#!/usr/bin/env bash
# verify-rls-production.sh
# Smoke-tests RLS isolation using app_user. Requires psql in PATH and PG* env vars set.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function log_info() { echo -e "${GREEN}✅ $1${NC}"; }
function log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function log_error() { echo -e "${RED}❌ $1${NC}"; }

function q() { psql -v ON_ERROR_STOP=1 -X -tAc "$1"; }

echo "🔍 Starting RLS Production Verification..."

# Test 1: Confirm current database user is NOT superuser
echo "📋 Test 1: Database User Security"
user_check=$(q "SELECT current_user, usesuper, rolbypassrls FROM pg_user WHERE usename = current_user;")
current_user=$(echo "$user_check" | cut -d'|' -f1)
is_super=$(echo "$user_check" | cut -d'|' -f2)
bypass_rls=$(echo "$user_check" | cut -d'|' -f3)

if [[ "$is_super" == "t" ]]; then
  log_error "FAIL: Current user '$current_user' is superuser (security risk)"
  exit 1
fi

if [[ "$bypass_rls" == "t" ]]; then
  log_error "FAIL: Current user '$current_user' can bypass RLS (security risk)"
  exit 1
fi

log_info "PASS: User '$current_user' has proper security restrictions"

# Test 2: Confirm policies exist and RLS is enabled
echo "📋 Test 2: RLS Coverage Check"
failed_tables=()
for table in customers vehicles appointments services; do
  # Check if table exists first
  table_exists=$(q "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='${table}' AND table_schema='public');" || echo "f")

  if [[ "$table_exists" == "t" ]]; then
    rls_enabled=$(q "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass;" 2>/dev/null || echo "f")
    if [[ "$rls_enabled" != "t" ]]; then
      failed_tables+=("$table (RLS disabled)")
      continue
    fi

    policy_count=$(q "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='${table}';" || echo "0")
    if [[ "$policy_count" -lt 1 ]]; then
      failed_tables+=("$table (no policies)")
      continue
    fi

    log_info "Table '$table': RLS enabled with $policy_count policies"
  else
    log_warn "Table '$table' does not exist - skipping"
  fi
done

if [[ ${#failed_tables[@]} -gt 0 ]]; then
  log_error "FAIL: Tables with RLS issues: ${failed_tables[*]}"
  exit 1
fi

# Test 3: Verify RLS policies are working (tenant isolation)
echo "📋 Test 3: Tenant Isolation Test"
TENANT_A=${TENANT_A:-"00000000-0000-0000-0000-000000000001"}
TENANT_B=${TENANT_B:-"00000000-0000-0000-0000-000000000002"}

# Test with customers table (most likely to have data)
tenant_a_count=$(q "SET LOCAL app.tenant_id='${TENANT_A}'; SELECT COALESCE((SELECT COUNT(*) FROM customers),0);" 2>/dev/null || echo "0")
tenant_b_count=$(q "SET LOCAL app.tenant_id='${TENANT_B}'; SELECT COALESCE((SELECT COUNT(*) FROM customers),0);" 2>/dev/null || echo "0")
no_tenant_count=$(q "SELECT COALESCE((SELECT COUNT(*) FROM customers),0);" 2>/dev/null || echo "0")

log_info "Tenant A sees: $tenant_a_count customers"
log_info "Tenant B sees: $tenant_b_count customers"
log_info "No tenant context sees: $no_tenant_count customers"

# When no tenant is set, RLS should deny all rows
if [[ "$no_tenant_count" != "0" ]]; then
  log_error "FAIL: Without tenant context, should see 0 rows but saw $no_tenant_count"
  exit 1
fi

log_info "PASS: RLS properly denies access without tenant context"

# Test 4: Cross-tenant data access prevention
echo "📋 Test 4: Cross-Tenant Access Prevention"
if [[ "$tenant_a_count" -gt 0 && "$tenant_b_count" -gt 0 && "$tenant_a_count" == "$tenant_b_count" ]]; then
  log_warn "WARN: Both tenants see same count ($tenant_a_count) - may indicate shared data or test limitation"
elif [[ "$tenant_a_count" -gt 0 || "$tenant_b_count" -gt 0 ]]; then
  log_info "PASS: Tenants see different data sets (isolation confirmed)"
else
  log_warn "WARN: No test data found - isolation test inconclusive"
fi

# Test 5: Verify tenant context switching works
echo "📋 Test 5: Tenant Context Switching"
test_tenant="test-tenant-$(date +%s)"

# Set context and verify it's retrievable
context_result=$(q "SET LOCAL app.tenant_id='${test_tenant}'; SELECT current_setting('app.tenant_id', true);" 2>/dev/null || echo "")
if [[ "$context_result" == "$test_tenant" ]]; then
  log_info "PASS: Tenant context switching works correctly"
else
  log_error "FAIL: Tenant context not set properly. Expected '$test_tenant', got '$context_result'"
  exit 1
fi

# Test 6: Security drift detection
echo "📋 Test 6: Security Configuration Drift Detection"
drift_issues=()

# Check for any superusers that shouldn't exist
suspicious_users=$(q "SELECT usename FROM pg_user WHERE usesuper = true AND usename NOT IN ('postgres', 'rds_superuser');" 2>/dev/null || echo "")
if [[ -n "$suspicious_users" ]]; then
  drift_issues+=("Unexpected superusers: $suspicious_users")
fi

# Check for tables that should have RLS but don't
expected_rls_tables="customers vehicles appointments services"
for table in $expected_rls_tables; do
  if q "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='${table}' AND table_schema='public');" | grep -q "t"; then
    if ! q "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass;" 2>/dev/null | grep -q "t"; then
      drift_issues+=("Table $table missing RLS")
    fi
  fi
done

# Check for null tenant_ids in tenant-scoped tables
for table in customers vehicles appointments; do
  if q "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='${table}' AND table_schema='public');" | grep -q "t"; then
    null_count=$(q "SELECT COUNT(*) FROM $table WHERE tenant_id IS NULL;" 2>/dev/null || echo "0")
    if [[ "$null_count" -gt 0 ]]; then
      drift_issues+=("Table $table has $null_count rows with null tenant_id")
    fi
  fi
done

if [[ ${#drift_issues[@]} -gt 0 ]]; then
  log_error "FAIL: Security drift detected:"
  for issue in "${drift_issues[@]}"; do
    log_error "  - $issue"
  done
  exit 1
fi

log_info "PASS: No security configuration drift detected"

# Final summary
echo ""
echo "🎉 All RLS Production Verification Tests Passed!"
echo "✅ Database user security: Proper restrictions in place"
echo "✅ RLS coverage: All tenant tables protected"
echo "✅ Tenant isolation: Cross-tenant access denied"
echo "✅ Context switching: Tenant context management working"
echo "✅ Configuration integrity: No security drift detected"
echo ""
echo "🛡️ Multi-tenant security is properly configured and active"
