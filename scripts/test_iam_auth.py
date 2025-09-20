#!/usr/bin/env python3
"""
Test authenticated requests to IAM-secured Lambda Function URL
Uses boto3 SigV4 signing for authentication
"""

import json

import boto3
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


def make_authenticated_request(
    function_url: str,
    path: str = "",
    method: str = "GET",
    data: dict = None,
    region: str = "us-west-2",
) -> dict:
    """Make an authenticated request to Lambda Function URL using SigV4"""

    # Create session and credentials
    session = boto3.Session()
    credentials = session.get_credentials()

    # Prepare full URL
    url = function_url.rstrip("/") + "/" + path.lstrip("/")

    # Prepare request data
    request_data = json.dumps(data) if data else None
    headers = {"Content-Type": "application/json"} if data else {}

    # Create AWS request
    request = AWSRequest(method=method, url=url, data=request_data, headers=headers)

    # Sign the request
    SigV4Auth(credentials, "lambda", region).add_auth(request)

    try:
        # Make the request
        response = requests.request(
            method=request.method, url=request.url, headers=dict(request.headers), data=request.data
        )

        return {
            "success": True,
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "text": response.text,
            "json": (
                response.json()
                if response.headers.get("content-type", "").startswith("application/json")
                else None
            ),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    """Test authenticated requests"""

    function_url = "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"

    print("🔐 Testing IAM-Secured Lambda Function URL")
    print(f"📍 URL: {function_url}")
    print()

    # Test health check endpoint
    print("1. Testing /healthz endpoint...")
    result = make_authenticated_request(function_url, "healthz")

    if result["success"]:
        print(f"   ✅ Status: {result['status_code']}")
        print(f"   📄 Response: {result['text']}")

        if result["json"]:
            print(f"   📊 Data: {json.dumps(result['json'], indent=2)}")
    else:
        print(f"   ❌ Error: {result['error']}")

    print()

    # Test Status Board endpoint
    print("2. Testing Status Board endpoint...")
    import datetime

    today = datetime.datetime.now().strftime("%Y-%m-%d")

    result = make_authenticated_request(function_url, f"api/admin/appointments/board?date={today}")

    if result["success"]:
        print(f"   ✅ Status: {result['status_code']}")
        if result["json"]:
            data = result["json"].get("data", {})
            columns = data.get("columns", {})
            total_appointments = sum(len(col.get("items", [])) for col in columns.values())
            print(f"   📊 Total appointments: {total_appointments}")
            print(f"   📋 Columns: {list(columns.keys())}")
        else:
            print(f"   📄 Response: {result['text'][:200]}...")
    else:
        print(f"   ❌ Error: {result['error']}")

    print()
    print("🎉 IAM Authentication testing complete!")


if __name__ == "__main__":
    main()
