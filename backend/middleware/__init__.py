"""
Middleware initialization for Edgar's Mobile Auto Shop
Extracts all @app.before_request/@app.after_request hooks from monolith
"""

from flask import Flask


def init_middleware(app: Flask) -> None:
    """
    Install all middleware layers in correct order

    This replaces the scattered @app.before_request/@app.after_request hooks
    in local_server.py with an ordered, maintainable middleware pipeline.
    """

    # Install middleware in dependency order
    from .envelope import init_envelope_middleware
    from .idempotency import init_idempotency_middleware
    from .request_meta import init_request_meta
    from .tenant import init_tenant_middleware

    # 1. Request metadata (correlation ID, timing) - no dependencies
    init_request_meta(app)

    # 2. Envelope + error handling (JSON standardization) - depends on correlation ID
    init_envelope_middleware(app)

    # 3. Idempotency cache (for critical POST operations) - depends on envelope
    init_idempotency_middleware(app)

    # 4. Tenant resolution (multi-tenant support) - depends on request meta
    init_tenant_middleware(app)
