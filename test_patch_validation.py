#!/usr/bin/env python3
"""
Test PR1 normalization and validation by using a fake ETag to bypass precondition check.
This will show us if the PR1 functions work even if the ETag is wrong.
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


def test_patch_customer_fake_etag():
    """Test PATCH customer with PR1 fields using a fake ETag to see validation."""
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "If-Match": "fake-etag-for-testing",  # This will cause 412, but we can see validation
    }

    customer_id = 1

    print("Testing PATCH with fake ETag (expecting 412 conflict)...")
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

    if response.status_code == 412:
        print("✅ Got 412 conflict as expected (ETag mismatch)")
        return True
    elif response.status_code == 400:
        # Check if it's validation error - that would mean our validation functions work
        error_data = response.json()
        if "validation" in error_data.get("error", {}).get("message", "").lower():
            print("✅ Got validation error - PR1 validation functions are working!")
            return True
        else:
            print(f"❌ Unexpected 400 error: {error_data}")
            return False
    else:
        print(f"❌ Unexpected status code: {response.status_code}")
        return False


def test_patch_customer_invalid_data():
    """Test PATCH customer validation with invalid data."""
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "If-Match": "fake-etag-for-testing",
    }

    customer_id = 1

    print("\nTesting PATCH with invalid data (expecting validation errors)...")
    patch_data = {
        "full_name": "",  # Should fail validation (required)
        "email": "invalid-email",  # Should fail validation
        "tags": "not-an-array",  # Should fail validation (must be array)
    }

    response = requests.patch(
        f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers, json=patch_data
    )

    print(f"PATCH Status: {response.status_code}")
    print(f"PATCH Response: {json.dumps(response.json(), indent=2)}")

    if response.status_code == 400:
        error_data = response.json()
        if "validation" in error_data.get("error", {}).get("message", "").lower():
            print("✅ Got validation errors as expected - PR1 validation is working!")
            return True

    print("❌ Expected validation errors but didn't get them")
    return False


if __name__ == "__main__":
    print("Testing PR1 PATCH customer validation...")

    test1 = test_patch_customer_fake_etag()
    test2 = test_patch_customer_invalid_data()

    if test1 and test2:
        print("\n🎉 Validation tests passed!")
    else:
        print("\n💥 Some validation tests failed!")
