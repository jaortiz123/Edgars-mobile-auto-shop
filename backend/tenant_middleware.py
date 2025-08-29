"""
Tenant Context Middleware for Multi-Tenant Flask Application
Implements Row-Level Security (RLS) tenant isolation
"""

import logging
import os
from functools import wraps

import psycopg2
from flask import abort, g, request
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class TenantContext:
    """Manages tenant context for RLS-based multi-tenancy"""

    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        """Initialize the tenant context with Flask app"""
        app.before_request(self.load_tenant_context)
        app.teardown_appcontext(self.cleanup_tenant_context)

    def load_tenant_context(self):
        """
        Extract tenant from request and set RLS context
        Supports multiple tenant identification methods:
        1. Subdomain: tenant.edgarautoshop.com
        2. Header: X-Tenant-Slug
        3. URL path: /api/tenant/{slug}/...
        4. Default tenant for single-tenant mode
        """
        tenant_slug = None

        # Method 1: Extract from subdomain
        if request.host:
            parts = request.host.split(".")
            if len(parts) >= 3 and parts[0] not in ["www", "api", "admin"]:
                tenant_slug = parts[0]

        # Method 2: Check for tenant header (for API clients)
        if not tenant_slug:
            tenant_slug = request.headers.get("X-Tenant-Slug")

        # Method 3: Extract from URL path
        if not tenant_slug and request.path.startswith("/api/tenant/"):
            path_parts = request.path.split("/")
            if len(path_parts) >= 4:
                tenant_slug = path_parts[3]

        # Method 4: Default to single-tenant mode
        if not tenant_slug:
            tenant_slug = os.getenv("DEFAULT_TENANT_SLUG", "edgar-auto-shop")

        # Validate and set tenant context
        try:
            tenant_id = self.validate_tenant(tenant_slug)
            g.tenant_id = tenant_id
            g.tenant_slug = tenant_slug

            # Set RLS context for this request
            self.set_tenant_rls_context(tenant_id)

            logger.debug(f"Tenant context set: {tenant_slug} ({tenant_id})")

        except Exception as e:
            logger.error(f"Failed to set tenant context for '{tenant_slug}': {e}")
            # For API requests, return 404 to avoid tenant enumeration
            if request.path.startswith("/api/"):
                abort(404)
            else:
                abort(400, description="Invalid tenant")

    def validate_tenant(self, tenant_slug):
        """Validate tenant exists and is active, return tenant_id"""
        conn = None
        try:
            conn = self.get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)

            # Use the validate_tenant_access function from our migration
            cur.execute("SELECT validate_tenant_access(%s) as tenant_id", (tenant_slug,))
            result = cur.fetchone()

            if result:
                return str(result["tenant_id"])
            else:
                raise ValueError(f"Tenant not found: {tenant_slug}")

        except psycopg2.Error as e:
            logger.error(f"Database error validating tenant '{tenant_slug}': {e}")
            raise
        finally:
            if conn:
                conn.close()

    def set_tenant_rls_context(self, tenant_id):
        """Set the tenant context for RLS policies"""
        conn = None
        try:
            conn = self.get_db_connection()
            cur = conn.cursor()

            # Set the tenant context using our function
            cur.execute("SELECT set_tenant_context(%s)", (tenant_id,))
            conn.commit()

            # Store connection in g for reuse in the same request
            g.db_connection = conn

        except psycopg2.Error as e:
            logger.error(f"Failed to set RLS context for tenant {tenant_id}: {e}")
            if conn:
                conn.close()
            raise

    def get_db_connection(self):
        """Get database connection with tenant-aware configuration"""
        # Reuse connection if already established for this request
        if hasattr(g, "db_connection") and g.db_connection:
            return g.db_connection

        # Get connection parameters
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            # Parse DATABASE_URL
            import urllib.parse

            parsed = urllib.parse.urlparse(database_url)
            conn_params = {
                "host": parsed.hostname,
                "port": parsed.port or 5432,
                "database": parsed.path[1:],  # Remove leading /
                "user": parsed.username,
                "password": parsed.password or os.getenv("PGPASSWORD"),
                "sslmode": "require" if "sslmode=require" in database_url else "prefer",
            }
        else:
            # Fallback to individual env vars
            conn_params = {
                "host": os.getenv("POSTGRES_HOST", "localhost"),
                "port": int(os.getenv("POSTGRES_PORT", 5432)),
                "database": os.getenv("POSTGRES_DB", "edgarautoshop"),
                "user": os.getenv("POSTGRES_USER", "appuser"),
                "password": os.getenv("POSTGRES_PASSWORD") or os.getenv("PGPASSWORD"),
                "sslmode": os.getenv("PGSSLMODE", "prefer"),
            }

        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False  # Important for RLS context
        return conn

    def cleanup_tenant_context(self, error):
        """Clean up tenant context at end of request"""
        if hasattr(g, "db_connection") and g.db_connection:
            try:
                g.db_connection.close()
            except:
                pass

        # Clear tenant context
        g.pop("tenant_id", None)
        g.pop("tenant_slug", None)
        g.pop("db_connection", None)


# Decorator for tenant-aware routes
def require_tenant(f):
    """Decorator to ensure tenant context is available"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, "tenant_id") or not g.tenant_id:
            abort(400, description="Tenant context required")
        return f(*args, **kwargs)

    return decorated_function


# Utility functions for use in routes
def get_current_tenant_id():
    """Get current tenant ID from request context"""
    return getattr(g, "tenant_id", None)


def get_current_tenant_slug():
    """Get current tenant slug from request context"""
    return getattr(g, "tenant_slug", None)


def get_tenant_db_connection():
    """Get the tenant-aware database connection"""
    if hasattr(g, "db_connection") and g.db_connection:
        return g.db_connection
    else:
        raise RuntimeError("No database connection available. Tenant context not initialized?")


def execute_tenant_query(query, params=None, fetchone=False, fetchall=True):
    """
    Execute a query with automatic tenant isolation via RLS

    Args:
        query (str): SQL query to execute
        params (tuple): Query parameters
        fetchone (bool): Return single row
        fetchall (bool): Return all rows (default)

    Returns:
        Query results with RLS automatically applied
    """
    conn = get_tenant_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(query, params)

        if query.strip().upper().startswith("SELECT"):
            if fetchone:
                return cur.fetchone()
            elif fetchall:
                return cur.fetchall()
        else:
            conn.commit()
            return cur.rowcount

    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Query error for tenant {get_current_tenant_id()}: {e}")
        raise


# Example usage in routes:
"""
from tenant_middleware import require_tenant, execute_tenant_query, get_current_tenant_slug

@app.route('/api/customers')
@require_tenant
def get_customers():
    # RLS automatically filters to current tenant
    customers = execute_tenant_query(
        "SELECT * FROM customers ORDER BY created_at DESC LIMIT %s",
        (50,)
    )
    return jsonify([dict(c) for c in customers])

@app.route('/api/customers', methods=['POST'])
@require_tenant
def create_customer():
    data = request.get_json()

    # tenant_id is automatically set by RLS policy
    customer = execute_tenant_query(
        "INSERT INTO customers (first_name, last_name, email, phone, tenant_id) VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (data['first_name'], data['last_name'], data['email'], data['phone'], get_current_tenant_id()),
        fetchone=True
    )
    return jsonify(dict(customer))
"""
