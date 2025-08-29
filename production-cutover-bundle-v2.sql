-- production-cutover-bundle-v2.sql
-- Purpose: lock down roles, enable RLS, grant least privilege, and add guardrails.
-- Review before applying; run in a superuser session (e.g., postgres).

BEGIN;

-- 0) Optional: logical schema for helpers
CREATE SCHEMA IF NOT EXISTS app;

-- 1) Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_admin') THEN
    -- Break‑glass admin (can bypass RLS intentionally)
    CREATE ROLE tenant_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT BYPASSRLS;
  END IF;
END $$;

-- 2) Schema hygiene: no public write, explicit grants only
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO tenant_admin;

-- 3) Default privileges for future tables/views
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO app_user;

-- 4) Helper: expose current tenant for diagnostics (SAFE)
CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.tenant_id', true)
$$;

-- 5) Enable RLS + policies (repeat per tenant‑scoped table)
-- Replace types/casts if tenant_id is uuid; using ::text comparison keeps it generic.

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_customers_tenant ON customers;
CREATE POLICY p_customers_tenant ON customers
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_vehicles_tenant ON vehicles;
CREATE POLICY p_vehicles_tenant ON vehicles
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_appointments_tenant ON appointments;
CREATE POLICY p_appointments_tenant ON appointments
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Services (if tenant-scoped; comment out if global)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_services_tenant ON services;
CREATE POLICY p_services_tenant ON services
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- 6) Grants: least privilege for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON customers, vehicles, appointments, services TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 7) Safety: fail‑closed when tenant not set
-- When current_setting('app.tenant_id', true) is NULL, the comparison yields NULL → policy denies.
-- No additional change required; keep policies as written.

COMMIT;

-- Verification queries to run after deployment
\echo 'Verification: Tables with RLS enabled:'
SELECT schemaname, tablename, rowsecurity, forcerls
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'appointments', 'services')
AND c.relrowsecurity = true;

\echo 'Verification: RLS policies created:'
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'appointments', 'services');

\echo 'Verification: app_user permissions:'
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'app_user'
AND table_schema = 'public';
