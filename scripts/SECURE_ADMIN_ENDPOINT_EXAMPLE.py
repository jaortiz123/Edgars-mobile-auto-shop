#!/usr/bin/env python3
"""
PROOF OF CONCEPT: Secure Admin Endpoint Implementation
======================================================

This demonstrates how admin endpoints should be secured with proper tenant isolation.
"""

# EXAMPLE: Secure implementation of /api/admin/invoices endpoint


def secure_list_invoices():
    """
    SECURE VERSION: Properly isolated admin invoices endpoint
    """
    # 1. AUTHENTICATION CHECK
    user = require_or_maybe("Advisor")  # Require admin authentication
    if not user:
        resp, status = _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")
        resp.headers["Cache-Control"] = "no-store"
        return resp, status

    # 2. PARAMETER VALIDATION
    try:
        page = max(1, int(request.args.get("page", 1)))
    except Exception:
        page = 1
    try:
        page_size = int(request.args.get("pageSize", 20))
    except Exception:
        page_size = 20
    if page_size < 1:
        page_size = 1
    if page_size > 100:
        page_size = 100

    customer_id = request.args.get("customerId")
    status_filter = request.args.get("status")

    # 3. DATABASE CONNECTION WITH TENANT CONTEXT
    conn, use_memory, err = safe_conn()
    if err or not conn:
        return _error(
            HTTPStatus.SERVICE_UNAVAILABLE,
            "db_unavailable",
            "Database unavailable for invoice listing",
        )

    offset = (page - 1) * page_size
    where = []
    params = []

    if customer_id and customer_id.isdigit():
        where.append("customer_id = %s")
        params.append(int(customer_id))
    if status_filter:
        where.append("status = %s")
        params.append(status_filter)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 4. CRITICAL: APPLY TENANT CONTEXT FOR RLS ENFORCEMENT
            tenant_id = resolve_active_tenant(user, request)
            with tenant_context(cur, tenant_id):
                # Now all queries are automatically tenant-isolated via RLS
                cur.execute(
                    f"SELECT id::text, customer_id, status::text, subtotal_cents, total_cents, amount_paid_cents, amount_due_cents FROM invoices {where_sql} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                    params + [page_size, offset],
                )
                rows = cur.fetchall() or []

                cur.execute(f"SELECT COUNT(*) AS cnt FROM invoices {where_sql}", params)
                total = cur.fetchone()["cnt"] if cur.rowcount != -1 else len(rows)

    data = {
        "page": page,
        "page_size": page_size,
        "total_items": total,
        "items": rows,
    }
    return _ok(data)


# COMPARISON: The current vulnerable implementation vs secure implementation

VULNERABLE_CODE = """
@app.route("/api/admin/invoices", methods=["GET"])
def list_invoices():
    # ❌ NO AUTHENTICATION CHECK
    # ❌ NO TENANT CONTEXT ENFORCEMENT

    conn, use_memory, err = safe_conn()
    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # ❌ DIRECT QUERY WITHOUT TENANT ISOLATION
            cur.execute("SELECT * FROM invoices ...")
            # ❌ RETURNS DATA FROM ALL TENANTS
"""

SECURE_CODE = """
@app.route("/api/admin/invoices", methods=["GET"])
def list_invoices():
    # ✅ AUTHENTICATION CHECK
    user = require_or_maybe("Advisor")
    if not user:
        return _error(HTTPStatus.FORBIDDEN, "FORBIDDEN", "Not authorized")

    conn, use_memory, err = safe_conn()
    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # ✅ TENANT CONTEXT ENFORCEMENT
            tenant_id = resolve_active_tenant(user, request)
            with tenant_context(cur, tenant_id):
                # ✅ RLS POLICIES AUTOMATICALLY APPLIED
                cur.execute("SELECT * FROM invoices ...")
                # ✅ RETURNS ONLY CURRENT TENANT'S DATA
"""


def main():
    print("🔒 SECURE ADMIN ENDPOINT IMPLEMENTATION EXAMPLE")
    print("=" * 50)
    print("\n❌ VULNERABLE CODE:")
    print(VULNERABLE_CODE)
    print("\n✅ SECURE CODE:")
    print(SECURE_CODE)
    print("\n🔑 KEY SECURITY PRINCIPLES:")
    print("1. Always authenticate admin users")
    print("2. Apply tenant context for RLS enforcement")
    print("3. Use resolve_active_tenant() for tenant detection")
    print("4. Wrap database queries in tenant_context()")
    print("5. Let RLS policies handle data isolation")


if __name__ == "__main__":
    main()
