"""
Documentation-only examples for tenant context middleware integration.

This module intentionally contains non-executable examples to avoid linter
errors in CI. Copy the snippets into your Flask app (e.g., local_server.py)
and adapt as needed.

Add this import at the top of local_server.py:

    from backend.app.middleware.tenant_context import tenant_context, resolve_active_tenant

Example 1: Simple metrics route (minimal changes)

    @app.route("/api/admin/metrics/304-efficiency", methods=["GET"])
    def metrics_304_efficiency():
        # Get tenant context (will use X-Tenant-Id header or default to 't_default')
        tenant_id = resolve_active_tenant(None, request)
        tracked = ["/api/customer/profile", "/api/vehicle/profile"]
        # ... rest of implementation

Example 2: Database-accessing admin route (full tenant context)

    @app.route("/api/admin/customers/<cid>", methods=["PATCH"])
    def patch_customer(cid: str):
        user = require_or_maybe("Advisor")
        if not user:
            return _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")
        tenant_id = resolve_active_tenant(user, request)
        with db_conn() as conn:
            with conn.cursor() as cur:
                with tenant_context(cur, tenant_id):
                    # ... DB operations scoped by RLS
                    pass

Example 3: Route that creates new records

    @app.route("/api/admin/vehicles", methods=["POST"])
    def create_vehicle():
        user = require_or_maybe("Advisor")
        if not user:
            return _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")
        tenant_id = resolve_active_tenant(user, request)
        with db_conn() as conn:
            with conn.cursor() as cur:
                with tenant_context(cur, tenant_id):
                    cur.execute(
                        "INSERT INTO vehicles (customer_id, make, model, year) VALUES (%s, %s, %s, %s) RETURNING id",
                        (customer_id, make, model, year),
                    )
                    # tenant_id is set automatically by trigger
"""
