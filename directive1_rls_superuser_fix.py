#!/usr/bin/env python3
"""
DIRECTIVE 1: FINAL RLS FIX

ROOT CAUSE IDENTIFIED: PostgreSQL RLS doesn't apply to superusers!
Need to create non-superuser role or use different approach.
"""

import os
import subprocess
import sys
import time

import psycopg2


def fix_rls_superuser_issue():
    """Fix RLS by addressing the superuser bypass issue"""
    print("🚨 FIXING RLS SUPERUSER BYPASS ISSUE")
    print("=" * 60)

    # Start database
    docker_cmd = [
        "docker",
        "run",
        "--rm",
        "-d",
        "--name",
        "rls-final-fix",
        "-p",
        "5438:5432",
        "-e",
        "POSTGRES_PASSWORD=finalfix",
        "-e",
        "POSTGRES_DB=rls_final_test",
        "postgres:15",
    ]
    subprocess.run(docker_cmd, capture_output=True)

    # Wait for database
    for i in range(30):
        try:
            conn = psycopg2.connect(
                host="localhost",
                port=5438,
                database="rls_final_test",
                user="postgres",
                password="finalfix",
            )
            break
        except:
            time.sleep(1)

    cursor = conn.cursor()

    try:
        # Create application user (non-superuser)
        cursor.execute("CREATE USER app_user WITH PASSWORD 'apppass'")
        cursor.execute("GRANT CONNECT ON DATABASE rls_final_test TO app_user")

        # Create test table
        cursor.execute(
            """
            CREATE TABLE test_customers (
              id SERIAL PRIMARY KEY,
              name TEXT,
              tenant_id TEXT
            );
        """
        )

        # Grant permissions to app user
        cursor.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON test_customers TO app_user")
        cursor.execute("GRANT USAGE, SELECT ON SEQUENCE test_customers_id_seq TO app_user")

        # Insert test data as superuser
        cursor.execute(
            """
            INSERT INTO test_customers (name, tenant_id) VALUES
            ('User A', 'tenant_1'),
            ('User B', 'tenant_2');
        """
        )

        # Enable RLS
        cursor.execute("ALTER TABLE test_customers ENABLE ROW LEVEL SECURITY")
        cursor.execute("ALTER TABLE test_customers FORCE ROW LEVEL SECURITY")

        # Create RLS policy
        cursor.execute(
            """
            CREATE POLICY test_rls_policy ON test_customers FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
        """
        )

        conn.commit()
        conn.close()

        print("✅ Created non-superuser and RLS setup")

        # Test as superuser (should bypass RLS)
        conn_super = psycopg2.connect(
            host="localhost",
            port=5438,
            database="rls_final_test",
            user="postgres",
            password="finalfix",
        )
        cursor_super = conn_super.cursor()

        cursor_super.execute("SET app.tenant_id = 'tenant_1'")
        cursor_super.execute("SELECT COUNT(*) FROM test_customers")
        super_count = cursor_super.fetchone()[0]
        print(f"Superuser sees: {super_count} records (bypasses RLS)")
        conn_super.close()

        # Test as application user (should respect RLS)
        conn_app = psycopg2.connect(
            host="localhost",
            port=5438,
            database="rls_final_test",
            user="app_user",
            password="apppass",
        )
        cursor_app = conn_app.cursor()

        # Test without tenant context
        cursor_app.execute("SELECT COUNT(*) FROM test_customers")
        no_context_count = cursor_app.fetchone()[0]
        print(f"App user, no context: {no_context_count} records")

        # Test with tenant context
        cursor_app.execute("SET app.tenant_id = 'tenant_1'")
        cursor_app.execute("SELECT COUNT(*) FROM test_customers")
        tenant1_count = cursor_app.fetchone()[0]
        print(f"App user, tenant_1: {tenant1_count} records")

        cursor_app.execute("SET app.tenant_id = 'tenant_2'")
        cursor_app.execute("SELECT COUNT(*) FROM test_customers")
        tenant2_count = cursor_app.fetchone()[0]
        print(f"App user, tenant_2: {tenant2_count} records")

        # Test cross-tenant
        cursor_app.execute("SET app.tenant_id = 'tenant_1'")
        cursor_app.execute("SELECT COUNT(*) FROM test_customers WHERE tenant_id = 'tenant_2'")
        cross_count = cursor_app.fetchone()[0]
        print(f"Cross-tenant query: {cross_count} records")

        conn_app.close()

        # Check if RLS is working for non-superuser
        rls_fixed = (
            no_context_count == 0 and tenant1_count == 1 and tenant2_count == 1 and cross_count == 0
        )

        if rls_fixed:
            print("\n✅ RLS FIXED! Works correctly with non-superuser")
            return True
        else:
            print("\n❌ RLS still not working")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        os.system("docker stop rls-final-fix 2>/dev/null")


def create_production_rls_fix():
    """Create the production RLS fix with proper user management"""

    # Create application user setup script
    app_user_setup = """-- application_user_setup.sql
-- CRITICAL: Create non-superuser for application to respect RLS

-- Create application database user
CREATE USER IF NOT EXISTS edgars_app WITH PASSWORD 'secure_app_password_change_in_prod';

-- Grant database connection
GRANT CONNECT ON DATABASE autoshop TO edgars_app;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO edgars_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edgars_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edgars_app;

-- Ensure future tables have permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edgars_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO edgars_app;

-- NOTE: Application should connect as 'edgars_app', NOT 'postgres'
-- RLS policies only apply to non-superuser accounts
"""

    with open(
        "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/migrations/000_application_user_setup.sql",
        "w",
    ) as f:
        f.write(app_user_setup)

    # Create fixed RLS migration
    rls_migration_fixed = """-- 003_rls_enable_FINAL_FIX.sql
-- CRITICAL FIX: RLS Configuration for Non-Superuser Application
BEGIN;

-- Helper function: current tenant context
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- CRITICAL: Force RLS even for table owner (but not superuser)
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- Clean slate: drop existing policies
DROP POLICY IF EXISTS customers_rls_select ON customers;
DROP POLICY IF EXISTS customers_rls_insert ON customers;
DROP POLICY IF EXISTS customers_rls_update ON customers;
DROP POLICY IF EXISTS customers_rls_delete ON customers;

-- Comprehensive RLS policies
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
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_tenant_id();
    IF NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
      RAISE EXCEPTION 'No tenant context set. Use SET app.tenant_id = ''tenant_id''';
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

-- CRITICAL DEPLOYMENT NOTE:
-- 1. Run 000_application_user_setup.sql first
-- 2. Change DATABASE_URL to connect as 'edgars_app' not 'postgres'
-- 3. Use: SET SESSION app.tenant_id = 'tenant_id' in application code
-- 4. RLS will ONLY work with non-superuser connections
"""

    with open(
        "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/migrations/003_rls_enable_FINAL_FIX.sql",
        "w",
    ) as f:
        f.write(rls_migration_fixed)

    # Create environment configuration fix
    env_fix = """# DATABASE CONNECTION FIX for RLS
# CRITICAL: Change from superuser to application user

# BEFORE (bypasses RLS):
# DATABASE_URL=postgresql://postgres:password@localhost:5432/autoshop

# AFTER (respects RLS):
DATABASE_URL=postgresql://edgars_app:secure_app_password_change_in_prod@localhost:5432/autoshop

# This ensures RLS policies are enforced because edgars_app is not a superuser
"""

    with open("/Users/jesusortiz/Edgars-mobile-auto-shop/ENVIRONMENT_FIX_FOR_RLS.md", "w") as f:
        f.write(env_fix)

    print("✅ Created production RLS fixes:")
    print("   - 000_application_user_setup.sql: Creates non-superuser")
    print("   - 003_rls_enable_FINAL_FIX.sql: Corrected RLS policies")
    print("   - ENVIRONMENT_FIX_FOR_RLS.md: Database connection fix")
    print("\n🚨 CRITICAL: Must change DATABASE_URL to use edgars_app user!")

    return True


if __name__ == "__main__":
    print("🚨 DIRECTIVE 1: FINAL RLS SUPERUSER FIX")
    print("=" * 60)

    if fix_rls_superuser_issue():
        create_production_rls_fix()
        print("\n✅ DIRECTIVE 1 COMPLETE: RLS ROOT CAUSE IDENTIFIED AND FIXED!")
        print("🔧 Root Cause: PostgreSQL superuser bypasses RLS policies")
        print("🛡️  Solution: Use non-superuser application account")
        print("📝 Generated complete production fix with proper user setup")
        print("\n🚨 DEPLOYMENT REQUIRED: Change DATABASE_URL to use edgars_app user")
    else:
        print("\n❌ DIRECTIVE 1 FAILED: Could not fix RLS superuser issue")
        sys.exit(1)
