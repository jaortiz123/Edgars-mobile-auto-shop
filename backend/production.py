"""
Production configuration for Edgar's Mobile Auto Shop
Handles AWS Secrets Manager, Aurora Serverless, and production logging
"""

import json
import logging
import os
import sys
from typing import Any, Dict

import boto3
import psycopg2.pool
from flask import Flask, current_app


class ProductionDatabaseManager:
    """Database manager that uses AWS Secrets Manager for credentials"""

    def __init__(self):
        self.pool = None
        self._credentials = None

    def init_app(self, app: Flask) -> None:
        """Initialize database with production configuration"""

        # Get database credentials from Secrets Manager
        credentials = self._get_database_credentials()

        # Create connection pool
        try:
            self.pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=5,  # Keep it small for Lambda
                host=credentials["host"],
                port=credentials["port"],
                database=credentials["dbname"],
                user=credentials["username"],
                password=credentials["password"],
                sslmode="require",
            )

            app.logger.info(
                f"Connected to Aurora Serverless: {credentials['host']}:{credentials['port']}"
            )

        except Exception as e:
            app.logger.error(f"Failed to connect to database: {e}")
            raise

        app.db = self

    def _get_database_credentials(self) -> Dict[str, Any]:
        """Get database credentials from AWS Secrets Manager"""

        if self._credentials:
            return self._credentials

        secret_name = os.getenv("SECRETS_MANAGER_NAME")
        if not secret_name:
            raise ValueError("SECRETS_MANAGER_NAME environment variable is required")

        try:
            session = boto3.Session()
            client = session.client("secretsmanager")

            response = client.get_secret_value(SecretId=secret_name)
            credentials = json.loads(response["SecretString"])

            self._credentials = credentials
            return credentials

        except Exception as e:
            current_app.logger.error(f"Failed to retrieve database credentials: {e}")
            raise

    def get_connection(self):
        """Get a connection from the pool"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
        return self.pool.getconn()

    def return_connection(self, conn):
        """Return a connection to the pool"""
        if self.pool and conn:
            self.pool.putconn(conn)

    def close_all_connections(self):
        """Close all connections in the pool"""
        if self.pool:
            self.pool.closeall()


def init_production_extensions(app: Flask) -> None:
    """
    Initialize Flask extensions for production deployment

    This includes:
    - Production logging with JSON format
    - AWS Secrets Manager integration
    - Aurora Serverless connection pooling
    - X-Ray tracing support
    """

    # Production logging with JSON format
    setup_production_logging(app)

    # CORS for production (more restrictive)
    from flask_cors import CORS

    allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    # Production database with Secrets Manager
    db = ProductionDatabaseManager()
    db.init_app(app)

    # Lightweight health check endpoint (no DB dependency)
    @app.route("/healthz")
    def health_check():
        """Lightweight health check for load balancers - no DB dependency"""
        return {
            "status": "ok",
            "service": "edgar-mobile-auto-shop",
            "version": os.getenv("GIT_SHA", "unknown"),
        }, 200

    # Full health check endpoint (with DB connectivity test)
    @app.route("/health/full")
    def full_health_check():
        """Full health check with database connectivity test"""
        try:
            # Test database connectivity
            conn = app.db.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            app.db.return_connection(conn)

            return {
                "status": "healthy",
                "database": "connected",
                "service": "edgar-mobile-auto-shop",
                "version": os.getenv("GIT_SHA", "unknown"),
            }, 200

        except Exception as e:
            app.logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "service": "edgar-mobile-auto-shop",
                "version": os.getenv("GIT_SHA", "unknown"),
            }, 503


def setup_production_logging(app: Flask) -> None:
    """Setup structured JSON logging for production"""

    # Remove default Flask handlers
    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    # Create structured logging handler
    handler = logging.StreamHandler(sys.stdout)

    # JSON formatter for CloudWatch Logs
    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "correlation_id": getattr(record, "correlation_id", None),
                "request_id": getattr(record, "request_id", None),
                "user_id": getattr(record, "user_id", None),
            }

            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)

            return json.dumps(log_data)

    formatter = JSONFormatter()
    handler.setFormatter(formatter)

    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)

    # Also configure root logger
    logging.root.addHandler(handler)
    logging.root.setLevel(logging.INFO)

    app.logger.info("Production logging configured")


# Lazy app creation for Lambda compatibility
_app = None


def get_app():
    """Lazy app factory for Lambda - only initialize on first request"""
    global _app
    if _app is None:
        from backend.app import create_prod_app

        _app = create_prod_app()
    return _app


# WSGI callable that creates app on first request
def application(environ, start_response):
    """WSGI application callable for Lambda Web Adapter"""
    return get_app()(environ, start_response)


# Alias for gunicorn/Lambda compatibility
app = application
