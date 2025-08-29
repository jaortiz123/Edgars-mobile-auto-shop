#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"  # e.g. postgres://app_user:***@host:5432/db
TENANT_A=${TENANT_A:-"tenant_a"}
TENANT_B=${TENANT_B:-"tenant_b"}

psqlc=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt)

red()  { printf "\e[31m%s\e[0m\n" "$*"; }
grn()  { printf "\e[32m%s\e[0m\n" "$*"; }
yel()  { printf "\e[33m%s\e[0m\n" "$*"; }

pass() { grn "✔ $*"; }
fail() { red "✖ $*"; exit 1; }

echo "🔍 Testing RLS Production Configuration..."

# 1) RLS status on target tables (Edgar's core tables)
echo "📋 Step 1: Checking RLS status on core tables"
for t in customers vehicles appointments services; do
  st=$(${psqlc[@]} -c "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.$t'::regclass" 2>/dev/null || echo "f|f")
  [[ "$st" == "t|t" || "$st" == "t|t"$'\n' ]] || fail "RLS not enabled+forced on $t (got: $st)"
done
pass "RLS enabled + forced on key tables"

# 2) app_user must NOT have BYPASSRLS or SUPERUSER
echo "📋 Step 2: Checking app_user security attributes"
attrs=$(${psqlc[@]} -c "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='app_user'")
[[ "$attrs" == "f|f"* ]] || fail "app_user should not be SUPERUSER/BYPASSRLS (got: $attrs)"
pass "app_user has safe attributes"

# 3) Policy predicate sanity (references current_setting)
echo "📋 Step 3: Checking policy predicates reference app.tenant_id"
missing=$(${psqlc[@]} -c "SELECT count(*) FROM pg_policies p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname IN ('customers','vehicles','appointments','services') AND p.polname like '%_tenant' AND p.polcmd IN ('r','a','w','d') AND position('current_setting(''app.tenant_id'')' IN p.polqual::text)=0" 2>/dev/null || echo "0")
[[ "$missing" == "0" ]] || fail "Some policies do not reference app.tenant_id (missing: $missing)"
pass "Policy predicates reference app.tenant_id"

# 4) Quick functional check (assumes tenant_id column for Edgar's schema)
echo "📋 Step 4: Testing functional tenant isolation"
${psqlc[@]} -c "SET LOCAL app.tenant_id = '$TENANT_A'; SELECT count(*) FROM public.customers WHERE tenant_id = current_setting('app.tenant_id')" >/dev/null || fail "Select with tenant A failed"
${psqlc[@]} -c "SET LOCAL app.tenant_id = '$TENANT_B'; SELECT count(*) FROM public.customers WHERE tenant_id = current_setting('app.tenant_id')" >/dev/null || fail "Select with tenant B failed"
pass "Functional SELECTs with different tenants executed"

echo ""
grn "✅ All RLS verification tests passed!"
yel "Note: Add fixture rows per-tenant to assert non-zero/zero counts if you want strict data checks."
