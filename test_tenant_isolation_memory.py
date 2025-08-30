#!/usr/bin/env python3
"""
TASK 9.9: TENANT ISOLATION VALIDATION (Memory Mode)
Validates tenant isolation by testing the security enforcement patterns
without requiring complex database setup.
"""

import sys
import time
from typing import Dict, Optional

import requests


class TenantIsolationValidator:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.tenant_a_id = "00000000-0000-0000-0000-000000000001"
        self.tenant_b_id = "00000000-0000-0000-0000-000000000002"

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "ERROR": "❌", "SUCCESS": "✅", "WARN": "⚠️"}
        print(f"[{timestamp}] {prefix.get(level, '•')} {message}")

    def setup_customer_auth(self, tenant_id: str, name_suffix: str) -> Optional[Dict]:
        """Create and authenticate a customer for a specific tenant"""
        try:
            timestamp = int(time.time())
            email = f"customer_{name_suffix}_{timestamp}@test.com"

            # Register customer
            self.log(f"Registering customer for tenant {name_suffix}")
            reg_response = requests.post(
                f"{self.base_url}/api/customers/register",
                json={"email": email, "password": "Test123!", "name": f"Customer {name_suffix}"},
                headers={"X-Tenant-Id": tenant_id},
                timeout=10,
            )

            if reg_response.status_code != 200:
                self.log(
                    f"Registration failed for {name_suffix}: {reg_response.status_code} - {reg_response.text[:200]}",
                    "ERROR",
                )
                return None

            # Login to get session
            login_response = requests.post(
                f"{self.base_url}/api/customers/login",
                json={"email": email, "password": "Test123!"},
                headers={"X-Tenant-Id": tenant_id},
                timeout=10,
            )

            if login_response.status_code != 200:
                self.log(
                    f"Login failed for {name_suffix}: {login_response.status_code} - {login_response.text[:200]}",
                    "ERROR",
                )
                return None

            self.log(f"Customer authentication setup complete for {name_suffix}", "SUCCESS")
            return {
                "tenant_id": tenant_id,
                "name": name_suffix,
                "email": email,
                "cookies": login_response.cookies,
                "headers": {"X-Tenant-Id": tenant_id},
            }

        except Exception as e:
            self.log(f"Exception during customer setup for {name_suffix}: {e}", "ERROR")
            return None

    def test_cross_tenant_header_manipulation(
        self, endpoint: str, tenant_a_auth: Dict, tenant_b_auth: Dict
    ) -> Dict:
        """
        Core test: Authenticated user from Tenant A tries to access Tenant B data
        by manipulating X-Tenant-Id header - this should be blocked
        """
        results = {
            "endpoint": endpoint,
            "same_tenant_allowed": None,
            "cross_tenant_blocked": None,
            "isolation_verified": False,
        }

        # Test 1: Same tenant access (should work)
        try:
            self.log(f"Testing same-tenant access: {tenant_a_auth['name']} → own data")
            same_tenant_response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=tenant_a_auth["headers"],  # Correct tenant header
                cookies=tenant_a_auth["cookies"],  # Correct auth cookies
                timeout=10,
            )

            if same_tenant_response.status_code in [
                200,
                201,
                400,
                422,
            ]:  # Allow business logic errors
                results["same_tenant_allowed"] = True
                self.log(f"✓ Same-tenant access works ({same_tenant_response.status_code})")
            elif same_tenant_response.status_code in [401, 403]:
                results["same_tenant_allowed"] = False
                self.log(
                    f"Same-tenant access blocked ({same_tenant_response.status_code}) - possible auth issue",
                    "WARN",
                )
            else:
                results["same_tenant_allowed"] = f"unexpected_{same_tenant_response.status_code}"
                self.log(
                    f"Unexpected same-tenant response: {same_tenant_response.status_code}", "WARN"
                )

        except Exception as e:
            results["same_tenant_allowed"] = f"error: {str(e)[:100]}"
            self.log(f"Same-tenant test error: {e}", "ERROR")

        # Test 2: Cross-tenant header attack (MUST be blocked)
        try:
            self.log(
                f"Testing cross-tenant attack: {tenant_a_auth['name']} auth + {tenant_b_auth['name']} header"
            )

            # ATTACK: Use Tenant A's authentication but Tenant B's header
            cross_tenant_response = requests.get(
                f"{self.base_url}{endpoint}",
                headers={"X-Tenant-Id": tenant_b_auth["tenant_id"]},  # Wrong tenant header!
                cookies=tenant_a_auth["cookies"],  # But valid auth from Tenant A
                timeout=10,
            )

            if cross_tenant_response.status_code in [403, 404]:
                results["cross_tenant_blocked"] = True
                results["isolation_verified"] = True
                self.log(
                    f"✓ Cross-tenant attack properly blocked ({cross_tenant_response.status_code})",
                    "SUCCESS",
                )
            elif cross_tenant_response.status_code == 401:
                results["cross_tenant_blocked"] = True  # Auth rejection is also valid protection
                results["isolation_verified"] = True
                self.log(
                    f"✓ Cross-tenant attack blocked by auth ({cross_tenant_response.status_code})",
                    "SUCCESS",
                )
            elif cross_tenant_response.status_code in [200, 201]:
                results["cross_tenant_blocked"] = False
                results["isolation_verified"] = False
                self.log(
                    f"🚨 CRITICAL: Cross-tenant attack SUCCESS! ({cross_tenant_response.status_code})",
                    "ERROR",
                )
                self.log(f"Response preview: {cross_tenant_response.text[:200]}", "ERROR")
            else:
                results["cross_tenant_blocked"] = f"unexpected_{cross_tenant_response.status_code}"
                self.log(
                    f"Unexpected cross-tenant response: {cross_tenant_response.status_code}", "WARN"
                )

        except Exception as e:
            results["cross_tenant_blocked"] = f"error: {str(e)[:100]}"
            self.log(f"Cross-tenant test error: {e}", "ERROR")

        return results

    def run_tenant_isolation_validation(self) -> Dict:
        """Run complete tenant isolation validation"""
        print("\n" + "=" * 80)
        print("🔒 TASK 9.9: TENANT ISOLATION VALIDATION")
        print("Testing cross-tenant data access prevention via header manipulation")
        print("=" * 80)

        # Setup customers in different tenants
        self.log("Setting up customer authentication for multiple tenants")

        tenant_a_auth = self.setup_customer_auth(self.tenant_a_id, "TenantA")
        if not tenant_a_auth:
            return {
                "status": "failed",
                "phase": "setup",
                "message": "Could not setup Tenant A customer authentication",
            }

        tenant_b_auth = self.setup_customer_auth(self.tenant_b_id, "TenantB")
        if not tenant_b_auth:
            return {
                "status": "failed",
                "phase": "setup",
                "message": "Could not setup Tenant B customer authentication",
            }

        print("\n✅ Multi-tenant authentication setup complete")
        print(f"   • Tenant A: {tenant_a_auth['email']}")
        print(f"   • Tenant B: {tenant_b_auth['email']}")

        # Test critical admin endpoints for tenant isolation
        critical_endpoints = [
            "/api/admin/customers",
            "/api/admin/appointments",
            "/api/admin/services",
            "/api/admin/reports/revenue",
        ]

        print(f"\n🎯 Testing {len(critical_endpoints)} critical admin endpoints")

        isolation_results = []
        isolated_count = 0
        vulnerable_count = 0

        for endpoint in critical_endpoints:
            print(f"\n--- Testing {endpoint} ---")

            result = self.test_cross_tenant_header_manipulation(
                endpoint, tenant_a_auth, tenant_b_auth
            )
            isolation_results.append(result)

            if result.get("isolation_verified"):
                isolated_count += 1
            elif result.get("cross_tenant_blocked") is False:
                vulnerable_count += 1

        # Results analysis
        print("\n" + "=" * 80)
        print("📊 TENANT ISOLATION VALIDATION RESULTS")
        print("=" * 80)

        total_endpoints = len(critical_endpoints)

        for result in isolation_results:
            status = "✅ SECURE" if result.get("isolation_verified") else "❌ VULNERABLE"
            print(f"{status} - {result['endpoint']}")
            if result.get("cross_tenant_blocked") is False:
                print("    🚨 CRITICAL: Cross-tenant data access allowed!")

        print("\nSUMMARY:")
        print(f"  • Secure endpoints: {isolated_count}/{total_endpoints}")
        print(f"  • Vulnerable endpoints: {vulnerable_count}/{total_endpoints}")

        # Validation assessment
        validation_passed = vulnerable_count == 0 and isolated_count >= (total_endpoints * 0.8)

        if validation_passed:
            print("\n✅ TENANT ISOLATION VALIDATION: PASSED")
            print("Cross-tenant data access is properly prevented")
            print("Authentication + tenant context enforcement is working")
        else:
            print("\n❌ TENANT ISOLATION VALIDATION: FAILED")
            if vulnerable_count > 0:
                print(f"🚨 {vulnerable_count} endpoints allow cross-tenant data access!")
            print("Tenant isolation security is insufficient")

        return {
            "status": "passed" if validation_passed else "failed",
            "phase": "validation",
            "secure_endpoints": isolated_count,
            "vulnerable_endpoints": vulnerable_count,
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
    results = validator.run_tenant_isolation_validation()

    # Exit with appropriate code
    if results["status"] == "passed":
        print("\n🎉 TASK 9.9: TENANT ISOLATION VALIDATION COMPLETED SUCCESSFULLY")
        print("Cross-tenant data access prevention has been functionally verified")
        sys.exit(0)
    else:
        print("\n💥 TASK 9.9: TENANT ISOLATION VALIDATION FAILED")
        print("Critical security vulnerabilities detected - tenant isolation insufficient")
        sys.exit(1)


if __name__ == "__main__":
    main()
