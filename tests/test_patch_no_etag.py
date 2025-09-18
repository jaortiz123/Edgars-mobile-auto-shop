#!/usr/bin/env python3
"""
Bypass ETag test for PR1 PATCH customer endpoint.
Tests the new fields without ETag validation for initial verification.
"""

import json

import jwt
import requests

# Configuration
BASE_URL = "http://localhost:3001"
JWT_SECRET = "your_jwt_secret_change_in_production_12345"
JWT_ALG = "HS256"


def get_auth_token(role="Owner", sub="tester"):
    """Generate a JWT token for testing."""
    token = jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm=JWT_ALG)
    return token


def test_patch_customer_no_etag():
    """Test PATCH customer with PR1 fields (without ETag)."""
    # Get auth header
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    customer_id = 1  # Test with the customer we inserted

    print("Testing PATCH without ETag (will expect 400)...")
    patch_data = {
        "full_name": "Jonathan Q. Doe",
        "email": "jonathan.doe@example.com",
        "phone": "555-9876",
        "tags": ["premium", "loyal", "vip"],
        "notes": "Updated notes for this customer",
        "sms_consent": True,
    }

    response = requests.patch(
        f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers, json=patch_data
    )

    print(f"PATCH Status: {response.status_code}")
    print(f"PATCH Response: {json.dumps(response.json(), indent=2)}")

    if response.status_code == 400:
        error_data = response.json()
        if error_data.get("error", {}).get("message") == "If-Match required":
            print("✅ Endpoint correctly requires If-Match header")
            return True
        else:
            print("❌ Unexpected 400 error message")
            return False
    else:
        print(f"❌ Expected 400 but got {response.status_code}")
        return False


if __name__ == "__main__":
    print("Testing PR1 PATCH customer endpoint (no ETag)...")
    success = test_patch_customer_no_etag()
    if success:
        print("\n🎉 Endpoint validation test passed!")
    else:
        print("\n💥 Endpoint validation test failed!")
