#!/usr/bin/env python3
import json
from datetime import datetime, timedelta, timezone

import jwt
import requests

print("🧪 Testing Enhanced Appointment Creation with Service Operations Linking")
print("=" * 70)

try:
    # Generate JWT token
    payload = {"sub": "test-user-e2e", "role": "Owner"}
    token = jwt.encode(payload, "dev_secret", algorithm="HS256")

    # Create appointment data
    requested_time = (
        (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    )

    appointment_data = {
        "customer_name": "Test Service Ops Customer",
        "customer_phone": "555-987-6543",
        "customer_email": "testserviceops@example.com",
        "service_location": "456 Service St, Link City, CA",
        "vehicle_year": 2021,
        "vehicle_make": "Honda",
        "vehicle_model": "Civic",
        "vehicle_license_plate": "LINK123",
        "requested_time": requested_time,
        "service_operation_ids": ["service-oil-change", "service-brake-inspection"],
        "notes": "Testing service operations linking enhancement - should create appointment_services entries",
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "00000000-0000-0000-0000-000000000001",
    }

    print("📡 Creating appointment with service operations...")
    print(f"🕐 Scheduled: {requested_time}")
    print(f'🔧 Services to link: {appointment_data["service_operation_ids"]}')
    print()

    response = requests.post(
        "http://localhost:3001/api/admin/appointments", headers=headers, json=appointment_data
    )

    print(f"📡 Response Status: {response.status_code}")

    if response.status_code == 201:
        data = response.json()
        appointment = data.get("data", {}).get("appointment", {})
        appt_id = appointment.get("id")

        print(f"✅ SUCCESS! Appointment created: {appt_id}")
        print()

        # Now check if services were properly linked by fetching appointment details
        print("🔍 Fetching appointment details to verify service linking...")
        detail_response = requests.get(
            f"http://localhost:3001/api/appointments/{appt_id}", headers=headers
        )

        if detail_response.status_code == 200:
            detail_data = detail_response.json()
            appointment_details = detail_data.get("data", {})
            services = appointment_details.get("services", [])

            print("✅ Appointment details retrieved successfully")
            print(f"🔗 Number of linked services: {len(services)}")
            print()

            if services:
                print("🎯 Service Operations Successfully Linked:")
                for i, svc in enumerate(services, 1):
                    name = svc.get("name", "Unknown Service")
                    service_id = svc.get("service_operation_id", "Unknown ID")
                    price = svc.get("estimated_price", 0)
                    hours = svc.get("estimated_hours", 0)

                    print(f"  {i}. {name}")
                    print(f"     • Service ID: {service_id}")
                    print(
                        f"     • Price: ${price:.2f}"
                        if price is not None
                        else "     • Price: Not set"
                    )
                    print(f"     • Hours: {hours:.1f}")
                    print()

                print("🎉 🎉 🎉 SUCCESS! 🎉 🎉 🎉")
                print("✅ Service operations linking is working correctly!")
                print("✅ Customer creation working")
                print("✅ Vehicle creation working")
                print("✅ Appointment creation working")
                print("✅ Service operations linking working")
                print()
                print("🔧 Enhancement Implementation: COMPLETE!")

            else:
                print("⚠️ WARNING: No services found in appointment details")
                print("🔧 This may indicate the service operations linking logic is not working")
                print("📊 Raw appointment data:", json.dumps(appointment_details, indent=2))

        else:
            print(f"⚠️ Could not retrieve appointment details: {detail_response.status_code}")
            print(f"📄 Error response: {detail_response.text}")

    else:
        print("❌ Appointment creation FAILED")
        print(f"📄 Response: {response.text}")

except requests.exceptions.ConnectionError:
    print("❌ Could not connect to backend server")
    print("💡 Make sure the backend is running on localhost:3001")
except Exception as e:
    print(f"❌ Unexpected error: {str(e)}")
    import traceback

    traceback.print_exc()
