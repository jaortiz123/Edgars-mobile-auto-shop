#!/bin/bash
# ============================================================================
# PRODUCTION RLS VERIFICATION TOOLKIT
# ============================================================================
# Run these queries to verify RLS tenant isolation is working correctly

set -euo pipefail

# Database connection settings
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-edgarautoshop}"
DB_USER="${POSTGRES_USER:-app_user}"

echo "🔍 RLS Production Verification Toolkit"
echo "======================================"
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# ============================================================================
# TEST 1: VERIFY APP_USER IS NOT SUPERUSER
# ============================================================================

echo "🧪 Test 1: Database User Security Check"
echo "---------------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'SQL'
SELECT
    '🔐 User Security Status' as check_type,
    current_user as connected_as,
    CASE
        WHEN rolsuper THEN '❌ SUPERUSER (DANGEROUS)'
        ELSE '✅ Non-superuser (Secure)'
    END as superuser_status,
    CASE
        WHEN rolbypassrls THEN '❌ BYPASSES RLS (DANGEROUS)'
        ELSE '✅ RLS Active (Secure)'
    END as rls_status
FROM pg_roles
WHERE rolname = current_user;
SQL

echo ""

# ============================================================================
# TEST 2: VERIFY RLS IS ENABLED ON ALL TENANT TABLES
# ============================================================================

echo "🧪 Test 2: RLS Coverage Check"
echo "-----------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'SQL'
-- Find tables with tenant_id that should have RLS
WITH tenant_tables AS (
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id' AND table_schema = 'public'
),
rls_status AS (
    SELECT
        t.table_name,
        COALESCE(p.rowsecurity, false) as rls_enabled,
        COALESCE(p.forcerowsecurity, false) as force_rls,
        COUNT(pol.polname) as policy_count
    FROM tenant_tables t
    LEFT JOIN pg_tables p ON p.tablename = t.table_name AND p.schemaname = 'public'
    LEFT JOIN pg_policies pol ON pol.tablename = t.table_name AND pol.schemaname = 'public'
    GROUP BY t.table_name, p.rowsecurity, p.forcerowsecurity
)
SELECT
    '🛡️ RLS Table Protection' as check_type,
    table_name,
    CASE
        WHEN rls_enabled AND force_rls AND policy_count > 0 THEN '✅ Fully Protected'
        WHEN rls_enabled AND policy_count > 0 THEN '⚠️ RLS Enabled (no FORCE)'
        WHEN rls_enabled THEN '❌ RLS Enabled (no policies)'
        ELSE '❌ No RLS Protection'
    END as protection_status,
    policy_count as policies
FROM rls_status
ORDER BY table_name;
SQL

echo ""

# ============================================================================
# TEST 3: VERIFY POLICIES EXIST AND ARE CORRECT
# ============================================================================

echo "🧪 Test 3: RLS Policy Validation"
echo "--------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'SQL'
SELECT
    '📋 RLS Policies' as policy_type,
    tablename as table_name,
    polname as policy_name,
    cmd as applies_to,
    CASE
        WHEN qual IS NOT NULL AND with_check IS NOT NULL THEN '✅ USING + WITH CHECK'
        WHEN qual IS NOT NULL THEN '⚠️ USING only'
        WHEN with_check IS NOT NULL THEN '⚠️ WITH CHECK only'
        ELSE '❌ No filters'
    END as policy_completeness,
    CASE
        WHEN qual LIKE '%current_setting(''app.tenant_id''%' THEN '✅ Tenant context'
        ELSE '❌ Wrong context'
    END as context_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (polname LIKE '%tenant%' OR qual LIKE '%tenant_id%')
ORDER BY tablename, polname;
SQL

echo ""

# ============================================================================
# TEST 4: VERIFY TENANT ISOLATION WITHOUT CONTEXT
# ============================================================================

echo "🧪 Test 4: No-Context Access Test"
echo "---------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'SQL'
-- Clear any existing tenant context
RESET app.tenant_id;

-- Try to access tenant data without context (should see nothing or error)
DO $$
DECLARE
    customer_count INTEGER;
    vehicle_count INTEGER;
    appointment_count INTEGER;
    service_count INTEGER;
BEGIN
    -- Test customers table
    SELECT COUNT(*) INTO customer_count FROM customers;
    RAISE NOTICE '🔍 Customers without context: %', customer_count;

    -- Test vehicles table
    SELECT COUNT(*) INTO vehicle_count FROM vehicles;
    RAISE NOTICE '🔍 Vehicles without context: %', vehicle_count;

    -- Test appointments table
    SELECT COUNT(*) INTO appointment_count FROM appointments;
    RAISE NOTICE '🔍 Appointments without context: %', appointment_count;

    -- Test services table
    SELECT COUNT(*) INTO service_count FROM services;
    RAISE NOTICE '🔍 Services without context: %', service_count;

    -- Summary
    IF customer_count = 0 AND vehicle_count = 0 AND appointment_count = 0 AND service_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No data accessible without tenant context';
    ELSE
        RAISE NOTICE '❌ SECURITY ISSUE: % total records accessible without tenant context',
            customer_count + vehicle_count + appointment_count + service_count;
    END IF;
END $$;
SQL

echo ""

# ============================================================================
# TEST 5: VERIFY TENANT ISOLATION WITH CONTEXT
# ============================================================================

echo "🧪 Test 5: Tenant Context Isolation Test"
echo "----------------------------------------"

# Get first two tenant IDs for testing
TENANT_IDS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM tenants LIMIT 2")

if [ -z "$TENANT_IDS" ]; then
    echo "⚠️ No tenants found in database - skipping isolation test"
else
    TENANT1=$(echo "$TENANT_IDS" | head -n1 | xargs)
    TENANT2=$(echo "$TENANT_IDS" | tail -n1 | xargs)

    if [ "$TENANT1" != "$TENANT2" ]; then
        echo "Testing with tenants: ${TENANT1:0:8}... and ${TENANT2:0:8}..."

        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << SQL
-- Test tenant 1 context
SELECT set_config('app.tenant_id', '$TENANT1', true);
SELECT '🎯 Tenant 1 (${TENANT1:0:8}...)' as tenant, COUNT(*) as customers FROM customers;

-- Test tenant 2 context
SELECT set_config('app.tenant_id', '$TENANT2', true);
SELECT '🎯 Tenant 2 (${TENANT2:0:8}...)' as tenant, COUNT(*) as customers FROM customers;

-- Verify context switching worked
SELECT
    '🔄 Context Switch Test' as test,
    current_setting('app.tenant_id', true) as active_tenant,
    CASE
        WHEN current_setting('app.tenant_id', true) = '$TENANT2' THEN '✅ Context switch successful'
        ELSE '❌ Context switch failed'
    END as switch_status;
SQL
    else
        echo "⚠️ Only one tenant found - cannot test cross-tenant isolation"
    fi
fi

echo ""

# ============================================================================
# TEST 6: SECURITY DRIFT DETECTION
# ============================================================================

echo "🧪 Test 6: Security Configuration Drift Check"
echo "---------------------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'SQL'
-- Check for tables with tenant_id but missing RLS
WITH tenant_tables AS (
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id' AND table_schema = 'public'
),
unprotected AS (
    SELECT t.table_name
    FROM tenant_tables t
    LEFT JOIN pg_tables p ON p.tablename = t.table_name AND p.schemaname = 'public'
    WHERE COALESCE(p.rowsecurity, false) = false
)
SELECT
    '⚠️ SECURITY DRIFT ALERT' as alert_type,
    table_name,
    'Missing RLS protection' as issue
FROM unprotected

UNION ALL

-- Check for policies with wrong tenant context
SELECT
    '⚠️ POLICY DRIFT ALERT' as alert_type,
    tablename as table_name,
    'Policy missing tenant context' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND qual IS NOT NULL
  AND qual NOT LIKE '%app.tenant_id%'
  AND tablename IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id' AND table_schema = 'public'
  )

ORDER BY alert_type, table_name;
SQL

echo ""

# ============================================================================
# SUMMARY REPORT
# ============================================================================

echo "📊 Verification Summary"
echo "======================"
echo ""
echo "✅ Tests completed. Review results above for:"
echo "   • User role security (non-superuser, RLS active)"
echo "   • RLS coverage on all tenant tables"
echo "   • Policy completeness and correctness"
echo "   • Data isolation without tenant context"
echo "   • Cross-tenant isolation with context"
echo "   • Configuration drift detection"
echo ""
echo "🚨 Any ❌ or ⚠️ indicators require immediate attention!"
echo ""
echo "💡 Run this script regularly to monitor production security"
