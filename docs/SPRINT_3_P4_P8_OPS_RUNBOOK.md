# Sprint 3 P4–P8 — Ops Runbook, Results & Follow‑Ups

This is the copy‑pasteable command sheet + checklist capturing what we just ran (P4–P8), how to reproduce it, and the focused follow‑ups to land in the next sprint.

---

## At‑a‑glance

* **Backend URL (Function URL):** `https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws`
* **Auth state:** Function URL **requires AWS\_IAM** (P5). Use the local **SigV4 proxy** for dev.
* **Status Board SLOs:** Board ≤ **800ms p95** (met), Stats ≤ **500ms p95** (met).
* **P4 finding:** Move API optimistic concurrency (OCC) shows high conflict/error rate under load (p95 \~711ms, \~59% failures). Needs hardening.

---

## Quick env setup

```bash
export URL="https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"
export DATE_TOMORROW=$(date -u -v+1d +%F 2>/dev/null || date -u -d '+1 day' +%F)
```

> If IAM is ON (it is), use the SigV4 proxy at `http://localhost:8080`.

---

## P4 — Move API Load Scenario (Reproduce)

### 1) Seed data (admin endpoints)

> Requires existing `customer_id` and `vehicle_id` (we used `1/1`). Adjust as needed.

```bash
curl -s -X POST "$URL/api/admin/appointments" -H 'Content-Type: application/json' -d "{
  \"customer_id\": \"1\",
  \"vehicle_id\": \"1\",
  \"appt_start\": \"${DATE_TOMORROW}T15:00:00Z\",
  \"appt_end\":   \"${DATE_TOMORROW}T16:00:00Z\",
  \"service_codes\":[\"OIL001\"],
  \"notes\": \"P4 seed\"
}"
```

Create a few more slots (alternating services):

```bash
for i in {2..5}; do
  svc=$([ $((i % 2)) -eq 0 ] && echo OIL001 || echo TIRE001)
  curl -s -X POST "$URL/api/admin/appointments" -H 'Content-Type: application/json' -d "{
    \"customer_id\": \"1\",
    \"vehicle_id\": \"1\",
    \"appt_start\": \"${DATE_TOMORROW}T$((14+i)):00:00Z\",
    \"appt_end\":   \"${DATE_TOMORROW}T$((15+i)):00:00Z\",
    \"service_codes\":[\"$svc\"],
    \"notes\": \"P4 seed $i\"
  }" > /dev/null
done
```

Verify:

```bash
curl -s "$URL/api/admin/appointments/board?date=$DATE_TOMORROW" | jq '.data.columns.scheduled.items | length'
```

### 2) Run k6 Move test

```bash
# From repo root
URL=$URL DATE=$DATE_TOMORROW k6 run perf/k6-move.js
```

**Expected (current):** p95 \~700ms, high 409 conflict/error rate.

---

## P5 — IAM on Function URL + SigV4 Dev Proxy

### 1) Enable IAM on Function URL

```bash
aws lambda update-function-url-config \
  --function-name edgar-auto-shop-dev-flask-app \
  --auth-type AWS_IAM \
  --cors '{
    "AllowCredentials": true,
    "AllowHeaders": ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token"],
    "AllowMethods": ["*"],
    "AllowOrigins": ["*"],
    "ExposeHeaders": ["date", "keep-alive"],
    "MaxAge": 86400
  }'
```

### 2) Start SigV4 proxy (local)

```bash
./dev-proxy/start-proxy.sh 8080 &
# Test
curl -s http://localhost:8080/healthz | jq .
```

Use proxy in the app by pointing API base to `http://localhost:8080`.

---

## P6 — Security Hardening (Scan, Lifecycle, Alarms)

### ECR

```bash
aws ecr put-image-scanning-configuration \
  --repository-name edgar-auto-shop-dev-flask-app \
  --image-scanning-configuration scanOnPush=true

aws ecr put-lifecycle-policy \
  --repository-name edgar-auto-shop-dev-flask-app \
  --lifecycle-policy-text '...see repo/monitoring config...'
```

### CloudWatch alarms (examples)

```bash
# Errors >= 5 in 10 minutes
aws cloudwatch put-metric-alarm \
  --alarm-name "EdgarAutoShop-HighErrorRate" \
  --metric-name Errors --namespace AWS/Lambda --statistic Sum \
  --period 300 --threshold 5 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=edgar-auto-shop-dev-flask-app

# Latency p95 proxy: use Duration Average threshold ~800ms as a coarse gate
aws cloudwatch put-metric-alarm \
  --alarm-name "EdgarAutoShop-HighLatency" \
  --metric-name Duration --namespace AWS/Lambda --statistic Average \
  --period 300 --threshold 800 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=edgar-auto-shop-dev-flask-app
```

---

## P7 — CI/CD Gates (Fast path)

### Local quick checks

```bash
# Backend quick pytest
cd backend && python -m pytest tests/test_fast_suite.py -v && cd -
# Frontend typecheck
cd frontend && npm run type-check && cd -
```

### GitHub Actions

* Workflow file: `.github/workflows/ci-cd.yml`
* Secrets required: `AWS_REGION`, `ECR_REPO`, `LAMBDA_FUNCTION`, etc. (see `.github/README.md`).

---

## P8 — Launch Checklist (Ops)

### Authenticated smoke tests via proxy

```bash
python smoke-tests/authenticated-health.py
```

### Production health probe (daily)

```bash
./scripts/production-health-check.sh
```

### UAT data (non‑prod)

```bash
python uat-dataset/generate_uat_data.py
```

---

## OCC Hardening — Focused TODOs (High Priority)

**Backend**

* [ ] Verify version increment on every successful move; return updated `version` in response.
* [ ] Enforce single‑row update with `WHERE id=? AND version=?`; return rows affected to detect stale.
* [ ] Add small server‑side jittered retry (max 1) for transient deadlocks.
* [ ] Emit metric: `occ_conflicts_total` and `move_latency_ms` per status transition.
* [ ] DB: add composite index on `(appointment_id, status, version)` if not present.
* [ ] Confirm transaction isolation level + autocommit behavior in Lambda DB client.

**Frontend**

* [ ] On 409/stale: immediate silent refetch of board + toast with "Updated, please try again".
* [ ] Backoff + jitter retry (1–2 attempts) for 5xx and network errors.
* [ ] Lock dragged card while move is in‑flight; disable re‑drag until resolve.
* [ ] Telemetry: `occ_conflict_rate` (conflicts / moves) and p95/p99 move times.

**Acceptance**

* [ ] k6 Move test: **<1% error rate**, **p95 < 400ms**, **conflict rate < 10%** with graceful UX.

---

## Open Issues & Decisions

* [ ] Confirm production write access policy: prod appears read‑only for create; document intended behavior.
* [ ] Finalize IAM default‑ON + local proxy as standard dev path (P5 landed; update docs).
* [ ] CI TypeScript debt: legacy tests still produce errors; track as separate cleanup epic.

---

## Handy one‑liners

```bash
# Board (today via proxy)
curl -s http://localhost:8080/api/admin/appointments/board?from=$(date -u +%F)\&to=$(date -u +%F) | jq '{ok, cols: (.data.columns|keys)}'

# Stats (today via proxy)
curl -s http://localhost:8080/api/admin/dashboard/stats?from=$(date -u +%F)\&to=$(date -u +%F) | jq '{ok, data: .data}'

# Re-run smoke (auth via proxy)
python smoke-tests/authenticated-health.py
```

---

## Sprint‑Next (proposed)

1. **OCC Hardening** (backend + hook retries) → rerun P4 test until green.
2. **FE polish**: drawer actions, skeletons, SLO toasts fine‑tune.
3. **CI debt pass**: reduce TS errors in legacy tests by 50%.
4. **Dashboards**: CloudWatch widgets for OCC rates & move latency.

---

**Owner:** You ✔️
**Last updated:** 2025-09-20
