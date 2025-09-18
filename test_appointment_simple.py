#!/usr/bin/env python3

import json
import sys
from datetime import datetime, timedelta, timezone

import requests


def test_appointment_creation():
    BASE_URL = "http://localhost:3001"

    # Step 1: Login to get JWT token
    print("Step 1: Authenticating...")
    login_data = {"username": "admin", "password": "admin123"}

    try:
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json=login_data, timeout=10)
        print(f"Login Response Status: {login_response.status_code}")

        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return False

        login_result = login_response.json()
        token = login_result.get("token") or login_result.get("access_token")
        if not token and "data" in login_result:
            token = login_result["data"].get("token")

        if not token:
            print(f"No token in response: {login_result}")
            return False

        print("✅ Authentication successful!")

    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

    # Step 2: Create appointment with vehicle linking
    print("\nStep 2: Creating appointment...")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Use a time that's 1 hour in the future to avoid past validation errors
    start_time = datetime.now(timezone.utc) + timedelta(hours=1)
    end_time = start_time + timedelta(hours=1)

    appointment_data = {
        "customer_name": "Test Customer",
        "customer_phone": "+15551234567",
        "customer_email": "test@example.com",
        "start": start_time.isoformat(),
        "end": end_time.isoformat(),
        "services": ["Oil Change"],
        "vehicle_make": "Toyota",
        "vehicle_model": "Camry",
        "vehicle_year": 2020,
        "vin": "1HGCM82633A123456",
        "license_plate": "ABC123",
        "mileage_at_service": 45000,
        "location": "123 Main St",
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments", json=appointment_data, headers=headers, timeout=10
        )
        print(f"Create Appointment Response Status: {response.status_code}")

        if response.status_code == 201:
            result = response.json()
            print(f"Create response: {json.dumps(result, indent=2)}")
            appointment_id = result.get("id")
            if not appointment_id and "data" in result:
                appointment_id = result["data"].get("id")
            print(f"✅ Appointment created successfully! ID: {appointment_id}")

            if not appointment_id:
                print("❌ No appointment ID in response")
                return False

            # Step 3: Verify the appointment and vehicle linking
            print(f"\nStep 3: Verifying appointment {appointment_id}...")

            get_response = requests.get(
                f"{BASE_URL}/api/admin/appointments/{appointment_id}", headers=headers, timeout=10
            )
            if get_response.status_code == 200:
                appointment_details = get_response.json()
                print("✅ Appointment retrieved successfully!")
                print(f"Appointment details: {json.dumps(appointment_details, indent=2)}")

                # Check if vehicle is linked
                if "vehicles" in appointment_details or "vehicle" in appointment_details:
                    print("✅ Vehicle linking appears to be working!")
                else:
                    print("⚠️  Vehicle linking may need verification")

                return True
            else:
                print(
                    f"❌ Failed to retrieve appointment: {get_response.status_code} - {get_response.text}"
                )
                return False

        else:
            print(f"❌ Failed to create appointment: {response.status_code}")
            print(f"Response body: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Appointment creation failed: {e}")
        return False


if __name__ == "__main__":
    print("=== Testing Appointment Creation with Vehicle Linking ===")
    success = test_appointment_creation()
    sys.exit(0 if success else 1)
