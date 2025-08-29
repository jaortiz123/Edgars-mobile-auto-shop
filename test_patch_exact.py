#!/usr/bin/env python3
"""
Test PR1 PATCH customer endpoint with exact ETag calculation.
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
    """Compute strong ETag exactly like the backend does."""
    ts = row.get("ts") or row.get("updated_at") or row.get("created_at") or "0"
    parts = [kind, str(row.get("id")), str(ts)]
    for f in sorted(editable_fields):
        parts.append(f"{f}={row.get(f)}")
    src = "|".join(parts)
    print(f"ETag source string: {src}")  # Debug output
    return 'W/"' + hashlib.sha1(src.encode("utf-8")).hexdigest() + '"'


def test_patch_customer_exact():
    """Test PATCH customer with exact database values."""
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    customer_id = 3  # The test customer we just created

    # Use exact values from the database insert
    mock_row = {
        "id": customer_id,
        "name": "Test User",
        "full_name": "Test User Full",
        "email": "test@example.com",
        "phone": "111-1111",
        "tags": [],  # Empty JSONB array
        "notes": "Test notes",
        "sms_consent": False,
        "ts": "2025-08-27T00:23:35.174896",
    }

    etag = compute_strong_etag(
        "customer",
        mock_row,
        ["name", "full_name", "email", "phone", "tags", "notes", "sms_consent"],
    )
    print(f"Computed ETag: {etag}")

    # Test PATCH with valid data
    print("Testing PATCH with computed ETag...")
    patch_headers = headers.copy()
    patch_headers["If-Match"] = etag

    patch_data = {
        "full_name": "Test User Updated",
        "email": "test.updated@example.com",
        "phone": "222-2222",
        "tags": ["updated", "test"],
        "notes": "Updated test notes",
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
        print("\nVerifying PR1 fields...")
        expected_checks = [
            ("full_name", "Test User Updated"),
            ("email", "test.updated@example.com"),
            ("phone", "222-2222"),
            ("tags", ["updated", "test"]),
            ("notes", "Updated test notes"),
            ("sms_consent", True),
        ]

        all_correct = True
        for field, expected in expected_checks:
            actual = new_data.get(field)
            if actual == expected:
                print(f"✅ {field}: {actual}")
            else:
                print(f"❌ {field}: expected {expected}, got {actual}")
                all_correct = False

        return all_correct
    else:
        print(f"❌ PATCH failed with status {response.status_code}")
        return False


if __name__ == "__main__":
    print("Testing PR1 PATCH customer endpoint with exact ETag...")
    success = test_patch_customer_exact()
    if success:
        print("\n🎉 PR1 PATCH test passed!")
    else:
        print("\n💥 PR1 PATCH test failed!")
