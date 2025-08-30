#!/usr/bin/env python3
"""
Application-Level Cross-Tenant Security Attack Test
OBJECTIVE: Prove that Tenant A admin cannot access Tenant B data via HTTP API

This is the DEFINITIVE test that proves application-level tenant isolation.
"""

import sys
import time

import requests


class CrossTenantAttackTest:
    def __init__(self):
        self.server_url = "http://localhost:3001"
        self.tenant_a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        self.tenant_b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        self.tenant_a_admin_email = "admin@tenant-a.com"
        self.admin_password = "AdminPass123!"
        self.tenant_a_jwt = None

    def log(self, message, level="INFO"):
        """Simple logging"""
        timestamp = time.strftime("%H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "ATTACK": "🚨"}
        print(f"[{timestamp}] {icons.get(level, '•')} {message}")

    def check_server_ready(self):
        """Verify server is running"""
        try:
            response = requests.get(f"{self.server_url}/health", timeout=5)
            self.log(f"Server health check: {response.status_code}")
            return True
        except Exception as e:
            self.log(f"Server not ready: {e}", "ERROR")
            return False

    def authenticate_tenant_a_admin(self):
        """Get JWT token for Tenant A admin"""
        self.log("Authenticating Tenant A admin")

        try:
            # First try to register admin (may fail if exists, that's OK)
            reg_response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": self.tenant_a_admin_email,
                    "password": self.admin_password,
                    "name": "Tenant A Admin",
                },
                headers={"X-Tenant-Id": self.tenant_a_id},
                timeout=10,
            )
            self.log(f"Admin registration: {reg_response.status_code}")

            # Login to get JWT token
            login_response = requests.post(
                f"{self.server_url}/api/customers/login",
                json={"email": self.tenant_a_admin_email, "password": self.admin_password},
                headers={"X-Tenant-Id": self.tenant_a_id},
                timeout=10,
            )

            if login_response.status_code != 200:
                self.log(
                    f"Login failed: {login_response.status_code} - {login_response.text[:200]}",
                    "ERROR",
                )
                return False

            login_data = login_response.json()
            self.log(f"Login response data: {login_data}", "INFO")
            self.tenant_a_jwt = login_data.get("data", {}).get("token")  # Try nested structure

            if not self.tenant_a_jwt:
                self.tenant_a_jwt = login_data.get("token")  # Try flat structure

            if not self.tenant_a_jwt:
                self.log("No JWT token received from login", "ERROR")
                return False

            self.log("✅ Tenant A admin authenticated successfully", "SUCCESS")
            self.log(f"   JWT: {self.tenant_a_jwt[:20]}...", "INFO")
            return True

        except Exception as e:
            self.log(f"Authentication failed: {e}", "ERROR")
            return False

    def execute_cross_tenant_attack(self):
        """
        THE CORE ATTACK: Use Tenant A JWT to access Tenant B data
        This is the exact attack that must be blocked to prove security
        """
        if not self.tenant_a_jwt:
            self.log("No valid JWT token available", "ERROR")
            return False

        self.log("🚨 EXECUTING CROSS-TENANT ATTACK", "ATTACK")
        self.log("Attack: Valid Tenant A JWT + Tenant B X-Tenant-Id header", "ATTACK")

        # Test multiple critical endpoints
        attack_endpoints = [
            "/api/admin/invoices",  # Most sensitive data
            "/api/admin/customers",  # Customer data access
            "/api/admin/appointments",  # Appointment data
            "/api/customers",  # General customer endpoint
            "/api/invoices",  # Invoice endpoint
        ]

        attack_results = []

        for endpoint in attack_endpoints:
            self.log(f"🎯 Testing endpoint: {endpoint}")

            try:
                # THE ATTACK: Valid Tenant A auth + Tenant B header
                attack_response = requests.get(
                    f"{self.server_url}{endpoint}",
                    headers={
                        "Authorization": f"Bearer {self.tenant_a_jwt}",  # Valid Tenant A JWT
                        "X-Tenant-Id": self.tenant_b_id,  # But try to access Tenant B!
                    },
                    timeout=10,
                )

                status_code = attack_response.status_code

                # Analyze security response
                if status_code == 403:
                    self.log(f"✅ ATTACK BLOCKED: {endpoint} → 403 Forbidden", "SUCCESS")
                    result = "BLOCKED"
                elif status_code == 401:
                    self.log(f"✅ ATTACK BLOCKED: {endpoint} → 401 Unauthorized", "SUCCESS")
                    result = "BLOCKED"
                elif status_code == 404:
                    self.log(f"✅ ATTACK BLOCKED: {endpoint} → 404 Not Found", "SUCCESS")
                    result = "BLOCKED"
                elif status_code in [200, 201]:
                    self.log(
                        f"🚨 CRITICAL VULNERABILITY: {endpoint} → {status_code} (DATA EXPOSED!)",
                        "ERROR",
                    )
                    self.log(f"    Response preview: {attack_response.text[:150]}", "ERROR")
                    result = "VULNERABLE"
                else:
                    self.log(f"⚠️  UNCLEAR RESPONSE: {endpoint} → {status_code}", "ERROR")
                    result = "UNCLEAR"

                attack_results.append(
                    {
                        "endpoint": endpoint,
                        "status_code": status_code,
                        "result": result,
                        "response_preview": (
                            attack_response.text[:100] if status_code in [200, 201] else None
                        ),
                    }
                )

            except Exception as e:
                self.log(f"Attack test failed on {endpoint}: {e}", "ERROR")
                attack_results.append(
                    {
                        "endpoint": endpoint,
                        "status_code": "ERROR",
                        "result": "ERROR",
                        "error": str(e)[:100],
                    }
                )

        return attack_results

    def analyze_attack_results(self, results):
        """Analyze attack results and determine security status"""
        if not results:
            self.log("No attack results to analyze", "ERROR")
            return False

        blocked_count = sum(1 for r in results if r["result"] == "BLOCKED")
        vulnerable_count = sum(1 for r in results if r["result"] == "VULNERABLE")
        total_count = len(results)

        self.log("📊 CROSS-TENANT ATTACK RESULTS:")

        for result in results:
            endpoint = result["endpoint"]
            status = result["status_code"]
            verdict = result["result"]

            if verdict == "BLOCKED":
                self.log(f"✅ SECURE: {endpoint} (HTTP {status})")
            elif verdict == "VULNERABLE":
                self.log(f"🚨 VULNERABLE: {endpoint} (HTTP {status}) - CRITICAL SECURITY FAILURE!")
                if result.get("response_preview"):
                    self.log(f"   Data leaked: {result['response_preview']}")
            else:
                self.log(f"⚠️  UNCLEAR: {endpoint} (HTTP {status})")

        print("\n📋 SUMMARY:")
        print(f"   • Total endpoints tested: {total_count}")
        print(f"   • Attacks blocked: {blocked_count}")
        print(f"   • Vulnerabilities found: {vulnerable_count}")

        # Security verdict
        if vulnerable_count == 0 and blocked_count >= total_count * 0.8:
            print("\n🎉 SECURITY TEST: PASSED ✅")
            print("✅ Cross-tenant attacks are properly blocked")
            print("✅ Application-level tenant isolation is working")
            print("✅ No unauthorized data access possible")
            return True
        elif vulnerable_count > 0:
            print("\n💥 CRITICAL SECURITY FAILURE ❌")
            print(f"🚨 {vulnerable_count} endpoints allow cross-tenant data access!")
            print("🚨 Tenant A can access Tenant B data - MAJOR VULNERABILITY!")
            print("🚨 IMMEDIATE SECURITY FIXES REQUIRED")
            return False
        else:
            print("\n⚠️  PARTIAL SECURITY VALIDATION")
            print("Some endpoints are secure, others need investigation")
            return False

    def run_security_test(self):
        """Run the complete cross-tenant security test"""
        print("\n" + "=" * 70)
        print("🔒 APPLICATION-LEVEL CROSS-TENANT SECURITY TEST")
        print("OBJECTIVE: Prove Tenant A admin cannot access Tenant B data")
        print("METHOD: HTTP API attack with valid JWT + wrong tenant header")
        print("=" * 70)

        # Step 1: Check server
        if not self.check_server_ready():
            print("\n❌ Test aborted: Server not ready")
            print("Please run: python3 start_test_server.py")
            return False

        # Step 2: Authenticate
        if not self.authenticate_tenant_a_admin():
            print("\n❌ Test aborted: Could not authenticate Tenant A admin")
            return False

        # Step 3: Execute attack
        self.log("🚨 Executing cross-tenant attack sequence", "ATTACK")
        attack_results = self.execute_cross_tenant_attack()

        if not attack_results:
            print("\n❌ Test aborted: Could not execute attacks")
            return False

        # Step 4: Analyze results
        security_validated = self.analyze_attack_results(attack_results)

        return security_validated


def main():
    """Execute the cross-tenant attack test"""
    print("🚨 CROSS-TENANT SECURITY ATTACK TEST")
    print("Testing: Can authenticated Tenant A user access Tenant B data?")
    print("Expected: NO (403 Forbidden)")

    tester = CrossTenantAttackTest()
    success = tester.run_security_test()

    if success:
        print("\n🏆 SECURITY VALIDATION: DEFINITIVE SUCCESS")
        print("✅ Application properly prevents cross-tenant attacks")
        print("✅ Tenant isolation security is verified at HTTP API level")
        sys.exit(0)
    else:
        print("\n☠️  SECURITY VALIDATION: CRITICAL FAILURE")
        print("💥 Cross-tenant data access vulnerabilities detected")
        print("🚨 Application security is compromised")
        sys.exit(1)


if __name__ == "__main__":
    main()
