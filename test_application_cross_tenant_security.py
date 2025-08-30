#!/usr/bin/env python3
"""
PART 2: APPLICATION-LAYER CROSS-TENANT SECURITY TEST
The definitive test: Can authenticated Tenant A user access Tenant B data?

This test simulates the core attack scenario that proves tenant isolation works:
1. Authenticate as Tenant A user (get valid JWT)
2. Use that JWT with X-Tenant-Id: TenantB header
3. Verify the application blocks this cross-tenant access attempt

If this test passes (returns 403/401), tenant isolation is working.
If this test fails (returns 200 with data), there's a critical security vulnerability.
"""

import sqlite3
import sys
import time
from typing import Dict, Optional

import requests


class ApplicationLayerCrossTenantTest:
    def __init__(
        self, base_url: str = "http://localhost:3001", db_path: str = "database/local_shop.db"
    ):
        self.base_url = base_url
        self.db_path = db_path
        self.tenant_a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        self.tenant_b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "ERROR": "❌", "SUCCESS": "✅", "WARN": "⚠️"}
        print(f"[{timestamp}] {prefix.get(level, '•')} {message}")

    def setup_server_environment(self) -> bool:
        """Setup server to use our SQLite database"""
        try:
            # Kill any existing server
            import subprocess

            subprocess.run(["pkill", "-f", "local_server.py"], capture_output=True)
            time.sleep(2)

            # Start server with correct database
            import os

            env = os.environ.copy()
            env["DATABASE_URL"] = f"sqlite:///{self.db_path}"

            self.log("Starting Flask server with SQLite database")

            process = subprocess.Popen(
                ["python3", "local_server.py"],
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop/backend",
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Give server time to start
            time.sleep(5)

            # Test connectivity
            try:
                response = requests.get(f"{self.base_url}/health", timeout=3)
                if response.status_code in [200, 503]:  # 503 is OK if DB connection issue
                    self.log("Server started successfully", "SUCCESS")
                    return True
            except:
                pass

            self.log("Server startup failed", "ERROR")
            return False

        except Exception as e:
            self.log(f"Server setup failed: {e}", "ERROR")
            return False

    def register_and_authenticate_user(self, tenant_id: str, email: str) -> Optional[str]:
        """Register a user and get authentication token"""
        try:
            password = "TestPass123!"

            # Step 1: Register user
            self.log(f"Registering user: {email}")

            reg_response = requests.post(
                f"{self.base_url}/api/customers/register",
                json={"email": email, "password": password, "name": f"Test User {email}"},
                headers={"X-Tenant-Id": tenant_id},
                timeout=10,
            )

            # Registration might fail if user exists - that's OK
            self.log(f"Registration response: {reg_response.status_code}")

            # Step 2: Login to get JWT
            login_response = requests.post(
                f"{self.base_url}/api/customers/login",
                json={"email": email, "password": password},
                headers={"X-Tenant-Id": tenant_id},
                timeout=10,
            )

            if login_response.status_code != 200:
                self.log(
                    f"Login failed: {login_response.status_code} - {login_response.text[:200]}",
                    "ERROR",
                )
                return None

            login_data = login_response.json()
            token = login_data.get("token")

            if not token:
                self.log("No JWT token received", "ERROR")
                return None

            self.log(f"Authentication successful: {email}", "SUCCESS")
            return token

        except Exception as e:
            self.log(f"Authentication failed for {email}: {e}", "ERROR")
            return None

    def test_cross_tenant_attack(self, tenant_a_token: str) -> Dict:
        """
        THE CORE TEST: Cross-tenant data access attempt

        Uses valid Tenant A authentication with Tenant B header
        This is the exact attack scenario we need to prevent
        """
        results = {
            "attack_blocked": False,
            "tenant_isolation_verified": False,
            "response_code": None,
            "security_status": "VULNERABLE",
        }

        # Define test endpoints that should be protected
        protected_endpoints = [
            "/api/customers",  # Customer list
            "/api/admin/customers",  # Admin customer access
            "/api/appointments",  # Appointment data
            "/api/admin/appointments",  # Admin appointment access
            "/api/invoices",  # Invoice data (most sensitive)
        ]

        self.log("🚨 EXECUTING CROSS-TENANT ATTACK TEST", "WARN")
        self.log("Attack: Tenant A token + Tenant B header", "WARN")

        attack_results = []

        for endpoint in protected_endpoints:
            try:
                self.log(f"Testing endpoint: {endpoint}")

                # THE ATTACK: Valid Tenant A JWT with Tenant B tenant header
                attack_response = requests.get(
                    f"{self.base_url}{endpoint}",
                    headers={
                        "Authorization": f"Bearer {tenant_a_token}",  # Valid Tenant A auth
                        "X-Tenant-Id": self.tenant_b_id,  # But try to access Tenant B!
                    },
                    timeout=10,
                )

                status_code = attack_response.status_code
                endpoint_result = {
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "blocked": status_code in [401, 403, 404],
                }

                if status_code in [401, 403]:
                    self.log(f"✅ BLOCKED: {endpoint} → {status_code}", "SUCCESS")
                    endpoint_result["security_status"] = "SECURE"
                elif status_code == 404:
                    self.log(f"✅ BLOCKED: {endpoint} → {status_code} (not found)", "SUCCESS")
                    endpoint_result["security_status"] = "SECURE"
                elif status_code in [200, 201]:
                    self.log(f"🚨 VULNERABLE: {endpoint} → {status_code} (DATA EXPOSED!)", "ERROR")
                    endpoint_result["security_status"] = "VULNERABLE"
                    self.log(f"    Response preview: {attack_response.text[:150]}", "ERROR")
                else:
                    self.log(f"? UNCLEAR: {endpoint} → {status_code}", "WARN")
                    endpoint_result["security_status"] = "UNCLEAR"

                attack_results.append(endpoint_result)

            except Exception as e:
                self.log(f"Attack test failed on {endpoint}: {e}", "ERROR")
                attack_results.append(
                    {"endpoint": endpoint, "status_code": "error", "error": str(e)[:100]}
                )

        # Analyze results
        blocked_count = sum(1 for r in attack_results if r.get("blocked", False))
        vulnerable_count = sum(
            1 for r in attack_results if r.get("security_status") == "VULNERABLE"
        )
        total_endpoints = len(attack_results)

        results["attack_results"] = attack_results
        results["blocked_endpoints"] = blocked_count
        results["vulnerable_endpoints"] = vulnerable_count
        results["total_endpoints"] = total_endpoints

        if vulnerable_count == 0 and blocked_count >= total_endpoints * 0.8:
            results["attack_blocked"] = True
            results["tenant_isolation_verified"] = True
            results["security_status"] = "SECURE"
        elif vulnerable_count > 0:
            results["attack_blocked"] = False
            results["tenant_isolation_verified"] = False
            results["security_status"] = "VULNERABLE"
        else:
            results["security_status"] = "PARTIAL"

        return results

    def run_definitive_cross_tenant_security_test(self) -> Dict:
        """Run the definitive cross-tenant security test"""
        print("\n" + "=" * 80)
        print("🔒 DEFINITIVE CROSS-TENANT SECURITY TEST")
        print("OBJECTIVE: Prove Tenant A cannot access Tenant B data")
        print("METHOD: Valid Tenant A JWT + Tenant B X-Tenant-Id header")
        print("EXPECTED: 403 Forbidden (attack blocked)")
        print("=" * 80)

        # Step 1: Check if server is available (try to start if not)
        try:
            health_response = requests.get(f"{self.base_url}/health", timeout=3)
            self.log(f"Server health check: {health_response.status_code}")
        except:
            self.log("Server not responding, attempting to start...", "WARN")
            if not self.setup_server_environment():
                return {
                    "status": "failed",
                    "phase": "server_setup",
                    "message": "Could not start server with SQLite database",
                }

        # Step 2: Authenticate Tenant A user
        tenant_a_email = "tenant-a-user@example.com"
        tenant_a_token = self.register_and_authenticate_user(self.tenant_a_id, tenant_a_email)

        if not tenant_a_token:
            return {
                "status": "failed",
                "phase": "authentication",
                "message": "Could not authenticate Tenant A user",
            }

        self.log("✅ Tenant A authentication complete", "SUCCESS")
        self.log(f"   Token: {tenant_a_token[:20]}...", "INFO")

        # Step 3: Execute cross-tenant attack
        attack_results = self.test_cross_tenant_attack(tenant_a_token)

        # Step 4: Report results
        print("\n" + "=" * 80)
        print("📊 CROSS-TENANT ATTACK TEST RESULTS")
        print("=" * 80)

        total = attack_results.get("total_endpoints", 0)
        blocked = attack_results.get("blocked_endpoints", 0)
        vulnerable = attack_results.get("vulnerable_endpoints", 0)

        for result in attack_results.get("attack_results", []):
            endpoint = result.get("endpoint", "unknown")
            status = result.get("security_status", "unknown")
            code = result.get("status_code", "unknown")

            if status == "SECURE":
                print(f"✅ SECURE   - {endpoint} (HTTP {code})")
            elif status == "VULNERABLE":
                print(f"🚨 VULNERABLE - {endpoint} (HTTP {code}) - DATA EXPOSED!")
            else:
                print(f"⚠️  UNCLEAR  - {endpoint} (HTTP {code})")

        print("\nSUMMARY:")
        print(f"  • Total endpoints tested: {total}")
        print(f"  • Secure (blocked): {blocked}")
        print(f"  • Vulnerable (exposed): {vulnerable}")

        # Final assessment
        if attack_results.get("tenant_isolation_verified"):
            print("\n🎉 CROSS-TENANT SECURITY: VERIFIED ✅")
            print("✅ Tenant isolation is working correctly")
            print("✅ Cross-tenant attacks are properly blocked")
            print("✅ Application layer security is functioning")

            return {
                "status": "passed",
                "phase": "validation",
                "security_status": "SECURE",
                "message": "Cross-tenant isolation verified successfully",
            }
        elif attack_results.get("security_status") == "VULNERABLE":
            print("\n💥 CRITICAL SECURITY FAILURE ❌")
            print("🚨 Cross-tenant data access is possible!")
            print("🚨 Tenant A can access Tenant B data!")
            print("🚨 This is a severe security vulnerability!")

            return {
                "status": "failed",
                "phase": "validation",
                "security_status": "VULNERABLE",
                "message": "Critical cross-tenant security vulnerability detected",
            }
        else:
            print("\n⚠️  PARTIAL SECURITY VALIDATION")
            print("Some endpoints are secure, others need investigation")

            return {
                "status": "partial",
                "phase": "validation",
                "security_status": "PARTIAL",
                "message": "Mixed security results - needs investigation",
            }


def main():
    """Run the definitive cross-tenant security test"""
    tester = ApplicationLayerCrossTenantTest()

    # Verify test database exists
    try:
        conn = sqlite3.connect(tester.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM tenants WHERE id IN (?, ?)",
            (tester.tenant_a_id, tester.tenant_b_id),
        )
        tenant_count = cursor.fetchone()[0]
        conn.close()

        if tenant_count != 2:
            print("❌ Multi-tenant test database not ready")
            print("Please run setup_multi_tenant_test_environment.py first")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Cannot access test database: {e}")
        print("Please run setup_multi_tenant_test_environment.py first")
        sys.exit(1)

    # Run the definitive test
    results = tester.run_definitive_cross_tenant_security_test()

    # Exit with appropriate code
    if results["status"] == "passed":
        print("\n🏆 TENANT ISOLATION SECURITY: DEFINITIVE SUCCESS")
        print("✅ Cross-tenant attacks are properly prevented")
        print("✅ Multi-tenant security validation complete")
        sys.exit(0)
    elif results["status"] == "failed" and results.get("security_status") == "VULNERABLE":
        print("\n☠️  CRITICAL SECURITY VULNERABILITY DETECTED")
        print("💥 Cross-tenant data access is possible")
        print("🚨 IMMEDIATE SECURITY FIXES REQUIRED")
        sys.exit(1)
    else:
        print("\n⚠️  SECURITY TEST INCOMPLETE")
        print(f"Could not complete full validation due to: {results.get('message')}")
        sys.exit(2)


if __name__ == "__main__":
    main()
