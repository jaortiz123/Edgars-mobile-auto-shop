"""Flask app factory for Edgar's Mobile Auto Shop backend."""

from flask import Flask

from ..middleware.cors import register_cors_middleware
from ..middleware.request_meta import register_request_meta_middleware
from ..middleware.security_headers import register_security_headers_middleware
from ..middleware.tenant import register_tenant_middleware
from ..routes.health import health_bp


def create_app() -> Flask:
    """Create and configure Flask application instance."""
    app = Flask(__name__)

    # Register middleware in order (following local_server.py order):
    # 1. request_meta - request ID, timing, version headers
    register_request_meta_middleware(app)

    # 2. tenant - multi-tenant context resolution
    register_tenant_middleware(app)

    # 3. cors - CORS headers and preflight handling
    register_cors_middleware(app)

    # 4. security_headers - security headers (CSP, X-Frame-Options, etc.)
    register_security_headers_middleware(app)

    # Register blueprints
    app.register_blueprint(health_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=3001, debug=True)
