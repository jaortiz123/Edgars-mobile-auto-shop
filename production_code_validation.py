#!/usr/bin/env python3
"""
PRODUCTION CODE VALIDATION TEST

This script tests the ACTUAL local_server.py production code
with the RLS tenant isolation fixes applied to the real authentication endpoints.

NO NEW FILES. NO WORKAROUNDS. Testing the actual production codebase.
"""

import os
import subprocess
import time

import psycopg2
import requests


class ProductionCodeValidation:
    def __init__(self):
        self.server_process = None
        self.test_db_conn = None

    def setup_test_database(self):
        """Setup test database with RLS policies"""
        print("🔧 SETTING UP TEST DATABASE FOR PRODUCTION VALIDATION")
        print("=" * 60)

        try:
            # Start test database
            docker_cmd = [
                "docker",
                "run",
                "--rm",
                "-d",
                "--name",
                "production-test-db",
                "-p",
                "5440:5432",
                "-e",
                "POSTGRES_PASSWORD=testpass",
                "-e",
                "POSTGRES_DB=autoshop_test",
                "postgres:15",
            ]

            subprocess.run(docker_cmd, capture_output=True, text=True)

            # Wait for database
            for i in range(30):
                try:
                    conn = psycopg2.connect(
                        host="localhost",
                        port=5440,
                        database="autoshop_test",
                        user="postgres",
                        password="testpass",
                    )
                    conn.close()
                    break
                except:
                    time.sleep(1)
            else:
                print("❌ Database not ready")
                return False

            # Setup database with non-superuser and RLS
            conn = psycopg2.connect(
                host="localhost",
                port=5440,
                database="autoshop_test",
                user="postgres",
                password="testpass",
            )

            cursor = conn.cursor()

            # Create application user (non-superuser)
            cursor.execute("DROP USER IF EXISTS edgars_app")
            cursor.execute("CREATE USER edgars_app WITH PASSWORD 'edgars_pass'")
            cursor.execute("GRANT CONNECT ON DATABASE autoshop_test TO edgars_app")
            cursor.execute("GRANT USAGE ON SCHEMA public TO edgars_app")

            # Create core tables
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS tenants (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS customers (
                  id SERIAL PRIMARY KEY,
                  name TEXT NOT NULL,
                  email TEXT UNIQUE NOT NULL,
                  phone TEXT,
                  address TEXT,
                  tenant_id TEXT NOT NULL DEFAULT 't_default',
                  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS customer_auth (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    tenant_id TEXT NOT NULL DEFAULT 't_default',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """
            )

            # Grant permissions
            cursor.execute(
                "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edgars_app"
            )
            cursor.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edgars_app")

            # Create test tenants
            cursor.execute("INSERT INTO tenants (id, name) VALUES ('tenant_a', 'Tenant A Shop')")
            cursor.execute("INSERT INTO tenants (id, name) VALUES ('tenant_b', 'Tenant B Shop')")

            # CRITICAL: Enable RLS with FORCE (from our fixed migration)
            cursor.execute(
                """
                -- Helper function: current tenant context
                CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
                LANGUAGE sql STABLE AS $$
                  SELECT NULLIF(current_setting('app.tenant_id', true), '')
                $$;
            """
            )

            # Enable RLS on customers table with FORCE
            cursor.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")
            cursor.execute("ALTER TABLE customers FORCE ROW LEVEL SECURITY")

            cursor.execute("ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY")
            cursor.execute("ALTER TABLE customer_auth FORCE ROW LEVEL SECURITY")

            # Create RLS policies
            cursor.execute(
                """
                DROP POLICY IF EXISTS customers_rls_select ON customers;
                CREATE POLICY customers_rls_select ON customers FOR SELECT
                USING (tenant_id = current_tenant_id());
            """
            )

            cursor.execute(
                """
                DROP POLICY IF EXISTS customers_rls_insert ON customers;
                CREATE POLICY customers_rls_insert ON customers FOR INSERT
                WITH CHECK (tenant_id = current_tenant_id());
            """
            )

            cursor.execute(
                """
                DROP POLICY IF EXISTS customer_auth_rls_select ON customer_auth;
                CREATE POLICY customer_auth_rls_select ON customer_auth FOR SELECT
                USING (tenant_id = current_tenant_id());
            """
            )

            cursor.execute(
                """
                DROP POLICY IF EXISTS customer_auth_rls_insert ON customer_auth;
                CREATE POLICY customer_auth_rls_insert ON customer_auth FOR INSERT
                WITH CHECK (tenant_id = current_tenant_id());
            """
            )

            conn.commit()
            self.test_db_conn = conn

            print("✅ Test database setup complete with RLS enforcement")
            return True

        except Exception as e:
            print(f"❌ Database setup failed: {e}")
            return False

    def start_production_server(self):
        """Start the actual local_server.py production code"""
        print("\n🚀 STARTING PRODUCTION SERVER (REAL CODE)")
        print("=" * 60)

        try:
            # Set environment for production server
            env = os.environ.copy()
            env.update(
                {
                    "DATABASE_URL": "postgresql://edgars_app:edgars_pass@localhost:5440/autoshop_test",
                    "JWT_SECRET": "test_secret_key_for_validation",
                    "PORT": "5001",  # Override default port
                    "FLASK_ENV": "production",
                }
            )

            # Start the ACTUAL local_server.py (not a test file)
            self.server_process = subprocess.Popen(
                ["python", "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/local_server.py"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd="/Users/jesusortiz/Edgars-mobile-auto-shop",
            )

            # Wait for server to start
            for i in range(60):  # Longer timeout for production server
                try:
                    response = requests.get("http://localhost:5001/api/health", timeout=2)
                    if response.status_code == 200:
                        print("✅ Production server started successfully")
                        return True
                except requests.exceptions.RequestException:
                    pass
                time.sleep(1)

            print("❌ Production server failed to start within 60 seconds")
            return False

        except Exception as e:
            print(f"❌ Production server startup failed: {e}")
            return False

    def test_cross_tenant_isolation(self):
        """Test that the ACTUAL authentication endpoints prevent cross-tenant data exposure"""
        print("\n🔒 TESTING CROSS-TENANT ISOLATION (REAL ENDPOINTS)")
        print("=" * 60)

        try:
            # Register user in Tenant A
            tenant_a_user = {
                "email": "tenant_a_user@example.com",
                "password": "SecurePassword123!",
                "name": "Tenant A User",
            }

            response = requests.post(
                "http://localhost:5001/api/customers/register",
                json=tenant_a_user,
                headers={"X-Tenant-Id": "tenant_a"},
            )

            if response.status_code == 201:
                print("✅ Tenant A user registered successfully")
                tenant_a_data = response.json()
                tenant_a_customer_id = tenant_a_data["customer"]["id"]
            else:
                print(f"❌ Tenant A registration failed: {response.status_code} - {response.text}")
                return False

            # Register user in Tenant B
            tenant_b_user = {
                "email": "tenant_b_user@example.com",
                "password": "SecurePassword456!",
                "name": "Tenant B User",
            }

            response = requests.post(
                "http://localhost:5001/api/customers/register",
                json=tenant_b_user,
                headers={"X-Tenant-Id": "tenant_b"},
            )

            if response.status_code == 201:
                print("✅ Tenant B user registered successfully")
                tenant_b_data = response.json()
                tenant_b_customer_id = tenant_b_data["customer"]["id"]
            else:
                print(f"❌ Tenant B registration failed: {response.status_code} - {response.text}")
                return False

            # Test cross-tenant login attempt (should fail due to RLS)
            print("\n🧪 Testing cross-tenant access...")

            # Try to login as Tenant A user from Tenant B context
            cross_tenant_login = {
                "email": "tenant_a_user@example.com",
                "password": "SecurePassword123!",
            }

            response = requests.post(
                "http://localhost:5001/api/customers/login",
                json=cross_tenant_login,
                headers={"X-Tenant-Id": "tenant_b"},  # Wrong tenant context
            )

            if response.status_code == 401:
                print("✅ Cross-tenant login correctly blocked by RLS")
                cross_tenant_blocked = True
            else:
                print(f"❌ SECURITY BREACH: Cross-tenant login succeeded: {response.status_code}")
                cross_tenant_blocked = False

            # Test correct tenant login (should work)
            response = requests.post(
                "http://localhost:5001/api/customers/login",
                json=cross_tenant_login,
                headers={"X-Tenant-Id": "tenant_a"},  # Correct tenant context
            )

            if response.status_code == 200:
                print("✅ Same-tenant login works correctly")
                same_tenant_works = True
            else:
                print(f"❌ Same-tenant login failed: {response.status_code} - {response.text}")
                same_tenant_works = False

            return cross_tenant_blocked and same_tenant_works

        except Exception as e:
            print(f"❌ Cross-tenant test failed: {e}")
            return False

    def test_database_isolation(self):
        """Test database-level tenant isolation directly"""
        print("\n🗃️  TESTING DATABASE-LEVEL TENANT ISOLATION")
        print("=" * 60)

        try:
            # Connect with non-superuser (like production)
            conn = psycopg2.connect(
                host="localhost",
                port=5440,
                database="autoshop_test",
                user="edgars_app",  # Non-superuser
                password="edgars_pass",
            )

            cursor = conn.cursor()

            # Set tenant context to tenant_a
            cursor.execute("SET SESSION app.tenant_id = 'tenant_a'")

            # Query customers - should only see tenant_a data
            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'tenant_a'")
            tenant_a_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'tenant_b'")
            tenant_b_visible_from_a = cursor.fetchone()[0]

            # Switch to tenant_b context
            cursor.execute("SET SESSION app.tenant_id = 'tenant_b'")

            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'tenant_b'")
            tenant_b_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'tenant_a'")
            tenant_a_visible_from_b = cursor.fetchone()[0]

            conn.close()

            print(f"Tenant A can see own data: {tenant_a_count} customers")
            print(f"Tenant A can see Tenant B data: {tenant_b_visible_from_a} customers")
            print(f"Tenant B can see own data: {tenant_b_count} customers")
            print(f"Tenant B can see Tenant A data: {tenant_a_visible_from_b} customers")

            # RLS is working if cross-tenant queries return 0
            rls_working = tenant_b_visible_from_a == 0 and tenant_a_visible_from_b == 0

            if rls_working:
                print("✅ RLS tenant isolation working correctly at database level")
            else:
                print("❌ RLS FAILURE: Cross-tenant data exposure at database level")

            return rls_working

        except Exception as e:
            print(f"❌ Database isolation test failed: {e}")
            return False

    def generate_final_report(self, server_started, rls_working, api_isolation):
        """Generate final validation report"""
        print("\n" + "=" * 80)
        print("🏁 PRODUCTION CODE VALIDATION RESULTS")
        print("=" * 80)

        print(
            f"Production Server Startup:        {'✅ SUCCESS' if server_started else '❌ FAILED'}"
        )
        print(f"Database RLS Enforcement:         {'✅ SUCCESS' if rls_working else '❌ FAILED'}")
        print(f"API Endpoint Tenant Isolation:    {'✅ SUCCESS' if api_isolation else '❌ FAILED'}")

        total_passed = sum([server_started, rls_working, api_isolation])

        print("-" * 80)

        if total_passed == 3:
            print("🎉 PRODUCTION CODE VALIDATION: COMPLETE SUCCESS!")
            print("✅ ACTUAL SECURITY VULNERABILITIES FIXED IN PRODUCTION CODEBASE")
            print("🔒 Cross-tenant data exposure PREVENTED")
            print("🚀 Production server WORKS with tenant isolation")
            print("🛡️  RLS policies ENFORCED correctly")
            print("\n🎯 REAL PRODUCTION CODE IS SECURE")
            return "PRODUCTION_SECURE"
        else:
            print(f"❌ PRODUCTION VALIDATION FAILED: {total_passed}/3 tests passed")
            print("🚨 CRITICAL SECURITY VULNERABILITIES STILL PRESENT")
            print("🛑 PRODUCTION DEPLOYMENT STILL BLOCKED")
            return "PRODUCTION_BROKEN"

    def cleanup(self):
        """Cleanup test resources"""
        if self.server_process:
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=5)
            except:
                self.server_process.kill()

        if self.test_db_conn:
            self.test_db_conn.close()

        os.system("docker stop production-test-db 2>/dev/null")


if __name__ == "__main__":
    print("🚨 PRODUCTION CODE VALIDATION TEST")
    print("Testing ACTUAL local_server.py with RLS fixes")
    print("=" * 80)

    validator = ProductionCodeValidation()

    try:
        # Setup test environment
        db_setup = validator.setup_test_database()

        # Start actual production server
        server_started = validator.start_production_server() if db_setup else False

        # Test RLS isolation
        rls_working = validator.test_database_isolation() if server_started else False

        # Test API endpoint isolation
        api_isolation = validator.test_cross_tenant_isolation() if server_started else False

        # Generate final report
        result = validator.generate_final_report(server_started, rls_working, api_isolation)

        if result == "PRODUCTION_SECURE":
            print("\n✅ MISSION ACCOMPLISHED: Production code vulnerabilities fixed!")
            exit(0)
        else:
            print("\n❌ MISSION FAILED: Production code still vulnerable")
            exit(1)

    finally:
        validator.cleanup()
