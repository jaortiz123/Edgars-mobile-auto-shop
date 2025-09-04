import os
import subprocess
import time
import logging
from pathlib import Path

# Add backend to sys.path so tests can import local modules without PYTHONPATH
import sys

tests_dir = Path(__file__).resolve().parent
backend_dir = tests_dir.parent
sys.path.insert(0, str(backend_dir))

# Set FALLBACK_TO_MEMORY before importing local_server for legacy tests
os.environ.setdefault("FALLBACK_TO_MEMORY", "true")
# Disable DB config caching in tests to avoid stale port/host when containers restart
os.environ.setdefault("DISABLE_DB_CONFIG_CACHE", "true")

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor

# Import testcontainers - ignore IDE warnings, this works at runtime
from testcontainers.postgres import PostgresContainer

# Do NOT import local_server here; we need DB env ready first. We import lazily in fixtures.

# Set up logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


_PG_SESSION = {"db_url": None, "container": None, "env_vars": None}


def _start_pg_container():
    """Start Postgres testcontainer, set env, run schema + seed. Idempotent."""
    if _PG_SESSION["container"] is not None:
        return
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
    try:
        if _PG_SESSION["container"] is not None:
            _PG_SESSION["container"].stop()
            logger.info("🧹 PostgreSQL container stopped and cleaned up")
    finally:
        _PG_SESSION.update({"db_url": None, "container": None, "env_vars": None})


def pytest_sessionstart(session):  # noqa: D401
    """Start DB container before test collection so module imports see correct env."""
    _start_pg_container()


def pytest_sessionfinish(session, exitstatus):  # noqa: D401
    """Cleanup the DB container at the end of the test session."""
    _stop_pg_container()


@pytest.fixture(scope="session")
def pg_container():
    """Provide session Postgres info started in pytest_sessionstart."""
    if _PG_SESSION["container"] is None:
        _start_pg_container()
    yield dict(_PG_SESSION)


@pytest.fixture()
def client(pg_container):  # depend on pg_container so env vars & DB are ready
    """Flask test client fixture using real Postgres (no in-memory fallback)."""
    import importlib
    import os
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
                "INSERT INTO tenants(id, slug, name, plan, status) VALUES (%s::uuid,%s,%s,'starter','active') ON CONFLICT DO NOTHING",
                (tid, f"t-{uuid.uuid4().hex[:6]}", "Test Tenant"),
            )
            cur.execute(
                "INSERT INTO staff_tenant_memberships(staff_id, tenant_id, role) VALUES ('owner', %s::uuid, 'Owner') ON CONFLICT DO NOTHING",
                (tid,),
            )

    # Issue a JWT directly to avoid hitting login in setup
    import jwt as _jwt
    import time as _time

    now_ts = int(_time.time())
    payload = {"sub": "owner", "role": "Owner", "iat": now_ts, "exp": now_ts + 8 * 3600}
    token = _jwt.encode(payload, srv.JWT_SECRET, algorithm=srv.JWT_ALG)
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    class AutoAuthClient(FlaskClient):
        def open(self, *args, **kwargs):  # type: ignore[override]
            headers = kwargs.setdefault("headers", {})
            headers.setdefault("Authorization", f"Bearer {token}")
            headers.setdefault("X-Tenant-Id", tid)
            return super().open(*args, **kwargs)

    # Apply the auto-auth client for all tests using this fixture
    prev_class = getattr(srv.app, "test_client_class", FlaskClient)
    try:
        srv.app.test_client_class = AutoAuthClient
        with srv.app.test_client() as c:
            yield c
    finally:
        srv.app.test_client_class = prev_class


@pytest.fixture()
def no_auto_auth_client(pg_container):
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
    prev_class = getattr(srv.app, "test_client_class", FlaskClient)
    try:
        srv.app.test_client_class = FlaskClient
        with srv.app.test_client() as c:
            yield c
    finally:
        srv.app.test_client_class = prev_class


# ----------------------------- RBAC helpers ---------------------------------
from typing import Optional


def _issue_token(role: str, sub: Optional[str] = None):
    import importlib, time, jwt  # type: ignore

    try:
        srv = importlib.import_module("backend.local_server")
    except Exception:
        srv = importlib.import_module("local_server")
    now_ts = int(time.time())
    if sub is None:
        if role == "Customer":
            sub = "1"
        else:
            sub = role.lower()
    payload = {"sub": sub, "role": role, "iat": now_ts, "exp": now_ts + 8 * 3600}
    tok = jwt.encode(payload, srv.JWT_SECRET, algorithm=srv.JWT_ALG)
    if isinstance(tok, bytes):
        tok = tok.decode("utf-8")
    return tok


@pytest.fixture()
def rbac_utils(pg_container):
    """Utility helpers for RBAC tests: token and header builders per-role.

    Provides:
      - token_for(role, sub?) -> str
      - headers_for(role, tenant_id, sub?) -> {Authorization, X-Tenant-Id}
    """

    def token_for(role: str, sub: Optional[str] = None) -> str:
        return _issue_token(role, sub)

    def headers_for(role: str, tenant_id: str, sub: Optional[str] = None) -> dict[str, str]:
        return {"Authorization": f"Bearer {token_for(role, sub)}", "X-Tenant-Id": tenant_id}

    return type(
        "RBAC", (), {"token_for": staticmethod(token_for), "headers_for": staticmethod(headers_for)}
    )


@pytest.fixture()
def db_connection(pg_container):
    """
    Database connection fixture that provides a real PostgreSQL connection
    with a compatibility cursor supporting both dict and index access.
    """
    db_url = pg_container["db_url"]
    from backend import db as _db

    conn = psycopg2.connect(db_url, cursor_factory=_db.CompatCursor)
    try:
        yield conn
    finally:
        conn.close()


# Legacy fixtures for backward compatibility with existing unit tests
class _FakeCursor:
    def __init__(self):
        self._q = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, sql, params=None):
        self._q = sql

    def fetchall(self):
        # Return different data based on the SQL query
        if self._q is None:
            return []

        # Customer history query - return appointment data
        if "FROM appointments a" in self._q and "LEFT JOIN payments p" in self._q:
            from datetime import datetime, timezone

            # Return different data based on test needs
            if hasattr(self, "_customer_history_empty"):
                return []
            return [
                {
                    "id": "apt-123",
                    "status": "COMPLETED",
                    "start": datetime(2025, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
                    "total_amount": 250.00,
                    "paid_amount": 250.00,
                    "appointment_created_at": datetime(2025, 7, 10, 9, 0, 0, tzinfo=timezone.utc),
                    "payments": [
                        {
                            "id": "pay-1",
                            "amount": 250.00,
                            "method": "cash",
                            "created_at": datetime(2025, 7, 15, 10, 30, 0, tzinfo=timezone.utc),
                        }
                    ],
                }
            ]

        # Dashboard stats query - return status counts
        if "COUNT(*)" in self._q and "GROUP BY status" in self._q:
            return [
                {"status": "SCHEDULED", "count": 3},
                {"status": "IN_PROGRESS", "count": 2},
                {"status": "READY", "count": 1},
                {"status": "COMPLETED", "count": 5},
                {"status": "NO_SHOW", "count": 0},
            ]

        # Default empty result
        return []

    def fetchone(self):
        # called by different queries; return numbers in sequence
        if self._q is None:
            return None

        # Customer lookup query - return customer data
        if "FROM customers WHERE id" in self._q:
            return {"id": "123", "name": "John Doe"}

        # cars_on_premises -> COUNT(*)
        if "check_in_at" in self._q:
            return [2]
        # jobs_today -> COUNT(*) WHERE start_ts::date = %s
        if ("scheduled_date = %s" in self._q) or ("start_ts::date = %s" in self._q):
            return [4]
        # unpaid total -> SUM(...)
        if "COALESCE(SUM" in self._q:
            return [1234.56]
        return [0]


class _FakeConn:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def cursor(self, *a, **k):
        return _FakeCursor()

    def close(self):
        pass


@pytest.fixture()
def fake_db(monkeypatch):
    """
    Legacy fake database fixture for unit tests that don't need real database behavior.
    This maintains backward compatibility with existing tests.
    """
    import local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: _FakeConn())
    # Signal to server code that tenant enforcement should be bypassed when using fake DB
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
