#!/usr/bin/env python3
"""
Integration test for PR1 customer profile GET → PATCH flow.
Tests that ETag from GET profile endpoint works with PATCH endpoint.
"""

import jwt
import pytest
import requests

# This external integration test targets a live server on localhost:3001.
# Skip in unit/integration CI runs for the backend test container environment.
pytestmark = pytest.mark.skip(reason="Requires live server at :3001; skipped in CI backend suite")

# Configuration
BASE_URL = "http://localhost:3001"
JWT_SECRET = "dev_secret"  # Match backend default
JWT_ALG = "HS256"


def get_auth_token(role="Owner", sub="test_user"):
    """Generate a JWT token for testing."""
    token = jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm=JWT_ALG)
    return token


def get_auth_headers():
    """Get authorization headers for API calls."""
    token = get_auth_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def setup_test_customer():
    """Create a test customer with PR1 fields for testing."""
    import psycopg2

    # Connect directly to database to insert test data
    conn = psycopg2.connect(
        host="localhost", port=5432, database="postgres", user="postgres", password="postgres"
    )

    with conn:
        with conn.cursor() as cur:
            # Clean up any existing test customer
            cur.execute("DELETE FROM customers WHERE email = 'integration.test@example.com'")

            # Insert test customer with all PR1 fields
            cur.execute(
                """
                INSERT INTO customers (name, email, phone, full_name, tags, notes, sms_consent)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
                RETURNING id
            """,
                (
                    "Integration Test User",
                    "integration.test@example.com",
                    "555-0001",
                    "Integration Test User Full Name",
                    '["test", "integration"]',
                    "Test notes for integration",
                    True,
                ),
            )

            customer_id = cur.fetchone()[0]
            conn.commit()

    conn.close()
    return customer_id


def cleanup_test_customer():
    """Clean up test customer after testing."""
    import psycopg2

    conn = psycopg2.connect(
        host="localhost", port=5432, database="postgres", user="postgres", password="postgres"
    )

    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM customers WHERE email = 'integration.test@example.com'")
            conn.commit()

    conn.close()


def test_get_profile_provides_etag():
    """Test that GET profile endpoint provides ETag in header and customer object."""
    customer_id = setup_test_customer()

    try:
        headers = get_auth_headers()

        # GET customer profile
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}/profile", headers=headers
        )

        print(f"GET Profile Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        # Check ETag in header
        etag_header = response.headers.get("ETag")
        print(f"ETag Header: {etag_header}")
        assert etag_header is not None, "ETag header is missing"
        assert etag_header.startswith('W/"'), f'ETag should start with W/", got: {etag_header}'

        # Check customer data includes PR1 fields and _etag
        data = response.json()
        customer = data["customer"]

        # Verify PR1 fields are present
        expected_fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "tags",
            "notes",
            "sms_consent",
            "_etag",
        ]
        for field in expected_fields:
            assert field in customer, f"Missing field: {field}"

        # Verify values
        assert customer["full_name"] == "Integration Test User Full Name"
        assert customer["email"] == "integration.test@example.com"
        assert customer["phone"] == "555-0001"
        assert customer["tags"] == ["test", "integration"]
        assert customer["notes"] == "Test notes for integration"
        assert customer["sms_consent"] is True

        # Verify _etag matches header (without W/ prefix)
        expected_etag = etag_header.replace('W/"', "").replace('"', "")
        assert (
            customer["_etag"] == expected_etag
        ), f"Customer _etag {customer['_etag']} doesn't match header {expected_etag}"

        print("✅ GET profile provides correct ETag and PR1 fields")
        return customer_id, etag_header

    except Exception as e:
        cleanup_test_customer()
        raise e


def test_patch_with_profile_etag(customer_id, etag):
    """Test that PATCH works with ETag from GET profile."""
    try:
        headers = get_auth_headers()
        headers["If-Match"] = etag

        # PATCH customer with PR1 data
        patch_data = {
            "full_name": "Integration Test User Updated",
            "email": "integration.updated@example.com",
            "phone": "555-0002",
            "tags": ["test", "integration", "updated"],
            "notes": "Updated test notes",
            "sms_consent": False,
        }

        response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers, json=patch_data
        )

        print(f"PATCH Status: {response.status_code}")
        if response.status_code != 200:
            print(f"PATCH Error Response: {response.text}")
        else:
            print(f"PATCH Success Response: {response.text}")

        assert (
            response.status_code == 200
        ), f"Expected 200, got {response.status_code}: {response.text}"

        # Verify response contains updated data
        updated_data = response.json()["data"]

        # Check all PR1 fields were updated correctly
        assert updated_data["full_name"] == "Integration Test User Updated"
        assert updated_data["email"] == "integration.updated@example.com"
        assert updated_data["phone"] == "555-0002"
        assert updated_data["tags"] == ["test", "integration", "updated"]
        assert updated_data["notes"] == "Updated test notes"
        assert updated_data["sms_consent"] is False

        # Verify new ETag is provided
        new_etag = response.headers.get("ETag")
        assert new_etag is not None, "No ETag in PATCH response"
        assert new_etag != etag, "ETag should change after update"

        print("✅ PATCH with profile ETag succeeded")
        return new_etag

    except Exception as e:
        cleanup_test_customer()
        raise e


def test_full_integration_flow():
    """Test the complete GET profile → PATCH → GET profile flow."""
    print("\n=== Testing Full Integration Flow ===")

    # Step 1: GET profile and extract ETag
    print("\n1. GET customer profile...")
    customer_id, original_etag = test_get_profile_provides_etag()

    # Step 2: PATCH with ETag from profile
    print("\n2. PATCH customer with profile ETag...")
    new_etag = test_patch_with_profile_etag(customer_id, original_etag)

    # Step 3: GET profile again and verify changes
    print("\n3. GET profile again to verify changes...")
    headers = get_auth_headers()
    response = requests.get(
        f"{BASE_URL}/api/admin/customers/{customer_id}/profile", headers=headers
    )

    assert response.status_code == 200
    data = response.json()
    customer = data["customer"]

    print(f"Step 3 Profile Data: {customer}")

    # Verify changes persisted
    assert customer["full_name"] == "Integration Test User Updated"
    assert customer["email"] == "integration.updated@example.com"
    assert customer["tags"] == ["test", "integration", "updated"]
    assert customer["sms_consent"] is False

    # Verify ETag changed
    final_etag = response.headers.get("ETag")
    assert final_etag == new_etag, "Final ETag should match PATCH response ETag"

    print("✅ Full integration flow completed successfully")

    # Cleanup
    cleanup_test_customer()

    return True


if __name__ == "__main__":
    print("Running PR1 Customer Profile Integration Test...")

    try:
        success = test_full_integration_flow()
        if success:
            print("\n🎉 All integration tests passed!")
            print("✅ GET profile endpoint provides compatible ETag")
            print("✅ PATCH endpoint accepts profile ETag")
            print("✅ End-to-end customer edit flow works")
        else:
            print("\n💥 Integration tests failed!")
            exit(1)

    except Exception as e:
        print(f"\n💥 Integration test failed with error: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
