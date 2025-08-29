-- production-cutover-bundle-v2.sql
-- Hardens roles, enables fail-closed RLS, and applies row policies across key tables.
-- SAFE TO RE-RUN. Requires: PostgreSQL 12+.

BEGIN;

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

-- 5. Apply to your tables -----------------------------------------------------
-- Set the tenant column name you actually use (default 'org_id').
DO $$
DECLARE TENANT_COL text := COALESCE(current_setting('app.tenant_col', true), 'org_id'); BEGIN
  PERFORM app.apply_policies('public.customers',           TENANT_COL);
  PERFORM app.apply_policies('public.vehicles',            TENANT_COL);
  PERFORM app.apply_policies('public.appointments',        TENANT_COL);
  PERFORM app.apply_policies('public.invoices',            TENANT_COL);
  PERFORM app.apply_policies('public.invoice_line_items',  TENANT_COL);
END $$;

-- 6. Grants (read/write limited to app_user) ---------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.customers,
  public.vehicles,
  public.appointments,
  public.invoices,
  public.invoice_line_items
TO app_user;

COMMIT;
