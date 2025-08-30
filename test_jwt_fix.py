#!/usr/bin/env python3
"""
Simple test to verify JWT token fix is working
"""

import time

import requests


def test_jwt_fix():
    base_url = "http://localhost:3002"

    # Wait for server to be ready
    print("Waiting for server...")
    max_retries = 10
    for i in range(max_retries):
        try:
            resp = requests.get(f"{base_url}/", timeout=2)
            print(f"Server is ready! Status: {resp.status_code}")
            break
        except requests.exceptions.RequestException:
            print(f"Retry {i+1}/{max_retries}...")
            time.sleep(2)
    else:
        print("❌ Server not ready after retries")
        return False

    # Test registration with valid tenant
    test_email = f"jwt_test_{int(time.time())}@test.com"
    tenant_id = "00000000-0000-0000-0000-000000000001"  # Edgar's Auto Shop

    print(f"\\nTesting registration with tenant {tenant_id}...")

    reg_data = {
        "email": test_email,
        "password": "TestPass123!",
        "name": "JWT Test User",
        "tenant_id": tenant_id,
    }

    try:
        reg_response = requests.post(
            f"{base_url}/api/customers/register",
            json=reg_data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print(f"Registration response: {reg_response.status_code}")

        if reg_response.status_code == 201:
            print("✅ Registration successful")

            # Now test login
            print("Testing login...")
            login_data = {"email": test_email, "password": "TestPass123!", "tenant_id": tenant_id}

            login_response = requests.post(
                f"{base_url}/api/customers/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            print(f"Login response: {login_response.status_code}")

            if login_response.status_code == 200:
                print("✅ Login successful")

                # Check if we have cookies (JWT tokens)
                cookies = login_response.cookies
                print(f"Cookies received: {list(cookies.keys())}")

                if "access_token" in cookies:
                    print("✅ Access token received")

                    # Test refresh token
                    print("Testing refresh token...")
                    refresh_response = requests.post(
                        f"{base_url}/api/auth/refresh", cookies=cookies, timeout=10
                    )

                    print(f"Refresh response: {refresh_response.status_code}")
                    print(f"Refresh response text: {refresh_response.text[:200]}...")

                    if refresh_response.status_code == 200:
                        print("✅ Refresh token works - JWT fix successful!")
                        return True
                    else:
                        print("❌ Refresh token failed")
                        return False
                else:
                    print("❌ No access token in response")
                    return False
            else:
                print(f"❌ Login failed: {login_response.text[:200]}...")
                return False
        else:
            print(f"❌ Registration failed: {reg_response.text[:200]}...")
            return False

    except Exception as e:
        print(f"❌ Test error: {e}")
        return False


if __name__ == "__main__":
    success = test_jwt_fix()
    print(f"\\nJWT Fix Test: {'✅ PASSED' if success else '❌ FAILED'}")
