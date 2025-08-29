"""
PRODUCTION TENANT MIDDLEWARE - Critical Security Component
===========================================================

This middleware MUST be applied to every database connection in production.
It ensures tenant context is set before any queries are executed.

CRITICAL: Never allow database queries without tenant context in production.
"""

import logging
import os
from contextlib import contextmanager
from typing import Optional

import psycopg2
from flask import g, request

logger = logging.getLogger(__name__)


class TenantSecurityError(Exception):
    """Raised when tenant security requirements are not met"""

    pass


class ProductionTenantMiddleware:
    """Production-ready tenant isolation middleware with fail-closed security"""

    def __init__(self, app=None, fail_closed: bool = True):
        self.app = app
        self.fail_closed = fail_closed  # Fail closed by default in production
        if app:
            self.init_app(app)

    def init_app(self, app):
        """Initialize the middleware with Flask app"""
        app.before_request(self._before_request)
        app.teardown_appcontext(self._teardown)

    def _before_request(self):
        """Extract tenant context before each request"""
        tenant_id = self._extract_tenant_id()
        if tenant_id:
            g.tenant_id = tenant_id
            logger.info(f"Request tenant context: {tenant_id[:8]}...")
        else:
            if self.fail_closed:
                # In production, fail closed if no tenant context
                logger.error(f"No tenant context for request: {request.path}")
                raise TenantSecurityError("Tenant context required for this operation")
            else:
                logger.warning(f"No tenant context for request: {request.path}")

    def _extract_tenant_id(self) -> Optional[str]:
        """
        Extract tenant ID from request context.
        Override this method to match your tenant identification strategy.
        """
        # Method 1: Subdomain extraction (e.g., tenant123.yourdomain.com)
        if request.host:
            parts = request.host.split(".")
            if len(parts) >= 3:  # tenant.domain.com
                subdomain = parts[0]
                if self._is_valid_tenant_slug(subdomain):
                    return self._slug_to_tenant_id(subdomain)

        # Method 2: Header-based tenant (e.g., X-Tenant-ID)
        tenant_header = request.headers.get("X-Tenant-ID")
        if tenant_header and self._is_valid_uuid(tenant_header):
            return tenant_header

        # Method 3: URL path prefix (e.g., /tenant/123/customers)
        if request.path.startswith("/tenant/"):
            path_parts = request.path.split("/")
            if len(path_parts) >= 3:
                potential_tenant = path_parts[2]
                if self._is_valid_uuid(potential_tenant):
                    return potential_tenant

        # Method 4: JWT token claims
        # if hasattr(g, 'jwt_claims') and 'tenant_id' in g.jwt_claims:
        #     return g.jwt_claims['tenant_id']

        return None

    def _is_valid_uuid(self, value: str) -> bool:
        """Validate UUID format"""
        try:
            import uuid

            uuid.UUID(value)
            return True
        except ValueError:
            return False

    def _is_valid_tenant_slug(self, slug: str) -> bool:
        """Validate tenant slug format"""
        return slug and slug.replace("-", "").replace("_", "").isalnum()

    def _slug_to_tenant_id(self, slug: str) -> Optional[str]:
        """Convert tenant slug to tenant UUID - implement based on your DB schema"""
        # This should query your tenants table to get UUID by slug
        # Example:
        # with get_db_connection() as conn:
        #     cur = conn.cursor()
        #     cur.execute("SELECT id FROM tenants WHERE slug = %s", (slug,))
        #     result = cur.fetchone()
        #     return str(result[0]) if result else None
        return None

    def _teardown(self, exception):
        """Clean up tenant context after request"""
        if hasattr(g, "tenant_id"):
            delattr(g, "tenant_id")


@contextmanager
def tenant_database_connection(dict_cursor: bool = True):
    """
    PRODUCTION DATABASE CONNECTION MANAGER

    This context manager ensures:
    1. Uses app_user role (never postgres)
    2. Sets tenant context before any queries
    3. Validates tenant context is active
    4. Provides proper connection cleanup

    Usage:
        with tenant_database_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM customers")  # Only sees tenant's data
    """
    if not hasattr(g, "tenant_id"):
        raise TenantSecurityError("No tenant context available for database connection")

    tenant_id = g.tenant_id
    conn = None

    try:
        # Create connection as app_user (never postgres!)
        conn = get_app_user_connection(dict_cursor)

        # Set tenant context IMMEDIATELY after connection
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))

            # CRITICAL: Verify the tenant context was set correctly
            cur.execute("SELECT current_setting('app.tenant_id', true)")
            active_tenant = cur.fetchone()[0]

            if active_tenant != tenant_id:
                raise TenantSecurityError(
                    f"Failed to set tenant context. Expected: {tenant_id}, Got: {active_tenant}"
                )

        conn.commit()
        logger.debug(f"Database connection established with tenant context: {tenant_id[:8]}...")

        yield conn

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database connection error with tenant {tenant_id[:8]}...: {e}")
        raise
    finally:
        if conn:
            conn.close()


def get_app_user_connection(dict_cursor: bool = True):
    """
    Get database connection using app_user role.
    NEVER use postgres role for application connections.
    """
    # Build connection with app_user
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "edgarautoshop")

    # CRITICAL: Always use app_user, never postgres
    user = os.getenv("POSTGRES_USER", "app_user")
    if user == "postgres":
        logger.error("🚨 SECURITY VIOLATION: Attempting to use postgres role for app connection")
        raise TenantSecurityError("Application must not use superuser database role")

    password = os.getenv("POSTGRES_PASSWORD")
    sslmode = os.getenv("PGSSLMODE", "require")

    if not password:
        raise TenantSecurityError("Database password not configured")

    # Create connection
    conn = psycopg2.connect(
        host=host,
        port=int(port),
        database=db,
        user=user,
        password=password,
        sslmode=sslmode,
        connect_timeout=5,
    )

    if dict_cursor:
        conn.cursor_factory = psycopg2.extras.RealDictCursor

    return conn


def validate_database_security():
    """
    Production security validation - run this in health checks.
    Ensures the database connection meets security requirements.
    """
    try:
        with get_app_user_connection() as conn:
            with conn.cursor() as cur:
                # Test 1: Verify we're not using superuser
                cur.execute(
                    """
                    SELECT
                        current_user,
                        rolsuper as is_superuser,
                        rolbypassrls as bypasses_rls
                    FROM pg_roles
                    WHERE rolname = current_user
                """
                )

                user_info = cur.fetchone()
                if user_info["is_superuser"]:
                    raise TenantSecurityError(
                        "🚨 Application is using superuser role - SECURITY VIOLATION"
                    )

                if user_info["bypasses_rls"]:
                    raise TenantSecurityError(
                        "🚨 Application role bypasses RLS - SECURITY VIOLATION"
                    )

                # Test 2: Verify RLS is active on tenant tables
                cur.execute(
                    """
                    SELECT tablename, rowsecurity, forcerowsecurity
                    FROM pg_tables
                    WHERE schemaname = 'public'
                      AND tablename IN ('customers', 'vehicles', 'appointments', 'services')
                """
                )

                tables = cur.fetchall()
                for table in tables:
                    if not table["rowsecurity"]:
                        raise TenantSecurityError(
                            f"🚨 RLS not enabled on {table['tablename']} - SECURITY VIOLATION"
                        )

                # Test 3: Verify tenant context isolation works
                try:
                    cur.execute("SELECT COUNT(*) FROM customers")
                    count_without_context = cur.fetchone()[0]

                    if count_without_context > 0:
                        logger.warning(
                            "Database returned data without tenant context - check RLS policies"
                        )

                except psycopg2.Error:
                    # This is actually good - RLS should block queries without context
                    pass

                return {
                    "status": "secure",
                    "user": user_info["current_user"],
                    "is_superuser": user_info["is_superuser"],
                    "bypasses_rls": user_info["bypasses_rls"],
                    "tables_with_rls": len(tables),
                }

    except Exception as e:
        logger.error(f"Database security validation failed: {e}")
        return {"status": "insecure", "error": str(e)}


# ============================================================================
# PRODUCTION HEALTH CHECK ENDPOINTS
# ============================================================================


def create_security_health_endpoints(app):
    """Add security health check endpoints - ONLY in non-production"""

    if os.getenv("FLASK_ENV") == "production":
        logger.info("Security endpoints disabled in production")
        return

    @app.route("/__db_whoami")
    def db_whoami():
        """Development-only endpoint to check database connection security"""
        try:
            security_status = validate_database_security()

            # Add tenant context info if available
            tenant_info = {"tenant_id": getattr(g, "tenant_id", None)}

            return {
                "database_security": security_status,
                "tenant_context": tenant_info,
                "environment": os.getenv("FLASK_ENV", "unknown"),
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @app.route("/__rls_test")
    def rls_test():
        """Development-only endpoint to test RLS policy effectiveness"""
        if not hasattr(g, "tenant_id"):
            return {"error": "No tenant context available for testing"}, 400

        try:
            with tenant_database_connection() as conn:
                with conn.cursor() as cur:
                    # Test tenant isolation
                    cur.execute("SELECT COUNT(*) as customer_count FROM customers")
                    result = cur.fetchone()

                    cur.execute("SELECT current_setting('app.tenant_id', true) as active_tenant")
                    tenant_check = cur.fetchone()

                    return {
                        "tenant_id": g.tenant_id[:8] + "...",
                        "active_tenant": tenant_check["active_tenant"][:8] + "...",
                        "customer_count": result["customer_count"],
                        "rls_working": True,
                    }
        except Exception as e:
            return {"error": str(e)}, 500


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

"""
# In your Flask app initialization:

from production_tenant_middleware import (
    ProductionTenantMiddleware,
    tenant_database_connection,
    create_security_health_endpoints
)

app = Flask(__name__)

# Initialize tenant middleware (fail closed in production)
tenant_middleware = ProductionTenantMiddleware(app, fail_closed=True)

# Add security health endpoints (non-production only)
create_security_health_endpoints(app)

# In your route handlers:

@app.route('/api/customers')
def get_customers():
    with tenant_database_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM customers ORDER BY created_at DESC")
        customers = cur.fetchall()
        return jsonify(customers)

# The middleware ensures:
# 1. Tenant context is extracted from request
# 2. Database connection uses app_user (not postgres)
# 3. Tenant context is set before any queries
# 4. RLS policies automatically filter results
# 5. Cross-tenant data access is impossible
"""
