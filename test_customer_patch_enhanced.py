#!/usr/bin/env python3
"""Test script for the enhanced PATCH /api/admin/customers/{id} endpoint"""

import json

import requests

BASE_URL = "http://localhost:3001"


def test_customer_patch_enhanced():
    print("🧪 Testing Enhanced Customer PATCH Endpoint")
    print("=" * 50)

    # First, let's get a test customer to work with
    # We'll need to authenticate first
    login_data = {"username": "admin", "password": "admin123"}

    try:
        # Login
        print("1. Logging in...")
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json=login_data)
        if login_response.status_code == 200:
            print("✅ Login successful")
            auth_token = login_response.json()["data"]["token"]
            headers = {"Authorization": f"Bearer {auth_token}"}
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return

        # Use a known customer ID for testing
        customer_id = "279"  # Using existing customer from database
        print(f"2. Using test customer ID: {customer_id}")

        # Get customer details for ETag
        print("3. Getting customer details for ETag...")
        customer_response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers
        )
        if customer_response.status_code != 200:
            print(f"❌ Failed to get customer: {customer_response.status_code}")
            return

        customer_data = customer_response.json()
        etag = customer_response.headers.get("ETag")
        print(f"✅ Got customer data and ETag: {etag}")
        print(
            f"   Customer name: {customer_data.get('data', {}).get('customer', {}).get('name', 'Unknown')}"
        )

        # If no ETag from that endpoint, try a simpler approach by making a test PATCH with no changes
        if not etag:
            print("   No ETag found, making a no-op PATCH to get ETag...")
            test_response = requests.patch(
                f"{BASE_URL}/api/admin/customers/{customer_id}", json={}, headers=headers
            )
            if test_response.status_code == 400 and "If-Match required" in test_response.text:
                # For testing purposes, let's create a dummy ETag
                etag = '"test-etag-123"'
                print(f"   Using test ETag for demonstration: {etag}")
            else:
                print(f"   Unexpected response: {test_response.status_code} - {test_response.text}")
                return

        # Test 1: Update preferred contact method
        print("\n4. Testing preferred contact method update...")
        patch_headers = {**headers, "If-Match": etag}
        patch_data = {"preferred_contact_method": "email"}

        patch_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}", json=patch_data, headers=patch_headers
        )

        if patch_response.status_code == 200:
            result = patch_response.json()
            print("✅ Contact method update successful")
            print(f"   New preferred_contact_method: {result.get('preferred_contact_method')}")
            etag = patch_response.headers.get("ETag")  # Update ETag for next test
        else:
            print(f"❌ Contact method update failed: {patch_response.status_code}")
            print(f"   Response: {patch_response.text}")
            return

        # Test 2: Update preferred contact time
        print("\n5. Testing preferred contact time update...")
        patch_headers = {**headers, "If-Match": etag}
        patch_data = {"preferred_contact_time": "9:00 AM - 5:00 PM weekdays"}

        patch_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}", json=patch_data, headers=patch_headers
        )

        if patch_response.status_code == 200:
            result = patch_response.json()
            print("✅ Contact time update successful")
            print(f"   New preferred_contact_time: {result.get('preferred_contact_time')}")
            etag = patch_response.headers.get("ETag")  # Update ETag for next test
        else:
            print(f"❌ Contact time update failed: {patch_response.status_code}")
            print(f"   Response: {patch_response.text}")
            return

        # Test 3: Update multiple fields at once
        print("\n6. Testing multiple field update...")
        patch_headers = {**headers, "If-Match": etag}
        patch_data = {
            "preferred_contact_method": "sms",
            "preferred_contact_time": "After 6:00 PM",
            "notes": "Customer prefers evening SMS communication",
            "tags": ["VIP", "Evening Contact"],
        }

        patch_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}", json=patch_data, headers=patch_headers
        )

        if patch_response.status_code == 200:
            result = patch_response.json()
            print("✅ Multiple field update successful")
            print(f"   Updated data: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Multiple field update failed: {patch_response.status_code}")
            print(f"   Response: {patch_response.text}")
            return

        # Test 4: Validation test - invalid contact method
        print("\n7. Testing validation with invalid contact method...")
        patch_headers = {**headers, "If-Match": patch_response.headers.get("ETag")}
        patch_data = {"preferred_contact_method": "invalid_method"}

        patch_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}", json=patch_data, headers=patch_headers
        )

        if patch_response.status_code == 400:
            print("✅ Validation correctly rejected invalid contact method")
            print(f"   Error response: {patch_response.json()}")
        else:
            print(f"❌ Validation should have failed but got: {patch_response.status_code}")

        print("\n🎉 All tests completed!")

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is the backend running on port 3001?")
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")


if __name__ == "__main__":
    test_customer_patch_enhanced()
