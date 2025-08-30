#!/usr/bin/env python3
"""
TASK 9.9: COMPLETE TENANT ISOLATION VALIDATION
Tests the critical requirement: cross-tenant data access prevention
"""

import sys
import time
from typing import Dict

import requests


class TenantIsolationValidator:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.test_results = []
        self.tenant_admin_tokens = {}  # tenant_id -> auth info

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "ERROR": "❌", "SUCCESS": "✅", "WARN": "⚠️"}
        print(f"[{timestamp}] {prefix.get(level, '•')} {message}")

    def setup_multi_tenant_admins(self) -> bool:
        """Create admin users in two different tenants"""
        self.log("Setting up admin users in multiple tenants for isolation testing")

        tenants = [
            ("00000000-0000-0000-0000-000000000001", "Tenant A"),
            ("00000000-0000-0000-0000-000000000002", "Tenant B"),
        ]

        timestamp = int(time.time())

        for tenant_id, tenant_name in tenants:
            try:
                # Create unique admin user for this tenant
                admin_email = f"admin_{tenant_name.lower().replace(' ', '_')}_{timestamp}@test.com"

                self.log(f"Creating admin user for {tenant_name} ({tenant_id})")

                # Register admin user in this tenant
                reg_response = requests.post(
                    f"{self.base_url}/api/customers/register",
                    json={
                        "email": admin_email,
                        "password": "AdminTest123!",
                        "name": f"Admin User {tenant_name}",
                    },
                    headers={"X-Tenant-Id": tenant_id},
                )

                if reg_response.status_code != 200:
                    self.log(
                        f"Failed to register admin for {tenant_name}: {reg_response.status_code} - {reg_response.text}",
                        "ERROR",
                    )
                    return False

                # Login to get authentication cookies/tokens
                login_response = requests.post(
                    f"{self.base_url}/api/customers/login",
                    json={"email": admin_email, "password": "AdminTest123!"},
                    headers={"X-Tenant-Id": tenant_id},
                )

                if login_response.status_code != 200:
                    self.log(
                        f"Failed to login admin for {tenant_name}: {login_response.status_code} - {login_response.text}",
                        "ERROR",
                    )
                    return False

                # Store auth info for cross-tenant testing
                self.tenant_admin_tokens[tenant_id] = {
                    "name": tenant_name,
                    "email": admin_email,
                    "cookies": login_response.cookies,
                    "headers": {"X-Tenant-Id": tenant_id},
                }

                self.log(f"Admin user successfully created for {tenant_name}", "SUCCESS")

            except Exception as e:
                self.log(f"Exception while setting up admin for {tenant_name}: {e}", "ERROR")
                return False

        return len(self.tenant_admin_tokens) == 2

    def test_cross_tenant_data_access(self, endpoint: str, method: str = "GET") -> Dict:
        """
        CORE TEST: Verify Tenant A admin cannot access Tenant B data
        This is the actual tenant isolation validation
        """
        if len(self.tenant_admin_tokens) < 2:
            return {"status": "error", "message": "Need 2 tenant admins for cross-tenant testing"}

        tenant_ids = list(self.tenant_admin_tokens.keys())
        tenant_a_id = tenant_ids[0]
        tenant_b_id = tenant_ids[1]

        tenant_a_auth = self.tenant_admin_tokens[tenant_a_id]
        tenant_b_auth = self.tenant_admin_tokens[tenant_b_id]

        results = {
            "endpoint": endpoint,
            "same_tenant_access": None,
            "cross_tenant_blocked": None,
            "isolation_verified": False,
        }

        # Test 1: Same-tenant access should work
        try:
            self.log(f"Testing same-tenant access: {tenant_a_auth['name']} → own tenant data")

            if method == "GET":
                same_tenant_response = requests.get(
                    f"{self.base_url}{endpoint}",
                    headers=tenant_a_auth["headers"],
                    cookies=tenant_a_auth["cookies"],
                    timeout=10,
                )
            elif method == "POST":
                same_tenant_response = requests.post(
                    f"{self.base_url}{endpoint}",
                    json={},
                    headers=tenant_a_auth["headers"],
                    cookies=tenant_a_auth["cookies"],
                    timeout=10,
                )
            else:
                return {"status": "error", "message": f"Unsupported method: {method}"}

            # Same-tenant should allow access (200/201) or business logic errors (400/422)
            if same_tenant_response.status_code in [200, 201, 400, 422]:
                results["same_tenant_access"] = "allowed"
                self.log(f"✓ Same-tenant access works ({same_tenant_response.status_code})")
            elif same_tenant_response.status_code in [401, 403]:
                results["same_tenant_access"] = "blocked"
                self.log(
                    f"Same-tenant access blocked - auth issue? ({same_tenant_response.status_code})",
                    "WARN",
                )
            else:
                results["same_tenant_access"] = f"unexpected_{same_tenant_response.status_code}"
                self.log(
                    f"Unexpected same-tenant response: {same_tenant_response.status_code}", "WARN"
                )

        except Exception as e:
            results["same_tenant_access"] = f"error: {e}"
            self.log(f"Same-tenant test failed: {e}", "ERROR")

        # Test 2: Cross-tenant access should be blocked
        try:
            self.log(
                f"Testing cross-tenant access: {tenant_a_auth['name']} → {tenant_b_auth['name']} data"
            )

            # Critical: Use Tenant A's auth cookies but Tenant B's header (attack scenario)
            cross_tenant_headers = {"X-Tenant-Id": tenant_b_id}

            if method == "GET":
                cross_tenant_response = requests.get(
                    f"{self.base_url}{endpoint}",
                    headers=cross_tenant_headers,
                    cookies=tenant_a_auth["cookies"],  # Auth from A, header for B
                    timeout=10,
                )
            elif method == "POST":
                cross_tenant_response = requests.post(
                    f"{self.base_url}{endpoint}",
                    json={},
                    headers=cross_tenant_headers,
                    cookies=tenant_a_auth["cookies"],  # Auth from A, header for B
                    timeout=10,
                )
            else:
                return {"status": "error", "message": f"Unsupported method: {method}"}

            # Cross-tenant should be blocked (403/404/401)
            if cross_tenant_response.status_code in [403, 404]:
                results["cross_tenant_blocked"] = "blocked"
                results["isolation_verified"] = True
                self.log(
                    f"✓ Cross-tenant access properly blocked ({cross_tenant_response.status_code})",
                    "SUCCESS",
                )
            elif cross_tenant_response.status_code == 401:
                results["cross_tenant_blocked"] = "auth_required"
                self.log(
                    f"Cross-tenant blocked by auth requirement ({cross_tenant_response.status_code})"
                )
            elif cross_tenant_response.status_code in [200, 201]:
                results["cross_tenant_blocked"] = "ALLOWED"  # CRITICAL SECURITY FAILURE
                results["isolation_verified"] = False
                self.log(
                    f"🚨 CRITICAL: Cross-tenant access ALLOWED! ({cross_tenant_response.status_code})",
                    "ERROR",
                )
                self.log(f"Response preview: {cross_tenant_response.text[:200]}", "ERROR")
            else:
                results["cross_tenant_blocked"] = f"unexpected_{cross_tenant_response.status_code}"
                self.log(
                    f"Unexpected cross-tenant response: {cross_tenant_response.status_code}", "WARN"
                )

        except Exception as e:
            results["cross_tenant_blocked"] = f"error: {e}"
            self.log(f"Cross-tenant test failed: {e}", "ERROR")

        return results

    def run_comprehensive_isolation_test(self) -> Dict:
        """Run complete tenant isolation validation across critical admin endpoints"""

        print("\n" + "=" * 80)
        print("🔒 TASK 9.9: TENANT ISOLATION VALIDATION")
        print("Testing cross-tenant data access prevention")
        print("=" * 80)

        # Setup phase
        if not self.setup_multi_tenant_admins():
            return {
                "status": "failed",
                "phase": "setup",
                "message": "Could not create multi-tenant admin users",
            }

        # Critical admin endpoints to test
        critical_endpoints = [
            ("/api/admin/customers", "GET"),
            ("/api/admin/appointments", "GET"),
            ("/api/admin/services", "GET"),
            ("/api/admin/mechanics", "GET"),
            ("/api/admin/reports/revenue", "GET"),
        ]

        print(f"\n🎯 Testing {len(critical_endpoints)} critical admin endpoints")

        isolation_results = []
        isolated_count = 0
        failed_count = 0

        for endpoint, method in critical_endpoints:
            print(f"\n--- Testing {endpoint} ---")

            result = self.test_cross_tenant_data_access(endpoint, method)
            isolation_results.append(result)

            if result.get("isolation_verified"):
                isolated_count += 1
            elif result.get("cross_tenant_blocked") == "ALLOWED":
                failed_count += 1

        # Final assessment
        print("\n" + "=" * 80)
        print("📊 TENANT ISOLATION VALIDATION RESULTS")
        print("=" * 80)

        total_endpoints = len(critical_endpoints)

        for result in isolation_results:
            status = "✅ ISOLATED" if result.get("isolation_verified") else "❌ VULNERABLE"
            print(f"{status} - {result['endpoint']}")
            if result.get("cross_tenant_blocked") == "ALLOWED":
                print("    🚨 CRITICAL: Cross-tenant access allowed!")

        print("\nSUMMARY:")
        print(f"  • Isolated endpoints: {isolated_count}/{total_endpoints}")
        print(f"  • Vulnerable endpoints: {failed_count}/{total_endpoints}")

        validation_passed = failed_count == 0 and isolated_count >= (total_endpoints * 0.8)

        if validation_passed:
            print("\n✅ TENANT ISOLATION VALIDATION: PASSED")
            print("Cross-tenant data access is properly prevented")
        else:
            print("\n❌ TENANT ISOLATION VALIDATION: FAILED")
            print("Cross-tenant data access vulnerabilities detected")

        return {
            "status": "passed" if validation_passed else "failed",
            "phase": "validation",
            "isolated_endpoints": isolated_count,
            "vulnerable_endpoints": failed_count,
            "total_endpoints": total_endpoints,
            "results": isolation_results,
        }


def main():
    """Run tenant isolation validation"""
    validator = TenantIsolationValidator()

    # Check server availability
    try:
        health_check = requests.get("http://localhost:3001/health", timeout=5)
        if health_check.status_code != 200:
            print("❌ Server not responding at localhost:3001")
            print("Please start the Flask server first")
            sys.exit(1)
    except:
        print("❌ Cannot connect to server at localhost:3001")
        print("Please start the Flask server first")
        sys.exit(1)

    # Run validation
    results = validator.run_comprehensive_isolation_test()

    # Exit with appropriate code
    if results["status"] == "passed":
        print("\n🎉 VALIDATION COMPLETED SUCCESSFULLY")
        sys.exit(0)
    else:
        print("\n💥 VALIDATION FAILED - SECURITY VULNERABILITIES DETECTED")
        sys.exit(1)


if __name__ == "__main__":
    main()
