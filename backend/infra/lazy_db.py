"""
Lazy database initialization for Lambda
Uses Secrets Manager through VPC endpoint with timeout safeguards
"""

import json
import logging
import os
import time
from typing import Any, Dict, Optional

import boto3

# Try pg8000 first (pure Python), fall back to psycopg2
try:
    import pg8000

    USE_PG8000 = True
    logger = logging.getLogger(__name__)
    logger.info("Using pg8000 (pure Python) PostgreSQL driver")
except ImportError:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    USE_PG8000 = False
    logger = logging.getLogger(__name__)
    logger.info("Using psycopg2 PostgreSQL driver")

logger = logging.getLogger(__name__)

# Global singleton database pool
_db_pool: Optional["LazyDatabaseManager"] = None


class LazyDatabaseManager:
    """
    Lazy-initialized database manager with Secrets Manager integration
    Thread-safe singleton pattern for Lambda environment
    """

    def __init__(self):
        self.connection_string: Optional[str] = None
        self.max_retries = 3
        self.retry_delay = 0.5
        self.connect_timeout = 3
        self._initialized = False
        self._secrets_client: Optional[boto3.client] = None

    def _get_secrets_client(self) -> boto3.client:
        """Get or create Secrets Manager client"""
        if self._secrets_client is None:
            self._secrets_client = boto3.client(
                "secretsmanager", region_name=os.getenv("AWS_REGION", "us-west-2")
            )
        return self._secrets_client

    def _fetch_db_credentials(self) -> Dict[str, str]:
        """Fetch database credentials from Secrets Manager"""
        secret_name = os.getenv("SECRETS_MANAGER_NAME")
        if not secret_name:
            raise RuntimeError("SECRETS_MANAGER_NAME environment variable not set")

        try:
            logger.info(f"Fetching credentials from Secrets Manager: {secret_name}")
            start_time = time.time()

            client = self._get_secrets_client()
            response = client.get_secret_value(SecretId=secret_name)

            fetch_time = time.time() - start_time
            logger.info(f"Secrets Manager fetch completed in {fetch_time:.3f}s")

            secret_data = json.loads(response["SecretString"])

            # Validate required fields
            required_fields = ["host", "port", "dbname", "username", "password"]
            for field in required_fields:
                if field not in secret_data:
                    raise ValueError(f"Missing required field '{field}' in secret")

            return secret_data

        except Exception as e:
            logger.error(f"Failed to fetch credentials from Secrets Manager: {e}")
            raise

    def _build_connection_params(self, credentials: Dict[str, str]) -> Dict[str, Any]:
        """Build PostgreSQL connection parameters from credentials"""
        if USE_PG8000:
            return {
                "host": credentials["host"],
                "port": int(credentials["port"]),
                "database": credentials["dbname"],
                "user": credentials["username"],
                "password": credentials["password"],
                "ssl_context": True,
                "timeout": self.connect_timeout,
            }
        else:
            # psycopg2 connection string
            return {
                "connection_string": (
                    f"host={credentials['host']} "
                    f"port={credentials['port']} "
                    f"dbname={credentials['dbname']} "
                    f"user={credentials['username']} "
                    f"password={credentials['password']} "
                    f"sslmode=prefer "
                    f"connect_timeout={self.connect_timeout}"
                )
            }

    def _initialize_once(self):
        """Initialize database connection (called once per Lambda container)"""
        if self._initialized:
            return

        logger.info("Initializing database connection...")
        start_time = time.time()

        try:
            # Fetch credentials from Secrets Manager
            credentials = self._fetch_db_credentials()

            # Build connection parameters
            self.connection_params = self._build_connection_params(credentials)

            # Test connection
            test_conn = self._get_raw_connection()
            test_conn.close()

            init_time = time.time() - start_time
            logger.info(
                f"Database initialization completed in {init_time:.3f}s using {'pg8000' if USE_PG8000 else 'psycopg2'}"
            )

            self._initialized = True

        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise RuntimeError(f"Database initialization failed: {e}")

    def _get_raw_connection(self):
        """Get a raw database connection with retry logic"""
        if not hasattr(self, "connection_params"):
            raise RuntimeError("Database not initialized - call _initialize_once() first")

        for attempt in range(self.max_retries):
            try:
                if USE_PG8000:
                    conn = pg8000.connect(**self.connection_params)
                else:
                    conn = psycopg2.connect(self.connection_params["connection_string"])
                return conn
            except Exception as e:
                if attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2**attempt)  # exponential backoff
                    logger.warning(
                        f"Connection attempt {attempt + 1} failed, retrying in {wait_time}s: {e}"
                    )
                    time.sleep(wait_time)
                    continue
                logger.error(f"All connection attempts failed: {e}")
                raise

    def get_connection(self):
        """Get database connection (lazy initialization on first call)"""
        self._initialize_once()
        return self._get_raw_connection()

    def query(self, sql: str, params: tuple = ()) -> list:
        """Execute query and return all rows as list of dicts"""
        with self.get_connection() as conn:
            if USE_PG8000:
                cur = conn.cursor()
                cur.execute(sql, params)
                # Commit for INSERT/UPDATE/DELETE operations
                if sql.strip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
                    conn.commit()
                # Only try to fetch if there are results (SELECT statements)
                if hasattr(cur, "description") and cur.description:
                    rows = cur.fetchall()
                    if rows:
                        columns = [desc[0] for desc in cur.description]
                        return [dict(zip(columns, row)) for row in rows]
                return []
            else:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    return [dict(row) for row in rows] if rows else []

    def one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """Execute query and return single row as dict"""
        with self.get_connection() as conn:
            if USE_PG8000:
                cur = conn.cursor()
                cur.execute(sql, params)
                # Commit for INSERT/UPDATE/DELETE operations
                if sql.strip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
                    conn.commit()
                row = cur.fetchone()
                if row and hasattr(cur, "description"):
                    columns = [desc[0] for desc in cur.description]
                    return dict(zip(columns, row))
                return None
            else:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, params)
                    # Commit for INSERT/UPDATE/DELETE operations
                    if sql.strip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
                        conn.commit()
                    row = cur.fetchone()
                    return dict(row) if row else None


def get_db_manager() -> LazyDatabaseManager:
    """Get the global database manager instance (singleton)"""
    global _db_pool
    if _db_pool is None:
        _db_pool = LazyDatabaseManager()
    return _db_pool


# Convenience functions for direct usage
def get_connection():
    """Get database connection via global manager"""
    return get_db_manager().get_connection()


def query(sql: str, params: tuple = ()) -> list:
    """Execute query via global manager"""
    return get_db_manager().query(sql, params)


def one(sql: str, params: tuple = ()) -> Optional[dict]:
    """Execute single-row query via global manager"""
    return get_db_manager().one(sql, params)
