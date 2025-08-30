-- 003_rls_enable_FINAL_FIX.sql
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
