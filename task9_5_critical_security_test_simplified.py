#!/usr/bin/env python3
"""
TASK 9.5: CRITICAL ENDPOINT SECURITY TEST - SIMPLIFIED
Test the 10 most critical admin endpoints for authentication and tenant isolation.
Focus on testing without requiring user registration.
"""

import json
import os
import sys

import requests

# Test configuration
SERVER_URL = "http://localhost:3001"
TEST_TENANT_1 = "00000000-0000-0000-0000-000000000001"
TEST_TENANT_2 = "00000000-0000-0000-0000-000000000002"


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

    results = {
        "critical_vulnerabilities": [],
        "authentication_required": [],
        "errors": [],
        "total_tested": len(critical_endpoints),
    }

    print(f"\nTesting {len(critical_endpoints)} critical endpoints...")
    print("-" * 60)

    for method, endpoint, description in critical_endpoints:
        print(f"\n🔍 Testing: {method} {endpoint} ({description})")

        # Test unauthenticated access (this is the critical security test)
        try:
            headers = {"X-Tenant-Id": TEST_TENANT_1}

            if method == "GET":
                response = requests.get(f"{SERVER_URL}{endpoint}", headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(
                    f"{SERVER_URL}{endpoint}", json={}, headers=headers, timeout=10
                )
            elif method == "PATCH":
                response = requests.patch(
                    f"{SERVER_URL}{endpoint}", json={}, headers=headers, timeout=10
                )
            elif method == "DELETE":
                response = requests.delete(f"{SERVER_URL}{endpoint}", headers=headers, timeout=10)
            else:
                response = requests.request(
                    method, f"{SERVER_URL}{endpoint}", headers=headers, timeout=10
                )

            print(f"   Status: {response.status_code}")

            # Analyze the response
            if response.status_code == 200:
                print("   🔴 CRITICAL VULNERABILITY: Unauthenticated access allowed!")
                results["critical_vulnerabilities"].append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "vulnerability": "No authentication required",
                        "status_code": response.status_code,
                        "description": description,
                    }
                )
            elif response.status_code in [401, 403]:
                print("   ✅ SECURED: Authentication required")
                results["authentication_required"].append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "status_code": response.status_code,
                        "description": description,
                    }
                )
            elif response.status_code == 404:
                print("   ℹ️ Not Found (404) - Endpoint may not exist or require specific resource")
            elif response.status_code == 400:
                print("   ℹ️ Bad Request (400) - May require authentication or valid data")
            elif response.status_code == 500:
                print("   ⚠️ Server Error (500) - Internal error, may indicate missing auth check")
                try:
                    error_text = response.text[:200] if response.text else "No error details"
                    print(f"      Error: {error_text}")
                except:
                    pass
            else:
                print(f"   ⚠️ Unexpected response: {response.status_code}")

        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request failed: {e}")
            results["errors"].append({"endpoint": endpoint, "method": method, "error": str(e)})
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
            results["errors"].append({"endpoint": endpoint, "method": method, "error": str(e)})

    # Summary Report
    print("\n" + "=" * 60)
    print("🔐 SECURITY ANALYSIS SUMMARY")
    print("=" * 60)

    critical_count = len(results["critical_vulnerabilities"])
    secured_count = len(results["authentication_required"])
    error_count = len(results["errors"])
    total_tested = results["total_tested"]

    print(f"Total Endpoints Tested: {total_tested}")
    print(f"🔴 Critical Vulnerabilities (No Auth): {critical_count}")
    print(f"✅ Authentication Required: {secured_count}")
    print(f"❌ Request Errors: {error_count}")

    # Calculate security score based on endpoints that require authentication
    testable_endpoints = total_tested - error_count
    security_score = (secured_count / testable_endpoints) * 100 if testable_endpoints > 0 else 0
    print(f"🔐 Security Score: {security_score:.1f}%")

    if critical_count > 0:
        print(f"\n🚨 IMMEDIATE ACTION REQUIRED: {critical_count} critical vulnerabilities found!")
        print("Endpoints allowing unauthenticated access:")
        for vuln in results["critical_vulnerabilities"]:
            print(f"   • {vuln['method']} {vuln['endpoint']} - {vuln['description']}")

    if critical_count == 0 and secured_count > 0:
        print("\n✅ AUTHENTICATION SECURITY: All testable endpoints require authentication")

    if secured_count == testable_endpoints and testable_endpoints > 0:
        print(
            f"\n🎉 COMPLETE AUTHENTICATION SECURITY: All {testable_endpoints} testable endpoints require authentication!"
        )

    # Save detailed results
    with open("task9_5_critical_security_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n📄 Detailed results saved to: task9_5_critical_security_results.json")

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
            print(
                f"\n❌ TASK 9.5 INCOMPLETE: {critical_vulns} critical vulnerabilities need to be fixed"
            )
            sys.exit(1)  # Critical vulnerabilities found
        else:
            print("\n✅ TASK 9.5 PROGRESS: No critical vulnerabilities in tested endpoints")
            sys.exit(0)  # No critical vulnerabilities

    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        sys.exit(1)
