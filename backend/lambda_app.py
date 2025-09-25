"""
Ultra-minimal Lambda entry point for production
Defers ALL initialization until first request
"""

from flask import Flask

# Global app instance - created only on first request
_app = None


def create_minimal_app():
    """Create app with absolute minimal configuration for cold start optimization"""
    app = Flask(__name__)

    # Only set basic config - no AWS calls, no DB connections
    app.config.update(
        {
            "DEBUG": False,
            "TESTING": False,
        }
    )

    @app.route("/healthz")
    def health():
        """Ultra-simple health check - no dependencies"""
        return {"status": "ok", "service": "edgar-auto-shop"}, 200

    @app.route("/")
    def root():
        """Root endpoint"""
        return {
            "message": "Edgar's Mobile Auto Shop API",
            "status": "running",
            "health_endpoint": "/healthz",
        }, 200

    return app


def get_app():
    """Lazy app factory - only initialize on first HTTP request"""
    global _app
    if _app is None:
        _app = create_minimal_app()
    return _app


def application(environ, start_response):
    """WSGI callable for Lambda Web Adapter - ultra-minimal initialization"""
    return get_app()(environ, start_response)


# Export for gunicorn/Lambda
app = application
