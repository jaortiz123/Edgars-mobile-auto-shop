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

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor

# Import testcontainers - ignore IDE warnings, this works at runtime
from testcontainers.postgres import PostgresContainer

from local_server import app as flask_app

# Set up logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.fixture(scope="session")
def pg_container():
    """
    PostgreSQL container fixture for integration tests.
    Starts a containerized PostgreSQL instance, runs migrations, and loads seed data.
    """
    logger.info("🐘 Starting PostgreSQL container...")
    
    with PostgresContainer("postgres:15-alpine") as postgres:
        # Container is now running
        raw_db_url = postgres.get_connection_url()
        # Fix the URL scheme for psycopg2 compatibility
        db_url = raw_db_url.replace("postgresql+psycopg2://", "postgresql://")
        logger.info(f"📦 PostgreSQL started on port {postgres.get_exposed_port(5432)}")
        
        # Set environment variables for the Flask app and Alembic
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
            "FALLBACK_TO_MEMORY": "false"
        }
        
        # Set environment variables
        for key, value in env_vars.items():
            os.environ[key] = value
        
        # Wait a moment for container to be fully ready
        time.sleep(2)
        
        # Test connection
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
        
        # Create database schema directly from SQL file
        logger.info("🗃️ Creating database schema...")
        schema_file = Path(__file__).parent / "test_schema.sql"
        
        try:
            with open(schema_file, 'r') as f:
                schema_sql = f.read()
            
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                # Execute the schema SQL
                cur.execute(schema_sql)
            conn.close()
            
            logger.info("✅ Database schema created successfully")
            
        except Exception as e:
            logger.error(f"Failed to create schema: {e}")
            raise Exception(f"Schema creation failed: {e}")
        
        # Load seed data
        logger.info("🌱 Loading seed data...")
        seed_file = Path(__file__).parent / "seed.sql"
        
        try:
            with open(seed_file, 'r') as f:
                seed_sql = f.read()
            
            conn = psycopg2.connect(db_url)
            with conn:
                with conn.cursor() as cur:
                    cur.execute(seed_sql)
            conn.close()
            
            logger.info("✅ Seed data loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load seed data: {e}")
            raise Exception(f"Seed data loading failed: {e}")
        
        # Yield the container configuration for tests
        yield {
            "db_url": db_url,
            "container": postgres,
            "env_vars": env_vars
        }
        
        # Cleanup happens automatically when context manager exits
        logger.info("🧹 PostgreSQL container stopped and cleaned up")


@pytest.fixture()
def client(pg_container):  # depend on pg_container so env vars & DB are ready
    """Flask test client fixture using real Postgres (no in-memory fallback)."""
    flask_app.testing = True
    flask_app.config["PROPAGATE_EXCEPTIONS"] = False
    with flask_app.test_client() as c:
        yield c


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
            if hasattr(self, '_customer_history_empty'):
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
                            "created_at": datetime(2025, 7, 15, 10, 30, 0, tzinfo=timezone.utc)
                        }
                    ]
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