#!/usr/bin/env python3
"""
DIRECTIVE 1: RLS TENANT ISOLATION REPAIR

Debug and fix the exact cause of RLS tenant isolation failure.
"""

import os
import subprocess
import sys
import time

import psycopg2


class RLSRepairTester:
    def __init__(self):
        self.db_connection = None

    def setup_test_database(self):
        """Setup isolated test database for RLS debugging"""
        print("🔧 SETTING UP RLS DEBUG DATABASE")
        print("=" * 60)

        # Start fresh PostgreSQL
        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "-d",
            "--name",
            "rls-debug-postgres",
            "-p",
            "5436:5432",
            "-e",
            "POSTGRES_PASSWORD=rlstest",
            "-e",
            "POSTGRES_DB=rls_debug_test",
            "postgres:15",
        ]

        subprocess.run(docker_cmd, capture_output=True, text=True)

        # Wait for database
        for i in range(30):
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5436,
                    database="rls_debug_test",
                    user="postgres",
                    password="rlstest",
                )
                conn.close()
                break
            except:
                time.sleep(1)
        else:
            print("❌ Database not ready")
            return False

        print("✅ RLS debug database ready")
        return True

    def test_current_rls_implementation(self):
        """Test the exact RLS setup from our migrations"""
        print("\n🔍 TESTING CURRENT RLS IMPLEMENTATION")
        print("=" * 60)

        try:
            conn = psycopg2.connect(
                host="localhost",
                port=5436,
                database="rls_debug_test",
                user="postgres",
                password="rlstest",
            )
            conn.autocommit = False
            cursor = conn.cursor()

            # Create the exact schema from production validation
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

            # Add the RLS function from migration
            cursor.execute(
                """
                CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
                LANGUAGE sql STABLE AS $$
                  SELECT NULLIF(current_setting('app.tenant_id', true), '')
                $$;
            """
            )

            # Enable RLS
            cursor.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")

            # Add the exact policies from migration
            cursor.execute(
                """
                DROP POLICY IF EXISTS customers_rls_select ON customers;
                CREATE POLICY customers_rls_select ON customers FOR SELECT
                USING (tenant_id = current_tenant_id());
            """
            )

            cursor.execute(
                """
                DROP POLICY IF EXISTS customers_rls_modify ON customers;
                CREATE POLICY customers_rls_modify ON customers FOR INSERT
                WITH CHECK (tenant_id = current_tenant_id());
            """
            )

            # Create test data
            cursor.execute(
                """
                INSERT INTO tenants (id, name) VALUES
                ('debug_tenant_1', 'Debug Tenant 1'),
                ('debug_tenant_2', 'Debug Tenant 2');
            """
            )

            cursor.execute(
                """
                INSERT INTO customers (name, email, tenant_id) VALUES
                ('Debug User 1', 'debug1@test.com', 'debug_tenant_1'),
                ('Debug User 2', 'debug2@test.com', 'debug_tenant_2');
            """
            )

            conn.commit()

            print("✅ Schema and RLS policies created")

            # Test RLS enforcement
            print("\n🧪 TESTING RLS ENFORCEMENT:")

            # Test 1: No tenant context - should see nothing
            cursor.execute("RESET app.tenant_id")
            cursor.execute("SELECT COUNT(*) FROM customers")
            no_context_count = cursor.fetchone()[0]
            print(f"   No tenant context: {no_context_count} records visible")

            # Test 2: Tenant 1 context
            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            tenant1_count = cursor.fetchone()[0]
            print(f"   Tenant 1 context: {tenant1_count} records visible")

            # Test 3: Tenant 2 context
            cursor.execute("SET app.tenant_id = 'debug_tenant_2'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            tenant2_count = cursor.fetchone()[0]
            print(f"   Tenant 2 context: {tenant2_count} records visible")

            # Test 4: Cross-tenant query attempt
            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'debug_tenant_2'")
            cross_tenant_count = cursor.fetchone()[0]
            print(f"   Cross-tenant query: {cross_tenant_count} records visible")

            # Test 5: Check what current_tenant_id() returns
            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute("SELECT current_tenant_id()")
            current_tenant = cursor.fetchone()[0]
            print(f"   current_tenant_id() returns: '{current_tenant}'")

            # Test 6: Manual policy check
            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute(
                "SELECT tenant_id, current_tenant_id(), tenant_id = current_tenant_id() as matches FROM customers"
            )
            results = cursor.fetchall()
            print(f"   Policy evaluation results: {results}")

            # Analyze results
            print("\n📊 RLS ANALYSIS:")
            if no_context_count == 0:
                print("   ✅ No tenant context correctly shows 0 records")
            else:
                print(
                    f"   ❌ No tenant context shows {no_context_count} records - RLS not working!"
                )

            if tenant1_count == 1 and tenant2_count == 1:
                print("   ✅ Tenant isolation working - each sees 1 record")
            else:
                print(f"   ❌ Tenant isolation broken - T1:{tenant1_count}, T2:{tenant2_count}")

            if cross_tenant_count == 0:
                print("   ✅ Cross-tenant queries blocked")
            else:
                print(f"   ❌ Cross-tenant queries succeed - {cross_tenant_count} records leaked!")

            self.db_connection = conn

            # Determine if RLS is working
            rls_working = (
                no_context_count == 0
                and tenant1_count == 1
                and tenant2_count == 1
                and cross_tenant_count == 0
            )

            return rls_working

        except Exception as e:
            print(f"❌ RLS test failed: {e}")
            return False

    def fix_rls_issues(self):
        """Fix identified RLS issues"""
        print("\n🔧 FIXING RLS ISSUES")
        print("=" * 60)

        try:
            cursor = self.db_connection.cursor()

            # Check if RLS is actually enabled
            cursor.execute(
                """
                SELECT schemaname, tablename, rowsecurity
                FROM pg_tables
                WHERE tablename = 'customers'
            """
            )
            rls_status = cursor.fetchone()
            print(f"RLS Status: {rls_status}")

            if not rls_status[2]:  # rowsecurity is False
                print("🔧 Enabling RLS on customers table")
                cursor.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")

            # Check existing policies
            cursor.execute(
                """
                SELECT policyname, cmd, qual, with_check
                FROM pg_policies
                WHERE tablename = 'customers'
            """
            )
            policies = cursor.fetchall()
            print(f"Existing policies: {policies}")

            # Force RLS for all roles (including table owner)
            cursor.execute("ALTER TABLE customers FORCE ROW LEVEL SECURITY")
            print("✅ Forced RLS for all roles")

            self.db_connection.commit()

            # Re-test RLS after fix
            print("\n🧪 RE-TESTING AFTER FIX:")

            # Test with forced RLS
            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            tenant1_count = cursor.fetchone()[0]
            print(f"   Tenant 1 (after fix): {tenant1_count} records")

            cursor.execute("SET app.tenant_id = 'debug_tenant_2'")
            cursor.execute("SELECT COUNT(*) FROM customers")
            tenant2_count = cursor.fetchone()[0]
            print(f"   Tenant 2 (after fix): {tenant2_count} records")

            cursor.execute("SET app.tenant_id = 'debug_tenant_1'")
            cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = 'debug_tenant_2'")
            cross_tenant_count = cursor.fetchone()[0]
            print(f"   Cross-tenant (after fix): {cross_tenant_count} records")

            # Check if fix worked
            fix_successful = tenant1_count == 1 and tenant2_count == 1 and cross_tenant_count == 0

            if fix_successful:
                print("✅ RLS FIX SUCCESSFUL!")
                return True
            else:
                print("❌ RLS still broken after fix")
                return False

        except Exception as e:
            print(f"❌ RLS fix failed: {e}")
            return False

    def generate_rls_fix_migration(self):
        """Generate corrected RLS migration"""
        print("\n📝 GENERATING RLS FIX MIGRATION")
        print("=" * 60)

        fixed_migration = """-- 003_rls_enable_FIXED.sql
BEGIN;

-- Helper function: NULL‑safe current tenant
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

-- Enable RLS with FORCE (critical fix)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- Note: Only enable RLS on tables that actually exist
-- Removed references to non-existent tables: vehicles, invoices, appointments, invoice_line_items

-- Fixed policies for customers table
DROP POLICY IF EXISTS customers_rls_select ON customers;
CREATE POLICY customers_rls_select ON customers FOR SELECT
USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS customers_rls_insert ON customers;
CREATE POLICY customers_rls_insert ON customers FOR INSERT
WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS customers_rls_update ON customers;
CREATE POLICY customers_rls_update ON customers FOR UPDATE
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS customers_rls_delete ON customers;
CREATE POLICY customers_rls_delete ON customers FOR DELETE
USING (tenant_id = current_tenant_id());

-- Tenant injection trigger (fixed)
CREATE OR REPLACE FUNCTION enforce_tenant_on_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_tenant_id();
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_insert_customers ON customers;
CREATE TRIGGER trg_tenant_insert_customers
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tenant_on_insert();

COMMIT;
"""

        # Write the fixed migration
        with open(
            "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/migrations/003_rls_enable_FIXED.sql",
            "w",
        ) as f:
            f.write(fixed_migration)

        print("✅ Fixed RLS migration generated: 003_rls_enable_FIXED.sql")
        return True

    def cleanup(self):
        """Cleanup test resources"""
        if self.db_connection:
            self.db_connection.close()
        os.system("docker stop rls-debug-postgres 2>/dev/null")


if __name__ == "__main__":
    print("🚨 DIRECTIVE 1: FIXING RLS TENANT ISOLATION")
    print("=" * 70)

    tester = RLSRepairTester()

    try:
        if not tester.setup_test_database():
            sys.exit(1)

        rls_working = tester.test_current_rls_implementation()

        if not rls_working:
            print("\n🔧 RLS is broken - applying fixes...")
            if tester.fix_rls_issues():
                print("\n✅ RLS TENANT ISOLATION REPAIRED!")
            else:
                print("\n❌ Could not repair RLS")
                sys.exit(1)
        else:
            print("\n✅ RLS appears to be working")

        tester.generate_rls_fix_migration()

    finally:
        tester.cleanup()
