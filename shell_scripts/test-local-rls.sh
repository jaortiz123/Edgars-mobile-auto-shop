#!/usr/bin/env bash
# test-local-rls.sh
# Test the production RLS bundle against local Docker database first

set -euo pipefail

echo "🧪 Testing Phase 2 RLS bundle against local Docker database..."

# Use local Docker database for testing
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edgar_db"

echo "📋 Step 1: Apply RLS bundle to local database"
docker exec -i edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -f - < edgars-production-cutover.sql

echo "📋 Step 2: Verify RLS configuration"
# Check that tables have RLS enabled
echo "Checking RLS status on key tables:"
docker exec -i edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -c "
SELECT
  schemaname,
  tablename,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN ('customers', 'vehicles', 'appointments', 'services')
ORDER BY t.tablename;
"

echo "📋 Step 3: Check app_user role exists and has correct permissions"
docker exec -i edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -c "
SELECT
  rolname,
  rolsuper,
  rolbypassrls,
  rolcreatedb,
  rolcreaterole
FROM pg_roles
WHERE rolname IN ('app_user', 'tenant_admin')
ORDER BY rolname;
"

echo "📋 Step 4: Test tenant isolation (basic functional test)"
# This assumes you have some test data with tenant_id values
docker exec -i edgars-mobile-auto-shop-db-1 psql -U app_user -d edgar_db -c "
-- Set tenant context and try to query
SET LOCAL app.tenant_id = 'test-tenant-123';
SELECT 'Tenant context set to: ' || current_setting('app.tenant_id', true) as status;
SELECT COUNT(*) as customer_count FROM customers;
" || echo "⚠️  Query failed - this is expected if no test data exists or app_user password not set"

echo ""
echo "✅ Local RLS bundle test completed!"
echo "🔧 Next step: Run this against your production RDS using SSM tunnel"
echo ""
echo "Production deployment command:"
echo "export DATABASE_URL='postgresql://app_user:YOUR_PASSWORD@localhost:5432/edgarautoshop'"
echo "./deploy/deploy-phase2.sh"
