"""
FLASK APPLICATION FACTORY

This module implements the application factory pattern to fix Flask instantiation conflicts.
Separates Flask app creation from import time to allow testing security modules.

CRITICAL: This fixes DIRECTIVE 2 - Flask instantiation conflicts
"""

import os

from flask import Flask

# Import security helpers (use explicit namespace to satisfy linters)


def create_app(config=None):
    """
    Application factory function to create Flask app instance.

    Args:
        config: Optional configuration dictionary

    Returns:
        Configured Flask application instance
    """
    app = Flask(__name__)

    # Load configuration
    if config:
        app.config.update(config)
    else:
        # Default configuration
        app.config.update(
            {
                "SECRET_KEY": os.getenv("FLASK_SECRET_KEY", "dev-secret-key"),
                "DATABASE_URL": os.getenv("DATABASE_URL", "postgresql://localhost/autoshop"),
                "JWT_SECRET": os.getenv("JWT_SECRET", "dev_secret"),
                "DEBUG": os.getenv("FLASK_ENV") == "development",
            }
        )

    # Import and register blueprints after app creation
    # Import routes (commented out for now - needs actual route modules)
    # from backend.routes import (
    # Register blueprints (commented out - needs actual route modules)
    # app.register_blueprint(auth_bp, url_prefix='/api/auth')
    # app.register_blueprint(api_bp, url_prefix='/api')

    return app


def create_app_for_testing(database_url=None):
    """
    Create app instance specifically for testing.

    Args:
        database_url: Test database URL

    Returns:
        Flask app configured for testing
    """
    test_config = {
        "TESTING": True,
        "DATABASE_URL": database_url or "postgresql://localhost/test_autoshop",
        "JWT_SECRET": "test_secret",
        "WTF_CSRF_ENABLED": False,
    }

    return create_app(test_config)


# Only create app if running this module directly
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5001))
    # Enforce safe defaults: only allow debug and 0.0.0.0 in explicit development
    app_env = os.getenv("APP_ENV", "development").lower()
    is_dev = app_env in {"dev", "development", "local"}
    host = "0.0.0.0" if is_dev else "127.0.0.1"
    debug = bool(is_dev)
    app.run(host=host, port=port, debug=debug)
