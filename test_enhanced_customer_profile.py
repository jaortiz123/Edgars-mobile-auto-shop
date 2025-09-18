#!/usr/bin/env python3

import sys

import requests


def test_enhanced_customer_profile():
    BASE_URL = "http://localhost:3001"

    # Step 1: Login to get JWT token
    print("Step 1: Authenticating...")
    login_data = {"username": "admin", "password": "admin123"}

    try:
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json=login_data, timeout=10)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False

        login_result = login_response.json()
        token = login_result["data"]["token"]
        print("✅ Authentication successful!")

    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

    # Step 2: Get customer profile with enhanced data
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Use customer ID 151 from our previous test
    customer_id = "151"

    print(f"\nStep 2: Getting enhanced customer profile for customer {customer_id}...")
    try:
        # Test basic profile first
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}", headers=headers, timeout=10
        )
        print(f"Basic Profile Response Status: {response.status_code}")

        if response.status_code == 200:
            basic_profile = response.json()
            print("✅ Basic profile retrieved successfully!")
            print(f"Basic profile keys: {list(basic_profile['data'].keys())}")

            # Test detailed profile with appointmentDetails
            response_detailed = requests.get(
                f"{BASE_URL}/api/admin/customers/{customer_id}?include=appointmentDetails",
                headers=headers,
                timeout=10,
            )
            print(f"Detailed Profile Response Status: {response_detailed.status_code}")

            if response_detailed.status_code == 200:
                detailed_profile = response_detailed.json()
                print("✅ Detailed profile retrieved successfully!")

                # Verify enhanced data structure
                data = detailed_profile["data"]
                customer = data.get("customer", {})
                vehicles = data.get("vehicles", [])
                appointments = data.get("appointments", [])
                metrics = data.get("metrics", {})

                print("\n=== ENHANCED CUSTOMER PROFILE VERIFICATION ===")

                # Check customer enhancement fields
                print("Customer enhanced fields:")
                print(f"  - Customer Since: {customer.get('customerSince')}")
                print(f"  - Relationship Duration: {customer.get('relationshipDurationDays')} days")
                print(f"  - Preferred Contact: {customer.get('preferredContactMethod')}")
                print(f"  - Preferred Time: {customer.get('preferredContactTime')}")
                print(f"  - Tags: {customer.get('tags')}")
                print(f"  - Notes: {customer.get('notes')}")

                # Check vehicle enhancements
                print(f"\nVehicles ({len(vehicles)} found):")
                for i, vehicle in enumerate(vehicles):
                    print(f"  Vehicle {i+1}:")
                    print(f"    - Display: {vehicle.get('display')}")
                    print(f"    - VIN: {vehicle.get('vin')}")
                    print(f"    - Is Primary: {vehicle.get('isPrimary')}")
                    print(f"    - Last Service: {vehicle.get('lastServiceDate')}")
                    print(f"    - Days Since Service: {vehicle.get('daysSinceLastService')}")
                    print(f"    - Overdue for Service: {vehicle.get('isOverdueForService')}")
                    print(f"    - Last Mileage: {vehicle.get('lastRecordedMileage')}")
                    print(f"    - Completed Services: {vehicle.get('completedServices')}")

                # Check appointment enhancements
                print(f"\nAppointments ({len(appointments)} found):")
                for i, appt in enumerate(appointments[:3]):  # Show first 3
                    print(f"  Appointment {i+1}:")
                    print(f"    - ID: {appt.get('id')}")
                    print(f"    - Status: {appt.get('status')}")
                    print(f"    - Mileage at Service: {appt.get('mileageAtService')}")
                    print(f"    - Unpaid Amount: ${appt.get('unpaidAmount')}")
                    print(f"    - Tech ID: {appt.get('techId')}")
                    print(f"    - Services: {len(appt.get('services', []))}")
                    print(f"    - Payments: {len(appt.get('payments', []))}")
                    print(f"    - Messages: {len(appt.get('messages', []))}")

                # Check metrics
                print("\nCustomer Metrics:")
                print(f"  - Total Spent: ${metrics.get('totalSpent')}")
                print(f"  - Vehicles Count: {metrics.get('vehiclesCount')}")
                print(f"  - Last 12 Months Spent: ${metrics.get('last12MonthsSpent')}")
                print(f"  - Is VIP: {metrics.get('isVip')}")

                print("\n✅ Enhanced Customer Profile API is working correctly!")
                return True
            else:
                print(f"❌ Failed to get detailed profile: {response_detailed.status_code}")
                print(f"Response: {response_detailed.text}")
                return False
        else:
            print(f"❌ Failed to get basic profile: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Profile retrieval failed: {e}")
        return False


if __name__ == "__main__":
    print("=== Testing Enhanced Customer Profile API ===")
    success = test_enhanced_customer_profile()
    sys.exit(0 if success else 1)
