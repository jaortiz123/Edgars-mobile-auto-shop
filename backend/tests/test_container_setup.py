#!/usr/bin/env python3
"""
Test script to verify the PostgreSQL container integration works correctly.
This script can be run independently to test the containerized database setup.
"""

import os
import sys
import subprocess
import time
import logging
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    try:
        from testcontainers.postgres import PostgresContainer  # type: ignore
    except Exception:  # pragma: no cover - optional dependency may be absent in minimal env
        PostgresContainer = None  # type: ignore
except ImportError as e:
    logger.error(f"Missing required dependency: {e}")
    logger.info("Run: pip install testcontainers psycopg2-binary")
    sys.exit(1)


def test_container_setup():
    """Test the PostgreSQL container setup end-to-end.

    IMPORTANT: This test previously mutated global environment variables (POSTGRES_* / DATABASE_URL)
    and left them pointing at a stopped ephemeral container after the context manager exited. That
    broke subsequent tests relying on the session‑scoped pg_container fixture (port mismatch / ECONNREFUSED).

    We now snapshot and restore any pre‑existing values so downstream tests continue using the
    original container started by the fixture.
    """
    logger.info("🧪 Testing PostgreSQL container setup...")
    preserved = {
        k: os.environ.get(k)
        for k in [
            "DATABASE_URL",
            "POSTGRES_HOST",
            "POSTGRES_PORT",
            "POSTGRES_DB",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
        ]
    }
    try:
        if PostgresContainer is None:
            logger.warning("testcontainers not available; skipping container setup test.")
            return True
        with PostgresContainer("postgres:15-alpine") as postgres:
            logger.info(f"✅ Container started on port {postgres.get_exposed_port(5432)}")

            db_url = postgres.get_connection_url()
            logger.info(f"📍 Database URL: {db_url}")
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
            }

            # Use a local copy for subprocess execution but avoid polluting global env beyond this test
            logger.info("🔗 Testing database connection (isolated env)...")
            conn = psycopg2.connect(db_url)
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                logger.info(f"✅ Connected to: {cur.fetchone()[0]}")
            conn.close()

            logger.info("🔄 Running Alembic migrations (isolated env)...")
            try:
                result = subprocess.run(
                    ["alembic", "upgrade", "head"],
                    cwd=backend_dir,
                    env={**os.environ, **env_vars},
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if result.returncode != 0:
                    logger.error(f"❌ Migration failed: {result.stderr}")
                    return False
            except subprocess.TimeoutExpired:
                logger.error("❌ Migration timed out")
                return False
            except FileNotFoundError:
                logger.error(
                    "❌ Alembic not found. Skipping migration execution in this test environment."
                )

            # Load seed data (isolated)
            seed_file = Path(__file__).parent / "seed.sql"
            if seed_file.exists():
                with open(seed_file, "r") as f:
                    seed_sql = f.read()
                conn = psycopg2.connect(db_url)
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(seed_sql)
                conn.close()
            else:
                logger.warning(f"Seed file not found: {seed_file}")

            # Basic verification (does not export env)
            conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM customers")
                logger.info(f"📊 Customers (ephemeral test DB): {cur.fetchone()['count']}")
            conn.close()
            logger.info("🎉 Container setup smoke test complete without side‑effects.")
            return True
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        return False
    finally:
        # Restore prior env so subsequent tests use the pg_container session fixture DB
        for k, v in preserved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


if __name__ == "__main__":
    success = test_container_setup()
    sys.exit(0 if success else 1)
