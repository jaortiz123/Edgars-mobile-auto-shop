# Production Phase 2 Deployment Runbook

## Overview
Complete cutover from Phase 1 (local RLS testing) to Phase 2 (production SSM + RLS + monitoring). This runbook provides step-by-step instructions for secure production deployment.

## Prerequisites
- ✅ Phase 1 complete: All 5 tenant isolation tests passing locally
- ✅ AWS CLI v2 installed and configured
- ✅ Session Manager plugin installed
- ✅ IAM permissions for SSM access
- ✅ EC2 instance with SSM agent running
- ✅ Production RDS instance accessible from EC2

## Files in this Package

### Core Deployment Scripts
- `production-cutover-bundle-v2.sql` - Enhanced SQL bundle (roles + RLS + policies)
- `setup-ssm-production.sh` - SSM port forwarding (replaces SSH bastion)
- `production_tenant_middleware_v2.py` - Production Flask middleware
- `verify-rls-production-v2.sh` - Enhanced verification tests
- `monitor-rls-drift.sql` - Ongoing security monitoring

### Configuration
- `.env.local` - Updated with SSM configuration template

## Deployment Steps

### Step 1: Set up SSM Port Forwarding

```bash
# Export your production values
export INSTANCE_ID="i-0123456789abcdef0"  # Your EC2 instance ID
export RDS_ENDPOINT="edgar-auto-shop-db.cvs4mm02yv7o.us-west-2.rds.amazonaws.com"
export AWS_PROFILE="your-production-profile"
export AWS_REGION="us-west-2"

# Start SSM tunnel (replaces SSH bastion)
./setup-ssm-production.sh
```

This will establish: `localhost:15432` → `RDS:5432` via SSM Session Manager

### Step 2: Apply Production SQL Bundle

```bash
# Apply the enhanced production cutover (as postgres/superuser)
psql -h localhost -p 15432 -U postgres -d edgarautoshop -v ON_ERROR_STOP=1 -f production-cutover-bundle-v2.sql
```

This creates:
- ✅ `app_user` role (NOBYPASSRLS, non-superuser)
- ✅ `tenant_admin` role (break-glass access)
- ✅ RLS policies on all tenant tables
- ✅ Least-privilege grants
- ✅ Helper functions

### Step 3: Verify RLS Security

```bash
# Test as app_user (critical - must use production role)
export PGHOST=127.0.0.1 PGPORT=15432 PGDATABASE=edgarautoshop PGUSER=app_user
export PGPASSWORD="your-actual-app-user-password"

# Run comprehensive verification suite
./verify-rls-production-v2.sh
```

Expected results:
- ✅ User security: app_user has proper restrictions
- ✅ RLS coverage: All tenant tables protected
- ✅ Tenant isolation: Cross-tenant access denied
- ✅ Context switching: Tenant management working
- ✅ No security drift detected

### Step 4: Deploy Production Middleware

Update your Flask application with the production middleware:

```python
# In your app factory or main module
from production_tenant_middleware_v2 import create_app, validate_database_security

# Validate security on startup
validate_database_security()

# Use the enhanced middleware
app = create_app()
```

Key features:
- ✅ Fail-closed tenant security
- ✅ Multiple tenant extraction methods
- ✅ Security headers
- ✅ Health check endpoints
- ✅ Database user validation

### Step 5: Test End-to-End Security

```bash
# Test health endpoint (should confirm app_user and RLS)
curl -H "X-Tenant-Id: test-tenant-123" http://localhost:3000/health/tenant-security | jq

# Expected response:
{
  "status": "healthy",
  "database": {
    "user": "app_user",
    "session_user": "app_user",
    "database": "edgarautoshop",
    "tenant_context": "test-tenant-123"
  },
  "rls": {
    "enabled_tables": 4,
    "tables": [...]
  }
}
```

### Step 6: Schedule Security Monitoring

Set up nightly monitoring:

```bash
# Add to cron or scheduler
0 2 * * * psql -h localhost -p 15432 -U app_user -d edgarautoshop -f monitor-rls-drift.sql > /var/log/rls-monitor.log 2>&1
```

## Security Validation Checklist

### Database Level ✅
- [ ] `app_user` role has `NOBYPASSRLS`
- [ ] `app_user` role is NOT superuser
- [ ] RLS enabled on: customers, vehicles, appointments, services
- [ ] Each table has tenant isolation policy
- [ ] No rows with `tenant_id IS NULL`
- [ ] Policies use `current_setting('app.tenant_id', true)`

### Application Level ✅
- [ ] Middleware sets `SET LOCAL app.tenant_id` per request
- [ ] Requests without tenant context are rejected (400)
- [ ] Health checks validate database security
- [ ] Security headers added to responses
- [ ] Database connections use `app_user` role

### Operational Level ✅
- [ ] SSM Session Manager replaces SSH bastion
- [ ] Monitoring script detects configuration drift
- [ ] Break-glass `tenant_admin` role available
- [ ] Secrets stored securely (not in code)
- [ ] Regular security validation scheduled

## Troubleshooting

### SSM Connection Issues
```bash
# Verify instance is SSM-managed
aws ssm describe-instance-information --filters "Key=InstanceIds,Values=i-0123456789abcdef0"

# Check SSM agent status
aws ssm send-command --instance-ids "i-0123456789abcdef0" --document-name "AWS-RunShellScript" --parameters 'commands=["sudo systemctl status amazon-ssm-agent"]'
```

### RLS Not Working
```bash
# Check current user and settings
psql -c "SELECT current_user, current_setting('app.tenant_id', true), (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user);"

# Verify policies exist
psql -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

### Tenant Context Issues
```bash
# Test manual tenant setting
psql -c "SET LOCAL app.tenant_id = 'test123'; SELECT current_setting('app.tenant_id', true);"

# Verify middleware is setting context
curl -H "X-Tenant-Id: debug" http://localhost:3000/health/tenant-security
```

## Rollback Plan

If issues arise:

1. **Database Rollback**: Keep `postgres` user available for emergency access
2. **Application Rollback**: Deploy previous middleware without tenant enforcement
3. **Connection Rollback**: Switch back to SSH tunnel if SSM fails

```sql
-- Emergency: Temporarily disable RLS (superuser only)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable after fixing issues
```

## Security Notes

### Critical Security Requirements
- **NEVER** use superuser for application connections
- **ALWAYS** validate tenant context before database operations
- **NEVER** bypass RLS in production code
- **ALWAYS** use `SET LOCAL` (not `SET`) for tenant context

### Break-glass Access
```bash
# Emergency admin access (bypasses RLS)
psql -h localhost -p 15432 -U tenant_admin -d edgarautoshop
# Use only for emergency operations, log all usage
```

## Success Criteria

Phase 2 deployment is complete when:
- ✅ SSM tunnel active (no SSH bastion needed)
- ✅ All RLS verification tests pass
- ✅ Application connects as `app_user`
- ✅ Tenant isolation confirmed in production
- ✅ Health checks return green
- ✅ Security monitoring scheduled

## Post-Deployment

1. **Monitor**: Check logs for tenant context errors
2. **Validate**: Run verification script weekly
3. **Document**: Record any production-specific configurations
4. **Train**: Ensure team understands tenant security model

---

**Questions or Issues?**
- Check verification script output first
- Review security monitoring logs
- Validate tenant context in health endpoint
- Confirm database user is `app_user` (not postgres)
