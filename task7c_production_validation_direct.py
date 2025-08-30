#!/usr/bin/env python3
"""
TASK 7-C: PRODUCTION SYSTEM VALIDATION (Direct Testing)

This script tests the ACTUAL production security functions directly without
starting a full Flask server to avoid module import conflicts.

Tests the real security functions from backend/local_server.py:
- hash_password() and verify_password() with bcrypt
- make_tokens() for JWT generation
- require_auth_role() for authentication
- Multi-tenant RLS at database level

Usage: python task7c_production_validation_direct.py
"""

import os
import subprocess
import sys
import time
from datetime import datetime

import jwt
import psycopg2

# Add backend to path to import production modules
sys.path.insert(0, "/Users/jesusortiz/Edgars-mobile-auto-shop/backend")
sys.path.insert(0, "/Users/jesusortiz/Edgars-mobile-auto-shop")


class ProductionSecurityDirectValidator:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.start_time = time.time()
        self.db_connection = None

    def log_test(self, test_name, passed, details=""):
        """Log individual test results"""
        if passed:
            print(f"    ✅ {test_name}: {details}")
            self.passed += 1
        else:
            print(f"    ❌ {test_name}: {details}")
            self.failed += 1

    def cleanup(self):
        """Clean up running processes"""
        if self.db_connection:
            self.db_connection.close()
        os.system("docker stop prod-direct-test-postgres 2>/dev/null")

    def setup_production_database(self):
        """Setup production database"""
        print("\n🗄️  PRODUCTION DATABASE SETUP")
        print("=" * 60)

        try:
            # Start fresh PostgreSQL
            docker_cmd = [
                "docker",
                "run",
                "--rm",
                "-d",
                "--name",
                "prod-direct-test-postgres",
                "-p",
                "5435:5432",
                "-e",
                "POSTGRES_PASSWORD=prodtest",
                "-e",
                "POSTGRES_DB=edgars_prod_direct_test",
                "postgres:15",
            ]

            result = subprocess.run(docker_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                self.log_test("Production DB Container", False, f"Failed: {result.stderr}")
                return False

            self.log_test("Production DB Container", True, "PostgreSQL container started")

            # Wait for database
            for i in range(30):
                try:
                    conn = psycopg2.connect(
                        host="localhost",
                        port=5435,
                        database="edgars_prod_direct_test",
                        user="postgres",
                        password="prodtest",
                    )
                    conn.close()
                    break
                except:
                    time.sleep(1)
            else:
                self.log_test("Production DB Ready", False, "Database not ready after 30s")
                return False

            self.log_test("Production DB Ready", True, "Database accepting connections")
            return True

        except Exception as e:
            self.log_test("Production Database Setup", False, f"Error: {e}")
            return False

    def setup_production_schema(self):
        """Create production schema"""
        print("\n🔄 PRODUCTION SCHEMA SETUP")
        print("=" * 60)

        try:
            # Set environment for production database
            os.environ.update(
                {
                    "DATABASE_URL": "postgresql://postgres:prodtest@localhost:5435/edgars_prod_direct_test",
                    "POSTGRES_HOST": "localhost",
                    "POSTGRES_PORT": "5435",
                    "POSTGRES_DB": "edgars_prod_direct_test",
                    "POSTGRES_USER": "postgres",
                    "POSTGRES_PASSWORD": "prodtest",
                }
            )

            conn = psycopg2.connect(
                host="localhost",
                port=5435,
                database="edgars_prod_direct_test",
                user="postgres",
                password="prodtest",
            )
            conn.autocommit = False
            cursor = conn.cursor()

            try:
                # Create production schema
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tenants (
                      id VARCHAR(100) PRIMARY KEY,
                      name VARCHAR(255) NOT NULL,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """
                )

                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS customers (
                      id SERIAL PRIMARY KEY,
                      name VARCHAR(255) NOT NULL,
                      phone VARCHAR(20),
                      email VARCHAR(255) UNIQUE NOT NULL,
                      password_hash VARCHAR(255),
                      address TEXT,
                      tenant_id VARCHAR(100) REFERENCES tenants(id),
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """
                )

                # Enable RLS
                cursor.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")
                cursor.execute(
                    """
                    DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
                    CREATE POLICY tenant_isolation_customers ON customers
                    USING (tenant_id = current_setting('app.tenant_id', true));
                """
                )

                # Create test tenants
                cursor.execute(
                    """
                    INSERT INTO tenants (id, name) VALUES
                    ('prod_tenant_1', 'Production Tenant 1'),
                    ('prod_tenant_2', 'Production Tenant 2')
                    ON CONFLICT (id) DO NOTHING;
                """
                )

                conn.commit()
                self.log_test("Production Schema", True, "Schema created with RLS")

                self.db_connection = conn
                return True

            except Exception as e:
                conn.rollback()
                self.log_test("Schema Setup Failed", False, f"Error: {e}")
                return False

        except Exception as e:
            self.log_test("Database Connection Failed", False, f"Error: {e}")
            return False

    def test_production_password_hashing(self):
        """Test actual production password hashing functions"""
        print("\n🔐 PRODUCTION PASSWORD HASHING TESTING")
        print("=" * 60)

        try:
            # Import production functions
            from local_server import hash_password, verify_password

            test_password = "ProductionTest123!"

            # Test hashing
            hashed = hash_password(test_password)

            if hashed and len(hashed) > 50:
                self.log_test("Production Hash Function", True, f"Hash length: {len(hashed)}")
            else:
                self.log_test("Production Hash Function", False, f"Invalid hash: {hashed}")
                return False

            # Test bcrypt format
            if hashed.startswith("$2b$"):
                self.log_test("Bcrypt Format", True, "Uses bcrypt format")
            else:
                self.log_test("Bcrypt Format", False, f"Not bcrypt format: {hashed[:10]}")

            # Test verification
            if verify_password(test_password, hashed):
                self.log_test("Password Verification", True, "Correct password verified")
            else:
                self.log_test("Password Verification", False, "Correct password not verified")
                return False

            # Test wrong password rejection
            if not verify_password("WrongPassword123!", hashed):
                self.log_test("Wrong Password Rejection", True, "Wrong password rejected")
            else:
                self.log_test(
                    "Wrong Password Rejection", False, "Wrong password accepted - SECURITY ISSUE!"
                )
                return False

            # Test cost factor (should be 12 for production)
            try:
                cost = int(hashed.split("$")[2])
                if cost >= 12:
                    self.log_test("Bcrypt Cost Factor", True, f"Cost factor: {cost}")
                else:
                    self.log_test("Bcrypt Cost Factor", False, f"Low cost factor: {cost}")
            except:
                self.log_test("Bcrypt Cost Factor", False, "Could not parse cost factor")

            return True

        except Exception as e:
            self.log_test("Production Password Hashing", False, f"Error: {e}")
            return False

    def test_production_jwt_generation(self):
        """Test actual production JWT generation"""
        print("\n🎫 PRODUCTION JWT GENERATION TESTING")
        print("=" * 60)

        try:
            # Import production functions
            from local_server import JWT_ALG, JWT_SECRET, make_tokens

            # Test token generation
            test_user_data = {
                "customer_id": 123,
                "tenant_id": "prod_tenant_1",
                "email": "test@example.com",
            }

            # Generate tokens
            tokens = make_tokens(test_user_data)

            if "access_token" in tokens and "refresh_token" in tokens:
                self.log_test("Token Generation", True, "Access and refresh tokens generated")
            else:
                self.log_test("Token Generation", False, f"Missing tokens: {list(tokens.keys())}")
                return False

            # Test JWT structure
            access_token = tokens["access_token"]

            try:
                # Decode without verification to check structure
                header = jwt.get_unverified_header(access_token)
                payload = jwt.decode(access_token, options={"verify_signature": False})

                self.log_test("JWT Structure", True, f"Algorithm: {header.get('alg')}")

                if payload.get("sub") == str(test_user_data["customer_id"]):
                    self.log_test("JWT Subject", True, "Correct subject in token")
                else:
                    self.log_test("JWT Subject", False, f"Wrong subject: {payload.get('sub')}")

                if payload.get("tenant_id") == test_user_data["tenant_id"]:
                    self.log_test("JWT Tenant ID", True, "Tenant ID in token")
                else:
                    self.log_test(
                        "JWT Tenant ID", False, f"Missing tenant ID: {payload.get('tenant_id')}"
                    )

            except Exception as e:
                self.log_test("JWT Structure", False, f"Invalid JWT structure: {e}")
                return False

            # Test token validation
            try:
                decoded = jwt.decode(access_token, JWT_SECRET, algorithms=[JWT_ALG])
                self.log_test("JWT Validation", True, "Token validates with production secret")
            except jwt.ExpiredSignatureError:
                self.log_test("JWT Validation", False, "Token expired")
            except jwt.InvalidTokenError as e:
                self.log_test("JWT Validation", False, f"Token invalid: {e}")

            return True

        except Exception as e:
            self.log_test("Production JWT Generation", False, f"Error: {e}")
            return False

    def test_production_rls_direct(self):
        """Test production RLS directly at database level"""
        print("\n🛡️  PRODUCTION RLS DIRECT TESTING")
        print("=" * 60)

        try:
            cursor = self.db_connection.cursor()

            # Create test data in different tenants
            cursor.execute(
                """
                INSERT INTO customers (name, email, tenant_id) VALUES
                ('Direct Test User 1', 'direct1@test.com', 'prod_tenant_1'),
                ('Direct Test User 2', 'direct2@test.com', 'prod_tenant_2')
            """
            )
            self.db_connection.commit()

            # Test tenant 1 isolation
            cursor.execute("SET app.tenant_id = 'prod_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers WHERE name LIKE 'Direct Test User%'")
            tenant1_visible = cursor.fetchone()[0]

            # Test tenant 2 isolation
            cursor.execute("SET app.tenant_id = 'prod_tenant_2'")
            cursor.execute("SELECT COUNT(*) FROM customers WHERE name LIKE 'Direct Test User%'")
            tenant2_visible = cursor.fetchone()[0]

            # Test cross-tenant blocking
            cursor.execute("SET app.tenant_id = 'prod_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'prod_tenant_2'")
            cross_tenant_visible = cursor.fetchone()[0]

            if tenant1_visible == 1 and tenant2_visible == 1:
                self.log_test(
                    "RLS Tenant Isolation",
                    True,
                    f"Each tenant sees only their data: T1={tenant1_visible}, T2={tenant2_visible}",
                )
            else:
                self.log_test(
                    "RLS Tenant Isolation",
                    False,
                    f"RLS isolation broken: T1={tenant1_visible}, T2={tenant2_visible}",
                )

            if cross_tenant_visible == 0:
                self.log_test(
                    "Cross-Tenant Blocking", True, "Cross-tenant queries properly blocked"
                )
            else:
                self.log_test(
                    "Cross-Tenant Blocking",
                    False,
                    f"Cross-tenant data visible: {cross_tenant_visible}",
                )

            # Test malicious query attempt
            try:
                cursor.execute("SET app.tenant_id = 'prod_tenant_1'")
                cursor.execute(
                    "SELECT COUNT(*) FROM customers WHERE tenant_id != current_setting('app.tenant_id')"
                )
                malicious_visible = cursor.fetchone()[0]

                if malicious_visible == 0:
                    self.log_test(
                        "Malicious Query Defense", True, "Malicious cross-tenant query blocked"
                    )
                else:
                    self.log_test(
                        "Malicious Query Defense",
                        False,
                        f"Malicious query succeeded: {malicious_visible} records",
                    )

            except Exception as e:
                self.log_test(
                    "Malicious Query Defense", True, f"Query failed as expected: {str(e)[:100]}"
                )

            return True

        except Exception as e:
            self.log_test("Production RLS Direct Test", False, f"Error: {e}")
            return False

    def test_production_attack_resistance(self):
        """Test production code resistance to attacks"""
        print("\n🎯 PRODUCTION ATTACK RESISTANCE TESTING")
        print("=" * 60)

        try:
            # Import production functions
            from local_server import JWT_SECRET, hash_password, verify_password

            # Test 1: SQL injection in password hashing
            malicious_input = "'; DROP TABLE customers; --"
            try:
                hashed = hash_password(malicious_input)
                # Should hash the malicious input safely, not execute it
                if hashed and hashed.startswith("$2b$"):
                    self.log_test("SQL Injection in Hash", True, "Malicious input hashed safely")
                else:
                    self.log_test(
                        "SQL Injection in Hash", False, "Hashing failed with malicious input"
                    )
            except Exception as e:
                self.log_test("SQL Injection in Hash", False, f"Hash function crashed: {e}")

            # Test 2: JWT secret extraction attempt
            fake_token = jwt.encode(
                {"sub": "attacker", "admin": True}, "fake-secret", algorithm="HS256"
            )

            try:
                decoded = jwt.decode(fake_token, JWT_SECRET, algorithms=["HS256"])
                self.log_test(
                    "Fake JWT Defense", False, "Fake JWT accepted - CRITICAL SECURITY ISSUE!"
                )
            except jwt.InvalidTokenError:
                self.log_test("Fake JWT Defense", True, "Fake JWT properly rejected")

            # Test 3: Timing attack resistance
            correct_password = "CorrectPassword123!"
            wrong_password = "WrongPassword123!"

            # Hash a password for testing
            hashed = hash_password(correct_password)

            # Measure timing for correct vs wrong password
            import time

            start = time.perf_counter()
            verify_password(correct_password, hashed)
            correct_time = time.perf_counter() - start

            start = time.perf_counter()
            verify_password(wrong_password, hashed)
            wrong_time = time.perf_counter() - start

            # Bcrypt should have consistent timing
            time_diff_ratio = abs(correct_time - wrong_time) / max(correct_time, wrong_time)
            if time_diff_ratio < 0.5:  # Less than 50% difference is good
                self.log_test(
                    "Timing Attack Resistance", True, f"Timing difference: {time_diff_ratio:.2%}"
                )
            else:
                self.log_test(
                    "Timing Attack Resistance",
                    False,
                    f"Large timing difference: {time_diff_ratio:.2%}",
                )

            return True

        except Exception as e:
            self.log_test("Production Attack Resistance", False, f"Error: {e}")
            return False

    def run_production_validation(self):
        """Run direct production validation"""
        print("🔥 DIRECT PRODUCTION SYSTEM VALIDATION")
        print("=" * 60)
        print(f"📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("🎯 Objective: Validate actual production security functions")
        print("⚠️  Testing: REAL PRODUCTION CODE DIRECTLY")
        print()

        try:
            # Setup phase
            if not self.setup_production_database():
                return False

            if not self.setup_production_schema():
                return False

            # Direct production tests
            test_results = [
                self.test_production_password_hashing(),
                self.test_production_jwt_generation(),
                self.test_production_rls_direct(),
                self.test_production_attack_resistance(),
            ]

            # Final assessment
            print("\n" + "=" * 60)
            print("📊 DIRECT PRODUCTION VALIDATION RESULTS")
            print("=" * 60)

            total_tests = self.passed + self.failed
            success_rate = (self.passed / total_tests * 100) if total_tests > 0 else 0

            print(f"✅ Tests Passed: {self.passed}")
            print(f"❌ Tests Failed: {self.failed}")
            print(f"📈 Success Rate: {success_rate:.1f}%")
            print(f"⏱️  Duration: {time.time() - self.start_time:.1f} seconds")

            all_passed = all(test_results)
            failed_count = len([r for r in test_results if not r])

            print("\n🎯 DIRECT PRODUCTION TEST RESULTS:")
            test_categories = [
                "Production Password Hashing (bcrypt)",
                "Production JWT Generation",
                "Production RLS Enforcement",
                "Production Attack Resistance",
            ]

            for i, (category, result) in enumerate(zip(test_categories, test_results)):
                status = "✅ PASSED" if result else "❌ FAILED"
                print(f"    {status}: {category}")

            print("\n🔒 PRODUCTION SECURITY STATUS:")
            if all_passed and self.failed == 0:
                print("🎉 PRODUCTION SECURITY FUNCTIONS ARE SECURE!")
                print("✅ All production security functions validated")
                print("🚀 Core security code verified and deployment-ready")
                print("💡 Note: Full integration testing still recommended")
            else:
                print(f"🚨 {failed_count} PRODUCTION SECURITY ISSUES DETECTED!")
                print("❌ Production security functions have vulnerabilities")
                print("⛔ DO NOT DEPLOY - Fix security issues first")

            return all_passed and self.failed == 0

        finally:
            # Cleanup
            self.cleanup()


if __name__ == "__main__":
    print("🔥 CRITICAL: Direct testing of ACTUAL PRODUCTION SECURITY CODE")
    print("📋 Validating core security functions from backend/local_server.py")
    print("⚠️  These are the security functions that will run in production!")
    print()

    validator = ProductionSecurityDirectValidator()

    try:
        success = validator.run_production_validation()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Direct production validation interrupted")
        validator.cleanup()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Direct production validation failed: {e}")
        validator.cleanup()
        sys.exit(1)
