"""
Extensions initialization for Edgar's Mobile Auto Shop
Extracts CORS, database, and other Flask extensions from the monolith
"""

import json
import logging
import time
import traceback
import uuid
from datetime import datetime

from flask import Flask, g, request
from flask_cors import CORS


class DatabaseManager:
    def __init__(self):
        self.pool = None

    def init_app(self, app):
        # TODO: wire psycopg2 / SQLAlchemy according to existing env vars
        self.pool = object()
        app.db = self


def init_extensions(app: Flask) -> None:
    """
    Initialize Flask extensions

    This preserves the exact CORS and database behavior from local_server.py
    but in a clean, reusable module that eliminates import order issues.
    """

    # CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Structured logging setup
    setup_structured_logging(app)

    # DB
    db = DatabaseManager()
    db.init_app(app)
    app.db = db


def setup_structured_logging(app: Flask) -> None:
    """Setup structured JSON logging for CloudWatch"""

    # Configure JSON formatter for CloudWatch
    class CloudWatchJsonFormatter(logging.Formatter):
        def format(self, record):
            log_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": record.levelname,
                "message": record.getMessage(),
                "logger": record.name,
                "service": "edgar-auto-shop",
                "environment": app.config.get("ENV", "production"),
            }

            # Add request context if available
            if hasattr(g, "request_id"):
                log_entry["request_id"] = g.request_id

            if request:
                log_entry["request"] = {
                    "method": request.method,
                    "path": request.path,
                    "remote_addr": request.remote_addr,
                    "user_agent": request.headers.get("User-Agent", ""),
                }

            # Add exception info if present
            if record.exc_info:
                log_entry["exception"] = {
                    "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                    "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                    "traceback": traceback.format_exception(*record.exc_info),
                }

            return json.dumps(log_entry)

    # Set up root logger with JSON formatter
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    # Add CloudWatch-friendly handler
    handler = logging.StreamHandler()
    handler.setFormatter(CloudWatchJsonFormatter())
    logger.addHandler(handler)

    # Request logging middleware
    @app.before_request
    def before_request():
        g.request_id = str(uuid.uuid4())
        g.start_time = time.time()

        # Log incoming request
        app.logger.info(
            "Request started",
            extra={
                "event_type": "request_start",
                "request_id": g.request_id,
                "method": request.method,
                "path": request.path,
                "args": dict(request.args),
            },
        )

    @app.after_request
    def after_request(response):
        duration = time.time() - g.start_time

        # Log response
        app.logger.info(
            "Request completed",
            extra={
                "event_type": "request_end",
                "request_id": g.request_id,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            },
        )

        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Log unhandled exceptions
        app.logger.error(
            "Unhandled exception",
            exc_info=True,
            extra={
                "event_type": "unhandled_exception",
                "request_id": getattr(g, "request_id", None),
            },
        )

        return {"error": "Internal server error", "request_id": getattr(g, "request_id", None)}, 500
