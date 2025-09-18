#!/usr/bin/env python3
"""Dedicated Cross-Tenant Security Test for Password Reset"""

import os
import time

import requests


def get_reset_token_from_logs():
    """Extract reset token from server logs for testing"""
    try:
        # Check current directory for server logs
        log_files = [
            "/Users/jesusortiz/Edgars-mobile-auto-shop/debug_server_final.log",
            "/Users/jesusortiz/Edgars-mobile-auto-shop/debug_server_new.log",
            "/Users/jesusortiz/Edgars-mobile-auto-shop/server.log",
            "/Users/jesusortiz/Edgars-mobile-auto-shop/rds-backend.log",
            "/Users/jesusortiz/Edgars-mobile-auto-shop/backend-rds.log",
        ]

        for log_file in log_files:
            try:
                if os.path.exists(log_file):
                    with open(log_file) as f:
                        lines = f.readlines()

                    # Look for the most recent reset token log entry
                    for line in reversed(lines):
                        if "PASSWORD RESET TOKEN (REMOVE IN PROD)" in line:
                            # Extract token from log line
                            # Format: INFO:app:PASSWORD RESET TOKEN (REMOVE IN PROD): abc123def456
                            token = line.split("PASSWORD RESET TOKEN (REMOVE IN PROD): ")[1].strip()
                            print(f"Found reset token in {log_file}: {token[:10]}...")
                            return token
            except Exception as e:
                print(f"Error reading {log_file}: {e}")
                continue

        print("No reset token found in any log file")
        return None

    except Exception as e:
        print(f"Log parsing error: {e}")
        return None


def test_cross_tenant_security():
    """Test that reset tokens cannot be used across tenant boundaries"""

    server_url = "http://localhost:3001"
    tenant_a = "00000000-0000-0000-0000-000000000001"  # Edgar's Auto Shop
    tenant_b = "11111111-1111-1111-1111-111111111111"  # Test Tenant 1

    timestamp = int(time.time())
    user_a_email = f"cross_test_a_{timestamp}@test.com"
    user_b_email = f"cross_test_b_{timestamp}@test.com"

    print("=== CROSS-TENANT SECURITY TEST ===")
    print("Testing that reset tokens cannot be used across tenant boundaries")

    try:
        # Step 1: Create users in different tenants
        user_a_reg = requests.post(
            f"{server_url}/api/customers/register",
            json={"email": user_a_email, "password": "OriginalPassA123!", "name": "User A"},
            headers={"X-Tenant-Id": tenant_a},
        )

        user_b_reg = requests.post(
            f"{server_url}/api/customers/register",
            json={"email": user_b_email, "password": "OriginalPassB123!", "name": "User B"},
            headers={"X-Tenant-Id": tenant_b},
        )

        if user_a_reg.status_code != 200 or user_b_reg.status_code != 200:
            print(
                f"❌ Failed to create users: A={user_a_reg.status_code}, B={user_b_reg.status_code}"
            )
            return False

        print("✅ Created users in different tenants")

        # Step 2: Request password reset for User A in Tenant A
        reset_request_a = requests.post(
            f"{server_url}/api/auth/reset-request",
            json={"email": user_a_email},
            headers={"X-Tenant-Id": tenant_a},
        )

        if reset_request_a.status_code != 202:
            print(f"❌ Password reset request for User A failed: {reset_request_a.status_code}")
            return False

        print("✅ Password reset requested for User A in Tenant A")

        # Step 3: Extract reset token from database (for testing purposes)
        time.sleep(1)  # Allow time for token creation
        reset_token = get_reset_token_from_logs()

        if not reset_token:
            print("❌ Could not extract reset token from database")
            return False

        print("✅ Extracted reset token from database")

        # Step 4: SECURITY TEST - Try to use Tenant A's reset token in Tenant B context
        print("\n🔍 CROSS-TENANT ATTACK SIMULATION:")
        print(f"   Using User A's reset token: {reset_token[:8]}...")
        print("   Attempting to reset User B's password in Tenant B")

        malicious_reset = requests.post(
            f"{server_url}/api/auth/reset-confirm",
            json={
                "token": reset_token,
                "email": user_b_email,  # Different user!
                "password": "HackedPassword123!",
            },
            headers={"X-Tenant-Id": tenant_b},  # Different tenant!
        )

        print(f"   Response: {malicious_reset.status_code}")

        # Step 5: Verify the attack failed
        if malicious_reset.status_code in [400, 401, 403, 404]:
            print("✅ SECURITY SUCCESS: Cross-tenant reset token attack properly blocked")

            # Step 6: Verify that the legitimate reset still works
            legitimate_reset = requests.post(
                f"{server_url}/api/auth/reset-confirm",
                json={
                    "token": reset_token,
                    "email": user_a_email,  # Correct user
                    "password": "NewPassword123!",
                },
                headers={"X-Tenant-Id": tenant_a},  # Correct tenant
            )

            if legitimate_reset.status_code == 200:
                print("✅ VERIFICATION: Legitimate reset in correct tenant works")
                return True
            else:
                print(f"❌ UNEXPECTED: Legitimate reset failed: {legitimate_reset.status_code}")
                print(f"Response: {legitimate_reset.text}")
                return False

        else:
            print(
                f"🚨 SECURITY BREACH: Cross-tenant reset succeeded with status {malicious_reset.status_code}"
            )
            print(f"Response: {malicious_reset.text}")
            return False

    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False


if __name__ == "__main__":
    success = test_cross_tenant_security()
    if success:
        print("\n🎉 CROSS-TENANT SECURITY TEST PASSED")
        print("✅ Password reset tokens properly enforce tenant boundaries")
    else:
        print("\n💥 CROSS-TENANT SECURITY TEST FAILED")
        print("❌ CRITICAL SECURITY VULNERABILITY DETECTED")
        exit(1)
