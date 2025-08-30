#!/usr/bin/env python3
"""
Simple server test to verify basic connectivity before running cross-tenant test
"""

import requests


def test_server():
    base_url = "http://localhost:3001"

    print("Testing server connectivity...")

    # Test 1: Try health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"Health endpoint: {response.status_code}")
        if response.status_code == 200:
            print("✅ Health endpoint works")
    except Exception as e:
        print(f"❌ Health endpoint failed: {e}")

    # Test 2: Try a simple endpoint
    try:
        response = requests.get(f"{base_url}/api", timeout=5)
        print(f"API root: {response.status_code}")
    except Exception as e:
        print(f"❌ API root failed: {e}")

    # Test 3: Try customer registration (should work)
    try:
        response = requests.post(
            f"{base_url}/api/customers/register",
            json={"email": "test@example.com", "password": "test123", "name": "Test User"},
            headers={"X-Tenant-Id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"},
            timeout=5,
        )
        print(f"Customer registration: {response.status_code}")
        if response.status_code in [200, 201, 400, 422]:
            print("✅ Customer registration endpoint responding")
    except Exception as e:
        print(f"❌ Customer registration failed: {e}")


if __name__ == "__main__":
    test_server()
