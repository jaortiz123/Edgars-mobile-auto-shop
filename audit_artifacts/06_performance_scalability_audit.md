# ⚡ Performance & Scalability Audit

**Deliverable**: Save/export this document as `06-performance-scalability-audit.md`

**Repo**: `<project_root>`
**Commit SHA**: `<fill>`
**Auditor**: `<your_name>`
**Date**: 2025‑09‑06

---

## 0) Objectives & Success Criteria
**Goal:** Hit target throughput with predictable latency under load. Kill N+1s, bad indexes, bloated bundles, and memory leaks.

**Done means:**
- **SLOs:** p95 **< 300ms**, p99 **< 800ms**, error rate **< 1%**, availability **≥ 99.9%** over 30d.
- **Stability:** Soak test (2h) shows **no latency creep** and **no memory growth**.
- **Capacity:** Clear **headroom ≥ 2×** peak traffic; scaling plan documented.
- **Budgets:** FE JS ≤ **200 KB** gz on critical route; images optimized; API timeouts and rate limits defined.

---

## 1) Baseline & Inventory

### 1.1 Traffic Profile (fill)
| Metric | Current | Target |
|---|---:|---:|
| Peak RPS (read) | `<fill>` | `<fill>` |
| Peak RPS (write) | `<fill>` | `<fill>` |
| Concurrency (90th) | `<fill>` | `<fill>` |
| Largest payload (KB) | `<fill>` | `<fill>` |

Export `audit_artifacts/traffic_profile.csv`.

### 1.2 Env & Flags
- **Prod‑like** DB with realistic data volumes for tests.
- **Statement timeout**: Postgres `statement_timeout=800ms` (tune per query class).
- **Server timeouts**: read/write/idle timeouts set at reverse proxy.

---

## 2) Backend Performance Checks

### 2.1 Query Health & N+1
```bash
# Find raw SQL and heavy query callsites
rg -n "SELECT |INSERT |UPDATE |DELETE |session.execute\(|cursor.execute\(" backend > audit_artifacts/sql_calls.txt

# Grep for iterative query patterns indicating N+1
rg -n "for .* in .*:.*(query|get|first|all)\(" backend > audit_artifacts/n_plus_one_suspects.txt
```

**Manual:**
- Turn on **Postgres slow query log** (`log_min_duration_statement=200ms`).
- Run hot endpoints under load; collect EXPLAIN ANALYZE for top 20 queries.

**EXPLAIN wrapper:**
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
<YOUR QUERY HERE>;
```
Save to `audit_artifacts/explain/<name>.json`.

### 2.2 Index Coverage & Constraints
- Ensure every hot **WHERE**, **JOIN**, **ORDER BY** column is indexed.
- Prefer **composite indexes** `(tenant_id, foreign_id)` to enforce isolation + speed.
- Add **partial indexes** for hot predicates (e.g., `status='open'`).

**Index suggestion pass (pg_hint):**
```sql
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 50;
```
Export to `audit_artifacts/pg_stat_top.sql.txt`.

### 2.3 Pooling & Concurrency
- **Gunicorn (sync Flask)**: `workers = 2×CPU + 1`; `threads = 2` (start here).
- **DB connections:** total = `instances × workers × threads` → keep **< 80%** of DB max; otherwise add **PgBouncer**.
- **Statement timeout** + **query cancellation** on client side.

### 2.4 Caching Strategy
- Read‑through cache for **GET by ID**; write‑through on mutation.
- Key includes `tenant_id`; TTL with **jitter** (±20%) to avoid stampedes.
- Don’t cache 403/404 beyond a few seconds.

### 2.5 Async Jobs & Backpressure
- Queue: Celery/RQ/SQS.
- **Idempotent** handlers; visibility timeouts > 2× job P95.
- **Retry policy** with exponential backoff; **DLQ** for poison messages.
- Rate‑limit producers; circuit break consumers.

### 2.6 Memory/CPU Profiling
- **CPU**: `py-spy record -o audit_artifacts/flame.svg --pid <pid>` (production‑safe).
- **Mem**: `memray run -o audit_artifacts/memray.bin <cmd>`; analyze leaks.
- **Leak watch**: run soak; sample `RSS` every 10s; assert flat curve.

**Leak sentinel (Python sketch):**
```python
import tracemalloc, time
tracemalloc.start()
base = tracemalloc.get_traced_memory()[0]
while True:
    cur = tracemalloc.get_traced_memory()[0]
    if cur > base * 1.5: print("[WARN] memory grew 50%+")
    time.sleep(60)
```

### 2.7 Timeouts, Limits, Retries
- HTTP client timeouts **≤ 1000ms**; DB `statement_timeout` **≤ 800ms** for OLTP.
- Circuit breakers for external deps; decide **fail‑open/closed** per feature.
- **Rate limits** on auth and write endpoints; `429` + `Retry-After`.

---

## 3) Frontend Performance Checks

### 3.1 Budgets & Audits
```bash
# Lighthouse CI
npx @lhci/cli autorun --collect.settings.preset=mobile \
  --upload.target=filesystem --upload.outputDir=audit_artifacts/lhci_mobile || true

# Bundle exploration (Vite/Webpack)
npx source-map-explorer "frontend/dist/assets/*.js" \
  --json > audit_artifacts/bundle_explorer.json || true
```
**Budgets:** JS ≤ **200 KB** gz critical route; CSS ≤ **50 KB** gz; fonts subsetted; images AVIF/WebP.

### 3.2 Code‑Splitting & Render Health
- Route‑level **dynamic import()**; split heavy admin pages and charts.
- **React Query/SWR** caching; avoid re‑fetching on focus unless needed.
- Virtualize large lists; debounce type‑ahead.
- Kill excessive renders (audit with React Profiler; memoize selectors).

### 3.3 CWV & RUM
- LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (mobile).
- Collect **web‑vitals** in prod; ship to metrics with route + tenant.

---

## 4) Load, Stress, Soak & Chaos

### 4.1 k6 Smoke & Sustained
Create `tests/k6/smoke.js`:
```js
import http from 'k6/http'
import { check, sleep } from 'k6'
export const options = { vus: 25, duration: '2m', thresholds: {
  http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<300'] } }
export default function () {
  const r = http.get(`${__ENV.BASE_URL}/api/health`)
  check(r, { 'status 200': (res) => res.status === 200 })
  sleep(1)
}
```
Run:
```bash
BASE_URL=https://<env> k6 run tests/k6/smoke.js | tee audit_artifacts/k6_smoke.txt
```

### 4.2 Scenario Tests
- **Read‑heavy** list/search (cache effectiveness).
- **Write‑heavy** create/update with idempotency keys.
- **Mixed** 80/20 read/write at target concurrency.
- **Soak** 2–4h at 0.6× peak; look for latency creep/memory growth.

### 4.3 Chaos & Failure Injection
- Drop DB for 30s → ensure friendly errors, quick recovery.
- Throttle external dependency → circuit breaks; queue buffers.
- Kill pod during load → autoscaler replaces; requests retry.

---

## 5) Capacity Planning

### 5.1 Back‑of‑Napkin Model
- **Little’s Law**: `L = λ × W` (concurrency = arrival rate × latency).
- Headroom: plan for **2×** peak RPS; verify DB and cache connection limits.

### 5.2 DB Connections Formula
```
connections = instances × workers × threads
```
Keep **< 80%** of Postgres `max_connections`; otherwise add **PgBouncer (transaction pooling)**.

### 5.3 Autoscaling Policy
- CPU target **60–65%**; scale out in ≤ 1 min.
- Scale on **RPS** and **queue depth**, not just CPU.
- Pre‑scale for known traffic spikes (cron/marketing events).

---

## 6) Observability & Alerts
- **Metrics:** RPS, error rate, p50/p95/p99, saturation, queue depth.
- **Traces:** W3C context propagated; DB spans show rows/plan/parameters (safe).
- **Logs:** structured; include tenant, user, route, status, duration, correlation ID.
- **Dashboards:** RED (Rate‑Errors‑Duration) per service + USE (Util‑Sat‑Errors) per node.
- **Alerts:** error rate > 2% (5m), p95 > 300ms (10m), queue wait > 2s (5m), memory RSS > 85% (10m).

---

## 7) Helper Scripts & Hooks

### 7.1 SQLAlchemy Slow Query Logger (Python)
```python
from sqlalchemy import event
THRESH_MS = 200
@event.listens_for(Engine, "after_cursor_execute")
def _slow(conn, cursor, statement, parameters, context, executemany):
    dur = (time.perf_counter() - context._query_start_time) * 1000
    if dur > THRESH_MS:
        app.logger.warning({"slow_query_ms": dur, "sql": statement[:200], "params": str(parameters)[:200]})
@event.listens_for(Engine, "before_cursor_execute")
def _start_timer(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.perf_counter()
```

### 7.2 Flask Timing Middleware
```python
@app.before_request
def _tic(): g._t0 = time.perf_counter()
@app.after_request
def _toc(resp):
    dt = (time.perf_counter() - g._t0) * 1000
    resp.headers['Server-Timing'] = f"app;dur={dt:.2f}"
    return resp
```

### 7.3 Bundle Guard (CI)
```bash
# Fail CI if gzipped JS on critical route exceeds 200 KB
npx gzip-size-cli frontend/dist/assets/*.js | tee audit_artifacts/gzip_sizes.txt
```

---

## 8) Risk Scoring & Prioritization
- **Critical:** Unindexed hot queries; N+1 on critical lists; no timeouts; memory leak under soak; DB connection exhaustion.
- **High:** Bloated bundles causing LCP > 2.5s; missing cache leading to DB saturation; lack of backpressure.
- **Medium:** Over‑eager revalidation; verbose logs on hot path.
- **Low:** Minor GC churn; tiny CLS shifts.

---

## 9) Remediation Plan (example)
- **Day 1–2:** Enable slow query log; add missing composite indexes; kill top N+1s.
- **Day 3:** Add caching for GET by ID + list TTL; introduce PgBouncer if needed.
- **Day 4:** FE bundle diet (code‑split, tree‑shake, image/font optimizations).
- **Day 5:** Timeouts/circuit breakers; rate‑limit write endpoints.
- **Day 6:** Soak test + mem profiling; fix leaks; finalize autoscaling rules.

---

## 10) CI Enforcement
- k6 smoke must pass thresholds; publish HTML summary artifact.
- Gzip bundle sizes checked against budgets.
- Slow query guard: fail PR if new EXPLAIN shows **Seq Scan** on large tables without justification.

---

## 11) Reviewer Checklist (PR Gate)
- ☐ Query plans sane (indexed), no obvious N+1.
- ☐ Timeouts and retries set for any new external call.
- ☐ Cache/invalidation described.
- ☐ Bundle impact measured; code‑split heavy UI.
- ☐ Metrics/traces added for new hot paths.

---

## 12) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top issues & owners:
1) `<PERF‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<PERF‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 13) Sign‑off
- Backend Lead: `<name>`
- Frontend Lead: `<name>`
- SRE: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*` and this markdown to the PR/release package.
