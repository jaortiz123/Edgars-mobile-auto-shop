-- edgars-production-cutover.sql
-- Customized for Edgar's Auto Shop schema (uses tenant_id column)
-- SAFE TO RE-RUN. Requires: PostgreSQL 12+.

BEGIN;

-- Set tenant column for Edgar's schema
SET app.tenant_col = 'tenant_id';

-- 1. Schema + helpers ---------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

-- Helper to fetch current tenant (NULL-safe)
CREATE OR REPLACE FUNCTION app.current_tenant() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.tenant_id', true)
$$;

-- Fail if tenant is missing (optionally used in app code)
CREATE OR REPLACE FUNCTION app.require_tenant() RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE t text; BEGIN
  t := current_setting('app.tenant_id', true);
  IF t IS NULL OR length(t) = 0 THEN
    RAISE EXCEPTION 'app.tenant_id is not set' USING ERRCODE = '42501';
  END IF; RETURN t;
END; $$;

-- 2. Roles (no BYPASSRLS on app_user) ---------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_admin') THEN
    -- Break-glass. Create without BYPASSRLS; grant separately if you must.
    CREATE ROLE tenant_admin LOGIN NOSUPERUSER NOINHERIT;
  END IF;
END $$;

-- 3. Privilege hygiene --------------------------------------------------------
-- Revoke world write; re-grant explicit privileges per table below as needed.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app TO app_user;

-- 4. Generic RLS applicator ---------------------------------------------------
-- 4a) Ensure RLS is enabled + forced
CREATE OR REPLACE FUNCTION app.enable_rls(p_table regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
END; $$;

-- 4b) Create/replace per-table policies for a given tenant column
CREATE OR REPLACE FUNCTION app.apply_policies(p_table regclass, p_tenant_col text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col_exists boolean;
  tn text := quote_ident(p_tenant_col);
  tbl text := p_table::text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = split_part(tbl, '.', 1)
      AND table_name   = split_part(tbl, '.', 2)
      AND column_name  = p_tenant_col
  ) INTO col_exists;
  IF NOT col_exists THEN
    RAISE EXCEPTION 'Table % has no column %', tbl, p_tenant_col;
  END IF;

  PERFORM app.enable_rls(p_table);

  -- Drop old policies if present (names are deterministic)
  EXECUTE format('DROP POLICY IF EXISTS sel_tenant ON %s', p_table);
  EXECUTE format('DROP POLICY IF EXISTS ins_tenant ON %s', p_table);
  EXECUTE format('DROP POLICY IF EXISTS upd_tenant ON %s', p_table);
  EXECUTE format('DROP POLICY IF EXISTS del_tenant ON %s', p_table);

  -- Build predicate: current tenant must be set and match tenant column
  EXECUTE format(
    'CREATE POLICY sel_tenant ON %s FOR SELECT USING (
       current_setting(''app.tenant_id'', true) IS NOT NULL AND %s = current_setting(''app.tenant_id'')
     )', p_table, tn);

  EXECUTE format(
    'CREATE POLICY ins_tenant ON %s FOR INSERT WITH CHECK (
       current_setting(''app.tenant_id'', true) IS NOT NULL AND %s = current_setting(''app.tenant_id'')
     )', p_table, tn);

  EXECUTE format(
    'CREATE POLICY upd_tenant ON %s FOR UPDATE USING (
       current_setting(''app.tenant_id'', true) IS NOT NULL AND %s = current_setting(''app.tenant_id'')
     ) WITH CHECK (
       current_setting(''app.tenant_id'', true) IS NOT NULL AND %s = current_setting(''app.tenant_id'')
     )', p_table, tn, tn);

  EXECUTE format(
    'CREATE POLICY del_tenant ON %s FOR DELETE USING (
       current_setting(''app.tenant_id'', true) IS NOT NULL AND %s = current_setting(''app.tenant_id'')
     )', p_table, tn);
END; $$;

-- 5. Apply to Edgar's Auto Shop tables ----------------------------------------
-- Using tenant_id column as discovered from schema inspection
DO $$
DECLARE TENANT_COL text := 'tenant_id'; BEGIN
  -- Core tenant-scoped tables
  PERFORM app.apply_policies('public.customers',     TENANT_COL);
  PERFORM app.apply_policies('public.vehicles',      TENANT_COL);
  PERFORM app.apply_policies('public.appointments',  TENANT_COL);
  PERFORM app.apply_policies('public.services',      TENANT_COL);

  -- Additional tables if they exist and have tenant_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices' AND table_schema = 'public') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tenant_id') THEN
      PERFORM app.apply_policies('public.invoices', TENANT_COL);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_line_items' AND table_schema = 'public') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_line_items' AND column_name = 'tenant_id') THEN
      PERFORM app.apply_policies('public.invoice_line_items', TENANT_COL);
    END IF;
  END IF;
END $$;

-- 6. Grants (read/write limited to app_user) ---------------------------------
-- Grant on existing tables
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('customers', 'vehicles', 'appointments', 'services', 'invoices', 'invoice_line_items')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', tbl.tablename);
  END LOOP;
END $$;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

COMMIT;

-- Display summary
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename)
  ELSE 0 END as policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN ('customers', 'vehicles', 'appointments', 'services', 'invoices', 'invoice_line_items')
ORDER BY t.tablename;
