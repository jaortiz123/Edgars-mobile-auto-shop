# Example of how to update admin routes with tenant context middleware

# Add this import at the top of local_server.py:
# from backend.app.middleware.tenant_context import tenant_context, resolve_active_tenant


# Example 1: Simple metrics route (minimal changes)
@app.route("/api/admin/metrics/304-efficiency", methods=["GET"])
def metrics_304_efficiency():
    """Compute 304 efficiency for key cacheable GET routes over recent log buffer."""
    # Get tenant context (will use X-Tenant-Id header or default to 't_default')
    tenant_id = resolve_active_tenant(None, request)

    # Original route logic continues unchanged...
    # (This route doesn't need database access, so no cursor context needed)
    tracked = [
        "/api/customer/profile",
        "/api/vehicle/profile",
    ]
    # ... rest of original implementation


# Example 2: Database-accessing admin route (full tenant context)
@app.route("/api/admin/customers/<cid>", methods=["PATCH"])
def patch_customer(cid: str):
    user = require_or_maybe("Advisor")
    if not user:
        return _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")

    # Get tenant context
    tenant_id = resolve_active_tenant(user, request)

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            # Set tenant context for RLS enforcement
            with tenant_context(cur, tenant_id):
                # Now all database queries will respect tenant isolation
                row = _get_customer_row(cur, cid_int)
                if not row:
                    # RLS will prevent access to other tenants' customers
                    return _error(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Customer not found")

                # ... rest of original implementation
                # All database operations in this context are automatically tenant-scoped


# Example 3: Routes that create new records
@app.route("/api/admin/vehicles", methods=["POST"])
def create_vehicle():
    user = require_or_maybe("Advisor")
    if not user:
        return _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")

    tenant_id = resolve_active_tenant(user, request)

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            with tenant_context(cur, tenant_id):
                # The trigger will automatically set tenant_id on INSERT
                cur.execute(
                    "INSERT INTO vehicles (customer_id, make, model, year) VALUES (%s, %s, %s, %s) RETURNING id",
                    (customer_id, make, model, year),
                )
                # tenant_id is set automatically by the trigger
