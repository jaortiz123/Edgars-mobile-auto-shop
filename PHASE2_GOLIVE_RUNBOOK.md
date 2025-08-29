# Phase 2 Go-Live Runbook

## Overview
Complete deployment procedure for Phase 2: Row-Level Security + Catalog API v2 with enterprise-grade security and fail-closed tenant isolation.

## Pre-Flight Checklist

1. **Environment Verification**
   ```bash
   # Set required environment variables
   export DATABASE_URL="postgresql://..."  # Production database
   export APP_URL="https://your-app.com"   # Application URL

   # Run comprehensive readiness check
   ./verify/phase2-golive-status.sh
   ```

2. **Required Tools**
   - `psql` (PostgreSQL client)
   - `curl` and `jq` (API testing)
   - Database backup tools (`pg_dump` or RDS snapshots)

## Go-Live Sequence

### Step 1: Database Snapshot (CRITICAL)
**Never skip this step** - provides immediate rollback path.

**RDS (AWS):**
```bash
# Create snapshot via AWS CLI
aws rds create-db-snapshot \
  --db-instance-identifier your-db-instance \
  --db-snapshot-identifier phase2-backup-$(date +%F)
```

**Self-hosted:**
```bash
pg_dump -Fc "$DATABASE_URL" -f backup_$(date +%F).dump
```

### Step 2: Database Migrations (Idempotent)
Apply Phase 2 column additions and backfills:
```bash
# Run your catalog v2 migrations
psql "$DATABASE_URL" -f migrations/add-catalog-v2-columns.sql

# Verify columns added
psql "$DATABASE_URL" -c "\d+ service_operations" | grep -E 'internal_code|subcategory|display_order'
```

### Step 3: RLS Policy Deployment (No-op Safe)
```bash
# Deploy RLS policies (idempotent)
./deploy/run-one-liner.sh

# Verify deployment
psql "$DATABASE_URL" -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2;"
```

**Critical Verification:**
- `app_user` role is `NOBYPASSRLS` and not superuser
- All policies use `CREATE POLICY IF NOT EXISTS`
- Policies enforce `tenant_id = current_setting('app.tenant_id', true)::uuid`
- RLS is **fail-closed** when tenant context is missing

### Step 4: Application Deployment

**Flask Middleware Integration:**
```python
from middleware.production_tenant_middleware_v2 import init_tenant_middleware

def create_app():
    app = Flask(__name__)

    # Initialize tenant middleware (extracts from headers, subdomains, URL params)
    init_tenant_middleware(app)

    return app
```

**API Route Update:**
Ensure `/api/admin/service-operations` returns root array format:
```python
@app.route('/api/admin/service-operations')
def service_operations():
    # Should return root array, not wrapped object
    return jsonify([...])  # ✅ Correct
    # return jsonify({"service_operations": [...]})  # ❌ Legacy wrapper
```

### Step 5: Verification Suite
Run comprehensive verification before enabling features:

**RLS Security Test:**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f verify/verify_rls.sql
```

**Policy Inspection:**
```bash
psql "$DATABASE_URL" -c "\pset border 2" -f verify/show_policies.sql
```

**API Shape Test:**
```bash
./verify/test-catalog-api.sh
```

### Step 6: Feature Flag Activation
Enable only after all verifiers pass:
```bash
# Set in your feature flag system or environment
catalog_v2_columns=true
catalog_api_v2=true
rls_enabled=true
```

### Step 7: Post-Deploy Monitoring (Critical)

**First 10 minutes:**
- Monitor 4xx/5xx error rates by route
- Check 304 cache hit rate on catalog endpoints
- Watch for RBAC/RLS denial logs

**First 24 hours:**
- Zero cross-tenant data leakage in logs
- Stable response times for add-to-invoice operations
- No unexpected fail-closed denials

```bash
# Monitor RLS denials
psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_user_tables WHERE n_tup_ins = 0 AND n_tup_upd = 0 AND n_tup_del = 0;"
```

## Rollback Procedures

### Fast Rollback (Feature Flags)
```bash
# Immediate effect - reverts to Phase 1 behavior
catalog_v2_columns=false
catalog_api_v2=false
rls_enabled=false
```

### Safe Rollback (Application)
```bash
# Disable tenant middleware in Flask app
# Comment out: init_tenant_middleware(app)
# Restart application
```

### Emergency Rollback (Database)
```bash
# Run interactive rollback script
./deploy/rollback-phase2.sh

# Or disable RLS manually
psql "$DATABASE_URL" -c "ALTER TABLE customers DISABLE ROW LEVEL SECURITY;"
psql "$DATABASE_URL" -c "ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;"
psql "$DATABASE_URL" -c "ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;"
psql "$DATABASE_URL" -c "ALTER TABLE services DISABLE ROW LEVEL SECURITY;"
```

### Data Restoration
```bash
# From dump file
pg_restore -d "$DATABASE_URL" --clean --if-exists backup_YYYY-MM-DD.dump

# From RDS snapshot (AWS Console)
# 1. Go to RDS Console -> Snapshots
# 2. Select pre-Phase-2 snapshot
# 3. Restore to new instance or overwrite
```

## Troubleshooting

### Common Issues

**Legacy API Wrapper:**
```bash
# Symptoms: API returns {"service_operations":[...]} instead of [...]
# Fix: Remove duplicate route handler, ensure v2 handler owns route
grep -r "service-operations" backend/ frontend/
```

**org_id vs tenant_id:**
```bash
# Find any remaining org_id references
grep -r "org_id" --exclude-dir=node_modules .
# All should use tenant_id consistently
```

**Fail-Open Policies:**
```bash
# Verify policies are fail-closed
psql "$DATABASE_URL" -c "RESET ROLE; SET ROLE app_user; SELECT COUNT(*) FROM customers;"
# Should return 0 without tenant context
```

**app_user Permissions:**
```bash
# Verify role security
psql "$DATABASE_URL" -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';"
# Should be: app_user | f | f
```

### Emergency Contacts
- Database Team: [contact info]
- Application Team: [contact info]
- On-call Engineer: [contact info]

## Success Criteria
- ✅ Zero cross-tenant data access
- ✅ All CRUD operations working with tenant context
- ✅ Catalog API v2 format with internal_code, subcategory, display_order
- ✅ Proper sorting: display_order ASC NULLS LAST, name ASC
- ✅ No performance degradation
- ✅ Clean rollback path available

## Post-Deployment Tasks
1. Update monitoring dashboards for RLS metrics
2. Document new tenant onboarding process
3. Schedule security audit of tenant isolation
4. Plan Phase 3 feature development
