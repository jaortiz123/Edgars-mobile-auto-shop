#!/usr/bin/env bash
# file: rollback-phase2.sh
# Fast and safe rollback procedure for Phase 2

set -euo pipefail

echo "🔄 Phase 2 Rollback Procedure"
echo "============================="

# Check prerequisites
if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL not set"
    exit 1
fi

echo "⚠️  ROLLBACK SEQUENCE:"
echo "1. API/Feature flags (immediate effect)"
echo "2. Application context (disable tenant middleware)"
echo "3. Database policies (only if absolutely necessary)"
echo "4. Data restore (from snapshot, if needed)"
echo ""

read -p "🚨 Proceed with rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

echo ""
echo "== Step 1: Feature Flag Rollback =="
echo "Disable these flags in your application configuration:"
echo "- catalog_v2_columns: false"
echo "- catalog_api_v2: false"
echo "- rls_enabled: false (if you have this flag)"
echo ""
echo "This immediately reverts to Phase 1 behavior while keeping data intact."

read -p "Feature flags disabled? Press Enter to continue..."

echo ""
echo "== Step 2: Application Context Disable =="
echo "In your Flask app, comment out or disable:"
echo "- init_tenant_middleware(app) call"
echo "- Any SET app.tenant_id in database connections"
echo ""
echo "This removes tenant context setting, making RLS policies ineffective"
echo "(but keeps them in place for potential re-enable)"

read -p "Tenant middleware disabled? Press Enter to continue..."

echo ""
echo "== Step 3: Database Policy Status =="
echo "Current RLS policies:"
psql "$DATABASE_URL" -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2;"

echo ""
echo "RLS can be left ENABLED with policies in place."
echo "Without app.tenant_id context, queries will see NO DATA (fail-closed)."
echo ""
echo "🚨 DANGER ZONE: Only proceed if you need to fully disable RLS"

read -p "Disable RLS policies? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Disabling RLS on core tables..."

    for table in customers vehicles appointments services; do
        echo "Disabling RLS on $table..."
        psql "$DATABASE_URL" -c "ALTER TABLE $table DISABLE ROW LEVEL SECURITY;" || {
            echo "⚠️  Failed to disable RLS on $table - may not exist"
        }
    done

    echo "✅ RLS disabled on all tables"
else
    echo "✅ RLS policies left in place (recommended)"
    echo "Queries will return no data without tenant context"
fi

echo ""
echo "== Step 4: Data Restore (if needed) =="
echo "If you need to restore data from backup:"
echo ""
echo "From pg_dump file:"
echo "pg_restore -d \"\$DATABASE_URL\" --clean --if-exists backup_YYYY-MM-DD.dump"
echo ""
echo "From RDS snapshot:"
echo "1. Go to RDS Console -> Snapshots"
echo "2. Select your pre-Phase-2 snapshot"
echo "3. Restore to new instance or overwrite current"
echo ""

read -p "Need to restore from backup? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Manual restore required - see commands above"
else
    echo "✅ No data restore needed"
fi

echo ""
echo "== Rollback Status Check =="
echo "Verifying current state..."

echo ""
echo "RLS Status:"
psql "$DATABASE_URL" -Atc "SELECT relname || ': enabled=' || COALESCE(relrowsecurity::text, 'false') FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname IN ('customers', 'vehicles', 'appointments', 'services') ORDER BY 1;"

echo ""
echo "Active policies:"
policy_count=$(psql "$DATABASE_URL" -Atc "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';")
echo "Policy count: $policy_count"

echo ""
echo "🎯 Rollback completed!"
echo ""
echo "== Verification Steps =="
echo "1. Test your application - should work as before Phase 2"
echo "2. Check that all CRUD operations work normally"
echo "3. Verify no RLS denials in logs"
echo "4. Monitor for 5-10 minutes to ensure stability"
echo ""
echo "== Re-enable Process =="
echo "To re-enable Phase 2 later:"
echo "1. Re-enable feature flags"
echo "2. Re-enable tenant middleware"
echo "3. Re-enable RLS: ALTER TABLE tablename ENABLE ROW LEVEL SECURITY FORCE;"
echo "4. Run verification: psql \"\$DATABASE_URL\" -f verify/verify_rls.sql"
