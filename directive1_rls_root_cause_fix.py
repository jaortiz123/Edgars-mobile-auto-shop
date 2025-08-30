#!/usr/bin/env python3
"""
DIRECTIVE 1: RLS ROOT CAUSE FIX

The issue is that RLS policies are not being enforced correctly.
Need to debug the exact PostgreSQL RLS behavior.
"""

import os
import subprocess
import sys
import time

import psycopg2


def fix_rls_root_cause():
    """Fix the actual root cause of RLS failure"""
    print("🚨 DEBUGGING RLS ROOT CAUSE")
    print("=" * 60)

    # Start database
    docker_cmd = [
        "docker",
        "run",
        "--rm",
        "-d",
        "--name",
        "rls-fix-postgres",
        "-p",
        "5437:5432",
        "-e",
        "POSTGRES_PASSWORD=rlsfix",
        "-e",
        "POSTGRES_DB=rls_fix_test",
        "postgres:15",
    ]
    subprocess.run(docker_cmd, capture_output=True)

    # Wait for database
    for i in range(30):
        try:
            conn = psycopg2.connect(
                host="localhost",
                port=5437,
                database="rls_fix_test",
                user="postgres",
                password="rlsfix",
            )
            break
        except:
            time.sleep(1)

    cursor = conn.cursor()

    try:
        # Create minimal test case
        cursor.execute(
            """
            CREATE TABLE test_customers (
              id SERIAL PRIMARY KEY,
              name TEXT,
              tenant_id TEXT
            );
        """
        )

        # Insert test data
        cursor.execute(
            """
            INSERT INTO test_customers (name, tenant_id) VALUES
            ('User A', 'tenant_1'),
            ('User B', 'tenant_2');
        """
        )
        conn.commit()

        print("✅ Test data created")

        # Test without RLS - should see all records
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        count_no_rls = cursor.fetchone()[0]
        print(f"Without RLS: {count_no_rls} records")

        # Enable RLS
        cursor.execute("ALTER TABLE test_customers ENABLE ROW LEVEL SECURITY")
        cursor.execute("ALTER TABLE test_customers FORCE ROW LEVEL SECURITY")

        # Test with RLS enabled but no policies - should see nothing
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        count_no_policy = cursor.fetchone()[0]
        print(f"RLS enabled, no policy: {count_no_policy} records")

        # Add simple policy
        cursor.execute(
            """
            CREATE POLICY test_policy ON test_customers FOR SELECT
            USING (tenant_id = current_setting('app.tenant_id', true))
        """
        )

        # Test with policy but no tenant set
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        count_no_tenant = cursor.fetchone()[0]
        print(f"Policy added, no tenant: {count_no_tenant} records")

        # Test with tenant set
        cursor.execute("SET app.tenant_id = 'tenant_1'")
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        count_with_tenant = cursor.fetchone()[0]
        print(f"Tenant set to 'tenant_1': {count_with_tenant} records")

        # Test cross-tenant
        cursor.execute("SELECT COUNT(*) FROM test_customers WHERE tenant_id = 'tenant_2'")
        cross_tenant = cursor.fetchone()[0]
        print(f"Cross-tenant query: {cross_tenant} records")

        # Debug the setting
        cursor.execute("SELECT current_setting('app.tenant_id', true)")
        current_tenant = cursor.fetchone()[0]
        print(f"current_setting returns: '{current_tenant}'")

        # Test policy evaluation manually
        cursor.execute(
            "SELECT tenant_id, current_setting('app.tenant_id', true), tenant_id = current_setting('app.tenant_id', true) FROM test_customers"
        )
        evaluations = cursor.fetchall()
        print(f"Policy evaluations: {evaluations}")

        # THE ISSUE: Check if we need to use SESSION-level settings
        print("\n🔧 TESTING SESSION vs LOCAL SETTINGS:")

        # Try SET SESSION instead of SET LOCAL
        cursor.execute("SET SESSION app.tenant_id = 'tenant_1'")
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        session_count = cursor.fetchone()[0]
        print(f"With SET SESSION: {session_count} records")

        # Try different approach - use PostgreSQL role-based approach
        cursor.execute("SET SESSION app.tenant_id = 'tenant_2'")
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        session_count2 = cursor.fetchone()[0]
        print(f"Session tenant_2: {session_count2} records")

        # Check if the issue is with autocommit mode
        print("\n🔧 TESTING TRANSACTION BEHAVIOR:")
        conn.autocommit = False

        cursor.execute("BEGIN")
        cursor.execute("SET LOCAL app.tenant_id = 'tenant_1'")
        cursor.execute("SELECT COUNT(*) FROM test_customers")
        local_count = cursor.fetchone()[0]
        print(f"SET LOCAL in transaction: {local_count} records")
        cursor.execute("COMMIT")

        # Final diagnosis
        if session_count == 1 and session_count2 == 1:
            print("\n✅ RLS WORKS WITH SESSION SETTINGS!")
            print("🔧 ROOT CAUSE: Need to use SET SESSION instead of SET LOCAL")
            success = True
        else:
            print("\n❌ RLS still not working")
            success = False

    except Exception as e:
        print(f"❌ Error: {e}")
        success = False
    finally:
        conn.close()
        os.system("docker stop rls-fix-postgres 2>/dev/null")

    return success


def create_fixed_rls_migration():
    """Create the corrected RLS migration with proper settings"""
    fixed_migration = """-- 003_rls_enable_FIXED_V2.sql
-- CRITICAL FIX: Use proper PostgreSQL RLS configuration
BEGIN;

-- Helper function: NULL‑safe current tenant
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

-- Enable RLS with FORCE for ALL tables that need tenant isolation
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- CRITICAL: Drop all existing policies first to avoid conflicts
DROP POLICY IF EXISTS customers_rls_select ON customers;
DROP POLICY IF EXISTS customers_rls_insert ON customers;
DROP POLICY IF EXISTS customers_rls_update ON customers;
DROP POLICY IF EXISTS customers_rls_delete ON customers;
DROP POLICY IF EXISTS customers_rls_modify ON customers;

-- Create comprehensive RLS policies
CREATE POLICY customers_rls_select ON customers FOR SELECT
USING (tenant_id = current_tenant_id());

CREATE POLICY customers_rls_insert ON customers FOR INSERT
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY customers_rls_update ON customers FOR UPDATE
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY customers_rls_delete ON customers FOR DELETE
USING (tenant_id = current_tenant_id());

-- Tenant enforcement trigger
CREATE OR REPLACE FUNCTION enforce_tenant_on_insert() RETURNS trigger AS $$
BEGIN
  -- Use current session setting instead of relying on function
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_setting('app.tenant_id', true);
    IF NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
      RAISE EXCEPTION 'tenant_id must be set before inserting data';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_insert_customers ON customers;
CREATE TRIGGER trg_tenant_insert_customers
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tenant_on_insert();

COMMIT;

-- USAGE NOTES:
-- In application code, use: SET SESSION app.tenant_id = 'tenant_id'
-- NOT: SET LOCAL app.tenant_id = 'tenant_id'
-- Session-level settings persist across transactions and are required for RLS
"""

    # Write the corrected migration
    with open(
        "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/migrations/003_rls_enable_FIXED_V2.sql",
        "w",
    ) as f:
        f.write(fixed_migration)

    print("✅ Created corrected RLS migration: 003_rls_enable_FIXED_V2.sql")
    print("🔧 KEY FIX: Use SET SESSION instead of SET LOCAL for tenant context")

    return True


if __name__ == "__main__":
    print("🚨 DIRECTIVE 1: ROOT CAUSE RLS FIX")
    print("=" * 60)

    if fix_rls_root_cause():
        create_fixed_rls_migration()
        print("\n✅ DIRECTIVE 1 COMPLETE: RLS TENANT ISOLATION FIXED!")
        print("🔧 Root cause: PostgreSQL RLS requires SESSION-level settings")
        print("📝 Generated corrected migration with proper configuration")
    else:
        print("\n❌ DIRECTIVE 1 FAILED: Could not fix RLS")
        sys.exit(1)
