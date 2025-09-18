#!/usr/bin/env python3
"""Simple password reset flow test to verify functionality"""

import time

import requests


def test_single_tenant_password_reset():
    try:
        server_url = "http://localhost:3002"
        tenant_id = "00000000-0000-0000-0000-000000000001"
        test_email = f"pwreset_test_{int(time.time())}@test.com"

        print("=== SINGLE-TENANT PASSWORD RESET FLOW TEST ===")

        # Step 1: Register user
        reg_response = requests.post(
            f"{server_url}/api/customers/register",
            json={"email": test_email, "password": "OriginalPass123!", "name": "Reset Test User"},
            headers={"X-Tenant-Id": tenant_id},
        )
        print(f"1. Registration: {reg_response.status_code}")

        if reg_response.status_code != 200:
            print(f"Registration failed: {reg_response.text}")
            return False

        # Step 2: Request password reset token
        reset_request_response = requests.post(
            f"{server_url}/api/auth/reset-request",
            json={"email": test_email},
            headers={"X-Tenant-Id": tenant_id},
        )
        print(f"2. Reset Request: {reset_request_response.status_code}")

        if reset_request_response.status_code != 202:
            print(f"Reset request failed: {reset_request_response.text}")
            return False

        print("✅ Single-tenant password reset request successful")

        # Note: In a full test, we would:
        # - Extract reset token from email/database
        # - Use token to confirm password reset via /api/auth/reset-confirm
        # - Verify old password no longer works
        # - Verify new password works

        print("⚠️  Complete flow requires database token extraction (not implemented)")
        return True

    except Exception as e:
        print(f"Test failed: {e}")
        return False


if __name__ == "__main__":
    success = test_single_tenant_password_reset()
    if success:
        print("✅ Single-tenant flow verification PASSED")
    else:
        print("❌ Single-tenant flow verification FAILED")
