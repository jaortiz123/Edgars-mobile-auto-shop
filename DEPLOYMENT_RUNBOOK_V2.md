# Phase 2 — Production Cutover Runbook

## Prereqs

- Confirm Postgres 12+.
- `app_user` exists and is the application login in production.
- Tables contain an org/tenant column (default expected: `org_id`).

## Steps

### 1. (Optional) Port‑forward via SSM

```bash
export INSTANCE_ID=i-0123456789abcdef0
export RDS_ENDPOINT=edgar-auto-shop-db.cvs4mm02yv7o.us-west-2.rds.amazonaws.com
./ops/ssm-port-forward.sh &  # opens localhost:5432 → RDS
export DATABASE_URL=postgres://app_user:***@127.0.0.1:5432/edgarautoshop
```

### 2. Apply SQL + verify

```bash
./deploy/deploy-phase2.sh
```

### 3. App middleware

* Ensure `init_tenant_middleware(app)` is called at startup.
* Verify `/health/tenant-security` returns the tenant when you hit an admin route with `X-Tenant-Id`.

### 4. Smoke tests

* With tenant **A** header: profile endpoints return only A's data.
* With tenant **B** header: ditto for B.
* Without tenant header: admin endpoints 400 (fail‑closed).

## Rollback

* Re-run previous SQL that DROPs policies or `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (not recommended).
* Remove middleware injection (temporary) if needed.

## Monitoring

* Schedule `monitoring/monitor-rls-drift.sql` nightly; alert on non‑empty results.

## Quick Start (One-liner)

```bash
# Set your database URL
export DATABASE_URL="postgres://app_user:your-password@127.0.0.1:5432/edgarautoshop"

# Deploy everything
./deploy/run-one-liner.sh
```

## Security Notes

* Policies are **fail‑closed** when `app.tenant_id` is missing.
* `app_user` role has NO superuser or BYPASSRLS privileges.
* All tenant tables get SELECT/INSERT/UPDATE/DELETE policies automatically.
* Use `tenant_admin` role only for break-glass operations.

## Customization

If your tenant column isn't `org_id`, set it before applying:

```sql
-- In psql session before running the bundle:
SET app.tenant_col = 'tenant_id';
```

Or edit the SQL bundle directly in the section marked "Apply to your tables".
