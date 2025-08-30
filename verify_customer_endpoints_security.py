#!/usr/bin/env python3
"""
Emergency Security Verification - Customer Data Endpoints
Verify that newly secured customer data endpoints now properly return 403 Forbidden
instead of exposing sensitive customer information.

This script tests the endpoints we just secured:
- /api/admin/customers/search
- /api/admin/recent-customers
- /api/admin/customers/<id>
- /api/admin/customers/<id>/profile
- /api/admin/customers/<id>/visits
"""

import json
import sys
from datetime import datetime

import requests

# Flask server details
BASE_URL = "http://localhost:5005"

# Test endpoints for customer data access
CUSTOMER_ENDPOINTS = [
    {
        "url": f"{BASE_URL}/api/admin/customers/search",
        "method": "GET",
        "params": {"q": "test"},
        "description": "Customer search endpoint",
    },
    {
        "url": f"{BASE_URL}/api/admin/recent-customers",
        "method": "GET",
        "params": {"limit": "5"},
        "description": "Recent customers endpoint",
    },
    {
        "url": f"{BASE_URL}/api/admin/customers/12345",
        "method": "GET",
        "params": {},
        "description": "Customer profile (legacy) endpoint",
    },
    {
        "url": f"{BASE_URL}/api/admin/customers/12345/profile",
        "method": "GET",
        "params": {},
        "description": "Customer unified profile endpoint",
    },
    {
        "url": f"{BASE_URL}/api/admin/customers/12345/visits",
        "method": "GET",
        "params": {},
        "description": "Customer visits/appointments endpoint",
    },
]


def test_endpoint_security(endpoint_info):
    """Test that endpoint returns 403 without authentication"""
    url = endpoint_info["url"]
    method = endpoint_info["method"]
    params = endpoint_info["params"]
    description = endpoint_info["description"]

    print(f"\n🔍 Testing: {description}")
    print(f"   URL: {method} {url}")

    try:
        # Test without any authentication headers
        if method == "GET":
            response = requests.get(url, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=params, timeout=10)
        elif method == "PATCH":
            response = requests.patch(url, json=params, timeout=10)
        else:
            response = requests.request(method, url, json=params, timeout=10)

        print(f"   Status: {response.status_code}")

        if response.status_code == 403:
            print("   ✅ SECURE: Returns 403 Forbidden (authentication required)")
            return True
        elif response.status_code == 401:
            print("   ✅ SECURE: Returns 401 Unauthorized (authentication required)")
            return True
        else:
            print(f"   ❌ VULNERABLE: Expected 403/401 but got {response.status_code}")
            try:
                content = response.json()
                print(f"   Response content: {json.dumps(content, indent=2)[:200]}...")
            except:
                print(f"   Response content: {response.text[:200]}...")
            return False

    except requests.exceptions.RequestException as e:
        print(f"   ❌ REQUEST ERROR: {e}")
        return False


def main():
    print("🔒 EMERGENCY SECURITY VERIFICATION - Customer Data Endpoints")
    print("=" * 60)
    print(f"Testing at: {datetime.now()}")
    print(f"Target: {BASE_URL}")

    # Check if server is running
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Server status: {health_response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot reach server at {BASE_URL}")
        print(f"Error: {e}")
        sys.exit(1)

    print("\n🧪 Testing newly secured customer data endpoints...")

    secure_count = 0
    total_count = len(CUSTOMER_ENDPOINTS)

    for endpoint_info in CUSTOMER_ENDPOINTS:
        is_secure = test_endpoint_security(endpoint_info)
        if is_secure:
            secure_count += 1

    print("\n" + "=" * 60)
    print("📊 SECURITY VERIFICATION RESULTS:")
    print(f"   Endpoints tested: {total_count}")
    print(f"   Secure endpoints: {secure_count}")
    print(f"   Vulnerable endpoints: {total_count - secure_count}")

    if secure_count == total_count:
        print("   🎉 SUCCESS: All customer data endpoints are properly secured!")
        print("   🔒 Authentication is now required for customer data access")
        return 0
    else:
        print(f"   ⚠️  WARNING: {total_count - secure_count} endpoints still vulnerable")
        print("   🚨 These endpoints may expose sensitive customer data without authentication")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
