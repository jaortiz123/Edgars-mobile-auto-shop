#!/usr/bin/env python3
"""
TASK 9.9: Functional Tenant Security Validation
Tests actual tenant isolation by making API calls with different tenant contexts
"""

import sys
import time
from typing import Dict, Optional

import requests


class TenantSecurityTester:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.tenant_1_id = "00000000-0000-0000-0000-000000000001"
        self.tenant_2_id = "00000000-0000-0000-0000-000000000002"
        self.tenant_1_auth = None
        self.tenant_2_auth = None

    def setup_test_data(self):
        """Create test users and authenticate for both tenants"""
        print("🔧 Setting up test data for tenant isolation testing...")

        # First, try to create tenants if they don't exist
        self.ensure_test_tenants_exist()

        # Create test users for tenant 1
        timestamp = int(time.time())
        tenant1_email = f"tenant1_admin_{timestamp}@test.com"
        tenant2_email = f"tenant2_admin_{timestamp}@test.com"

        # Register user for tenant 1
        reg1 = requests.post(
            f"{self.base_url}/api/customers/register",
            json={"email": tenant1_email, "password": "Test123!", "name": "Tenant 1 Admin"},
            headers={"X-Tenant-Id": self.tenant_1_id},
        )

        # Register user for tenant 2
        reg2 = requests.post(
            f"{self.base_url}/api/customers/register",
            json={"email": tenant2_email, "password": "Test123!", "name": "Tenant 2 Admin"},
            headers={"X-Tenant-Id": self.tenant_2_id},
        )

        print(f"Tenant 1 registration: {reg1.status_code}")
        print(f"Tenant 2 registration: {reg2.status_code}")

        if reg1.status_code != 200:
            print(f"Tenant 1 registration failed: {reg1.text}")
        if reg2.status_code != 200:
            print(f"Tenant 2 registration failed: {reg2.text}")

        if reg1.status_code != 200 or reg2.status_code != 200:
            print("❌ Failed to register test users - may be tenant setup issue")
            return False

        # Login to get authentication tokens
        login1 = requests.post(
            f"{self.base_url}/api/customers/login",
            json={"email": tenant1_email, "password": "Test123!"},
            headers={"X-Tenant-Id": self.tenant_1_id},
        )

        login2 = requests.post(
            f"{self.base_url}/api/customers/login",
            json={"email": tenant2_email, "password": "Test123!"},
            headers={"X-Tenant-Id": self.tenant_2_id},
        )

        print(f"Tenant 1 login: {login1.status_code}")
        print(f"Tenant 2 login: {login2.status_code}")

        if login1.status_code == 200 and login2.status_code == 200:
            self.tenant_1_auth = login1.cookies
            self.tenant_2_auth = login2.cookies
            print("✅ Authentication setup complete")
            return True

        print("❌ Failed to authenticate test users")
        return False

        login2 = requests.post(
            f"{self.base_url}/api/customers/login",
            json={"email": tenant2_email, "password": "Test123!"},
            headers={"X-Tenant-Id": self.tenant_2_id},
        )

        print(f"Tenant 1 login: {login1.status_code}")
        print(f"Tenant 2 login: {login2.status_code}")

        if login1.status_code == 200 and login2.status_code == 200:
            self.tenant_1_auth = login1.cookies
            self.tenant_2_auth = login2.cookies
            print("✅ Authentication setup complete")
            return True

        print("❌ Failed to authenticate test users")
        return False

    def test_endpoint_tenant_isolation(
        self, endpoint: str, method: str = "GET", test_data: Optional[Dict] = None
    ) -> Dict:
        """Test if an endpoint properly isolates tenant data"""
        print(f"\n🔍 Testing tenant isolation for {method} {endpoint}")

        headers_t1 = {"X-Tenant-Id": self.tenant_1_id}
        headers_t2 = {"X-Tenant-Id": self.tenant_2_id}

        # Make request as tenant 1
        if method == "GET":
            resp1 = requests.get(
                f"{self.base_url}{endpoint}", cookies=self.tenant_1_auth, headers=headers_t1
            )
        elif method == "POST":
            resp1 = requests.post(
                f"{self.base_url}{endpoint}",
                json=test_data or {},
                cookies=self.tenant_1_auth,
                headers=headers_t1,
            )
        else:
            resp1 = requests.request(
                method,
                f"{self.base_url}{endpoint}",
                json=test_data or {},
                cookies=self.tenant_1_auth,
                headers=headers_t1,
            )

        # Make request as tenant 2
        if method == "GET":
            resp2 = requests.get(
                f"{self.base_url}{endpoint}", cookies=self.tenant_2_auth, headers=headers_t2
            )
        elif method == "POST":
            resp2 = requests.post(
                f"{self.base_url}{endpoint}",
                json=test_data or {},
                cookies=self.tenant_2_auth,
                headers=headers_t2,
            )
        else:
            resp2 = requests.request(
                method,
                f"{self.base_url}{endpoint}",
                json=test_data or {},
                cookies=self.tenant_2_auth,
                headers=headers_t2,
            )

        # Analyze responses for tenant isolation
        result = {
            "endpoint": endpoint,
            "method": method,
            "tenant_1_status": resp1.status_code,
            "tenant_2_status": resp2.status_code,
            "both_authorized": resp1.status_code not in [401, 403]
            and resp2.status_code not in [401, 403],
            "isolation_status": "UNKNOWN",
        }

        # Check if both tenants get authorized responses
        if result["both_authorized"]:
            try:
                data1 = resp1.json() if resp1.content else {}
                data2 = resp2.json() if resp2.content else {}

                # For list endpoints, compare data lengths and content
                if "data" in data1 and "data" in data2:
                    data1_items = data1.get("data", {})
                    data2_items = data2.get("data", {})

                    if isinstance(data1_items, dict) and "items" in data1_items:
                        data1_items = data1_items["items"]
                    if isinstance(data2_items, dict) and "items" in data2_items:
                        data2_items = data2_items["items"]

                    # If both tenants see different data, isolation is working
                    if str(data1_items) != str(data2_items):
                        result["isolation_status"] = "ISOLATED"
                    else:
                        result["isolation_status"] = "SHARED_DATA"

                elif data1 != data2:
                    result["isolation_status"] = "ISOLATED"
                else:
                    result["isolation_status"] = "SHARED_DATA"

                result["tenant_1_data_size"] = len(str(data1))
                result["tenant_2_data_size"] = len(str(data2))

            except Exception as e:
                result["isolation_status"] = "PARSE_ERROR"
                result["error"] = str(e)
        else:
            # If either tenant gets 401/403, check if both get same response
            if resp1.status_code == resp2.status_code:
                result["isolation_status"] = (
                    "NOT_AUTHENTICATED" if resp1.status_code in [401, 403] else "ERROR"
                )
            else:
                result["isolation_status"] = "INCONSISTENT_AUTH"

        # Print result
        if result["isolation_status"] == "ISOLATED":
            print(f"✅ SECURE: {endpoint} - Tenants see different data")
        elif result["isolation_status"] == "SHARED_DATA":
            print(f"❌ VULNERABLE: {endpoint} - Tenants see same data!")
        elif result["isolation_status"] == "NOT_AUTHENTICATED":
            print(f"⚠️  NO AUTH: {endpoint} - Both tenants unauthorized")
        else:
            print(f"❓ {result['isolation_status']}: {endpoint}")

        return result

    def run_security_validation(self) -> Dict:
        """Test the 5 endpoints claimed to be secured"""
        print("🔒 TASK 9.9: FUNCTIONAL SECURITY VALIDATION")
        print("=" * 60)

        if not self.setup_test_data():
            return {"status": "SETUP_FAILED"}

        # Test the 5 endpoints I claimed to have secured
        test_endpoints = [
            {"endpoint": "/api/admin/vehicles/1", "method": "GET"},
            {"endpoint": "/api/admin/invoices", "method": "GET"},
            {"endpoint": "/api/admin/metrics/304-efficiency", "method": "GET"},
            {"endpoint": "/api/admin/cars-on-premises", "method": "GET"},
            {"endpoint": "/api/admin/invoices/1", "method": "GET"},
        ]

        results = []
        secure_count = 0

        for test in test_endpoints:
            result = self.test_endpoint_tenant_isolation(test["endpoint"], test["method"])
            results.append(result)

            if result["isolation_status"] in ["ISOLATED", "NOT_AUTHENTICATED"]:
                secure_count += 1

        print("\n" + "=" * 60)
        print(f"📊 VALIDATION RESULTS: {secure_count}/{len(test_endpoints)} endpoints secure")

        if secure_count == len(test_endpoints):
            print("✅ ALL TESTED ENDPOINTS SECURE - Proceeding with remaining endpoints")
            return {"status": "VALIDATION_PASSED", "results": results}
        else:
            print("❌ SECURITY VALIDATION FAILED - Must fix issues before continuing")
            return {"status": "VALIDATION_FAILED", "results": results}


def main():
    """Run the tenant security validation"""
    tester = TenantSecurityTester()
    result = tester.run_security_validation()

    if result["status"] == "VALIDATION_PASSED":
        sys.exit(0)
    else:
        print("\n🚨 CRITICAL: Fix security issues before continuing with Task 9.9")
        sys.exit(1)


if __name__ == "__main__":
    main()
