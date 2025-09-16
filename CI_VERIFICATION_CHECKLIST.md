# CI Verification Checklist - Green Path

## ✅ 1. Compose Present (E2E Job)
**Expect in logs:**
```
docker-compose version x.y.z
```

## ✅ 2. Integration Job DB Reachable (Host Path)
**Checks added:**
- `DATABASE_URL` points at `127.0.0.1:55432`
- `pg_isready` succeeds before any tests
- Order: `init.sql → migrations → seed`
- Backend health check: `curl -fsS http://localhost:3001/health`

## ✅ 3. E2E Job DB Reachable (Compose Path)
**Checks added:**
- `DATABASE_URL_COMPOSE` points at `postgresql://…@db:5432/...`
- `docker-compose exec db pg_isready -h localhost -p 5432` passes
- Migrations + seed run INSIDE backend container before health check

## ✅ 4. Health Endpoint Goes 200
**Sanity blocks added:**
- Integration job: `curl -fsS http://localhost:3001/health` (90s timeout)
- E2E job: Same check after compose up & migrations/seed (120s timeout)

## ✅ 5. Frontend Tests Scoped
**Verification:**
- CI uses `npm run test:unit:ci` (i.e. `vitest --project unit --run --coverage`)
- Coverage gate reads `frontend/coverage/coverage-summary.json`
- Compares to `${COVERAGE_MIN:-26}`

## Sanity Blocks Added

### Integration Job (Before Tests):
1. **Show DB URL (redacted)** - Verify connection string format
2. **Wait for Postgres** - 90s pg_isready loop
3. **SELECT 1** - Basic connectivity test
4. **Backend health** - 90s curl health check

### E2E Job (Step by Step):
1. **Install Docker Compose** - With version verification
2. **Compose up** - Load .env.ci and build services
3. **Wait DB (compose)** - 90s pg_isready inside container
4. **Schema | migrations + seed** - Proper order inside backend container
5. **Backend health** - 120s curl timeout for compose startup
6. **Playwright tests** - With API_BASE_URL set
7. **Cleanup** - Always run docker-compose down

## Common Failure → Instant Fix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `docker-compose: command not found` | Compose not installed | ✅ Install step added |
| `could not translate host name "db"` | Using compose hostname in host job | ✅ Using 127.0.0.1:55432 for integration |
| `connection refused 127.0.0.1:55432` | Service not up | ✅ pg_isready wait loops added |
| `relation "service_operations" does not exist` | Seed before migrations | ✅ Order: init.sql → migrations → seed |
| `Playwright "health false"` | Backend not ready | ✅ Health checks before tests |
| `FE runs archived tests` | Wrong script | ✅ Using npm run test:unit:ci |

## Expected Green Path Flow

1. **Unit Tests**: 39.56% coverage (above 26% gate) ✅
2. **Integration**: Host postgres with proper init sequence ✅
3. **E2E**: Compose network with health waits ✅
4. **No 503 failures**: DB ready before health checks ✅
