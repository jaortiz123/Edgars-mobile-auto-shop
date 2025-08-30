#!/usr/bin/env python3
"""
TASK 9.9: FUNCTIONAL TENANT ISOLATION VALIDATION (Simplified)
Tests the core security requirement: tenant context enforcement prevents unauthorized access
"""

import sys
import time
from typing import Dict, Optional

import requests


class SimpleTenantSecurityValidator:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.valid_tenant_id = "00000000-0000-0000-0000-000000000001"  # Known working tenant
        self.invalid_tenant_id = "99999999-9999-9999-9999-999999999999"  # Invalid tenant

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "ERROR": "❌", "SUCCESS": "✅", "WARN": "⚠️"}
        print(f"[{timestamp}] {prefix.get(level, '•')} {message}")

    def setup_authenticated_customer(self) -> Optional[Dict]:
        """Create and authenticate a customer in the valid tenant"""
        try:
            timestamp = int(time.time())
            email = f"security_test_{timestamp}@test.com"

            # Register customer in valid tenant
            self.log("Registering customer in valid tenant")
            reg_response = requests.post(
                f"{self.base_url}/api/customers/register",
                json={"email": email, "password": "Test123!", "name": "Security Test User"},
                headers={"X-Tenant-Id": self.valid_tenant_id},
                timeout=10,
            )

            if reg_response.status_code != 200:
                self.log(
                    f"Registration failed: {reg_response.status_code} - {reg_response.text[:200]}",
                    "ERROR",
                )
                return None

            # Login to get authentication
            login_response = requests.post(
                f"{self.base_url}/api/customers/login",
                json={"email": email, "password": "Test123!"},
                headers={"X-Tenant-Id": self.valid_tenant_id},
                timeout=10,
            )

            if login_response.status_code != 200:
                self.log(
                    f"Login failed: {login_response.status_code} - {login_response.text[:200]}",
                    "ERROR",
                )
                return None

            self.log("Customer authentication successful", "SUCCESS")
            return {
                "email": email,
                "cookies": login_response.cookies,
                "valid_tenant_headers": {"X-Tenant-Id": self.valid_tenant_id},
                "invalid_tenant_headers": {"X-Tenant-Id": self.invalid_tenant_id},
            }

        except Exception as e:
            self.log(f"Exception during customer setup: {e}", "ERROR")
            return None

    def test_tenant_context_enforcement(self, endpoint: str, auth: Dict) -> Dict:
        """
        Test tenant context enforcement:
        1. Valid tenant + auth should work (or return business logic error)
        2. Invalid tenant + auth should be blocked by security
        3. No tenant header should be blocked
        """
        results = {
            "endpoint": endpoint,
            "valid_tenant_access": None,
            "invalid_tenant_blocked": None,
            "no_tenant_blocked": None,
            "security_enforced": False,
        }

        # Test 1: Valid tenant context (should work)
        try:
            self.log(f"Testing valid tenant access: {endpoint}")
            valid_response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=auth["valid_tenant_headers"],
                cookies=auth["cookies"],
                timeout=10,
            )

            if valid_response.status_code in [200, 201, 400, 422]:
                results["valid_tenant_access"] = "allowed"
                self.log(f"✓ Valid tenant access works ({valid_response.status_code})")
            elif valid_response.status_code in [401, 403, 404]:
                results["valid_tenant_access"] = "blocked"
                self.log(
                    f"Valid tenant access blocked ({valid_response.status_code}) - check endpoint",
                    "WARN",
                )
            else:
                results["valid_tenant_access"] = f"unexpected_{valid_response.status_code}"

        except Exception as e:
            results["valid_tenant_access"] = f"error: {str(e)[:100]}"
            self.log(f"Valid tenant test error: {e}", "ERROR")

        # Test 2: Invalid tenant context (MUST be blocked)
        try:
            self.log(f"Testing invalid tenant attack: {endpoint} with fake tenant ID")
            invalid_response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=auth["invalid_tenant_headers"],  # Wrong/fake tenant
                cookies=auth["cookies"],  # But valid authentication
                timeout=10,
            )

            if invalid_response.status_code in [403, 404, 401]:
                results["invalid_tenant_blocked"] = "blocked"
                results["security_enforced"] = True
                self.log(
                    f"✓ Invalid tenant properly blocked ({invalid_response.status_code})", "SUCCESS"
                )
            elif invalid_response.status_code in [200, 201]:
                results["invalid_tenant_blocked"] = "allowed"
                results["security_enforced"] = False
                self.log(
                    f"🚨 CRITICAL: Invalid tenant allowed access! ({invalid_response.status_code})",
                    "ERROR",
                )
            else:
                results["invalid_tenant_blocked"] = f"unexpected_{invalid_response.status_code}"

        except Exception as e:
            results["invalid_tenant_blocked"] = f"error: {str(e)[:100]}"
            self.log(f"Invalid tenant test error: {e}", "ERROR")

        # Test 3: No tenant context (should be blocked)
        try:
            self.log(f"Testing no tenant header: {endpoint}")
            no_tenant_response = requests.get(
                f"{self.base_url}{endpoint}",
                cookies=auth["cookies"],  # Auth but no tenant header
                timeout=10,
            )

            if no_tenant_response.status_code in [400, 401, 403, 404]:
                results["no_tenant_blocked"] = "blocked"
                self.log(
                    f"✓ Missing tenant header properly blocked ({no_tenant_response.status_code})"
                )
            elif no_tenant_response.status_code in [200, 201]:
                results["no_tenant_blocked"] = "allowed"
                self.log("⚠️ Missing tenant header allowed - may indicate security gap", "WARN")
            else:
                results["no_tenant_blocked"] = f"unexpected_{no_tenant_response.status_code}"

        except Exception as e:
            results["no_tenant_blocked"] = f"error: {str(e)[:100]}"
            self.log(f"No tenant test error: {e}", "ERROR")

        return results

    def run_security_validation(self) -> Dict:
        """Run complete tenant security validation"""
        print("\n" + "=" * 80)
        print("🔒 TASK 9.9: TENANT SECURITY VALIDATION")
        print("Testing tenant context enforcement prevents unauthorized access")
        print("=" * 80)

        # Setup authenticated customer
        auth = self.setup_authenticated_customer()
        if not auth:
            return {
                "status": "failed",
                "phase": "setup",
                "message": "Could not setup authenticated customer",
            }

        print(f"\n✅ Authentication setup complete: {auth['email']}")

        # Critical admin endpoints that MUST enforce tenant context
        critical_endpoints = [
            "/api/admin/customers",
            "/api/admin/appointments",
            "/api/admin/services",
            "/api/admin/reports/revenue",
            "/api/admin/mechanics",
        ]

        print(f"\n🎯 Testing {len(critical_endpoints)} critical admin endpoints")
        print("Each endpoint MUST block invalid tenant contexts")

        security_results = []
        secure_count = 0
        vulnerable_count = 0

        for endpoint in critical_endpoints:
            print(f"\n--- Testing {endpoint} ---")

            result = self.test_tenant_context_enforcement(endpoint, auth)
            security_results.append(result)

            if result.get("security_enforced"):
                secure_count += 1
            elif result.get("invalid_tenant_blocked") == "allowed":
                vulnerable_count += 1

        # Results analysis
        print("\n" + "=" * 80)
        print("📊 TENANT SECURITY VALIDATION RESULTS")
        print("=" * 80)

        total_endpoints = len(critical_endpoints)

        for result in security_results:
            status = "✅ SECURE" if result.get("security_enforced") else "❌ VULNERABLE"
            print(f"{status} - {result['endpoint']}")
            if result.get("invalid_tenant_blocked") == "allowed":
                print("    🚨 CRITICAL: Invalid tenant context allowed access!")

        print("\nSUMMARY:")
        print(f"  • Secure endpoints: {secure_count}/{total_endpoints}")
        print(f"  • Vulnerable endpoints: {vulnerable_count}/{total_endpoints}")

        # Validation assessment
        validation_passed = vulnerable_count == 0 and secure_count >= (total_endpoints * 0.8)

        if validation_passed:
            print("\n✅ TENANT SECURITY VALIDATION: PASSED")
            print("Tenant context enforcement is working correctly")
            print("Invalid tenant contexts are properly blocked")
        else:
            print("\n❌ TENANT SECURITY VALIDATION: FAILED")
            if vulnerable_count > 0:
                print(f"🚨 {vulnerable_count} endpoints allow invalid tenant access!")
            print("Tenant isolation security is insufficient")

        return {
            "status": "passed" if validation_passed else "failed",
            "phase": "validation",
            "secure_endpoints": secure_count,
            "vulnerable_endpoints": vulnerable_count,
            "total_endpoints": total_endpoints,
            "results": security_results,
        }


def main():
    """Run tenant security validation"""
    validator = SimpleTenantSecurityValidator()

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
    results = validator.run_security_validation()

    # Exit with appropriate code
    if results["status"] == "passed":
        print("\n🎉 TASK 9.9: TENANT SECURITY VALIDATION COMPLETED")
        print("✅ Tenant context enforcement has been functionally verified")
        print("✅ Invalid tenant contexts are properly blocked by security")
        sys.exit(0)
    else:
        print("\n💥 TASK 9.9: TENANT SECURITY VALIDATION FAILED")
        print("❌ Critical tenant isolation vulnerabilities detected")
        sys.exit(1)


if __name__ == "__main__":
    main()
