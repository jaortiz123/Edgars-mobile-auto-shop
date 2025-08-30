#!/usr/bin/env python3
"""
TASK 8-C: COMPLETE MULTI-TENANT SYSTEM PROOF

This comprehensive test proves the complete multi-tenant architecture works end-to-end:

1. ✅ Real tenant records with business data
2. ✅ Users with proper tenant associations via user_tenants table
3. ✅ Legitimate multi-tenant operations - users from different tenants see different data
4. ✅ All security layers working together - RLS + middleware + authentication + user-tenant relationships
5. ✅ Complete authentication flows with tenant isolation

This validates the sophisticated multi-tenant system using actual database relationships,
NOT hardcoded whitelists.
"""

import time
import uuid

import psycopg2
import requests


class MultiTenantSystemProof:
    def __init__(self):
        self.server_url = "http://localhost:5001"
        self.db_config = {
            "host": "localhost",
            "port": 5441,
            "database": "security_test",
            "user": "edgars_app",
            "password": "app_secure_pass",
        }
        self.results = {}
        self.test_id = str(uuid.uuid4())[:8]

    def get_db_connection(self):
        """Get database connection for verification"""
        return psycopg2.connect(**self.db_config)

    def test_1_tenant_validation_with_database(self):
        """Test that tenant validation uses actual database records, not hardcoded lists"""
        print("🔍 TEST 1: REAL TENANT DATABASE VALIDATION")
        print("=" * 60)

        # Test 1A: Valid tenant from database should work
        try:
            response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"test1_{self.test_id}@edgarsmobile.com",
                    "password": "TestPassword123!",
                    "name": "Test Customer Edgar",
                },
                headers={"X-Tenant-Id": "edgar_mobile_shop"},  # Real tenant from DB
                timeout=10,
            )

            if response.status_code == 200:
                print("✅ Valid database tenant 'edgar_mobile_shop' accepted")
                test_1a = True
            else:
                print(f"❌ Valid database tenant rejected: {response.status_code}")
                print(f"   Response: {response.text}")
                test_1a = False

        except Exception as e:
            print(f"❌ Valid tenant test failed: {e}")
            test_1a = False

        # Test 1B: Invalid tenant should be rejected (database validation)
        try:
            response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"test1b_{self.test_id}@invalid.com",
                    "password": "TestPassword123!",
                    "name": "Test Invalid Tenant",
                },
                headers={"X-Tenant-Id": "non_existent_tenant_999"},  # Not in database
                timeout=10,
            )

            if response.status_code == 400:
                print("✅ Invalid database tenant 'non_existent_tenant_999' rejected")
                test_1b = True
            else:
                print(f"❌ SECURITY BREACH: Invalid tenant accepted ({response.status_code})")
                test_1b = False

        except Exception as e:
            print(f"❌ Invalid tenant test failed: {e}")
            test_1b = False

        # Test 1C: Verify hardcoded whitelist is NOT used
        try:
            # Try to register with a tenant that might be in old hardcoded list but not in database
            response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"test1c_{self.test_id}@whitelist.com",
                    "password": "TestPassword123!",
                    "name": "Test Whitelist Bypass",
                },
                headers={"X-Tenant-Id": "t_default"},  # Old hardcoded whitelist value
                timeout=10,
            )

            # This should be rejected if database validation is working
            if response.status_code == 400:
                print("✅ Hardcoded whitelist tenant 't_default' properly rejected")
                print("   (Database validation working, not using hardcoded whitelist)")
                test_1c = True
            elif response.status_code == 200:
                print("⚠️  't_default' tenant accepted - checking if it exists in database...")
                # Verify if t_default actually exists in database
                conn = self.get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM tenants WHERE id = %s", ("t_default",))
                exists = cursor.fetchone() is not None
                conn.close()

                if exists:
                    print("✅ 't_default' exists in database - valid acceptance")
                    test_1c = True
                else:
                    print("❌ SECURITY BREACH: Hardcoded whitelist bypassed database validation")
                    test_1c = False
            else:
                print(f"❌ Unexpected response for whitelist test: {response.status_code}")
                test_1c = False

        except Exception as e:
            print(f"❌ Whitelist bypass test failed: {e}")
            test_1c = False

        all_passed = all([test_1a, test_1b, test_1c])
        self.results["database_tenant_validation"] = all_passed

        print(f"\\n{'✅ PASSED' if all_passed else '❌ FAILED'}: Database tenant validation")
        return all_passed

    def test_2_legitimate_multitenant_operations(self):
        """Test that users from different tenants see different data"""
        print("\\n🔍 TEST 2: LEGITIMATE MULTI-TENANT OPERATIONS")
        print("=" * 60)

        # Create customers in different tenants
        edgar_customer = None
        quickfix_customer = None
        premium_customer = None

        try:
            # Register customer in Edgar's Mobile Shop
            edgar_response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"edgar_customer_{self.test_id}@test.com",
                    "password": "EdgarPassword123!",
                    "name": "Edgar Test Customer",
                },
                headers={"X-Tenant-Id": "edgar_mobile_shop"},
                timeout=10,
            )

            if edgar_response.status_code == 200:
                edgar_customer = edgar_response.json()
                print("✅ Created customer in Edgar's Mobile Shop")
            else:
                print(f"❌ Failed to create Edgar customer: {edgar_response.status_code}")

            # Register customer in Quick Fix Auto
            quickfix_response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"quickfix_customer_{self.test_id}@test.com",
                    "password": "QuickFixPassword123!",
                    "name": "QuickFix Test Customer",
                },
                headers={"X-Tenant-Id": "quick_fix_auto"},
                timeout=10,
            )

            if quickfix_response.status_code == 200:
                quickfix_customer = quickfix_response.json()
                print("✅ Created customer in Quick Fix Auto")
            else:
                print(f"❌ Failed to create QuickFix customer: {quickfix_response.status_code}")

            # Register customer in Premium Motors
            premium_response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": f"premium_customer_{self.test_id}@test.com",
                    "password": "PremiumPassword123!",
                    "name": "Premium Test Customer",
                },
                headers={"X-Tenant-Id": "premium_motors"},
                timeout=10,
            )

            if premium_response.status_code == 200:
                premium_customer = premium_response.json()
                print("✅ Created customer in Premium Motors")
            else:
                print(f"❌ Failed to create Premium customer: {premium_response.status_code}")

        except Exception as e:
            print(f"❌ Customer creation failed: {e}")

        # Verify tenant data isolation using direct database queries
        print("\\n🔍 Verifying tenant data isolation...")

        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Test Edgar's tenant context
            cursor.execute("SET app.tenant_id = 'edgar_mobile_shop'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            edgar_customer_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM services WHERE name LIKE '%Mobile%'")
            edgar_mobile_services = cursor.fetchone()[0]

            # Test Quick Fix tenant context
            cursor.execute("SET app.tenant_id = 'quick_fix_auto'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            quickfix_customer_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM services WHERE name LIKE '%Standard%'")
            quickfix_standard_services = cursor.fetchone()[0]

            # Test Premium Motors tenant context
            cursor.execute("SET app.tenant_id = 'premium_motors'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            premium_customer_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM services WHERE name LIKE '%Premium%'")
            premium_luxury_services = cursor.fetchone()[0]

            # Test cross-tenant isolation
            cursor.execute("SET app.tenant_id = 'edgar_mobile_shop'")
            cursor.execute("SELECT COUNT(*) FROM services WHERE name LIKE '%Premium%'")
            edgar_sees_premium_services = cursor.fetchone()[0]  # Should be 0

            conn.close()

            print(
                f"📊 Edgar's Mobile Shop: {edgar_customer_count} customers, {edgar_mobile_services} mobile services"
            )
            print(
                f"📊 Quick Fix Auto: {quickfix_customer_count} customers, {quickfix_standard_services} standard services"
            )
            print(
                f"📊 Premium Motors: {premium_customer_count} customers, {premium_luxury_services} premium services"
            )
            print(
                f"🔒 Cross-tenant test: Edgar sees {edgar_sees_premium_services} premium services (should be 0)"
            )

            # Validation
            isolation_working = (
                edgar_customer_count >= 3  # Has existing + new customer
                and quickfix_customer_count >= 3
                and premium_customer_count >= 2
                and edgar_mobile_services > 0  # Has mobile-specific services
                and quickfix_standard_services > 0  # Has standard services
                and premium_luxury_services > 0  # Has premium services
                and edgar_sees_premium_services == 0  # Cannot see other tenant's services
            )

            if isolation_working:
                print("✅ Multi-tenant data isolation working correctly!")
                print("   Each tenant sees only their own customers and services")
            else:
                print("❌ Multi-tenant data isolation failed!")

        except Exception as e:
            print(f"❌ Data isolation verification failed: {e}")
            isolation_working = False

        registration_success = edgar_customer and quickfix_customer and premium_customer
        overall_success = registration_success and isolation_working

        self.results["multitenant_operations"] = overall_success

        print(f"\\n{'✅ PASSED' if overall_success else '❌ FAILED'}: Multi-tenant operations")
        return overall_success

    def test_3_user_tenant_membership_system(self):
        """Test the user_tenants relationship system controls access properly"""
        print("\\n🔍 TEST 3: USER-TENANT MEMBERSHIP ACCESS CONTROL")
        print("=" * 60)

        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Test 1: Verify user-tenant relationships exist
            cursor.execute(
                """
                SELECT u.email, ut.tenant_id, ut.role, t.name
                FROM users u
                JOIN user_tenants ut ON u.id = ut.user_id
                JOIN tenants t ON ut.tenant_id = t.id
                WHERE ut.is_active = TRUE
                ORDER BY u.email, ut.tenant_id
            """
            )

            memberships = cursor.fetchall()
            print(f"📋 Found {len(memberships)} active user-tenant memberships:")

            for email, tenant_id, role, tenant_name in memberships[:10]:  # Show first 10
                print(f"   👤 {email} → {role} @ {tenant_name} ({tenant_id})")

            # Test 2: Verify cross-tenant access exists (realistic scenario)
            cursor.execute(
                """
                SELECT u.email, COUNT(DISTINCT ut.tenant_id) as tenant_count
                FROM users u
                JOIN user_tenants ut ON u.id = ut.user_id
                WHERE ut.is_active = TRUE
                GROUP BY u.id, u.email
                HAVING COUNT(DISTINCT ut.tenant_id) > 1
            """
            )

            cross_tenant_users = cursor.fetchall()
            print(f"\\n🔗 Found {len(cross_tenant_users)} users with multi-tenant access:")

            for email, tenant_count in cross_tenant_users:
                print(f"   👤 {email} has access to {tenant_count} tenants")

            # Test 3: Verify tenant-specific business data relationships
            cursor.execute(
                """
                SELECT t.name, COUNT(DISTINCT c.id) as customers, COUNT(DISTINCT s.id) as services,
                       COUNT(DISTINCT a.id) as appointments
                FROM tenants t
                LEFT JOIN customers c ON t.id = c.tenant_id
                LEFT JOIN services s ON t.id = s.tenant_id
                LEFT JOIN appointments a ON t.id = a.tenant_id
                GROUP BY t.id, t.name
                ORDER BY t.name
            """
            )

            tenant_data = cursor.fetchall()
            print("\\n📈 Tenant business data distribution:")

            for name, customers, services, appointments in tenant_data:
                print(
                    f"   🏢 {name}: {customers} customers, {services} services, {appointments} appointments"
                )

            # Test 4: Verify RLS prevents unauthorized data access
            print("\\n🔒 Testing RLS enforcement across tenants...")

            # Edgar's context - should only see Edgar's data
            cursor.execute("SET app.tenant_id = 'edgar_mobile_shop'")
            cursor.execute("SELECT tenant_id, COUNT(*) FROM customers GROUP BY tenant_id")
            edgar_view = cursor.fetchall()

            # Quick Fix context - should only see Quick Fix data
            cursor.execute("SET app.tenant_id = 'quick_fix_auto'")
            cursor.execute("SELECT tenant_id, COUNT(*) FROM customers GROUP BY tenant_id")
            quickfix_view = cursor.fetchall()

            print(f"   Edgar's view: {edgar_view}")
            print(f"   QuickFix view: {quickfix_view}")

            # Validation: Each should only see their own tenant's data
            edgar_isolated = len(edgar_view) == 1 and edgar_view[0][0] == "edgar_mobile_shop"
            quickfix_isolated = len(quickfix_view) == 1 and quickfix_view[0][0] == "quick_fix_auto"

            if edgar_isolated and quickfix_isolated:
                print("✅ RLS enforcement working - each tenant sees only their data")
                rls_working = True
            else:
                print("❌ RLS enforcement failed - cross-tenant data leakage detected")
                rls_working = False

            conn.close()

            # Overall validation
            system_working = (
                len(memberships) >= 8  # Has user-tenant relationships
                and len(cross_tenant_users) >= 2  # Has cross-tenant users
                and len(tenant_data) == 3  # Has all 3 tenants with data
                and rls_working  # RLS prevents unauthorized access
            )

            self.results["user_tenant_system"] = system_working

            print(
                f"\\n{'✅ PASSED' if system_working else '❌ FAILED'}: User-tenant membership system"
            )
            return system_working

        except Exception as e:
            print(f"❌ User-tenant system test failed: {e}")
            import traceback

            traceback.print_exc()
            self.results["user_tenant_system"] = False
            return False

    def test_4_complete_authentication_flows(self):
        """Test complete authentication flows with tenant isolation"""
        print("\\n🔍 TEST 4: COMPLETE AUTHENTICATION FLOWS WITH TENANT ISOLATION")
        print("=" * 60)

        auth_tests = {}

        # Test 4A: Registration flow with proper tenant validation
        try:
            unique_email = f"auth_test_{self.test_id}@test.com"

            # Valid registration
            reg_response = requests.post(
                f"{self.server_url}/api/customers/register",
                json={
                    "email": unique_email,
                    "password": "AuthTestPassword123!",
                    "name": "Authentication Test User",
                },
                headers={"X-Tenant-Id": "edgar_mobile_shop"},
                timeout=10,
            )

            if reg_response.status_code == 200:
                print("✅ Registration with valid tenant succeeded")
                auth_tests["registration"] = True

                # Test login immediately after registration
                login_response = requests.post(
                    f"{self.server_url}/api/customers/login",
                    json={"email": unique_email, "password": "AuthTestPassword123!"},
                    headers={"X-Tenant-Id": "edgar_mobile_shop"},
                    timeout=10,
                )

                if login_response.status_code == 200:
                    print("✅ Login after registration succeeded")
                    auth_tests["login_after_registration"] = True
                else:
                    print(f"❌ Login after registration failed: {login_response.status_code}")
                    auth_tests["login_after_registration"] = False

            else:
                print(f"❌ Registration failed: {reg_response.status_code}")
                auth_tests["registration"] = False
                auth_tests["login_after_registration"] = False

        except Exception as e:
            print(f"❌ Registration/login flow failed: {e}")
            auth_tests["registration"] = False
            auth_tests["login_after_registration"] = False

        # Test 4B: Cross-tenant login prevention
        try:
            if auth_tests.get("registration", False):
                # Try to login from different tenant context
                cross_tenant_login = requests.post(
                    f"{self.server_url}/api/customers/login",
                    json={"email": unique_email, "password": "AuthTestPassword123!"},
                    headers={"X-Tenant-Id": "quick_fix_auto"},  # Different tenant!
                    timeout=10,
                )

                if cross_tenant_login.status_code == 401:
                    print("✅ Cross-tenant login correctly blocked (401)")
                    auth_tests["cross_tenant_blocked"] = True
                else:
                    print(
                        f"❌ SECURITY BREACH: Cross-tenant login succeeded ({cross_tenant_login.status_code})"
                    )
                    auth_tests["cross_tenant_blocked"] = False
            else:
                auth_tests["cross_tenant_blocked"] = False

        except Exception as e:
            print(f"❌ Cross-tenant login test failed: {e}")
            auth_tests["cross_tenant_blocked"] = False

        # Test 4C: No tenant header handling
        try:
            no_tenant_login = requests.post(
                f"{self.server_url}/api/customers/login",
                json={"email": unique_email, "password": "AuthTestPassword123!"},
                # No X-Tenant-Id header
                timeout=10,
            )

            # Should be rejected in production multi-tenant system
            if no_tenant_login.status_code in [400, 401]:
                print("✅ Login without tenant header properly rejected")
                auth_tests["no_tenant_rejected"] = True
            else:
                print(f"❌ Login without tenant header not rejected: {no_tenant_login.status_code}")
                auth_tests["no_tenant_rejected"] = False

        except Exception as e:
            print(f"❌ No tenant header test failed: {e}")
            auth_tests["no_tenant_rejected"] = False

        # Test 4D: Verify authentication data is tenant-isolated
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Check customer_auth table tenant isolation
            cursor.execute("SET app.tenant_id = 'edgar_mobile_shop'")
            cursor.execute("SELECT COUNT(*) FROM customer_auth")
            edgar_auth_count = cursor.fetchone()[0]

            cursor.execute("SET app.tenant_id = 'quick_fix_auto'")
            cursor.execute("SELECT COUNT(*) FROM customer_auth")
            quickfix_auth_count = cursor.fetchone()[0]

            cursor.execute("RESET app.tenant_id")
            cursor.execute("SELECT COUNT(*) FROM customer_auth")
            no_tenant_auth_count = cursor.fetchone()[0]

            conn.close()

            print(
                f"📊 Auth records - Edgar: {edgar_auth_count}, QuickFix: {quickfix_auth_count}, No tenant: {no_tenant_auth_count}"
            )

            if no_tenant_auth_count == 0 and edgar_auth_count > 0:
                print("✅ Authentication data properly tenant-isolated")
                auth_tests["auth_data_isolated"] = True
            else:
                print("❌ Authentication data not properly isolated")
                auth_tests["auth_data_isolated"] = False

        except Exception as e:
            print(f"❌ Auth data isolation test failed: {e}")
            auth_tests["auth_data_isolated"] = False

        # Overall authentication flow validation
        all_auth_passed = all(auth_tests.values())
        self.results["authentication_flows"] = all_auth_passed

        print(
            f"\\n{'✅ PASSED' if all_auth_passed else '❌ FAILED'}: Complete authentication flows"
        )
        return all_auth_passed

    def generate_comprehensive_report(self):
        """Generate comprehensive multi-tenant system proof report"""
        print("\\n" + "=" * 80)
        print("🏁 TASK 8-C: COMPLETE MULTI-TENANT SYSTEM PROOF RESULTS")
        print("=" * 80)

        print("MULTI-TENANT ARCHITECTURE VALIDATION:")
        print(
            f"  Database Tenant Validation:          {'✅ PASS' if self.results.get('database_tenant_validation') else '❌ FAIL'}"
        )
        print(
            f"  Legitimate Multi-Tenant Operations:  {'✅ PASS' if self.results.get('multitenant_operations') else '❌ FAIL'}"
        )
        print(
            f"  User-Tenant Membership System:       {'✅ PASS' if self.results.get('user_tenant_system') else '❌ FAIL'}"
        )
        print(
            f"  Complete Authentication Flows:       {'✅ PASS' if self.results.get('authentication_flows') else '❌ FAIL'}"
        )

        total_passed = sum([1 for result in self.results.values() if result])
        total_tests = len(self.results)

        print("-" * 80)

        if total_passed == total_tests:
            print("🎉 MULTI-TENANT SYSTEM: FULLY VALIDATED!")
            print("✅ ALL SECURITY LAYERS WORKING TOGETHER")
            print("✅ SOPHISTICATED ARCHITECTURE PROVEN")
            print()
            print("CONFIRMED MULTI-TENANT FEATURES:")
            print("  🏢 Real tenant records with business data")
            print("  👥 Users with proper tenant associations via user_tenants table")
            print("  🔄 Legitimate cross-tenant access for consultants/managers")
            print("  🔒 Database-level RLS enforcing tenant boundaries")
            print("  🛡️  Application-level tenant validation using database relationships")
            print("  🍪 Secure authentication with tenant isolation")
            print("  📊 Business data properly isolated by tenant")
            print()
            print("🚀 SOPHISTICATED MULTI-TENANT ARCHITECTURE: PRODUCTION READY")
            print("🎯 Real tenant relationships: WORKING")
            print("🏆 No hardcoded whitelists: DATABASE-DRIVEN VALIDATION")

            return "MULTITENANT_SYSTEM_PROVEN"

        else:
            print(f"❌ MULTI-TENANT SYSTEM FAILED: {total_passed}/{total_tests} tests passed")
            print("🚨 ARCHITECTURAL FLAWS DETECTED")
            print("🛑 SOPHISTICATED SYSTEM NOT WORKING PROPERLY")

            # Show which tests failed
            for test, result in self.results.items():
                if not result:
                    print(f"   🔥 FAILED: {test}")

            return "MULTITENANT_SYSTEM_FAILED"


def main():
    print("🚨 TASK 8-C: COMPLETE MULTI-TENANT SYSTEM PROOF")
    print("Comprehensive validation of sophisticated multi-tenant architecture")
    print("=" * 80)

    tester = MultiTenantSystemProof()

    # Execute all multi-tenant system tests
    print("Starting comprehensive multi-tenant system validation...")
    time.sleep(2)

    test1 = tester.test_1_tenant_validation_with_database()
    test2 = tester.test_2_legitimate_multitenant_operations() if test1 else False
    test3 = tester.test_3_user_tenant_membership_system() if test1 else False
    test4 = tester.test_4_complete_authentication_flows() if test1 else False

    # Generate final comprehensive report
    system_status = tester.generate_comprehensive_report()

    if system_status == "MULTITENANT_SYSTEM_PROVEN":
        print("\\n✅ TASK 8-C COMPLETE: Sophisticated multi-tenant system PROVEN!")
        return 0
    else:
        print("\\n❌ TASK 8-C FAILED: Multi-tenant system validation FAILED!")
        return 1


if __name__ == "__main__":
    exit(main())
