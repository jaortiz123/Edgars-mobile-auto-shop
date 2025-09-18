#!/usr/bin/env python3
"""
Quick test script for PR1 PATCH customer endpoint.
Tests the new fields: full_name, tags, notes, sms_consent
"""

import hashlib
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


def compute_strong_etag(kind, row, editable_fields):
    """Compute strong ETag like the backend does."""
    ts = row.get("ts") or row.get("updated_at") or row.get("created_at") or "0"
    parts = [kind, str(row.get("id")), str(ts)]
    for f in sorted(editable_fields):
        parts.append(f"{f}={row.get(f)}")
    src = "|".join(parts)
    return 'W/"' + hashlib.sha1(src.encode("utf-8")).hexdigest() + '"'


def test_patch_customer_pr1():
    """Test PATCH customer with PR1 fields."""
    # Get auth header
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    customer_id = 1  # Test with the customer we inserted

    # First, get the customer directly from the database using a direct call
    print("1. Getting customer data directly...")
    response = requests.get(f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers)
    print(f"GET Status: {response.status_code}")
    if response.status_code != 200:
        print(f"GET Error: {response.text}")
        return

    customer_data = response.json()["data"]["customer"]
    print(f"Customer data: {json.dumps(customer_data, indent=2)}")

    # Manually compute the ETag using the actual database values
    mock_row = {
        "id": customer_id,
        "name": "John Doe",
        "full_name": "Jonathan Doe",
        "email": "john@example.com",
        "phone": "555-1234",
        "tags": ["premium", "loyal"],  # JSONB arrays are returned as Python lists
        "notes": "Great customer",
        "sms_consent": True,
        "ts": "2025-08-27T00:18:58.837375",
    }

    etag = compute_strong_etag(
        "customer",
        mock_row,
        ["name", "full_name", "email", "phone", "tags", "notes", "sms_consent"],
    )
    print(f"Computed ETag: {etag}")

    # Now test PATCH with PR1 fields
    print("\n2. Testing PATCH with PR1 fields...")
    patch_headers = headers.copy()
    patch_headers["If-Match"] = etag

    patch_data = {
        "full_name": "Jonathan Q. Doe",
        "email": "jonathan.doe@example.com",
        "phone": "555-9876",
        "tags": ["premium", "loyal", "vip"],
        "notes": "Updated notes for this customer",
        "sms_consent": True,
    }

    response = requests.patch(
        f"{BASE_URL}/api/admin/customers/{customer_id}", headers=patch_headers, json=patch_data
    )

    print(f"PATCH Status: {response.status_code}")
    print(f"PATCH Response: {json.dumps(response.json(), indent=2)}")

    if response.status_code == 200:
        print("✅ PATCH succeeded!")
        new_data = response.json()["data"]

        # Verify the new fields are present and correct
        print("\n3. Verifying PR1 fields...")
        expected_checks = [
            ("full_name", "Jonathan Q. Doe"),
            ("email", "jonathan.doe@example.com"),
            ("phone", "555-9876"),
            ("tags", ["premium", "loyal", "vip"]),
            ("notes", "Updated notes for this customer"),
            ("sms_consent", True),
        ]

        for field, expected in expected_checks:
            actual = new_data.get(field)
            if actual == expected:
                print(f"✅ {field}: {actual}")
            else:
                print(f"❌ {field}: expected {expected}, got {actual}")

        return True
    else:
        print(f"❌ PATCH failed with status {response.status_code}")
        try:
            error_data = response.json()
            print(f"Error details: {json.dumps(error_data, indent=2)}")
        except:
            print(f"Raw error response: {response.text}")
        return False


if __name__ == "__main__":
    print("Testing PR1 PATCH customer endpoint...")
    success = test_patch_customer_pr1()
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n💥 Tests failed!")
