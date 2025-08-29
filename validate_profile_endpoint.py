#!/usr/bin/env python3
"""Quick validation test for customer profile endpoint changes"""

import json

import requests

# Test the endpoint manually
base_url = "http://localhost:3001"
endpoint = f"{base_url}/api/admin/customers/279/profile"

try:
    response = requests.get(endpoint)
    print(f"Status Code: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print("Response Structure:")
        print(json.dumps(data, indent=2))

        # Check if new fields are present
        if "stats" in data:
            stats = data["stats"]
            required_fields = [
                "lifetime_spend",
                "unpaid_balance",
                "total_visits",
                "last_service_at",
                "avg_ticket",
            ]
            missing = [f for f in required_fields if f not in stats]
            if missing:
                print(f"Missing required fields: {missing}")
            else:
                print("✅ All required stats fields present")

        if "page" in data:
            page = data["page"]
            required_page_fields = ["page_size", "has_more", "next_cursor"]
            missing_page = [f for f in required_page_fields if f not in page]
            if missing_page:
                print(f"Missing required page fields: {missing_page}")
            else:
                print("✅ All required page fields present")
    else:
        print(f"Error response: {response.text}")

except Exception as e:
    print(f"Error: {e}")
