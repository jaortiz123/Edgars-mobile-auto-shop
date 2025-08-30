#!/usr/bin/env python3
"""
Cross-Tenant Attack Test - Proof of Concept
Shows exactly what the security test should validate
"""

import requests


def demonstrate_cross_tenant_attack():
    """
    This demonstrates the exact cross-tenant attack scenario.
    Even if we can't authenticate due to database issues,
    this shows the precise HTTP requests that test security.
    """

    print("🔒 CROSS-TENANT ATTACK DEMONSTRATION")
    print("=" * 60)
    print("This shows the exact HTTP attack that must be blocked")
    print("=" * 60)

    server_url = "http://localhost:3001"
    tenant_a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    tenant_b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    print("\n📋 TEST SCENARIO:")
    print("1. Authenticate as Tenant A admin")
    print("2. Get valid JWT token for Tenant A")
    print("3. Use that JWT with X-Tenant-Id header for Tenant B")
    print("4. Attempt to access protected endpoints")
    print("5. ASSERT: All requests return 403 Forbidden")

    print("\n🚨 THE ATTACK REQUESTS:")

    # Show what the attack requests would look like
    mock_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.TENANT_A_PAYLOAD.signature"

    attack_endpoints = [
        "/api/admin/invoices",
        "/api/admin/customers",
        "/api/admin/appointments",
        "/api/customers",
        "/api/invoices",
    ]

    for endpoint in attack_endpoints:
        print(f"\n🎯 Attack: {endpoint}")
        print("   Headers:")
        print(f"     Authorization: Bearer {mock_jwt[:30]}...")
        print(f"     X-Tenant-Id: {tenant_b_id}")
        print("   Expected Response: 403 Forbidden")

        # Try the actual request to see what happens
        try:
            response = requests.get(
                f"{server_url}{endpoint}",
                headers={"Authorization": f"Bearer {mock_jwt}", "X-Tenant-Id": tenant_b_id},
                timeout=5,
            )

            status = response.status_code
            if status == 401:
                print(f"   ✅ ACTUAL RESPONSE: {status} Unauthorized (Good - auth required)")
            elif status == 403:
                print(f"   ✅ ACTUAL RESPONSE: {status} Forbidden (PERFECT - attack blocked)")
            elif status == 404:
                print(f"   ⚠️  ACTUAL RESPONSE: {status} Not Found (Endpoint doesn't exist)")
            elif status == 500:
                print(f"   ⚠️  ACTUAL RESPONSE: {status} Server Error (Database issue)")
            elif status in [200, 201]:
                print(f"   🚨 ACTUAL RESPONSE: {status} SUCCESS - CRITICAL VULNERABILITY!")
                print("      This means the attack worked!")
            else:
                print(f"   ❓ ACTUAL RESPONSE: {status} (Unclear)")

        except requests.exceptions.ConnectionError:
            print("   ❌ ACTUAL RESPONSE: Connection refused (server not running)")
        except Exception as e:
            print(f"   ❌ ACTUAL RESPONSE: Error - {str(e)[:50]}")

    print("\n📊 SECURITY VALIDATION CRITERIA:")
    print("✅ SUCCESS: All endpoints return 401, 403, or 404")
    print("🚨 FAILURE: Any endpoint returns 200 with data")
    print("⚠️  UNCLEAR: 500 errors (need working database)")

    print("\n🎯 DEFINITIVE TEST REQUIREMENTS:")
    print("1. Working server with SQLite database connection")
    print("2. Successful authentication to get real JWT")
    print("3. Cross-tenant attack requests as shown above")
    print("4. Assert all responses are 403 Forbidden")

    print("\n🔧 TO COMPLETE THIS TEST:")
    print("1. Fix server database connectivity issues")
    print("2. Run: python3 cross_tenant_attack_test.py")
    print("3. Verify all attack requests return 403")


if __name__ == "__main__":
    demonstrate_cross_tenant_attack()
