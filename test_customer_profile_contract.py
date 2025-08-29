#!/usr/bin/env python3
"""
Integration test script to validate the Customer Profile API against the PRD contract.
This script tests the complete response shape and field requirements from Section D2 of the PRD.
"""

import requests


def test_customer_profile_contract():
    """Test the customer profile endpoint against the PRD contract"""

    print("🧪 Testing Customer Profile API Contract (PRD Section D)")
    print("=" * 60)

    # Test with a known customer (using auth token from tests)
    base_url = "http://localhost:3001"
    endpoint = f"{base_url}/api/admin/customers/1/profile"

    # Simple auth token (in production this would be properly authenticated)
    headers = {"Authorization": "Bearer test_token"}

    try:
        response = requests.get(endpoint, headers=headers)
        print(f"✅ Response Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("\n📋 Testing Response Contract:")

            # Test customer object
            print("   Customer object:")
            customer = data.get("customer", {})
            required_customer_fields = ["id", "full_name", "phone", "email", "created_at", "tags"]
            for field in required_customer_fields:
                status = "✅" if field in customer else "❌"
                print(f"      {status} {field}: {customer.get(field, 'MISSING')}")

            # Test stats object with new fields
            print("\n   Stats object:")
            stats = data.get("stats", {})
            required_stats_fields = [
                "lifetime_spend",
                "unpaid_balance",
                "total_visits",
                "last_service_at",
                "avg_ticket",
            ]
            for field in required_stats_fields:
                status = "✅" if field in stats else "❌"
                value = stats.get(field, "MISSING")
                print(f"      {status} {field}: {value}")

            # Validate money fields are numbers with 2 decimals
            money_fields = ["lifetime_spend", "unpaid_balance", "avg_ticket"]
            print("\n   Money field validation (2 decimal precision):")
            for field in money_fields:
                value = stats.get(field)
                if isinstance(value, (int, float)):
                    formatted = f"{value:.2f}"
                    status = (
                        "✅"
                        if str(value) == formatted or abs(value - float(formatted)) < 0.001
                        else "❌"
                    )
                    print(f"      {status} {field}: {value} (formatted: {formatted})")
                else:
                    print(f"      ❌ {field}: Not a number - {value}")

            # Test UTC timestamps (should end with Z)
            print("\n   UTC timestamp validation:")
            created_at = customer.get("created_at")
            last_service_at = stats.get("last_service_at")

            if created_at:
                z_status = "✅" if created_at.endswith("Z") else "❌"
                print(f"      {z_status} customer.created_at ends with Z: {created_at}")
            else:
                print("      ⚠️  customer.created_at is null")

            if last_service_at:
                z_status = "✅" if last_service_at.endswith("Z") else "❌"
                print(f"      {z_status} stats.last_service_at ends with Z: {last_service_at}")
            else:
                print("      ⚠️  stats.last_service_at is null (no completed visits)")

            # Test vehicles array
            print("\n   Vehicles array:")
            vehicles = data.get("vehicles", [])
            print(f"      ✅ vehicles is array with {len(vehicles)} items")
            if vehicles:
                vehicle = vehicles[0]
                vehicle_fields = ["id", "year", "make", "model", "plate", "vin", "notes"]
                for field in vehicle_fields:
                    status = "✅" if field in vehicle else "❌"
                    print(f"         {status} {field}: {vehicle.get(field, 'MISSING')}")

            # Test appointments array
            print("\n   Appointments array:")
            appointments = data.get("appointments", [])
            print(f"      ✅ appointments is array with {len(appointments)} items")
            if appointments:
                appt = appointments[0]
                appt_fields = ["id", "vehicle_id", "scheduled_at", "status", "services"]
                for field in appt_fields:
                    status = "✅" if field in appt else "❌"
                    print(f"         {status} {field}: {appt.get(field, 'MISSING')}")

                # Check scheduled_at has Z suffix
                scheduled_at = appt.get("scheduled_at")
                if scheduled_at:
                    z_status = "✅" if scheduled_at.endswith("Z") else "❌"
                    print(f"         {z_status} scheduled_at ends with Z: {scheduled_at}")

            # Test page object
            print("\n   Page object:")
            page = data.get("page", {})
            required_page_fields = ["page_size", "has_more", "next_cursor"]
            for field in required_page_fields:
                status = "✅" if field in page else "❌"
                print(f"      {status} {field}: {page.get(field, 'MISSING')}")

            # Test ETag header
            print("\n   Headers:")
            etag = response.headers.get("ETag")
            cache_control = response.headers.get("Cache-Control")
            print(f"      {'✅' if etag else '❌'} ETag: {etag}")
            print(f"      {'✅' if cache_control else '❌'} Cache-Control: {cache_control}")

            print("\n🎉 Contract validation complete!")

        elif response.status_code == 404:
            print("ℹ️  Customer not found (404) - this is expected for non-existent customers")
            error = response.json()
            if "error" in error and "code" in error["error"]:
                print(f"   Error format correct: {error['error']['code']}")

        elif response.status_code == 403:
            print("🔒 Authentication required (403) - testing without proper auth token")

        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"   Response: {response.text}")

    except Exception as e:
        print(f"❌ Error testing endpoint: {e}")


if __name__ == "__main__":
    test_customer_profile_contract()
