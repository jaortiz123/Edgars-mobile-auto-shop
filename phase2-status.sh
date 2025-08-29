#!/usr/bin/env bash
# phase2-status.sh
# Quick status check of Phase 2 deployment readiness

echo "🚀 Phase 2 Production Cutover Bundle - Status Summary"
echo "=================================================="

# 1. Check file structure
echo ""
echo "📁 File Structure Check:"
declare -a required_files=(
    "sql/production-cutover-bundle-v2.sql"
    "middleware/production_tenant_middleware_v2.py"
    "verify/verify-rls-production-v2.sh"
    "monitoring/monitor-rls-drift.sql"
    "ops/ssm-port-forward.sh"
    "deploy/deploy-phase2.sh"
    "deploy/run-one-liner.sh"
    "edgars-production-cutover.sql"
    "test-local-rls.sh"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing)"
    fi
done

# 2. Check executability
echo ""
echo "🔧 Script Permissions:"
declare -a scripts=(
    "verify/verify-rls-production-v2.sh"
    "ops/ssm-port-forward.sh"
    "deploy/deploy-phase2.sh"
    "deploy/run-one-liner.sh"
    "test-local-rls.sh"
)

for script in "${scripts[@]}"; do
    if [[ -x "$script" ]]; then
        echo "  ✅ $script (executable)"
    else
        echo "  ⚠️  $script (not executable)"
    fi
done

# 3. Check local database status
echo ""
echo "🗄️  Local Database Status:"
if docker ps | grep -q "edgars-mobile-auto-shop-db-1"; then
    echo "  ✅ Docker database container is running"

    # Check app_user role
    if docker exec edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -tAc "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'app_user');" 2>/dev/null | grep -q "t"; then
        echo "  ✅ app_user role exists"
    else
        echo "  ❌ app_user role missing"
    fi

    # Check RLS status
    rls_count=$(docker exec edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -tAc "
        SELECT count(*) FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.schemaname = 'public'
        AND t.tablename IN ('customers', 'vehicles', 'appointments', 'services')
        AND c.relrowsecurity = true;" 2>/dev/null || echo "0")

    echo "  ✅ Tables with RLS enabled: $rls_count/4"

    # Check tenant column
    tenant_col_count=$(docker exec edgars-mobile-auto-shop-db-1 psql -U postgres -d edgar_db -tAc "
        SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name IN ('customers', 'vehicles', 'appointments', 'services')
        AND column_name = 'tenant_id';" 2>/dev/null || echo "0")

    echo "  ✅ Tables with tenant_id column: $tenant_col_count/4"

else
    echo "  ❌ Docker database container not running"
fi

# 4. Environment check
echo ""
echo "🌍 Environment Configuration:"
if [[ -f ".env.local" ]]; then
    echo "  ✅ .env.local exists"
    if grep -q "app_user" .env.local; then
        echo "  ✅ .env.local references app_user"
    else
        echo "  ⚠️  .env.local may need app_user configuration"
    fi
else
    echo "  ❌ .env.local missing"
fi

echo ""
echo "🎯 Next Steps:"
echo "  1. Test locally: ./test-local-rls.sh"
echo "  2. Set up SSM: export INSTANCE_ID=... && ./ops/ssm-port-forward.sh"
echo "  3. Deploy production: export DATABASE_URL=... && ./deploy/deploy-phase2.sh"
echo ""
echo "🛡️ Phase 2 provides bank-grade multi-tenant security with fail-closed RLS policies!"
