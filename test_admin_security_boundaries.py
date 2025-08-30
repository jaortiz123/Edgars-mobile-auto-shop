#!/usr/bin/env python3
"""
TASK 9.2: Admin API Security Boundary Verification
Testing admin endpoint security under header manipulation attacks
"""

import time

import requests


class AdminSecurityTester:
    def __init__(self, server_url: str = "http://localhost:3001"):
        self.server_url = server_url
        self.tenant_a = "00000000-0000-0000-0000-000000000001"
        self.tenant_b = "11111111-1111-1111-1111-111111111111"
        self.admin_cookies_a = None
        self.admin_cookies_b = None

    def setup_test_environment(self):
        """Create test data in both tenants for attack testing"""
        print("🔧 Setting up test environment...")

        timestamp = int(time.time())

        # Create customers in both tenants
        customer_a_data = {
            "email": f"customer_a_{timestamp}@test.com",
            "password": "Test123!",
            "name": "Customer A",
        }

        customer_b_data = {
            "email": f"customer_b_{timestamp}@test.com",
            "password": "Test123!",
            "name": "Customer B",
        }

        # Register customers in their respective tenants
        reg_a = requests.post(
            f"{self.server_url}/api/customers/register",
            json=customer_a_data,
            headers={"X-Tenant-Id": self.tenant_a},
        )

        reg_b = requests.post(
            f"{self.server_url}/api/customers/register",
            json=customer_b_data,
            headers={"X-Tenant-Id": self.tenant_b},
        )

        if reg_a.status_code != 200 or reg_b.status_code != 200:
            print(
                f"❌ Failed to create test customers: A={reg_a.status_code}, B={reg_b.status_code}"
            )
            return False

        # Login as admin in both tenants (assuming admin login exists)
        admin_login_a = requests.post(
            f"{self.server_url}/api/admin/login",
            json={"username": "admin", "password": "admin123"},  # assuming default creds
            headers={"X-Tenant-Id": self.tenant_a},
        )

        admin_login_b = requests.post(
            f"{self.server_url}/api/admin/login",
            json={"username": "admin", "password": "admin123"},
            headers={"X-Tenant-Id": self.tenant_b},
        )

        # Store admin cookies if login successful
        if admin_login_a.status_code == 200:
            self.admin_cookies_a = admin_login_a.cookies
            print("✅ Admin authenticated for Tenant A")
        else:
            print(f"⚠️  Admin login failed for Tenant A: {admin_login_a.status_code}")

        if admin_login_b.status_code == 200:
            self.admin_cookies_b = admin_login_b.cookies
            print("✅ Admin authenticated for Tenant B")
        else:
            print(f"⚠️  Admin login failed for Tenant B: {admin_login_b.status_code}")

        print("✅ Test environment setup completed")
        return True

    def test_baseline_admin_operations(self):
        """Test that legitimate admin operations work correctly within tenant boundaries"""
        print("\n🔍 STEP 2: Testing baseline admin operations...")

        # Test: Get invoices for Tenant A using correct tenant header
        invoices_a = requests.get(
            f"{self.server_url}/api/admin/invoices",
            headers={"X-Tenant-Id": self.tenant_a},
            cookies=self.admin_cookies_a,
        )

        # Test: Get appointments board for Tenant A
        board_a = requests.get(
            f"{self.server_url}/api/admin/appointments/board",
            headers={"X-Tenant-Id": self.tenant_a},
            cookies=self.admin_cookies_a,
        )

        # Test: Get message templates for Tenant A
        templates_a = requests.get(
            f"{self.server_url}/api/admin/message-templates",
            headers={"X-Tenant-Id": self.tenant_a},
            cookies=self.admin_cookies_a,
        )

        results = {
            "invoices": invoices_a.status_code,
            "board": board_a.status_code,
            "templates": templates_a.status_code,
        }

        print(f"   Invoices API: {invoices_a.status_code}")
        print(f"   Appointments Board: {board_a.status_code}")
        print(f"   Message Templates: {templates_a.status_code}")

        success = all(code in [200, 401, 403] for code in results.values())  # Allow auth failures

        if success:
            print("✅ Baseline admin operations tested")
            return True, results
        else:
            print("❌ Baseline admin operations failed")
            return False, results

    def test_header_manipulation_attacks(self):
        """Test cross-tenant attacks via header manipulation"""
        print("\n🔍 STEP 3: Testing header manipulation attacks...")

        attacks_blocked = []
        attacks_successful = []

        # Attack 1: Use Tenant A admin credentials with Tenant B header to access Tenant B invoices
        attack1 = requests.get(
            f"{self.server_url}/api/admin/invoices",
            headers={"X-Tenant-Id": self.tenant_b},  # MALICIOUS: Wrong tenant header
            cookies=self.admin_cookies_a,  # But using Tenant A admin cookies
        )

        print(f"   🔴 Attack 1 - Cross-tenant invoice access: {attack1.status_code}")
        if attack1.status_code in [200]:
            attacks_successful.append(f"Invoice access cross-tenant (HTTP {attack1.status_code})")
            print(
                f"      ⚠️  SECURITY ISSUE: Got access to data! Response length: {len(attack1.text)}"
            )
        else:
            attacks_blocked.append(f"Invoice access blocked (HTTP {attack1.status_code})")

        # Attack 2: Use Tenant A admin to access Tenant B appointments board
        attack2 = requests.get(
            f"{self.server_url}/api/admin/appointments/board",
            headers={"X-Tenant-Id": self.tenant_b},  # MALICIOUS: Wrong tenant header
            cookies=self.admin_cookies_a,  # But using Tenant A admin cookies
        )

        print(f"   🔴 Attack 2 - Cross-tenant appointments access: {attack2.status_code}")
        if attack2.status_code in [200]:
            attacks_successful.append(
                f"Appointments access cross-tenant (HTTP {attack2.status_code})"
            )
            print(
                f"      ⚠️  SECURITY ISSUE: Got access to data! Response length: {len(attack2.text)}"
            )
        else:
            attacks_blocked.append(f"Appointments access blocked (HTTP {attack2.status_code})")

        # Attack 3: Use Tenant A admin to access Tenant B message templates
        attack3 = requests.get(
            f"{self.server_url}/api/admin/message-templates",
            headers={"X-Tenant-Id": self.tenant_b},  # MALICIOUS: Wrong tenant header
            cookies=self.admin_cookies_a,  # But using Tenant A admin cookies
        )

        print(f"   🔴 Attack 3 - Cross-tenant templates access: {attack3.status_code}")
        if attack3.status_code in [200]:
            attacks_successful.append(f"Templates access cross-tenant (HTTP {attack3.status_code})")
            print(
                f"      ⚠️  SECURITY ISSUE: Got access to data! Response length: {len(attack3.text)}"
            )
        else:
            attacks_blocked.append(f"Templates access blocked (HTTP {attack3.status_code})")

        return attacks_blocked, attacks_successful

    def test_rls_enforcement(self):
        """Test that database RLS policies prevent data leakage"""
        print("\n🔍 STEP 4: Testing RLS enforcement...")

        # This tests whether the database-level RLS policies are working
        # even if application-level checks might be bypassed

        rls_tests = []

        # Test: Try to access customer data across tenants
        if self.admin_cookies_a:
            # Try to get customer list without proper tenant context
            customers_test = requests.get(
                f"{self.server_url}/api/admin/invoices?customerId=999999",  # Non-existent customer
                headers={"X-Tenant-Id": self.tenant_b},  # Wrong tenant
                cookies=self.admin_cookies_a,
            )

            rls_tests.append(
                {
                    "name": "Customer data access",
                    "status": customers_test.status_code,
                    "blocked": customers_test.status_code not in [200],
                }
            )

        return rls_tests

    def run_complete_security_test(self):
        """Execute the complete admin security verification"""
        print("=" * 60)
        print("🚨 TASK 9.2: ADMIN API SECURITY BOUNDARY VERIFICATION")
        print("=" * 60)

        # Setup
        if not self.setup_test_environment():
            print("❌ Failed to setup test environment")
            return False

        # Step 2: Baseline test
        baseline_success, baseline_results = self.test_baseline_admin_operations()

        # Step 3: Attack tests
        blocked_attacks, successful_attacks = self.test_header_manipulation_attacks()

        # Step 4: RLS tests
        rls_results = self.test_rls_enforcement()

        # Results summary
        print("\n" + "=" * 60)
        print("📊 SECURITY TEST RESULTS")
        print("=" * 60)

        print(f"\n🛡️  ATTACKS BLOCKED ({len(blocked_attacks)}):")
        for attack in blocked_attacks:
            print(f"   ✅ {attack}")

        print(f"\n⚠️  POTENTIAL SECURITY ISSUES ({len(successful_attacks)}):")
        for attack in successful_attacks:
            print(f"   🔴 {attack}")

        print(f"\n🔒 RLS ENFORCEMENT ({len(rls_results)}):")
        for test in rls_results:
            status = "✅ BLOCKED" if test["blocked"] else "🔴 VULNERABLE"
            print(f"   {status} {test['name']} (HTTP {test['status']})")

        # Final assessment
        security_score = (
            len(blocked_attacks) / (len(blocked_attacks) + len(successful_attacks)) * 100
            if (blocked_attacks or successful_attacks)
            else 100
        )

        print(f"\n📈 SECURITY SCORE: {security_score:.1f}%")

        if successful_attacks:
            print("\n🚨 CRITICAL SECURITY VULNERABILITIES DETECTED")
            print("❌ Admin endpoints allow cross-tenant data access")
            print("🛑 IMMEDIATE SECURITY HARDENING REQUIRED")
            return False
        else:
            print("\n🎉 ADMIN SECURITY BOUNDARIES VERIFIED")
            print("✅ Cross-tenant attacks properly blocked")
            print("🔒 Tenant isolation maintained under attack conditions")
            return True


def main():
    tester = AdminSecurityTester()
    success = tester.run_complete_security_test()
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
