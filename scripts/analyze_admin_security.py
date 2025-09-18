#!/usr/bin/env python3
"""
TASK 9.4: Admin Endpoint Security Analysis Script
Systematically analyzes all admin endpoints for security implementation patterns
"""

import re


def extract_admin_endpoint_security():
    """Analyze admin endpoints in local_server.py for security patterns"""

    endpoints = [
        {"line": 1107, "method": "GET", "route": "/api/admin/metrics/304-efficiency"},
        {"line": 1404, "method": "PATCH", "route": "/api/admin/customers/<cid>"},
        {"line": 1599, "method": "POST", "route": "/api/admin/vehicles"},
        {"line": 1748, "method": "GET", "route": "/api/admin/vehicles/<vid>"},
        {"line": 1793, "method": "PATCH", "route": "/api/admin/vehicles/<vid>"},
        {"line": 1944, "method": "POST", "route": "/api/admin/vehicles/<vid>/transfer"},
        {"line": 2192, "method": "GET", "route": "/api/admin/invoices"},
        {"line": 2268, "method": "GET", "route": "/api/admin/invoices/<invoice_id>/estimate.pdf"},
        {"line": 2336, "method": "GET", "route": "/api/admin/invoices/<invoice_id>/receipt.pdf"},
        {"line": 2396, "method": "GET", "route": "/api/admin/invoices/<invoice_id>/estimate.html"},
        {"line": 2449, "method": "GET", "route": "/api/admin/invoices/<invoice_id>/receipt.html"},
        {"line": 2502, "method": "POST", "route": "/api/admin/invoices/<invoice_id>/send"},
        {"line": 2609, "method": "POST", "route": "/api/admin/login"},
        {"line": 3542, "method": "POST", "route": "/api/admin/appointments/<appt_id>/invoice"},
        {"line": 3608, "method": "GET", "route": "/api/admin/invoices/<invoice_id>"},
        {"line": 3632, "method": "POST", "route": "/api/admin/invoices/<invoice_id>/payments"},
        {"line": 3700, "method": "POST", "route": "/api/admin/invoices/<invoice_id>/void"},
        {"line": 3793, "method": "GET", "route": "/api/admin/appointments/board"},
        {"line": 4373, "method": "GET", "route": "/api/admin/message-templates"},
        {"line": 4455, "method": "POST", "route": "/api/admin/message-templates"},
        {"line": 4500, "method": "GET", "route": "/api/admin/message-templates/<tid>"},
        {"line": 4516, "method": "PATCH", "route": "/api/admin/message-templates/<tid>"},
        {"line": 4561, "method": "DELETE", "route": "/api/admin/message-templates/<tid>"},
        {"line": 4653, "method": "POST", "route": "/api/admin/template-usage"},
        {"line": 4826, "method": "GET", "route": "/api/admin/technicians"},
        {"line": 4910, "method": "GET", "route": "/api/admin/analytics/templates"},
        {"line": 5133, "method": "PATCH", "route": "/api/admin/appointments/<appt_id>/move"},
        {"line": 5262, "method": "GET/PATCH", "route": "/api/admin/appointments/<appt_id>"},
        {"line": 6329, "method": "GET", "route": "/api/admin/appointments"},
        {"line": 6469, "method": "POST", "route": "/api/admin/appointments"},
        {"line": 6859, "method": "DELETE", "route": "/api/admin/appointments/<appt_id>"},
        {"line": 7002, "method": "GET", "route": "/api/admin/service-operations"},
        {"line": 7199, "method": "GET", "route": "/api/admin/service-packages"},
        {"line": 7352, "method": "POST", "route": "/api/admin/invoices/<invoice_id>/add-package"},
        {"line": 7547, "method": "GET", "route": "/api/admin/reports/appointments.csv"},
        {"line": 7701, "method": "GET", "route": "/api/admin/reports/payments.csv"},
        {"line": 7806, "method": "GET", "route": "/api/admin/dashboard/stats"},
        {"line": 7936, "method": "GET", "route": "/api/admin/customers/search"},
        {"line": 8158, "method": "GET", "route": "/api/admin/recent-customers"},
        {"line": 8293, "method": "GET", "route": "/api/admin/customers/<cust_id>"},
        {"line": 8596, "method": "GET", "route": "/api/admin/customers/<cust_id>/profile"},
        {"line": 8991, "method": "GET", "route": "/api/admin/customers/<cust_id>/visits"},
        {"line": 9032, "method": "GET", "route": "/api/admin/vehicles/<license_plate>/visits"},
        {"line": 9078, "method": "GET", "route": "/api/admin/cars-on-premises"},
        {"line": 9104, "method": "GET", "route": "/api/admin/vehicles/<vehicle_id>/profile"},
        {"line": 9287, "method": "GET", "route": "/api/admin/appointments/today"},
    ]

    # Read the server file
    try:
        with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/local_server.py") as f:
            content = f.read()
    except FileNotFoundError:
        print("❌ Could not find backend/local_server.py")
        return

    lines = content.split("\n")

    # Analyze each endpoint
    secured_endpoints = []
    partially_secured_endpoints = []
    vulnerable_endpoints = []
    auth_only_endpoints = []

    for endpoint in endpoints:
        line_num = endpoint["line"]
        route = endpoint["route"]
        method = endpoint["method"]

        # Extract function code (next ~100 lines after the route definition)
        start_line = line_num - 1  # Convert to 0-based index
        end_line = min(start_line + 150, len(lines))
        function_code = "\n".join(lines[start_line:end_line])

        # Check for security patterns
        has_auth = bool(re.search(r"require_or_maybe|require_auth", function_code))
        has_tenant_context = bool(re.search(r"tenant_context\(", function_code))
        has_resolve_tenant = bool(re.search(r"resolve_active_tenant", function_code))
        has_db_access = bool(re.search(r"db_conn\(\)|with conn|cursor\(", function_code))

        # Categorize
        if route == "/api/admin/login":
            auth_only_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "AUTH_ONLY",
                    "reason": "Authentication endpoint",
                }
            )
        elif has_auth and has_tenant_context and has_resolve_tenant:
            secured_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "SECURED",
                    "reason": "Has auth + tenant context",
                }
            )
        elif has_auth and has_db_access and not has_tenant_context:
            vulnerable_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "VULNERABLE",
                    "reason": "Has auth + DB access but NO tenant context",
                }
            )
        elif has_auth and not has_db_access:
            partially_secured_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "PARTIALLY_SECURED",
                    "reason": "Has auth but no DB access detected",
                }
            )
        elif not has_auth and has_db_access:
            vulnerable_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "CRITICAL_VULNERABLE",
                    "reason": "NO auth + has DB access",
                }
            )
        else:
            vulnerable_endpoints.append(
                {
                    "method": method,
                    "route": route,
                    "line": line_num,
                    "status": "UNKNOWN",
                    "reason": f"Auth: {has_auth}, DB: {has_db_access}, Tenant: {has_tenant_context}",
                }
            )

    # Report results
    print("🔒 TASK 9.4: ADMIN ENDPOINT SECURITY ANALYSIS")
    print("=" * 60)

    print(f"\n✅ SECURED ENDPOINTS ({len(secured_endpoints)}):")
    for ep in secured_endpoints:
        print(f"   {ep['method']:8} {ep['route']:40} Line {ep['line']:4} - {ep['reason']}")

    print(f"\n⚠️  PARTIALLY SECURED ENDPOINTS ({len(partially_secured_endpoints)}):")
    for ep in partially_secured_endpoints:
        print(f"   {ep['method']:8} {ep['route']:40} Line {ep['line']:4} - {ep['reason']}")

    print(f"\n🚨 VULNERABLE ENDPOINTS ({len(vulnerable_endpoints)}):")
    for ep in vulnerable_endpoints:
        status_icon = "🔴" if "CRITICAL" in ep["status"] else "🟡"
        print(
            f"   {status_icon} {ep['method']:8} {ep['route']:40} Line {ep['line']:4} - {ep['reason']}"
        )

    print(f"\n🔐 AUTHENTICATION ONLY ({len(auth_only_endpoints)}):")
    for ep in auth_only_endpoints:
        print(f"   {ep['method']:8} {ep['route']:40} Line {ep['line']:4} - {ep['reason']}")

    # Summary
    total = len(endpoints)
    secured = len(secured_endpoints)
    vulnerable = len(vulnerable_endpoints)

    security_score = (secured / total) * 100 if total > 0 else 0

    print("\n📊 SECURITY SUMMARY:")
    print(f"   Total Admin Endpoints: {total}")
    print(f"   Secured: {secured}")
    print(f"   Vulnerable: {vulnerable}")
    print(f"   Security Score: {security_score:.1f}%")

    if vulnerable > 0:
        print(f"\n🛑 IMMEDIATE ACTION REQUIRED: {vulnerable} vulnerable endpoints found!")
    else:
        print("\n🎉 ALL ENDPOINTS SECURED!")

    return {
        "secured": secured_endpoints,
        "vulnerable": vulnerable_endpoints,
        "partially_secured": partially_secured_endpoints,
        "auth_only": auth_only_endpoints,
    }


if __name__ == "__main__":
    extract_admin_endpoint_security()
