#!/usr/bin/env python3
"""
TASK 9.5: CRITICAL ENDPOINT SECURITY TEST
Test the 10 most critical admin endpoints for tenant isolation vulnerabilities.
"""

import json
import os
import sys
import time

import requests

# Test configuration
SERVER_URL = "http://localhost:3001"
TEST_TENANT_1 = "00000000-0000-0000-0000-000000000001"
TEST_TENANT_2 = "00000000-0000-0000-0000-000000000002"


def register_and_login_user(tenant_id, email_suffix):
    """Register and login a user for testing"""
    timestamp = int(time.time())
    email = f"test_user_{email_suffix}_{timestamp}@test.com"

    # Register
    reg_response = requests.post(
        f"{SERVER_URL}/api/customers/register",
        json={"email": email, "password": "Test123!", "name": f"Test User {email_suffix}"},
        headers={"X-Tenant-Id": tenant_id},
    )

    if reg_response.status_code != 200:
        print(f"Registration failed for {email}: {reg_response.status_code}")
        return None

    # Login
    login_response = requests.post(
        f"{SERVER_URL}/api/customers/login",
        json={"email": email, "password": "Test123!"},
        headers={"X-Tenant-Id": tenant_id},
    )

    if login_response.status_code != 200:
        print(f"Login failed for {email}: {login_response.status_code}")
        return None

    return login_response.cookies


def test_critical_endpoints():
    """Test the 10 most critical admin endpoints"""

    print("🚨 TASK 9.5: CRITICAL ENDPOINT SECURITY TEST")
    print("=" * 60)

    # Critical endpoints to test (Top 10 by security risk)
    critical_endpoints = [
        # 🔴 CRITICAL - No authentication + DB access
        ("GET", "/api/admin/customers/12345", "Customer PII Access"),
        ("POST", "/api/admin/invoices/12345/payments", "Financial Data Access"),
        ("GET", "/api/admin/appointments/12345", "Appointment Data Access"),
        ("GET", "/api/admin/appointments", "All Appointments Access"),
        ("GET", "/api/admin/service-packages", "Service Data Access"),
        ("POST", "/api/admin/invoices/12345/add-package", "Financial Modification"),
        # 🟡 AUTH BUT NO TENANT CONTEXT - Cross-tenant vulnerabilities
        ("GET", "/api/admin/customers/12345/visits", "Customer History Access"),
        ("GET", "/api/admin/dashboard/stats", "Business Metrics Access"),
        ("POST", "/api/admin/vehicles", "Vehicle Registration"),
        ("GET", "/api/admin/vehicles/12345", "Vehicle Data Access"),
    ]

    # Setup test users for both tenants
    print("Setting up test users...")
    tenant1_cookies = register_and_login_user(TEST_TENANT_1, "t1")
    tenant2_cookies = register_and_login_user(TEST_TENANT_2, "t2")

    if not tenant1_cookies or not tenant2_cookies:
        print("❌ Failed to setup test users")
        return

    print("✅ Test users created successfully")

    results = {
        "critical_vulnerabilities": [],
        "tenant_bypass_vulnerabilities": [],
        "secured_endpoints": [],
        "total_tested": len(critical_endpoints),
    }

    print(f"\nTesting {len(critical_endpoints)} critical endpoints...")
    print("-" * 60)

    for method, endpoint, description in critical_endpoints:
        print(f"\n🔍 Testing: {method} {endpoint} ({description})")

        # Test 1: Unauthenticated access
        try:
            if method == "GET":
                response = requests.get(
                    f"{SERVER_URL}{endpoint}", headers={"X-Tenant-Id": TEST_TENANT_1}
                )
            elif method == "POST":
                response = requests.post(
                    f"{SERVER_URL}{endpoint}", json={}, headers={"X-Tenant-Id": TEST_TENANT_1}
                )
            else:
                response = requests.request(
                    method, f"{SERVER_URL}{endpoint}", headers={"X-Tenant-Id": TEST_TENANT_1}
                )

            if response.status_code not in [401, 403]:
                print(f"   🔴 CRITICAL: Unauthenticated access allowed ({response.status_code})")
                results["critical_vulnerabilities"].append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "vulnerability": "No authentication required",
                        "status_code": response.status_code,
                        "description": description,
                    }
                )
            else:
                print(f"   ✅ Authentication required ({response.status_code})")

        except Exception as e:
            print(f"   ⚠️ Error testing unauthenticated access: {e}")

        # Test 2: Cross-tenant access (using authenticated users)
        try:
            # Try accessing tenant 1 data with tenant 2 credentials
            if method == "GET":
                response = requests.get(
                    f"{SERVER_URL}{endpoint}",
                    cookies=tenant2_cookies,
                    headers={"X-Tenant-Id": TEST_TENANT_1},
                )
            elif method == "POST":
                response = requests.post(
                    f"{SERVER_URL}{endpoint}",
                    json={},
                    cookies=tenant2_cookies,
                    headers={"X-Tenant-Id": TEST_TENANT_1},
                )
            else:
                response = requests.request(
                    method,
                    f"{SERVER_URL}{endpoint}",
                    cookies=tenant2_cookies,
                    headers={"X-Tenant-Id": TEST_TENANT_1},
                )

            if response.status_code == 200:
                print("   🟡 TENANT BYPASS: Cross-tenant access allowed")
                results["tenant_bypass_vulnerabilities"].append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "vulnerability": "Cross-tenant access allowed",
                        "status_code": response.status_code,
                        "description": description,
                    }
                )
            elif response.status_code in [401, 403, 404]:
                print(f"   ✅ Tenant isolation enforced ({response.status_code})")
                results["secured_endpoints"].append(
                    {"endpoint": endpoint, "method": method, "status_code": response.status_code}
                )
            else:
                print(f"   ⚠️ Unexpected response: {response.status_code}")

        except Exception as e:
            print(f"   ⚠️ Error testing cross-tenant access: {e}")

    # Summary Report
    print("\n" + "=" * 60)
    print("🔐 SECURITY ANALYSIS SUMMARY")
    print("=" * 60)

    critical_count = len(results["critical_vulnerabilities"])
    tenant_bypass_count = len(results["tenant_bypass_vulnerabilities"])
    secured_count = len(results["secured_endpoints"])
    total_tested = results["total_tested"]

    print(f"Total Endpoints Tested: {total_tested}")
    print(f"🔴 Critical Vulnerabilities: {critical_count}")
    print(f"🟡 Tenant Bypass Vulnerabilities: {tenant_bypass_count}")
    print(f"✅ Properly Secured: {secured_count}")

    security_score = (secured_count / total_tested) * 100 if total_tested > 0 else 0
    print(f"🔐 Security Score: {security_score:.1f}%")

    if critical_count > 0:
        print(f"\n🚨 IMMEDIATE ACTION REQUIRED: {critical_count} critical vulnerabilities found!")
        for vuln in results["critical_vulnerabilities"]:
            print(f"   • {vuln['method']} {vuln['endpoint']} - {vuln['vulnerability']}")

    if tenant_bypass_count > 0:
        print(
            f"\n⚠️ TENANT ISOLATION GAPS: {tenant_bypass_count} endpoints allow cross-tenant access"
        )
        for vuln in results["tenant_bypass_vulnerabilities"]:
            print(f"   • {vuln['method']} {vuln['endpoint']} - {vuln['description']}")

    if critical_count == 0:
        print("\n✅ NO CRITICAL VULNERABILITIES: All endpoints require authentication")

    if tenant_bypass_count == 0 and critical_count == 0:
        print("\n🎉 COMPLETE SECURITY: All endpoints properly enforce tenant isolation!")

    # Save detailed results
    with open("task9_5_critical_security_results.json", "w") as f:
        json.dump(results, f, indent=2)

    return results


if __name__ == "__main__":
    # Check if DEV_NO_AUTH is disabled
    if os.getenv("DEV_NO_AUTH", "false").lower() != "false":
        print("⚠️ WARNING: DEV_NO_AUTH is enabled. Disable it for accurate security testing.")
        print("Run: export DEV_NO_AUTH=false")
        sys.exit(1)

    try:
        results = test_critical_endpoints()

        # Exit with appropriate code
        critical_vulns = len(results.get("critical_vulnerabilities", []))
        if critical_vulns > 0:
            sys.exit(1)  # Critical vulnerabilities found
        else:
            sys.exit(0)  # No critical vulnerabilities

    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        sys.exit(1)
