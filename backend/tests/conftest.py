"""
Refactored conftest.py - Hybrid Test Architecture
=================================================

This conftest supports TWO test modes:

1. UNIT TESTS (Fast, No Docker):
   - Use SQLite in-memory database
   - Run with: pytest -m unit
   - No external dependencies

2. INTEGRATION TESTS (Full Stack):
   - Use PostgreSQL containers
   - Run with: pytest -m integration
   - Requires Docker

Environment Variables:
- TEST_MODE=unit (default) | integration
- FORCE_UNIT_TESTS=true (bypass Docker entirely)
"""

import os
import subprocess
import time
import logging
import sqlite3
import tempfile
from pathlib import Path

# Add backend to sys.path so tests can import local modules without PYTHONPATH
import sys

tests_dir = Path(__file__).resolve().parent
backend_dir = tests_dir.parent
sys.path.insert(0, str(backend_dir))

# Determine test mode from environment or pytest markers
TEST_MODE = os.environ.get("TEST_MODE", "unit")
FORCE_UNIT_TESTS = os.environ.get("FORCE_UNIT_TESTS", "false").lower() == "true"

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor

# Only import testcontainers for integration tests
if TEST_MODE == "integration" and not FORCE_UNIT_TESTS:
    try:
        from testcontainers.postgres import PostgresContainer

        DOCKER_AVAILABLE = True
    except ImportError:
        DOCKER_AVAILABLE = False
        print("⚠️  testcontainers not available, falling back to unit test mode")
else:
    DOCKER_AVAILABLE = False

# Set up logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---- Make sqlite cursors context-manageable in unit tests ----
class _CursorProxy:
    def __init__(self, cur):
        self._cur = cur

    # allow normal cursor usage
    def __getattr__(self, name):
        return getattr(self._cur, name)

    # enable `with` support
    def __enter__(self):
        return self._cur

    def __exit__(self, exc_type, exc, tb):
        try:
            self._cur.close()
        except Exception:
            pass


class _CMConnection(sqlite3.Connection):
    def cursor(self, *args, **kwargs):
        cur = super().cursor(*args, **kwargs)
        return _CursorProxy(cur)


@pytest.fixture(autouse=True, scope="session")
def _sqlite_cursor_cm_patch():
    """
    Force sqlite3.connect(...) used in unit tests to return a connection whose
    cursor supports the context manager protocol. Does not affect Postgres.
    """
    orig_connect = sqlite3.connect

    def _connect(*args, **kwargs):
        kwargs.setdefault("factory", _CMConnection)
        # let test code pass a different factory if it wants
        return orig_connect(*args, **kwargs)

    sqlite3.connect = _connect
    try:
        yield
    finally:
        sqlite3.connect = orig_connect


# ---- Belt & suspenders already in your pipeline ----
# Ensure AWS region exists everywhere tests run
os.environ.setdefault("AWS_DEFAULT_REGION", "us-west-2")

# Set E2E bypass environment variables for all tests
os.environ["APP_INSTANCE_ID"] = "ci"
os.environ["SKIP_TENANT_ENFORCEMENT"] = "true"
os.environ["TESTING"] = "true"

# Global session state
_PG_SESSION = {"db_url": None, "container": None, "env_vars": None}
_SQLITE_SESSION = {"db_path": None, "connection": None}


# Pytest markers
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests (SQLite, no Docker)")
    config.addinivalue_line(
        "markers", "integration: Integration tests (PostgreSQL, requires Docker)"
    )
    config.addinivalue_line("markers", "slow: Slow tests (typically integration)")


def pytest_collection_modifyitems(config, items):
    """Auto-assign markers based on test names and current mode."""
    for item in items:
        # Auto-mark tests based on naming conventions
        path_str = str(item.fspath)

        if "tests/api/" in path_str or "tests/domain/" in path_str:
            item.add_marker(pytest.mark.integration)
            item.add_marker(pytest.mark.slow)
        elif "integration" in item.nodeid or "e2e" in item.nodeid:
            item.add_marker(pytest.mark.integration)
            item.add_marker(pytest.mark.slow)
        elif "unit" in item.nodeid or not any(
            marker.name in ["integration", "unit"] for marker in item.iter_markers()
        ):
            # Default to unit tests if no marker specified
            item.add_marker(pytest.mark.unit)

    # Filter tests based on current test mode
    if TEST_MODE == "unit" or FORCE_UNIT_TESTS:
        skip_integration = pytest.mark.skip(reason="Integration tests disabled in unit test mode")
        for item in items:
            if "integration" in [marker.name for marker in item.iter_markers()]:
                item.add_marker(skip_integration)
    elif TEST_MODE == "integration":
        skip_unit = pytest.mark.skip(reason="Unit tests disabled in integration test mode")
        for item in items:
            if "unit" in [marker.name for marker in item.iter_markers()]:
                item.add_marker(skip_unit)


def _setup_sqlite_database():
    """Create SQLite in-memory database with minimal schema for unit tests."""
    if _SQLITE_SESSION["connection"] is not None:
        return

    logger.info("🗃️  Setting up SQLite in-memory database for unit tests...")

    # Create temporary SQLite database
    temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = temp_file.name
    temp_file.close()

    # Set environment variables for SQLite mode
    sqlite_url = f"sqlite:///{db_path}"
    env_vars = {
        "DATABASE_URL": sqlite_url,
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "test_db",
        "POSTGRES_USER": "test_user",
        "POSTGRES_PASSWORD": "test_pass",
        "FALLBACK_TO_MEMORY": "true",
        "DISABLE_DB_CONFIG_CACHE": "true",
        "TESTING": "true",
        "APP_INSTANCE_ID": "ci",
        "SKIP_TENANT_ENFORCEMENT": "true",
    }

    for k, v in env_vars.items():
        os.environ[k] = v

    # Create minimal schema for testing
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            service TEXT,
            start_ts TEXT,
            status TEXT DEFAULT 'scheduled',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
    """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicles (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            make TEXT,
            model TEXT,
            year INTEGER,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
    """
    )

    # Insert minimal test data
    conn.execute(
        """
        INSERT OR IGNORE INTO customers (id, name, phone, email)
        VALUES ('test-customer-1', 'Test Customer', '555-1234', 'test@example.com')
    """
    )

    conn.execute(
        """
        INSERT OR IGNORE INTO appointments (id, customer_id, service, start_ts, status)
        VALUES ('test-appointment-1', 'test-customer-1', 'Oil Change', '2024-01-15T09:00:00Z', 'scheduled')
    """
    )

    conn.commit()
    conn.close()

    _SQLITE_SESSION.update({"db_path": db_path, "connection": sqlite_url})
    logger.info("✅ SQLite database ready for unit tests")


def _cleanup_sqlite_database():
    """Clean up SQLite database."""
    if _SQLITE_SESSION["db_path"]:
        try:
            os.unlink(_SQLITE_SESSION["db_path"])
            logger.info("🧹 SQLite database cleaned up")
        except OSError:
            pass
        finally:
            _SQLITE_SESSION.update({"db_path": None, "connection": None})


def _start_pg_container():
    """Start Postgres testcontainer, set env, run schema + seed. Idempotent."""
    if _PG_SESSION["container"] is not None:
        return

    if not DOCKER_AVAILABLE:
        raise RuntimeError("Docker/testcontainers not available for integration tests")

    logger.info("🐘 Starting PostgreSQL container (session)...")

    # Reset any cached DB connection config from prior runs in same process
    try:
        import importlib

        srv = importlib.import_module("backend.local_server")
        if hasattr(srv, "_DB_CONN_CONFIG_CACHE"):
            srv._DB_CONN_CONFIG_CACHE = None  # type: ignore
    except Exception:
        try:
            import local_server as _srv

            if hasattr(_srv, "_DB_CONN_CONFIG_CACHE"):
                _srv._DB_CONN_CONFIG_CACHE = None  # type: ignore
        except Exception:
            pass

    postgres = PostgresContainer("postgres:15-alpine")
    postgres.start()
    raw_db_url = postgres.get_connection_url()
    db_url = raw_db_url.replace("postgresql+psycopg2://", "postgresql://")
    logger.info(f"📦 PostgreSQL started on port {postgres.get_exposed_port(5432)}")

    # Derive discrete env vars
    postgres_url_parts = db_url.replace("postgresql://", "").split("@")
    user_pass = postgres_url_parts[0].split(":")
    host_port_db = postgres_url_parts[1].split("/")
    host_port = host_port_db[0].split(":")

    env_vars = {
        "DATABASE_URL": db_url,
        "POSTGRES_HOST": host_port[0],
        "POSTGRES_PORT": host_port[1],
        "POSTGRES_DB": host_port_db[1],
        "POSTGRES_USER": user_pass[0],
        "POSTGRES_PASSWORD": user_pass[1],
        "FALLBACK_TO_MEMORY": "false",
        "TESTING": "true",
        "APP_INSTANCE_ID": "ci",
        "SKIP_TENANT_ENFORCEMENT": "true",
    }
    for k, v in env_vars.items():
        os.environ[k] = v

    # Wait for readiness + verify connection
    time.sleep(1)
    max_retries = 30
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(db_url)
            conn.close()
            logger.info("✅ Database connection test successful")
            break
        except Exception as e:
            if i == max_retries - 1:
                raise Exception(f"Failed to connect to database after {max_retries} retries: {e}")
            time.sleep(1)

    # Apply schema
    logger.info("🗃️ Creating database schema...")
    schema_file = Path(__file__).parent / "test_schema.sql"
    if schema_file.exists():
        with open(schema_file, "r") as f:
            schema_sql = f.read()
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.close()
        logger.info("✅ Database schema created successfully")

    # Seed data
    logger.info("🌱 Loading seed data...")
    seed_file = Path(__file__).parent / "seed.sql"
    if seed_file.exists():
        with open(seed_file, "r") as f:
            seed_sql = f.read()
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(seed_sql)
        conn.close()
        logger.info("✅ Seed data loaded successfully")

    _PG_SESSION.update({"db_url": db_url, "container": postgres, "env_vars": env_vars})


def _stop_pg_container():
    """Stop and cleanup PostgreSQL container."""
    try:
        if _PG_SESSION["container"] is not None:
            _PG_SESSION["container"].stop()
            logger.info("🧹 PostgreSQL container stopped and cleaned up")
    finally:
        _PG_SESSION.update({"db_url": None, "container": None, "env_vars": None})


def pytest_sessionstart(session):
    """Start appropriate database based on test mode."""
    if TEST_MODE == "unit" or FORCE_UNIT_TESTS:
        _setup_sqlite_database()
    elif TEST_MODE == "integration" and DOCKER_AVAILABLE:
        _start_pg_container()
    else:
        logger.warning("⚠️  No database setup - running in minimal mode")


def pytest_sessionfinish(session, exitstatus):
    """Cleanup databases at the end of the test session."""
    _cleanup_sqlite_database()
    _stop_pg_container()


# FIXTURES
# ========


@pytest.fixture(scope="session")
def database_session():
    """Provide database connection info based on test mode."""
    if TEST_MODE == "unit" or FORCE_UNIT_TESTS:
        if _SQLITE_SESSION["connection"] is None:
            _setup_sqlite_database()
        return {"type": "sqlite", "url": _SQLITE_SESSION["connection"], "mode": "unit"}
    elif TEST_MODE == "integration":
        if _PG_SESSION["container"] is None:
            _start_pg_container()
        return {"type": "postgresql", "url": _PG_SESSION["db_url"], "mode": "integration"}
    else:
        return {"type": "mock", "url": None, "mode": "minimal"}


@pytest.fixture()
def db_connection(database_session):
    """Provide database connection for individual tests."""
    db_info = database_session
    if db_info["type"] == "sqlite":
        import sqlite3

        conn = sqlite3.connect(db_info["url"].replace("sqlite:///", ""))
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        yield conn
        conn.close()
    elif db_info["type"] == "postgresql":
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(db_info["url"])
        yield conn
        conn.close()
    else:
        # Mock connection for minimal tests
        yield {"mock": True}


@pytest.fixture()
def unit_client(database_session):
    """Flask test client for unit tests (SQLite backend)."""
    if database_session["mode"] != "unit":
        pytest.skip("unit_client only available in unit test mode")

    import importlib
    from flask.testing import FlaskClient

    try:
        srv = importlib.import_module("backend.local_server")
    except Exception:
        srv = importlib.import_module("local_server")

    srv.app.testing = True
    srv.app.config["PROPAGATE_EXCEPTIONS"] = True
    srv.app.config["TESTING"] = True

    # Set up authenticated test client for unit tests
    class AuthenticatedTestClient(FlaskClient):
        def open(self, *args, **kwargs):
            # If no headers provided at all, don't add any (test wants no auth)
            if "headers" not in kwargs:
                kwargs["headers"] = {}
                # Generate proper JWT token for E2E bypass
                import jwt

                payload = {"sub": "test-user-e2e", "role": "Owner"}
                jwt_secret = os.getenv("JWT_SECRET", "dev_secret")
                token = jwt.encode(payload, jwt_secret, algorithm="HS256")
                kwargs["headers"]["Authorization"] = f"Bearer {token}"
                kwargs["headers"]["X-Tenant-Id"] = "00000000-0000-0000-0000-000000000001"
            else:
                # Headers were provided - only add defaults if specific ones missing
                if "Authorization" not in kwargs["headers"]:
                    # Generate proper JWT token for E2E bypass
                    import jwt

                    payload = {"sub": "test-user-e2e", "role": "Owner"}
                    jwt_secret = os.getenv("JWT_SECRET", "dev_secret")
                    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
                    kwargs["headers"]["Authorization"] = f"Bearer {token}"
                # Only add default tenant if not already provided
                if "X-Tenant-Id" not in kwargs["headers"]:
                    kwargs["headers"]["X-Tenant-Id"] = "00000000-0000-0000-0000-000000000001"
            return super().open(*args, **kwargs)

    # Set environment for E2E bypass in unit tests
    original_app_instance_id = os.environ.get("APP_INSTANCE_ID")
    original_skip_tenant = os.environ.get("SKIP_TENANT_ENFORCEMENT")
    os.environ["APP_INSTANCE_ID"] = "ci"
    os.environ["SKIP_TENANT_ENFORCEMENT"] = "true"

    srv.app.test_client_class = AuthenticatedTestClient
    try:
        with srv.app.test_client() as client:
            yield client
    finally:
        # Restore original environment
        if original_app_instance_id is None:
            os.environ.pop("APP_INSTANCE_ID", None)
        else:
            os.environ["APP_INSTANCE_ID"] = original_app_instance_id
        if original_skip_tenant is None:
            os.environ.pop("SKIP_TENANT_ENFORCEMENT", None)
        else:
            os.environ["SKIP_TENANT_ENFORCEMENT"] = original_skip_tenant


@pytest.fixture()
def no_auto_auth_client():
    """Raw Flask client with no default Authorization or X-Tenant-Id headers.

    Use this when a test must control authentication/headers explicitly.
    """
    import importlib
    from flask.testing import FlaskClient

    try:
        srv = importlib.import_module("backend.local_server")
    except Exception:
        srv = importlib.import_module("local_server")

    srv.app.testing = True
    srv.app.config["PROPAGATE_EXCEPTIONS"] = True
    srv.app.config["TESTING"] = True

    # Set environment for E2E bypass in unit tests
    original_app_instance_id = os.environ.get("APP_INSTANCE_ID")
    original_skip_tenant = os.environ.get("SKIP_TENANT_ENFORCEMENT")
    os.environ["APP_INSTANCE_ID"] = "ci"
    os.environ["SKIP_TENANT_ENFORCEMENT"] = "true"

    # Use regular FlaskClient without any authentication headers
    prev_class = getattr(srv.app, "test_client_class", FlaskClient)
    srv.app.test_client_class = FlaskClient
    try:
        with srv.app.test_client() as client:
            yield client
    finally:
        srv.app.test_client_class = prev_class
        # Restore original environment
        if original_app_instance_id is None:
            os.environ.pop("APP_INSTANCE_ID", None)
        else:
            os.environ["APP_INSTANCE_ID"] = original_app_instance_id
        if original_skip_tenant is None:
            os.environ.pop("SKIP_TENANT_ENFORCEMENT", None)
        else:
            os.environ["SKIP_TENANT_ENFORCEMENT"] = original_skip_tenant


@pytest.fixture()
def integration_client(database_session):
    """Flask test client for integration tests (PostgreSQL backend)."""
    if database_session["mode"] != "integration":
        pytest.skip("integration_client only available in integration test mode")

    import importlib
    import uuid
    import psycopg2
    from flask.testing import FlaskClient

    try:
        srv = importlib.import_module("backend.local_server")
    except Exception:
        srv = importlib.import_module("local_server")
    srv.app.testing = True
    srv.app.config["PROPAGATE_EXCEPTIONS"] = True

    # Create a tenant + Owner membership, then login to get a token
    dsn = os.environ.get("DATABASE_URL")
    tid = str(uuid.uuid4())
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO tenants (id, name, timezone, address, created_at) VALUES (%s, %s, %s, %s, NOW())",
                (tid, f"Test Tenant {tid[:8]}", "America/New_York", "123 Test St"),
            )
            cur.execute(
                "INSERT INTO memberships (tenant_id, email, role, is_active, created_at) VALUES (%s, %s, %s, %s, NOW())",
                (tid, "test@example.com", "Owner", True),
            )
            cur.execute(
                "INSERT INTO auth_tokens (id, tenant_id, email, expires_at, created_at) VALUES (%s, %s, %s, NOW() + INTERVAL '1 hour', NOW())",
                (f"token-{tid}", tid, "test@example.com"),
            )

    class AuthenticatedTestClient(FlaskClient):
        def open(self, *args, **kwargs):
            if "headers" not in kwargs:
                kwargs["headers"] = {}
            kwargs["headers"]["Authorization"] = f"Bearer token-{tid}"
            kwargs["headers"]["X-Tenant-Id"] = tid
            return super().open(*args, **kwargs)

    srv.app.test_client_class = AuthenticatedTestClient
    with srv.app.test_client() as client:
        client.tenant_id = tid
        yield client


# Legacy compatibility - automatically choose appropriate client
@pytest.fixture()
def client(database_session):
    """Auto-select appropriate client based on test mode."""
    if database_session["mode"] == "unit":
        import importlib
        from flask.testing import FlaskClient

        try:
            srv = importlib.import_module("backend.local_server")
        except Exception:
            srv = importlib.import_module("local_server")

        srv.app.testing = True
        srv.app.config["PROPAGATE_EXCEPTIONS"] = True
        srv.app.config["TESTING"] = True

        # Set up authenticated test client for unit tests
        class AuthenticatedTestClient(FlaskClient):
            def open(self, *args, **kwargs):
                if "headers" not in kwargs:
                    kwargs["headers"] = {}
                # Only add default auth if not already provided
                if "Authorization" not in kwargs["headers"]:
                    # Generate proper JWT token for E2E bypass
                    import jwt

                    payload = {"sub": "test-user-e2e", "role": "Owner"}
                    jwt_secret = os.getenv("JWT_SECRET", "dev_secret")
                    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
                    kwargs["headers"]["Authorization"] = f"Bearer {token}"
                # Only add default tenant if not already provided
                if "X-Tenant-Id" not in kwargs["headers"]:
                    kwargs["headers"]["X-Tenant-Id"] = "00000000-0000-0000-0000-000000000001"
                return super().open(*args, **kwargs)

        # Set environment for E2E bypass in unit tests
        original_app_instance_id = os.environ.get("APP_INSTANCE_ID")
        original_skip_tenant = os.environ.get("SKIP_TENANT_ENFORCEMENT")
        os.environ["APP_INSTANCE_ID"] = "ci"
        os.environ["SKIP_TENANT_ENFORCEMENT"] = "true"

        srv.app.test_client_class = AuthenticatedTestClient
        try:
            with srv.app.test_client() as client:
                yield client
        finally:
            # Restore original environment
            if original_app_instance_id is None:
                os.environ.pop("APP_INSTANCE_ID", None)
            else:
                os.environ["APP_INSTANCE_ID"] = original_app_instance_id
            if original_skip_tenant is None:
                os.environ.pop("SKIP_TENANT_ENFORCEMENT", None)
            else:
                os.environ["SKIP_TENANT_ENFORCEMENT"] = original_skip_tenant
    else:
        # Use integration client for backwards compatibility
        import importlib
        import uuid
        import psycopg2
        from flask.testing import FlaskClient

        try:
            srv = importlib.import_module("backend.local_server")
        except Exception:
            srv = importlib.import_module("local_server")
        srv.app.testing = True
        srv.app.config["PROPAGATE_EXCEPTIONS"] = True

        # Create a tenant + Owner membership, then login to get a token
        dsn = os.environ.get("DATABASE_URL")
        tid = str(uuid.uuid4())

        if dsn and "postgresql://" in dsn:
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO tenants (id, name, timezone, address, created_at) VALUES (%s, %s, %s, %s, NOW())",
                        (tid, f"Test Tenant {tid[:8]}", "America/New_York", "123 Test St"),
                    )
                    cur.execute(
                        "INSERT INTO memberships (tenant_id, email, role, is_active, created_at) VALUES (%s, %s, %s, %s, NOW())",
                        (tid, "test@example.com", "Owner", True),
                    )
                    cur.execute(
                        "INSERT INTO auth_tokens (id, tenant_id, email, expires_at, created_at) VALUES (%s, %s, %s, NOW() + INTERVAL '1 hour', NOW())",
                        (f"token-{tid}", tid, "test@example.com"),
                    )

            class AuthenticatedTestClient(FlaskClient):
                def open(self, *args, **kwargs):
                    if "headers" not in kwargs:
                        kwargs["headers"] = {}
                    kwargs["headers"]["Authorization"] = f"Bearer token-{tid}"
                    kwargs["headers"]["X-Tenant-Id"] = tid
                    return super().open(*args, **kwargs)

            srv.app.test_client_class = AuthenticatedTestClient

        with srv.app.test_client() as client:
            if dsn and "postgresql://" in dsn:
                client.tenant_id = tid
            yield client
