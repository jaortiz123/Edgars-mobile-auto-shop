-- monitor-rls-drift.sql
-- Run nightly and alert on any failures.
-- This script detects security configuration drift in multi-tenant setup

\echo '=== RLS Security Monitoring Report ==='
\echo ''

\echo '🔍 Tables missing RLS (should be empty):'
SELECT
    schemaname,
    tablename,
    'Missing RLS' as issue
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname='public'
AND relrowsecurity = false
AND tablename IN ('customers','vehicles','appointments','services','invoices','invoice_line_items')
ORDER BY tablename;

\echo ''
\echo '🔍 Tables with zero RLS policies (should be empty):'
WITH expected_tables AS (
    SELECT unnest(ARRAY['customers','vehicles','appointments','services','invoices','invoice_line_items']) as table_name
),
policy_counts AS (
    SELECT
        tablename,
        COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname='public'
    GROUP BY tablename
)
SELECT
    et.table_name,
    COALESCE(pc.policy_count, 0) as policy_count,
    'No RLS policies' as issue
FROM expected_tables et
LEFT JOIN policy_counts pc ON pc.tablename = et.table_name
WHERE COALESCE(pc.policy_count, 0) = 0
AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = et.table_name
    AND table_schema = 'public'
);

\echo ''
\echo '🔍 Suspicious database users (review carefully):'
SELECT
    usename,
    usesuper,
    usecreatedb,
    usebypassrls,
    CASE
        WHEN usesuper THEN 'SUPERUSER'
        WHEN usebypassrls THEN 'BYPASSES_RLS'
        ELSE 'OK'
    END as security_concern
FROM pg_user
WHERE (usesuper = true AND usename NOT IN ('postgres', 'rds_superuser'))
   OR (usebypassrls = true AND usename NOT IN ('postgres', 'rds_superuser', 'tenant_admin'))
ORDER BY usesuper DESC, usebypassrls DESC;

\echo ''
\echo '🔍 Rows with null tenant_id (should be 0 for all tables):'
DO $$
DECLARE
    table_name text;
    null_count integer;
    sql_query text;
BEGIN
    FOR table_name IN
        SELECT t.tablename
        FROM pg_tables t
        JOIN information_schema.columns c ON c.table_name = t.tablename
        WHERE t.schemaname = 'public'
        AND c.column_name = 'tenant_id'
        AND t.tablename IN ('customers','vehicles','appointments','services','invoices','invoice_line_items')
    LOOP
        sql_query := format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NULL', table_name);
        EXECUTE sql_query INTO null_count;

        IF null_count > 0 THEN
            RAISE NOTICE '% has % rows with null tenant_id', table_name, null_count;
        END IF;
    END LOOP;
END $$;

\echo ''
\echo '🔍 RLS Policy Details:'
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers','vehicles','appointments','services','invoices','invoice_line_items')
ORDER BY tablename, policyname;

\echo ''
\echo '🔍 Current Session Security Status:'
SELECT
    current_user as current_user,
    session_user as session_user,
    current_database() as database,
    current_setting('app.tenant_id', true) as tenant_context,
    (SELECT usesuper FROM pg_user WHERE usename = current_user) as is_superuser,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as can_bypass_rls;

\echo ''
\echo '🔍 Table Ownership and Permissions:'
SELECT
    t.schemaname,
    t.tablename,
    t.tableowner,
    string_agg(DISTINCT p.grantee || ':' || p.privilege_type, ', ') as granted_privileges
FROM pg_tables t
LEFT JOIN information_schema.table_privileges p ON p.table_name = t.tablename AND p.table_schema = t.schemaname
WHERE t.schemaname = 'public'
AND t.tablename IN ('customers','vehicles','appointments','services','invoices','invoice_line_items')
GROUP BY t.schemaname, t.tablename, t.tableowner
ORDER BY t.tablename;

\echo ''
\echo '=== End of RLS Security Monitoring Report ==='

-- Exit with error code if critical issues found
DO $$
DECLARE
    critical_issues integer := 0;
    missing_rls integer;
    superusers integer;
BEGIN
    -- Count tables missing RLS
    SELECT COUNT(*) INTO missing_rls
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE schemaname='public'
    AND relrowsecurity = false
    AND tablename IN ('customers','vehicles','appointments','services');

    -- Count suspicious superusers
    SELECT COUNT(*) INTO superusers
    FROM pg_user
    WHERE usesuper = true
    AND usename NOT IN ('postgres', 'rds_superuser');

    critical_issues := missing_rls + superusers;

    IF critical_issues > 0 THEN
        RAISE EXCEPTION 'SECURITY ALERT: % critical issues found', critical_issues;
    ELSE
        RAISE NOTICE 'SECURITY STATUS: All checks passed';
    END IF;
END $$;
