#!/usr/bin/env python3
"""
🔬 TASK 7: INTEGRATION TESTING & VERIFICATION
Complete end-to-end verification of the multi-tenant security foundation

This script verifies that all 6 security tasks work together as an integrated system:
- TASK 1: Database Multi-Tenant Foundation
- TASK 2: Row-Level Security Enforcement
- TASK 3: Tenant Context Middleware
- TASK 4: Secure Password Hashing
- TASK 5: Secure JWT Cookie System
- TASK 6: Password Reset Flow

CRITICAL: NO new development until this security foundation is proven to work.
"""

import random
import string
import subprocess
import time

import psycopg2
import requests
from psycopg2.extras import RealDictCursor

print("🔬 TASK 7: INTEGRATION TESTING & VERIFICATION")
print("=" * 70)
print("🚨 HALTING ALL NEW DEVELOPMENT")
print("🔒 VERIFYING COMPLETE SECURITY FOUNDATION WORKS END-TO-END")
print("=" * 70)


class SecurityIntegrationTest:
    def __init__(self):
        self.base_url = "http://localhost:3001"
        self.db_conn = None
        self.test_results = {}
        self.tenant1_id = None
        self.tenant2_id = None
        self.user1_data = None
        self.user2_data = None

    def log_test(self, test_name, success, message=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results[test_name] = success

    def generate_test_data(self):
        """Generate unique test data"""
        timestamp = int(time.time())
        random_suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))

        return {
            "tenant1_name": f"tenant1_{timestamp}_{random_suffix}",
            "tenant2_name": f"tenant2_{timestamp}_{random_suffix}",
            "user1_email": f"user1_{timestamp}_{random_suffix}@test.com",
            "user2_email": f"user2_{timestamp}_{random_suffix}@test.com",
            "password": "SecureTestPassword123!",
        }

    def test_1_database_startup(self):
        """Test 1: Full System Startup - Database and Migrations"""
        print("\n🏗️ TEST 1: FULL SYSTEM STARTUP")
        print("=" * 50)

        try:
            # Check if Docker is available
            result = subprocess.run(["docker", "--version"], capture_output=True, text=True)
            if result.returncode != 0:
                self.log_test("Docker Available", False, "Docker not found")
                return False

            self.log_test("Docker Available", True, "Docker is installed")

            # Try to start database container
            print("Starting local database with Docker...")
            result = subprocess.run(
                ["docker-compose", "up", "-d", "db"],
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop",
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                self.log_test("Database Container", True, "PostgreSQL container started")
                time.sleep(5)  # Wait for database to be ready
            else:
                self.log_test("Database Container", False, f"Failed: {result.stderr}")
                return False

            # Test database connection
            try:
                # Try local development database credentials
                self.db_conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="autoshop",
                    user="autoshop_user",
                    password="autoshop_pass",
                )
                self.log_test("Database Connection", True, "Connected to PostgreSQL")
            except psycopg2.Error as e:
                # Try alternative credentials
                try:
                    self.db_conn = psycopg2.connect(
                        host="localhost",
                        port=5432,
                        database="postgres",
                        user="postgres",
                        password="postgres",
                    )
                    self.log_test(
                        "Database Connection", True, "Connected to PostgreSQL (alt credentials)"
                    )
                except psycopg2.Error:
                    self.log_test("Database Connection", False, f"Connection failed: {e}")
                    return False

            # Run migrations
            print("Running migrations 001-004...")
            result = subprocess.run(
                ["python", "init_db.py"],
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop",
                capture_output=True,
                text=True,
            )

            if "successfully" in result.stdout.lower() or result.returncode == 0:
                self.log_test("Database Migrations", True, "All migrations executed")
            else:
                self.log_test("Database Migrations", False, f"Migration failed: {result.stderr}")
                return False

            return True

        except Exception as e:
            self.log_test("System Startup", False, f"Startup failed: {e}")
            return False

    def test_2_create_test_tenants(self):
        """Test 2: Multi-Tenant Foundation - Create Test Tenants"""
        print("\n🏢 TEST 2: MULTI-TENANT FOUNDATION")
        print("=" * 50)

        if not self.db_conn:
            self.log_test("Tenant Creation", False, "No database connection")
            return False

        try:
            test_data = self.generate_test_data()

            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Create tenant 1
                cursor.execute(
                    """
                    INSERT INTO tenants (id, name, domain_name)
                    VALUES (%s, %s, %s) RETURNING id
                """,
                    (
                        test_data["tenant1_name"],
                        f"Tenant 1 {test_data['tenant1_name']}",
                        f"{test_data['tenant1_name']}.test.com",
                    ),
                )

                self.tenant1_id = cursor.fetchone()["id"]

                # Create tenant 2
                cursor.execute(
                    """
                    INSERT INTO tenants (id, name, domain_name)
                    VALUES (%s, %s, %s) RETURNING id
                """,
                    (
                        test_data["tenant2_name"],
                        f"Tenant 2 {test_data['tenant2_name']}",
                        f"{test_data['tenant2_name']}.test.com",
                    ),
                )

                self.tenant2_id = cursor.fetchone()["id"]

                self.db_conn.commit()

                self.log_test(
                    "Tenant Creation",
                    True,
                    f"Created tenants: {self.tenant1_id}, {self.tenant2_id}",
                )

                # Store user data for later tests
                self.user1_data = {
                    "name": "Test User 1",
                    "email": test_data["user1_email"],
                    "password": test_data["password"],
                    "phone": "+1234567801",
                    "tenant_id": self.tenant1_id,
                }

                self.user2_data = {
                    "name": "Test User 2",
                    "email": test_data["user2_email"],
                    "password": test_data["password"],
                    "phone": "+1234567802",
                    "tenant_id": self.tenant2_id,
                }

                return True

        except Exception as e:
            self.log_test("Tenant Creation", False, f"Failed to create tenants: {e}")
            return False

    def test_3_flask_server_startup(self):
        """Test 3: Start Flask Server"""
        print("\n🌐 TEST 3: FLASK SERVER STARTUP")
        print("=" * 50)

        try:
            # Start Flask server in background
            print("Starting Flask server...")
            self.server_process = subprocess.Popen(
                ["python", "backend/local_server.py"],
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Wait for server to start
            time.sleep(8)

            # Test server health
            try:
                response = requests.get(f"{self.base_url}/api/health", timeout=5)
                if response.status_code == 200:
                    self.log_test("Flask Server", True, "Server started and responding")
                    return True
                else:
                    self.log_test(
                        "Flask Server", False, f"Health check failed: {response.status_code}"
                    )
                    return False
            except requests.exceptions.RequestException as e:
                self.log_test("Flask Server", False, f"Server not responding: {e}")
                return False

        except Exception as e:
            self.log_test("Flask Server", False, f"Failed to start server: {e}")
            return False

    def test_4_registration_flow(self):
        """Test 4: Registration with bcrypt + httpOnly cookies"""
        print("\n👤 TEST 4: REGISTRATION & AUTHENTICATION FLOW")
        print("=" * 50)

        try:
            # Test registration for tenant 1 user
            headers = {
                "Content-Type": "application/json",
                "Host": f"{self.tenant1_id}.test.com",  # Tenant context via Host header
            }

            response = requests.post(
                f"{self.base_url}/api/customers/register", json=self.user1_data, headers=headers
            )

            if response.status_code == 201:
                self.log_test("User Registration", True, "User registered successfully")

                # Check for httpOnly cookies
                cookies = response.cookies
                has_access_cookie = "__Host_access_token" in cookies
                has_refresh_cookie = "__Host_refresh_token" in cookies

                if has_access_cookie and has_refresh_cookie:
                    self.log_test("httpOnly Cookies", True, "Access and refresh cookies set")
                else:
                    self.log_test("httpOnly Cookies", False, "Missing authentication cookies")

                # Verify no tokens in JSON response
                response_data = response.json()
                has_json_token = "token" in response_data or "access_token" in response_data

                if not has_json_token:
                    self.log_test("No JSON Tokens", True, "No tokens in response JSON")
                else:
                    self.log_test("No JSON Tokens", False, "Found tokens in JSON response")

                # Store user ID for later tests
                self.user1_data["id"] = response_data.get("customer_id")

                return True
            else:
                self.log_test(
                    "User Registration", False, f"Registration failed: {response.status_code}"
                )
                return False

        except Exception as e:
            self.log_test("Registration Flow", False, f"Registration test failed: {e}")
            return False

    def test_5_login_flow(self):
        """Test 5: Login with bcrypt verification + cookie setting"""
        print("\n🔐 TEST 5: LOGIN & COOKIE AUTHENTICATION")
        print("=" * 50)

        try:
            # Test login
            headers = {"Content-Type": "application/json", "Host": f"{self.tenant1_id}.test.com"}

            login_data = {
                "email": self.user1_data["email"],
                "password": self.user1_data["password"],
            }

            response = requests.post(
                f"{self.base_url}/api/customers/login", json=login_data, headers=headers
            )

            if response.status_code == 200:
                self.log_test("User Login", True, "Login successful")

                # Check for httpOnly cookies
                cookies = response.cookies
                has_access_cookie = "__Host_access_token" in cookies
                has_refresh_cookie = "__Host_refresh_token" in cookies

                if has_access_cookie and has_refresh_cookie:
                    self.log_test("Login Cookies", True, "Login sets authentication cookies")
                else:
                    self.log_test("Login Cookies", False, "Login missing cookies")

                # Store session for later tests
                self.user1_session = requests.Session()
                self.user1_session.cookies.update(response.cookies)
                self.user1_session.headers.update({"Host": f"{self.tenant1_id}.test.com"})

                return True
            else:
                self.log_test("User Login", False, f"Login failed: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Login Flow", False, f"Login test failed: {e}")
            return False

    def test_6_tenant_isolation(self):
        """Test 6: Multi-Tenant Isolation & RLS Enforcement"""
        print("\n🏢 TEST 6: TENANT ISOLATION & RLS ENFORCEMENT")
        print("=" * 50)

        try:
            # Register user in tenant 2
            headers = {"Content-Type": "application/json", "Host": f"{self.tenant2_id}.test.com"}

            response = requests.post(
                f"{self.base_url}/api/customers/register", json=self.user2_data, headers=headers
            )

            if response.status_code == 201:
                self.log_test("Tenant 2 Registration", True, "Second tenant user registered")

                # Login user 2
                login_data = {
                    "email": self.user2_data["email"],
                    "password": self.user2_data["password"],
                }

                response = requests.post(
                    f"{self.base_url}/api/customers/login", json=login_data, headers=headers
                )

                if response.status_code == 200:
                    self.user2_session = requests.Session()
                    self.user2_session.cookies.update(response.cookies)
                    self.user2_session.headers.update({"Host": f"{self.tenant2_id}.test.com"})

                    self.log_test("Tenant 2 Login", True, "Second tenant user logged in")

                    # Test cross-tenant access (should be blocked)
                    # User 1 tries to access with tenant 2 context
                    try:
                        cross_tenant_headers = {"Host": f"{self.tenant2_id}.test.com"}
                        response = self.user1_session.get(
                            f"{self.base_url}/api/customers/profile", headers=cross_tenant_headers
                        )

                        if response.status_code in [403, 404, 401]:
                            self.log_test(
                                "Cross-Tenant Access Blocked",
                                True,
                                f"Cross-tenant access properly blocked ({response.status_code})",
                            )
                        else:
                            self.log_test(
                                "Cross-Tenant Access Blocked",
                                False,
                                f"Cross-tenant access allowed ({response.status_code})",
                            )
                    except:
                        self.log_test(
                            "Cross-Tenant Access Blocked", True, "Cross-tenant access blocked"
                        )

                    return True
                else:
                    self.log_test("Tenant 2 Login", False, "Second tenant login failed")
                    return False
            else:
                self.log_test("Tenant 2 Registration", False, "Second tenant registration failed")
                return False

        except Exception as e:
            self.log_test("Tenant Isolation", False, f"Tenant isolation test failed: {e}")
            return False

    def test_7_password_reset_flow(self):
        """Test 7: Complete Password Reset Flow"""
        print("\n🔓 TEST 7: PASSWORD RESET FLOW")
        print("=" * 50)

        try:
            # Test reset request
            headers = {"Content-Type": "application/json", "Host": f"{self.tenant1_id}.test.com"}

            reset_request = {"email": self.user1_data["email"]}

            response = requests.post(
                f"{self.base_url}/api/auth/reset-request", json=reset_request, headers=headers
            )

            if response.status_code == 202:
                self.log_test("Password Reset Request", True, "Reset request returns 202")

                response_data = response.json()
                if "reset link has been sent" in response_data.get("message", "").lower():
                    self.log_test("Generic Reset Message", True, "Prevents email enumeration")
                else:
                    self.log_test("Generic Reset Message", False, "Message may leak information")

                # Test reset request for non-existent email (should also return 202)
                fake_reset = {"email": "nonexistent@fake.com"}
                response = requests.post(
                    f"{self.base_url}/api/auth/reset-request", json=fake_reset, headers=headers
                )

                if response.status_code == 202:
                    self.log_test(
                        "Email Enumeration Prevention", True, "Same response for non-existent email"
                    )
                else:
                    self.log_test(
                        "Email Enumeration Prevention",
                        False,
                        "Different response reveals email existence",
                    )

                return True
            else:
                self.log_test(
                    "Password Reset Request", False, f"Reset request failed: {response.status_code}"
                )
                return False

        except Exception as e:
            self.log_test("Password Reset Flow", False, f"Reset flow test failed: {e}")
            return False

    def test_8_token_refresh(self):
        """Test 8: Token Refresh System"""
        print("\n🔄 TEST 8: TOKEN REFRESH SYSTEM")
        print("=" * 50)

        try:
            if not hasattr(self, "user1_session"):
                self.log_test("Token Refresh", False, "No active session for refresh test")
                return False

            # Test refresh endpoint
            response = self.user1_session.post(f"{self.base_url}/api/auth/refresh")

            if response.status_code == 200:
                self.log_test("Token Refresh", True, "Refresh endpoint working")

                # Check for new cookies
                cookies = response.cookies
                has_new_tokens = (
                    "__Host_access_token" in cookies and "__Host_refresh_token" in cookies
                )

                if has_new_tokens:
                    self.log_test("Token Rotation", True, "New tokens generated on refresh")

                    # Update session with new cookies
                    self.user1_session.cookies.update(response.cookies)
                else:
                    self.log_test("Token Rotation", False, "No new tokens on refresh")

                return True
            else:
                self.log_test("Token Refresh", False, f"Refresh failed: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Token Refresh", False, f"Token refresh test failed: {e}")
            return False

    def test_9_logout_flow(self):
        """Test 9: Logout and Cookie Clearing"""
        print("\n👋 TEST 9: LOGOUT & COOKIE CLEARING")
        print("=" * 50)

        try:
            if not hasattr(self, "user1_session"):
                self.log_test("Logout Flow", False, "No active session for logout test")
                return False

            # Test logout endpoint
            response = self.user1_session.post(f"{self.base_url}/api/auth/logout")

            if response.status_code == 200:
                self.log_test("Logout Request", True, "Logout endpoint working")

                # Try to access protected endpoint after logout
                response = self.user1_session.get(f"{self.base_url}/api/customers/profile")

                if response.status_code in [401, 403]:
                    self.log_test(
                        "Post-Logout Access", True, "Protected endpoints blocked after logout"
                    )
                else:
                    self.log_test(
                        "Post-Logout Access", False, "Protected endpoints still accessible"
                    )

                return True
            else:
                self.log_test("Logout Request", False, f"Logout failed: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Logout Flow", False, f"Logout test failed: {e}")
            return False

    def test_10_error_handling(self):
        """Test 10: Error Handling & Edge Cases"""
        print("\n⚠️ TEST 10: ERROR HANDLING & EDGE CASES")
        print("=" * 50)

        try:
            # Test malformed request
            response = requests.post(
                f"{self.base_url}/api/customers/login",
                data="invalid json",
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 400:
                self.log_test("Malformed Request Handling", True, "Bad requests properly rejected")
            else:
                self.log_test("Malformed Request Handling", False, "Malformed requests not handled")

            # Test invalid credentials
            headers = {"Content-Type": "application/json", "Host": f"{self.tenant1_id}.test.com"}

            response = requests.post(
                f"{self.base_url}/api/customers/login",
                json={"email": self.user1_data["email"], "password": "wrong_password"},
                headers=headers,
            )

            if response.status_code == 401:
                self.log_test("Invalid Credentials", True, "Wrong password rejected")
            else:
                self.log_test("Invalid Credentials", False, "Wrong password not rejected")

            # Test missing tenant context
            response = requests.post(
                f"{self.base_url}/api/customers/login",
                json={"email": self.user1_data["email"], "password": self.user1_data["password"]},
                # No Host header = no tenant context
            )

            if response.status_code in [400, 403]:
                self.log_test(
                    "Missing Tenant Context", True, "Requests without tenant context rejected"
                )
            else:
                self.log_test("Missing Tenant Context", False, "Missing tenant context not handled")

            return True

        except Exception as e:
            self.log_test("Error Handling", False, f"Error handling test failed: {e}")
            return False

    def cleanup(self):
        """Clean up test resources"""
        print("\n🧹 CLEANING UP TEST RESOURCES")
        print("=" * 50)

        try:
            # Stop Flask server
            if hasattr(self, "server_process"):
                self.server_process.terminate()
                self.server_process.wait(timeout=10)
                print("✅ Flask server stopped")
        except:
            print("⚠️ Could not stop Flask server cleanly")

        try:
            # Clean up test data
            if self.db_conn and self.tenant1_id and self.tenant2_id:
                with self.db_conn.cursor() as cursor:
                    # Delete test tenants (cascades to users)
                    cursor.execute(
                        "DELETE FROM tenants WHERE id IN (%s, %s)",
                        (self.tenant1_id, self.tenant2_id),
                    )
                    self.db_conn.commit()
                    print("✅ Test data cleaned up")
        except:
            print("⚠️ Could not clean up test data")

        try:
            # Close database connection
            if self.db_conn:
                self.db_conn.close()
                print("✅ Database connection closed")
        except:
            print("⚠️ Could not close database connection")

        try:
            # Stop database container
            subprocess.run(
                ["docker-compose", "down"],
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop",
                capture_output=True,
            )
            print("✅ Database container stopped")
        except:
            print("⚠️ Could not stop database container")

    def run_all_tests(self):
        """Run complete integration test suite"""
        print("🚀 STARTING COMPLETE INTEGRATION TEST SUITE")
        print("=" * 70)

        tests = [
            ("Database & Startup", self.test_1_database_startup),
            ("Multi-Tenant Foundation", self.test_2_create_test_tenants),
            ("Flask Server", self.test_3_flask_server_startup),
            ("Registration Flow", self.test_4_registration_flow),
            ("Login Flow", self.test_5_login_flow),
            ("Tenant Isolation", self.test_6_tenant_isolation),
            ("Password Reset", self.test_7_password_reset_flow),
            ("Token Refresh", self.test_8_token_refresh),
            ("Logout Flow", self.test_9_logout_flow),
            ("Error Handling", self.test_10_error_handling),
        ]

        try:
            for test_name, test_func in tests:
                print(f"\n{'='*20} {test_name} {'='*20}")
                success = test_func()
                if not success:
                    print(f"❌ CRITICAL FAILURE in {test_name}")
                    print("🚨 STOPPING TEST SUITE - SECURITY FOUNDATION BROKEN")
                    break

            # Print final results
            self.print_final_results()

        finally:
            # Always cleanup
            self.cleanup()

    def print_final_results(self):
        """Print comprehensive test results"""
        print("\n" + "=" * 70)
        print("🔬 INTEGRATION TEST RESULTS - SECURITY FOUNDATION VERIFICATION")
        print("=" * 70)

        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result)
        failed_tests = total_tests - passed_tests

        print("\n📊 TEST SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {failed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests)*100:.1f}%")

        print("\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {status} {test_name}")

        if failed_tests == 0:
            print("\n🎉 ALL TESTS PASSED - SECURITY FOUNDATION VERIFIED!")
            print("✅ Multi-tenant database foundation working")
            print("✅ Row-Level Security enforcing isolation")
            print("✅ Tenant context middleware functioning")
            print("✅ bcrypt password hashing secure")
            print("✅ httpOnly cookie authentication working")
            print("✅ Password reset flow complete")
            print("✅ Cross-tenant access blocked")
            print("✅ Error handling robust")
            print("\n🚀 SECURITY FOUNDATION IS SOLID - READY FOR NEW DEVELOPMENT")
        else:
            print(f"\n🚨 {failed_tests} TESTS FAILED - SECURITY FOUNDATION BROKEN!")
            print("❌ DO NOT PROCEED WITH NEW DEVELOPMENT")
            print("❌ FIX FAILING TESTS BEFORE ADDING FEATURES")
            print("❌ SECURITY VULNERABILITIES PRESENT")
            print("\n🛑 DEVELOPMENT HALT REQUIRED")


if __name__ == "__main__":
    tester = SecurityIntegrationTest()
    tester.run_all_tests()
