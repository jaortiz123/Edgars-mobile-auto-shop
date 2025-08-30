#!/usr/bin/env python3
"""Simple refresh token test to debug the issue"""

import time

import requests


def test_refresh_debug():
    try:
        server_url = "http://localhost:3002"
        tenant_id = "00000000-0000-0000-0000-000000000001"
        test_email = f"refresh_debug_{int(time.time())}@test.com"

        print("Testing refresh token debug...")

        # 1. Register user
        reg_response = requests.post(
            f"{server_url}/api/customers/register",
            json={"email": test_email, "password": "Test123!", "name": "Debug User"},
            headers={"X-Tenant-Id": tenant_id},
        )
        print(f"Registration: {reg_response.status_code}")

        if reg_response.status_code != 200:
            print(f"Registration failed: {reg_response.text}")
            return

        # 2. Login to get cookies
        login_response = requests.post(
            f"{server_url}/api/customers/login",
            json={"email": test_email, "password": "Test123!"},
            headers={"X-Tenant-Id": tenant_id},
        )
        print(f"Login: {login_response.status_code}")

        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return

        # 3. Test refresh - this should trigger debug output
        refresh_response = requests.post(
            f"{server_url}/api/auth/refresh",
            cookies=login_response.cookies,
            headers={"X-Tenant-Id": tenant_id},
        )
        print(f"Refresh: {refresh_response.status_code}")
        if refresh_response.status_code != 200:
            print(f"Refresh failed: {refresh_response.text}")

        print("Test completed - check server terminal for debug output")

    except Exception as e:
        print(f"Test failed: {e}")


if __name__ == "__main__":
    test_refresh_debug()
