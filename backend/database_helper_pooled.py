# Database Helper Migration to Connection Pooling
# Backward-compatible integration with existing codebase

"""
Enhanced Database Helper with Connection Pooling

This module provides a drop-in replacement for the existing database_helper.py
that integrates connection pooling while maintaining backward compatibility.

The module automatically detects if connection pooling is available and falls
back to the original connection-per-request pattern if needed.
"""

import logging
import os
from contextlib import contextmanager
from urllib.parse import urlparse

import psycopg2

# Try to import connection pooling, fall back if not available
try:
    from database_pool import (
        close_connection_pool,
        get_pool_stats,
        get_pooled_connection,
        initialize_connection_pool,
    )

    POOLING_AVAILABLE = True
except ImportError:
    POOLING_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Database configuration management"""

    @staticmethod
    def get_connection_params():
        """Get database connection parameters from environment"""
        database_url = os.getenv("DATABASE_URL")

        if database_url:
            # Parse DATABASE_URL
            result = urlparse(database_url)
            return {
                "host": result.hostname or "localhost",
                "port": result.port or 5432,
                "database": result.path[1:] if result.path else "autoshop",
                "user": result.username or "postgres",
                "password": result.password or "password",
            }
        else:
            # Use individual environment variables
            return {
                "host": os.getenv("POSTGRES_HOST", "localhost"),
                "port": int(os.getenv("POSTGRES_PORT", 5432)),
                "database": os.getenv("POSTGRES_DB", "autoshop"),
                "user": os.getenv("POSTGRES_USER", "postgres"),
                "password": os.getenv("POSTGRES_PASSWORD", "password"),
            }


@contextmanager
def get_db_connection():
    """
    Get database connection with automatic pooling if available

    This function maintains backward compatibility while providing
    performance benefits when connection pooling is configured.
    """
    if POOLING_AVAILABLE:
        # Use connection pool if available
        try:
            with get_pooled_connection() as conn:
                yield conn
            return
        except RuntimeError as e:
            if "not initialized" in str(e):
                # Pool not initialized, try to initialize it
                logger.info("Initializing connection pool...")
                params = DatabaseConfig.get_connection_params()
                try:
                    initialize_connection_pool(**params)
                    with get_pooled_connection() as conn:
                        yield conn
                    return
                except Exception as init_error:
                    logger.warning(
                        f"Failed to initialize pool: {init_error}, falling back to direct connection"
                    )
            else:
                raise

    # Fallback to original connection-per-request pattern
    conn = None
    try:
        params = DatabaseConfig.get_connection_params()
        logger.debug(
            f"Direct connection to: {params['user']}@{params['host']}:{params['port']}/{params['database']}"
        )

        conn = psycopg2.connect(**params)
        yield conn

    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        logger.error(f"Unexpected database error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


def get_database_status():
    """Get comprehensive database status including pool information"""
    status = {}

    # Test basic connection
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1, current_user, current_database(), version()")
            result = cursor.fetchone()

            status.update(
                {
                    "connection_status": "success",
                    "user": result[1],
                    "database": result[2],
                    "postgres_version": result[3].split()[1],
                    "message": "Database connection successful",
                }
            )

    except Exception as e:
        status.update(
            {"connection_status": "error", "error": str(e), "message": "Database connection failed"}
        )

    # Add pooling information
    if POOLING_AVAILABLE:
        status["pooling_enabled"] = True
        try:
            pool_stats = get_pool_stats()
            status["pool_stats"] = pool_stats
        except Exception as e:
            status["pool_error"] = str(e)
    else:
        status["pooling_enabled"] = False
        status["pool_message"] = "Connection pooling module not available"

    return status


def test_database_connection():
    """Test database connection and return status (backward compatibility)"""
    status = get_database_status()
    return {
        "status": status["connection_status"],
        "user": status.get("user"),
        "database": status.get("database"),
        "message": status["message"],
        "error": status.get("error"),
    }


def initialize_database_pool():
    """
    Initialize database connection pool if available

    This should be called once at application startup for optimal performance.
    """
    if not POOLING_AVAILABLE:
        logger.warning("Connection pooling not available")
        return False

    try:
        params = DatabaseConfig.get_connection_params()
        initialize_connection_pool(**params)
        logger.info("Database connection pool initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        return False


def shutdown_database_pool():
    """
    Shutdown database connection pool

    This should be called during application shutdown.
    """
    if POOLING_AVAILABLE:
        try:
            close_connection_pool()
            logger.info("Database connection pool shutdown successfully")
        except Exception as e:
            logger.error(f"Error shutting down database pool: {e}")


# Compatibility alias for existing code
db_conn = get_db_connection


if __name__ == "__main__":
    # Test the connection and display comprehensive status
    result = get_database_status()
    print("=== Database Status Report ===")
    for key, value in result.items():
        print(f"{key}: {value}")
