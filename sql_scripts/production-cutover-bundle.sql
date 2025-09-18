-- ============================================================================
-- PRODUCTION CUTOVER BUNDLE: RLS + app_user
-- ============================================================================
-- Run this script as postgres/superuser ONCE in production
-- Then switch all app connections to use app_user (never postgres)

-- ============================================================================
-- STEP 1: CREATE PRODUCTION APP ROLE
-- ============================================================================

-- Create non-superuser app role (critical: no BYPASSRLS)
CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_THIS_IN_PRODUCTION'
  INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Grant schema access
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant table permissions for all existing tables
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Grant default privileges for future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO app_user;

-- ============================================================================
-- STEP 2: ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================================

-- Enable RLS on multi-tenant tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;

-- Add more tables here if they have tenant_id columns
-- ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE RLS POLICIES (ONE PER TENANT TABLE)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS p_customers_tenant ON public.customers;
DROP POLICY IF EXISTS p_vehicles_tenant ON public.vehicles;
DROP POLICY IF EXISTS p_appointments_tenant ON public.appointments;
DROP POLICY IF EXISTS p_services_tenant ON public.services;

-- Create tenant isolation policies
CREATE POLICY p_customers_tenant ON public.customers
    FOR ALL TO app_user
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY p_vehicles_tenant ON public.vehicles
    FOR ALL TO app_user
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY p_appointments_tenant ON public.appointments
    FOR ALL TO app_user
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY p_services_tenant ON public.services
    FOR ALL TO app_user
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ============================================================================
-- STEP 4: DATA SAFETY - ADD NOT NULL CONSTRAINTS
-- ============================================================================

-- Ensure tenant_id is always set (prevents orphan data)
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN tenant_id SET NOT NULL;

-- Add FK constraints to tenants table if not already present
-- ALTER TABLE customers ADD CONSTRAINT fk_customers_tenant
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_tenant
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE appointments ADD CONSTRAINT fk_appointments_tenant
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE services ADD CONSTRAINT fk_services_tenant
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- ============================================================================
-- STEP 5: VERIFICATION QUERIES
-- ============================================================================

-- Show app_user privileges (should NOT be superuser, should NOT have BYPASSRLS)
SELECT
    'App User Security Check' as check_type,
    rolname,
    rolsuper as is_superuser,
    rolbypassrls as bypasses_rls,
    rolcanlogin as can_login
FROM pg_roles
WHERE rolname = 'app_user';

-- Show tables with tenant_id but NO RLS policies (should be empty)
WITH tenant_tables AS (
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name='tenant_id' AND table_schema='public'
),
unprotected AS (
    SELECT t.table_name
    FROM tenant_tables t
    LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.table_name
    GROUP BY t.table_name
    HAVING COUNT(p.polname)=0
)
SELECT
    'UNPROTECTED TENANT TABLES (should be empty)' as warning,
    table_name
FROM unprotected;

-- Show all RLS policies created
SELECT
    'RLS Policy Summary' as summary,
    tablename,
    polname as policy_name,
    cmd as applies_to,
    CASE
        WHEN qual IS NOT NULL AND with_check IS NOT NULL THEN 'USING + WITH CHECK'
        WHEN qual IS NOT NULL THEN 'USING only'
        WHEN with_check IS NOT NULL THEN 'WITH CHECK only'
        ELSE 'NO FILTERS'
    END as policy_type
FROM pg_policies
WHERE schemaname='public' AND polname LIKE '%tenant%'
ORDER BY tablename, polname;

-- Show RLS status for all tenant tables
SELECT
    'RLS Status Check' as status,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    forcerowsecurity as force_rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id' AND table_schema = 'public'
  )
ORDER BY tablename;

-- ============================================================================
-- STEP 6: TEST QUERIES (run as app_user to verify isolation)
-- ============================================================================

-- Test 1: Without tenant context (should see nothing or get error)
-- SELECT COUNT(*) FROM customers;  -- Should return 0 or error

-- Test 2: Set tenant context and query (should see only that tenant's data)
-- SELECT set_config('app.tenant_id', 'your-test-tenant-uuid-here', true);
-- SELECT COUNT(*) FROM customers;  -- Should return only that tenant's count

-- Test 3: Switch tenant context (should see different data)
-- SELECT set_config('app.tenant_id', 'different-tenant-uuid-here', true);
-- SELECT COUNT(*) FROM customers;  -- Should return different tenant's count

-- ============================================================================
-- PRODUCTION CUTOVER COMPLETE
-- ============================================================================

SELECT
    '✅ PRODUCTION CUTOVER COMPLETE' as status,
    'Switch app connections to app_user' as next_step,
    'Never use postgres role for app connections' as critical_warning;
