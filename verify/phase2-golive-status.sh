#!/usr/bin/env bash
# file: phase2-golive-status.sh
# Comprehensive go-live readiness checker for Phase 2 deployment

set -euo pipefail

DB=${DATABASE_URL:?set DATABASE_URL}
APP_URL=${APP_URL:-"http://localhost:3000"}

echo "🚀 Phase 2 Go-Live Status Check"
echo "================================="

echo ""
echo "== RLS Status =="
psql "$DB" -Atc "SELECT relname || ': enabled=' || COALESCE(relrowsecurity::text, 'false') || ', forced=' || COALESCE(relforcerowsecurity::text, 'false') FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname IN ('customers', 'vehicles', 'appointments', 'services') ORDER BY 1;"

echo ""
echo "== Active Policies =="
psql "$DB" -c "SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2;"

echo ""
echo "== app_user Role Security =="
psql "$DB" -Atc "SELECT 'app_user exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END FROM pg_roles WHERE rolname = 'app_user';"
psql "$DB" -Atc "SELECT 'app_user NOBYPASSRLS: ' || CASE WHEN NOT rolbypassrls THEN 'YES' ELSE 'NO' END FROM pg_roles WHERE rolname = 'app_user';"
psql "$DB" -Atc "SELECT 'app_user not superuser: ' || CASE WHEN NOT rolsuper THEN 'YES' ELSE 'NO' END FROM pg_roles WHERE rolname = 'app_user';"

echo ""
echo "== Tenant Column Check =="
for table in customers vehicles appointments services; do
    result=$(psql "$DB" -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '$table' AND column_name = 'tenant_id';" 2>/dev/null || echo "0")
    echo "$table: tenant_id column exists = $([ "$result" = "1" ] && echo "YES" || echo "NO")"
done

echo ""
echo "== Service Operations V2 Columns =="
if psql "$DB" -c "\d+ service_operations" 2>/dev/null | grep -q "internal_code\|subcategory\|display_order"; then
    echo "✅ Phase 2 columns detected:"
    psql "$DB" -c "\d+ service_operations" | grep -E 'internal_code|subcategory|display_order' || true
else
    echo "⚠️  Phase 2 columns not found - may need catalog migration"
fi

echo ""
echo "== API Shape Test =="
if command -v curl >/dev/null && command -v jq >/dev/null; then
    echo "Testing $APP_URL/api/admin/service-operations"
    if curl -s -f "$APP_URL/api/admin/service-operations" >/dev/null 2>&1; then
        api_type=$(curl -s "$APP_URL/api/admin/service-operations" | jq -r 'type' 2>/dev/null || echo "unknown")
        echo "API response type: $api_type"

        if [ "$api_type" = "array" ]; then
            echo "✅ Root array format (correct)"
            first_keys=$(curl -s "$APP_URL/api/admin/service-operations" | jq -r '.[0] // {} | keys | join(", ")' 2>/dev/null || echo "none")
            echo "First item keys: $first_keys"

            # Check for v2 fields
            has_v2_fields=$(curl -s "$APP_URL/api/admin/service-operations" | jq -r 'if .[0] and (.[0].internal_code or .[0].subcategory or .[0].display_order) then "YES" else "NO" end' 2>/dev/null || echo "NO")
            echo "Has v2 fields (internal_code/subcategory/display_order): $has_v2_fields"
        else
            echo "⚠️  Not root array - may be legacy wrapper format"
        fi
    else
        echo "⚠️  API endpoint not accessible at $APP_URL"
    fi
else
    echo "⚠️  curl or jq not available for API testing"
fi

echo ""
echo "== File Structure =="
phase2_files=(
    "sql/production-cutover-bundle-v2.sql"
    "sql/edgars-production-cutover.sql"
    "middleware/production_tenant_middleware_v2.py"
    "verify/verify-rls-production-v2.sh"
    "verify/verify_rls.sql"
    "verify/show_policies.sql"
    "monitoring/monitor-rls-drift.sql"
    "ops/ssm-port-forward.sh"
    "deploy/deploy-phase2.sh"
    "deploy/run-one-liner.sh"
)

missing_files=0
for file in "${phase2_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
        ((missing_files++))
    fi
done

echo ""
echo "== Summary =="
echo "Missing files: $missing_files/${#phase2_files[@]}"

if [ $missing_files -eq 0 ]; then
    echo "🎯 Phase 2 Go-Live Status: READY"
    echo ""
    echo "Next steps:"
    echo "1. Take DB snapshot: pg_dump -Fc \"\$DATABASE_URL\" -f backup_\$(date +%F).dump"
    echo "2. Run migrations (if needed)"
    echo "3. Deploy RLS: ./deploy/run-one-liner.sh"
    echo "4. Verify: psql \"\$DATABASE_URL\" -f verify/verify_rls.sql"
    echo "5. Test API and flip feature flags"
else
    echo "⚠️  Phase 2 Go-Live Status: INCOMPLETE"
    echo "Missing $missing_files files - check deployment bundle"
fi

echo ""
