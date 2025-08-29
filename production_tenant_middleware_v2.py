# production_tenant_middleware.py
# Enforces tenant context per-request and sets Postgres GUC `app.tenant_id` using SET LOCAL.

from __future__ import annotations

import logging
import os
from typing import Optional

from flask import Flask, abort, g, jsonify, request
from sqlalchemy import text
from werkzeug.middleware.proxy_fix import ProxyFix

# assuming your app factory pattern; adapt imports accordingly
# from app.extensions import db  # SQLAlchemy() instance

REQUIRED_HEADER = os.getenv("TENANT_HEADER", "X-Tenant-Id")
logger = logging.getLogger(__name__)


class TenantSecurityError(Exception):
    """Raised when tenant security requirements are not met"""

    pass


def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    @app.before_request
    def _enforce_tenant_and_set_guc():
        """Enforce tenant context and set database GUC - fail-closed security"""

        # Skip security for health checks and static assets
        if request.path in ["/health", "/health/tenant-security", "/static"]:
            return

        # Extract tenant from multiple sources (prioritized)
        tenant_id = _extract_tenant_id()

        if not tenant_id:
            logger.warning(
                f"Missing tenant context for {request.method} {request.path} from {request.remote_addr}"
            )
            abort(400, description="missing tenant context")

        # Validate tenant ID format (basic UUID validation)
        if not _is_valid_tenant_id(tenant_id):
            logger.warning(f"Invalid tenant ID format: {tenant_id}")
            abort(400, description="invalid tenant identifier")

        g.tenant_id = tenant_id

        # Fail-closed: set per-transaction; RLS denies if not set
        try:
            # Assuming db is available - adapt to your SQLAlchemy setup
            from app.extensions import db

            db.session.execute(text("SET LOCAL app.tenant_id = :tenant"), {"tenant": tenant_id})
            logger.debug(f"Set tenant context: {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to set tenant context: {e}")
            abort(500, description="tenant security failure")

    def _extract_tenant_id() -> Optional[str]:
        """Extract tenant ID from various sources with fallback priority"""

        # Priority 1: Header (most common for API requests)
        tenant_id = request.headers.get(REQUIRED_HEADER)
        if tenant_id:
            return tenant_id.strip()

        # Priority 2: Subdomain (e.g., tenant1.example.com)
        if request.host and "." in request.host:
            subdomain = request.host.split(".")[0]
            if subdomain and subdomain != "www":
                return subdomain

        # Priority 3: URL path parameter (e.g., /tenant/abc123/dashboard)
        if request.view_args and "tenant_id" in request.view_args:
            return request.view_args["tenant_id"]

        # Priority 4: Query parameter (least secure, use carefully)
        tenant_id = request.args.get("tenant_id")
        if tenant_id:
            return tenant_id.strip()

        return None

    def _is_valid_tenant_id(tenant_id: str) -> bool:
        """Basic validation for tenant ID format"""
        if not tenant_id or len(tenant_id) < 3:
            return False

        # Allow UUID format (with or without dashes) or alphanumeric
        import re

        uuid_pattern = r"^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$"
        alphanum_pattern = r"^[a-zA-Z0-9_-]+$"

        return bool(
            re.match(uuid_pattern, tenant_id, re.IGNORECASE)
            or re.match(alphanum_pattern, tenant_id)
        )

    @app.after_request
    def _propagate_security_headers(resp):
        """Add security headers to all responses"""
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp

    @app.get("/health")
    def health_basic():
        """Basic health check without tenant context"""
        return jsonify({"status": "healthy", "service": "edgar-auto-shop"})

    @app.get("/health/tenant-security")
    def health_tenant_security():
        """Roundtrip to DB to confirm the GUC is set and RLS is active"""
        try:
            from app.extensions import db

            # Verify database user and tenant context
            row = (
                db.session.execute(
                    text(
                        """
                SELECT
                    current_user as db_user,
                    current_setting('app.tenant_id', true) as tenant_context,
                    session_user as session_user,
                    current_database() as database_name
            """
                    )
                )
                .mappings()
                .one()
            )

            # Verify RLS is enabled on key tables
            rls_check = (
                db.session.execute(
                    text(
                        """
                SELECT
                    schemaname, tablename, rowsecurity, forcerls
                FROM pg_tables t
                JOIN pg_class c ON c.relname = t.tablename
                WHERE schemaname = 'public'
                AND tablename IN ('customers', 'vehicles', 'appointments')
                AND c.relrowsecurity = true
            """
                    )
                )
                .mappings()
                .all()
            )

            return jsonify(
                {
                    "status": "healthy",
                    "database": {
                        "user": row["db_user"],
                        "session_user": row["session_user"],
                        "database": row["database_name"],
                        "tenant_context": row["tenant_context"] or "NOT_SET",
                    },
                    "rls": {
                        "enabled_tables": len(rls_check),
                        "tables": [dict(r) for r in rls_check],
                    },
                }
            )
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({"status": "unhealthy", "error": str(e)}), 500

    @app.errorhandler(TenantSecurityError)
    def handle_tenant_error(e):
        """Handle tenant security errors"""
        logger.warning(f"Tenant security error: {e}")
        return jsonify({"error": "tenant security violation"}), 403

    return app


def validate_database_security():
    """Validate that database is configured correctly for multi-tenant security"""
    try:
        from app.extensions import db

        # Check current user is not superuser
        user_check = (
            db.session.execute(
                text(
                    """
            SELECT
                current_user,
                usesuper,
                usecreatedb,
                rolbypassrls
            FROM pg_user
            WHERE usename = current_user
        """
                )
            )
            .mappings()
            .one()
        )

        if user_check["usesuper"]:
            raise TenantSecurityError("Database user has superuser privileges - security risk")

        if user_check["rolbypassrls"]:
            raise TenantSecurityError("Database user can bypass RLS - security risk")

        # Check RLS is enabled on tenant tables
        rls_tables = (
            db.session.execute(
                text(
                    """
            SELECT tablename
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE schemaname = 'public'
            AND tablename IN ('customers', 'vehicles', 'appointments')
            AND c.relrowsecurity = false
        """
                )
            )
            .mappings()
            .all()
        )

        if rls_tables:
            missing = [r["tablename"] for r in rls_tables]
            raise TenantSecurityError(f"RLS not enabled on tables: {missing}")

        logger.info("Database security validation passed")
        return True

    except Exception as e:
        logger.error(f"Database security validation failed: {e}")
        raise


# Context manager for tenant-aware database connections
class tenant_database_connection:
    """Context manager that ensures proper tenant context for database operations"""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    def __enter__(self):
        from app.extensions import db

        # Ensure we're using app_user role
        current_user = db.session.execute(text("SELECT current_user")).scalar()
        if current_user != "app_user":
            logger.warning(f"Not using app_user role: {current_user}")

        # Set tenant context
        db.session.execute(text("SET LOCAL app.tenant_id = :tenant"), {"tenant": self.tenant_id})
        return db.session

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Context is automatically cleared at transaction end
        pass


# Example usage in route handlers:
"""
@app.route('/api/customers')
def get_customers():
    tenant_id = g.get('tenant_id')
    if not tenant_id:
        abort(400, "Missing tenant context")

    with tenant_database_connection(tenant_id) as db_session:
        # All queries automatically filtered by RLS
        customers = db_session.execute(text("SELECT * FROM customers")).fetchall()
        return jsonify([dict(c) for c in customers])
"""
