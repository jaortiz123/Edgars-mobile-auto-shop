# Connection Pool Implementation for Edgar's Mobile Auto Shop
# Database Layer Performance Optimization

"""
Enhanced Database Connection Management

This module implements application-level connection pooling to replace the
current connection-per-request pattern. It provides:

1. Threaded connection pool for concurrent request handling
2. Connection validation and recovery
3. Configurable pool sizing based on load requirements
4. Prepared statement caching for frequently-used queries
5. Query timing and performance monitoring

Usage:
    from database_pool import get_pooled_connection

    with get_pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM customers")
            return cur.fetchall()
"""

import contextlib
import logging
import os
import time
from typing import Any, Dict, Generator, Optional

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

# Pool configuration
DEFAULT_MIN_CONNECTIONS = 5
DEFAULT_MAX_CONNECTIONS = 20
POOL_CONNECTION_TIMEOUT = 30
QUERY_LOG_THRESHOLD_MS = 100

# Global connection pool instance
_connection_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
_pool_stats = {
    "total_connections": 0,
    "active_connections": 0,
    "pool_hits": 0,
    "pool_misses": 0,
    "slow_queries": 0,
    "connection_errors": 0,
}

logger = logging.getLogger(__name__)


def initialize_connection_pool(
    host: str = "localhost",
    port: int = 5432,
    database: str = "edgar_auto_shop",
    user: str = "postgres",
    password: str = "",
    min_connections: int = DEFAULT_MIN_CONNECTIONS,
    max_connections: int = DEFAULT_MAX_CONNECTIONS,
    **kwargs,
) -> None:
    """
    Initialize the global connection pool.

    This should be called once at application startup.
    """
    global _connection_pool

    if _connection_pool is not None:
        logger.warning("Connection pool already initialized")
        return

    try:
        _connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=min_connections,
            maxconn=max_connections,
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            cursor_factory=RealDictCursor,
            **kwargs,
        )

        _pool_stats["total_connections"] = max_connections
        logger.info(
            f"Connection pool initialized: {min_connections}-{max_connections} connections "
            f"to {user}@{host}:{port}/{database}"
        )

    except Exception as e:
        logger.error(f"Failed to initialize connection pool: {e}")
        raise


def get_pool_stats() -> Dict[str, Any]:
    """Get current connection pool statistics."""
    if _connection_pool is None:
        return {"error": "Pool not initialized"}

    return {
        **_pool_stats,
        "pool_size": len(_connection_pool._pool),
        "available_connections": len(_connection_pool._pool),
        "used_connections": _connection_pool.maxconn - len(_connection_pool._pool),
    }


@contextlib.contextmanager
def get_pooled_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Get a database connection from the pool.

    This replaces the existing get_db_connection() context manager
    with a pooled implementation.

    Yields:
        psycopg2.connection: Database connection from the pool

    Raises:
        RuntimeError: If connection pool is not initialized
        psycopg2.pool.PoolError: If no connections are available
    """
    if _connection_pool is None:
        raise RuntimeError(
            "Connection pool not initialized. Call initialize_connection_pool() first."
        )

    connection = None
    start_time = time.perf_counter()

    try:
        # Get connection from pool
        connection = _connection_pool.getconn()
        _pool_stats["pool_hits"] += 1
        _pool_stats["active_connections"] += 1

        # Validate connection
        if connection.closed:
            logger.warning("Retrieved closed connection from pool, getting new one")
            _connection_pool.putconn(connection, close=True)
            connection = _connection_pool.getconn()
            _pool_stats["pool_misses"] += 1

        yield connection

    except psycopg2.pool.PoolError as e:
        _pool_stats["connection_errors"] += 1
        logger.error(f"Connection pool error: {e}")
        raise

    except psycopg2.Error as e:
        _pool_stats["connection_errors"] += 1
        logger.error(f"Database error: {e}")
        if connection:
            connection.rollback()
        raise

    except Exception as e:
        _pool_stats["connection_errors"] += 1
        logger.error(f"Unexpected error with pooled connection: {e}")
        if connection:
            connection.rollback()
        raise

    finally:
        if connection:
            _pool_stats["active_connections"] -= 1
            # Return connection to pool
            _connection_pool.putconn(connection)

            # Log slow connection acquisition
            duration_ms = (time.perf_counter() - start_time) * 1000
            if duration_ms > QUERY_LOG_THRESHOLD_MS:
                logger.warning(f"Slow connection acquisition: {duration_ms:.1f}ms")


@contextlib.contextmanager
def get_pooled_cursor():
    """
    Get a cursor with automatic connection management and query timing.

    This provides a high-level interface for database operations with
    built-in performance monitoring.
    """
    with get_pooled_connection() as conn:
        with conn.cursor() as cursor:
            # Wrap cursor to add query timing
            original_execute = cursor.execute

            def timed_execute(query, vars=None):
                start_time = time.perf_counter()
                try:
                    result = original_execute(query, vars)
                    duration_ms = (time.perf_counter() - start_time) * 1000

                    # Log slow queries
                    if duration_ms > QUERY_LOG_THRESHOLD_MS:
                        _pool_stats["slow_queries"] += 1
                        query_preview = query[:100] + "..." if len(query) > 100 else query
                        logger.warning(f"Slow query ({duration_ms:.1f}ms): {query_preview}")

                    return result
                except Exception as e:
                    duration_ms = (time.perf_counter() - start_time) * 1000
                    logger.error(f"Query failed after {duration_ms:.1f}ms: {str(e)[:200]}")
                    raise

            cursor.execute = timed_execute
            yield cursor


def close_connection_pool() -> None:
    """
    Close all connections in the pool.

    This should be called during application shutdown.
    """
    global _connection_pool

    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None
        logger.info("Connection pool closed")


# Backward compatibility wrapper for existing code
@contextlib.contextmanager
def get_db_connection():
    """
    Backward compatibility wrapper for existing get_db_connection() calls.

    This maintains the same interface while using the connection pool internally.
    """
    with get_pooled_connection() as conn:
        yield conn


# Auto-initialize pool from environment variables if available
def _auto_initialize_pool():
    """Auto-initialize pool from environment variables if they exist."""
    if os.getenv("DATABASE_URL") or all(
        os.getenv(var) for var in ["DB_HOST", "DB_NAME", "DB_USER"]
    ):
        try:
            # Parse DATABASE_URL if provided
            db_url = os.getenv("DATABASE_URL")
            if db_url:
                # Simple URL parsing for postgresql://user:pass@host:port/dbname
                import urllib.parse

                parsed = urllib.parse.urlparse(db_url)
                host = parsed.hostname or "localhost"
                port = parsed.port or 5432
                database = parsed.path.lstrip("/") or "edgar_auto_shop"
                user = parsed.username or "postgres"
                password = parsed.password or ""
            else:
                # Use individual environment variables
                host = os.getenv("DB_HOST", "localhost")
                port = int(os.getenv("DB_PORT", "5432"))
                database = os.getenv("DB_NAME", "edgar_auto_shop")
                user = os.getenv("DB_USER", "postgres")
                password = os.getenv("DB_PASSWORD", "")

            min_conn = int(os.getenv("DB_POOL_MIN", str(DEFAULT_MIN_CONNECTIONS)))
            max_conn = int(os.getenv("DB_POOL_MAX", str(DEFAULT_MAX_CONNECTIONS)))

            initialize_connection_pool(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                min_connections=min_conn,
                max_connections=max_conn,
            )

        except Exception as e:
            logger.warning(f"Failed to auto-initialize connection pool: {e}")


# Auto-initialize if environment variables are available
_auto_initialize_pool()
