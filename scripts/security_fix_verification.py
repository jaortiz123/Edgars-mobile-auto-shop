#!/usr/bin/env python3
"""
Demonstration of Cross-Tenant Security Fix
Shows that the previously vulnerable endpoints now return 403 Forbidden
"""

import sys

import requests


def test_endpoint_security(endpoint_name, endpoint_path):
    """Test an endpoint for proper cross-tenant security"""
    print(f"\n🎯 Testing {endpoint_name}: {endpoint_path}")

    try:
        # This is the exact same attack that previously returned HTTP 200
        response = requests.get(
            f"http://localhost:3001{endpoint_path}",
            headers={"X-Tenant-Id": "t2"},  # Try to access tenant t2 data
            timeout=5,
        )

        status = response.status_code
        if status == 403:
            print(f"✅ SECURED: Returns {status} Forbidden - Attack blocked!")
            print(f"   Response: {response.json().get('error', 'No error message')}")
            return True
        elif status == 200:
            print(f"❌ VULNERABLE: Returns {status} OK - Attack succeeded!")
            print(f"   Data exposed: {response.text[:100]}...")
            return False
        else:
            print(f"⚠️ UNEXPECTED: Returns {status} - {response.text[:100]}...")
            return False

    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False


def main():
    print("🔒 CROSS-TENANT SECURITY FIX VERIFICATION")
    print("==========================================")
    print("Testing endpoints that were previously vulnerable...")

    # Test the two endpoints that were identified as vulnerable
    results = []

    results.append(test_endpoint_security("Admin Invoices Endpoint", "/api/admin/invoices"))

    results.append(test_endpoint_security("Admin Appointments Endpoint", "/api/admin/appointments"))

    # Summary
    print("\n📊 SECURITY FIX RESULTS:")
    secured_count = sum(results)
    total_count = len(results)

    if secured_count == total_count:
        print(f"🎉 SUCCESS: All {total_count} vulnerable endpoints are now SECURED!")
        print("✅ Cross-tenant attacks are now blocked with 403 Forbidden")
        print("✅ Critical security vulnerabilities have been FIXED")
        return 0
    else:
        print(f"❌ FAILURE: {total_count - secured_count} endpoints still vulnerable")
        print("🚨 Additional security work needed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
