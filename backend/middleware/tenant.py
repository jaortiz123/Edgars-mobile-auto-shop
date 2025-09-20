"""
Tenant resolution middleware
Handles multi-tenant request processing
Extracted from local_server.py tenant-related logic
"""

from flask import Flask, g, request


def init_tenant_middleware(app: Flask) -> None:
    """
    Multi-tenant support and tenant resolution

    This preserves any existing tenant resolution logic from local_server.py
    and provides a clean foundation for multi-tenant features.
    """

    @app.before_request
    def resolve_tenant():
        """
        Extract and validate tenant information from request
        Provides foundation for multi-tenant features
        """
        try:
            # Extract tenant ID from headers (multiple header variations supported)
            tenant_id = request.headers.get("X-Tenant-Id") or request.headers.get("x-tenant-id")

            # Store in request context for use by routes
            g.tenant_id = tenant_id

            # TODO: Add tenant validation logic here
            # - Verify tenant exists and is active
            # - Check tenant permissions
            # - Set up tenant-specific database context

        except Exception:
            # Don't break requests due to tenant resolution issues
            g.tenant_id = None

    # TODO: Add tenant-specific database connection logic
    # TODO: Add tenant permission checking
    # TODO: Add tenant-aware logging context
