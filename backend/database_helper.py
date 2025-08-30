"""
Database connection helper with proper error handling and configuration.
Fixes production database connection issues.
"""

import logging
import os
from contextlib import contextmanager
from urllib.parse import urlparse

import psycopg2

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
    """Get database connection with proper error handling"""
    conn = None
    try:
        params = DatabaseConfig.get_connection_params()
        logger.info(
            f"Connecting to database: {params['user']}@{params['host']}:{params['port']}/{params['database']}"
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


def test_database_connection():
    """Test database connection and return status"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1, current_user, current_database()")
            result = cursor.fetchone()

            return {
                "status": "success",
                "user": result[1],
                "database": result[2],
                "message": "Database connection successful",
            }

    except Exception as e:
        return {"status": "error", "error": str(e), "message": "Database connection failed"}


if __name__ == "__main__":
    # Test the connection
    result = test_database_connection()
    print(f"Database connection test: {result}")
