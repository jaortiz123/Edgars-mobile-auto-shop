#!/usr/bin/env python3
"""
Debug PATCH endpoint by calling it directly and checking database state
"""

import json

import jwt
import psycopg2
import requests

# Configuration
BASE_URL = "http://localhost:3001"
JWT_SECRET = "dev_secret"
JWT_ALG = "HS256"


def get_auth_token(role="Owner", sub="tester"):
    """Generate a JWT token for testing."""
    token = jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm=JWT_ALG)
    return token


def check_db_state(customer_id, label):
    """Check current database state"""
    conn = psycopg2.connect(
        host="localhost", port=5432, database="postgres", user="postgres", password="postgres"
    )

    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, full_name, email, phone, tags::text, notes, sms_consent FROM customers WHERE id = %s",
                (customer_id,),
            )
            row = cur.fetchone()

    conn.close()

    if row:
        print(
            f"{label}: id={row[0]}, name='{row[1]}', full_name='{row[2]}', email='{row[3]}', phone='{row[4]}', tags={row[5]}, notes='{row[6]}', sms_consent={row[7]}"
        )
        return row
    else:
        print(f"{label}: Customer not found")
        return None


def test_patch_endpoint():
    customer_id = 15

    # Check initial state
    print("=== PATCH Endpoint Debug ===")
    initial_state = check_db_state(customer_id, "Before PATCH")

    if not initial_state:
        print("Customer doesn't exist, exiting")
        return

    # Get profile to get ETag
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    profile_response = requests.get(
        f"{BASE_URL}/api/admin/customers/{customer_id}/profile", headers=headers
    )
    print(f"GET Profile Status: {profile_response.status_code}")

    if profile_response.status_code != 200:
        print("Failed to get profile")
        return

    etag = profile_response.headers.get("ETag")
    print(f"Current ETag: {etag}")

    # Perform PATCH
    patch_data = {
        "name": "DEBUG Updated Name",
        "full_name": "DEBUG Updated Full Name",
        "email": "debug.updated@example.com",
        "phone": "999-DEBUG",
        "tags": ["debug", "test"],
        "notes": "DEBUG updated notes",
        "sms_consent": False,
    }

    patch_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "If-Match": etag,
    }

    print(f"PATCH Data: {json.dumps(patch_data, indent=2)}")

    patch_response = requests.patch(
        f"{BASE_URL}/api/admin/customers/{customer_id}", headers=patch_headers, json=patch_data
    )

    print(f"PATCH Status: {patch_response.status_code}")
    print(f"PATCH Response: {patch_response.text}")

    # Check final state
    final_state = check_db_state(customer_id, "After PATCH")

    # Compare states
    if initial_state and final_state:
        print("\n=== Comparison ===")
        fields = ["id", "name", "full_name", "email", "phone", "tags", "notes", "sms_consent"]
        for i, field in enumerate(fields):
            initial_val = initial_state[i]
            final_val = final_state[i]
            if initial_val != final_val:
                print(f"  {field}: '{initial_val}' -> '{final_val}' ✅ CHANGED")
            else:
                print(f"  {field}: '{initial_val}' (unchanged)")


if __name__ == "__main__":
    test_patch_endpoint()
