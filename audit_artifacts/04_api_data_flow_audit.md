# 🔄 API & Data Flow Audit

**Deliverable**: Save/export this document as `04-api-data-flow-audit.md`

**Repo**: `<project_root>`
**Commit SHA**: `<fill>`
**Auditor**: `<your_name>`
**Date**: 2025‑09‑06

---

## 0) Objectives & Success Criteria
**Goal:** Make the API predictable, safe under load, and easy to debug. Eliminate response drift, brittle transactions, and cache/data sync bugs.

**Done means:**
- One **authoritative API contract** (OpenAPI) that **matches reality**; contract tests enforce it.
- Responses follow a **single envelope**; errors standardized with correlation IDs.
- Idempotent mutations, consistent pagination/filtering/sorting, and stable versioning.
- Transactions are **atomic**; data integrity is protected with constraints + retries.
- Caching and invalidation rules are explicit; rate limiting & timeouts in place.
- Tracing, metrics, and logs make any failure diagnosable in minutes.

---

## 1) System Inventory & Discovery
Quick mapping of endpoints, response shapes, and data flows.

### 1.1 Endpoint Discovery (collect evidence)
```bash
# Flask/Python routes
rg -n "@app\.route\(|Blueprint\(" backend > audit_artifacts/api_routes.txt

# API string literals and /api/ usage
rg -n "(/api/|endpoint\s*=)" backend | tee audit_artifacts/api_strings.txt

# Frontend consumers (fetch/axios/SWR/React Query)
rg -n "fetch\(|axios\.|useSWR|useQuery\(" frontend | tee audit_artifacts/frontend_api_calls.txt
```

### 1.2 Data Flow Sketch (fill)
Document the path for a representative request: **UI → API Gateway → App → DB/Cache → Event Outbox → Consumers**.

Attach diagram as `audit_artifacts/data_flow.png`.

---

## 2) API Contract & Style Guide

### 2.1 OpenAPI (single source of truth)
- Spec file: `openapi/openapi.yaml` (required).
- Use **problem+json (RFC 7807)** for errors or the envelope below.

**Response Envelope (recommended):**
```json
// Success
{
  "ok": true,
  "data": { /* resource(s) */ },
  "meta": { "page": 1, "page_size": 25, "total": 123 },
  "correlation_id": "01J..."
}
```
```json
// Error (RFC7807 compatible shape)
{
  "ok": false,
  "error": {
    "type": "https://docs.example.com/errors/E_RESOURCE_NOT_FOUND",
    "title": "Resource not found",
    "status": 404,
    "code": "E_RESOURCE_NOT_FOUND",
    "detail": "Job 9c8… not found for tenant",
    "fields": { "job_id": "unknown" }
  },
  "correlation_id": "01J..."
}
```

### 2.2 Status Codes & Semantics
- **200/206** read, **201 + Location** create, **202** async accepted, **204** no body.
- **400** validation, **401** unauth, **403** forbidden, **404** missing, **409** conflict, **422** semantic, **429** rate limit, **5xx** server.

### 2.3 Pagination/Filtering/Sorting (must be consistent)
- Query params: `page`, `page_size` (max 100), `sort`, `order`, `filter[foo]=bar`.
- Return `meta.total` + `Link` headers (`next`, `prev`).

### 2.4 Versioning & Deprecation
- Path or header versioning: `/v1/...`.
- **Expand‑contract**: only additive changes in minor versions; deprecations with dates.

---

## 3) Automated Contract Checks

```bash
mkdir -p audit_artifacts

# Validate OpenAPI
npx @redocly/cli lint openapi/openapi.yaml --format json > audit_artifacts/openapi_lint.json || true

# Diff spec vs previous release
npx openapi-diff --fail-on-incompatible \
  openapi/openapi@prev.yaml openapi/openapi.yaml \
  > audit_artifacts/openapi_diff.txt || true

# Generate client/server stubs to enforce types
npm i -D openapi-typescript
npx openapi-typescript openapi/openapi.yaml -o frontend/src/types/openapi.d.ts
```

**Pass/Fail bar:** No incompatible diffs; spec lints clean or with accepted waivers.

---

## 4) Manual Review Checklists (mark ✅/❌ + notes)

### 4.1 Response Consistency
- ☐ Every handler returns the **envelope**; no raw arrays/objects.
- ☐ Error taxonomy mapped to codes; **no 200 with error** payloads.
- ☐ Correlation ID added on all responses and propagated to logs/traces.

### 4.2 Idempotency & Retries
- ☐ `Idempotency-Key` header required for POST that create resources or charge money.
- ☐ Server stores key + request hash + final response; duplicates return same response.
- ☐ Safe retry policy documented (timeouts, jitter, backoff).

### 4.3 Transactions & Integrity
- ☐ Explicit transactions around multi‑step writes; rollback on any failure.
- ☐ Isolation level documented (usually **READ COMMITTED** or **REPEATABLE READ**).
- ☐ Unique constraints & FKs enforce invariants (no rely on app code only).
- ☐ Outbox pattern for reliable events (no dual‑write).

### 4.4 Caching & Invalidation
- ☐ Server sets `ETag`/`Last-Modified`; GET supports conditional requests (304).
- ☐ Cache keys include tenant + role where relevant.
- ☐ Clear/write‑through on mutations; background TTL for lists.

### 4.5 Rate Limits, Timeouts, Circuit Breakers
- ☐ Global + per‑user limits for hot endpoints; 429 with `Retry-After`.
- ☐ Downstream timeouts (DB/HTTP) sensible (e.g., 200–1000ms).
- ☐ Circuit breakers on flaky providers; fallbacks where safe.

### 4.6 Observability
- ☐ W3C trace context headers propagated; `x-request-id` set.
- ☐ Structured logs with tenant, user, route, status, duration, bytes.
- ☐ Metrics: request rate, error rate, p50/p95/p99 latency; SLOs defined.

---

## 5) Database Transaction Safety

### 5.1 Patterns
- **Unit of Work**: one transaction per business operation.
- **SELECT … FOR UPDATE** when updating aggregates/counters.
- **Retry** on deadlocks with bounded attempts + jitter.
- **Outbox Table** to publish events after commit.

**Outbox schema (template):**
```sql
CREATE TABLE outbox (
  id            uuid PRIMARY KEY,
  aggregate     text NOT NULL,
  aggregate_id  uuid NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
```

---

## 6) Caching Strategy
- **Read‑through** for GET by ID; **write‑through** on updates.
- **List cache** keyed by normalized filters; small TTL to avoid staleness.
- Prevent **cache stampede** (jittered TTL, mutex).
- Never cache **403/404** longer than a few seconds.

---

## 7) Data Synchronization
- Prefer **Outbox → Consumer** for internal projections.
- For external sync, use **webhooks** with retries + signatures.
- For heavy replication, consider CDC (Debezium) but only if needed.

---

## 8) Helper Scripts (drop‑in)

### 8.1 Flask Response Envelope Linter (heuristic)
Create `scripts/audit/check_envelope.py`:
```python
import json, pathlib, re, sys
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'backend')
route = re.compile(r"@app\.route\([\"']([^\"']+)")

def has_envelope(body:str):
    return all(k in body for k in ('ok', 'correlation_id'))

for p in ROOT.rglob('*.py'):
    if any(x in p.as_posix() for x in ('venv','site-packages','node_modules')): continue
    s = p.read_text(errors='ignore')
    for m in route.finditer(s):
        seg = s[m.end():m.end()+800]
        if 'jsonify(' in seg and not has_envelope(seg):
            print(f"[WARN] {p}:{m.start()} route {m.group(1)} may not use envelope")
```
Run:
```bash
python scripts/audit/check_envelope.py backend > audit_artifacts/envelope_warnings.txt
```

### 8.2 Find Missing Pagination
```bash
rg -n "GET\s+/api/\w+" openapi/openapi.yaml | rg -v "page|page_size" > audit_artifacts/maybe_unpaged.txt
```

### 8.3 Correlation ID Middleware (Flask sketch)
```python
import uuid
from flask import g, request, Response

def correlation_middleware(app):
    @app.before_request
    def _cid():
        g.correlation_id = request.headers.get('x-request-id', str(uuid.uuid7()))
    @app.after_request
    def _set(resp: Response):
        resp.headers['x-request-id'] = getattr(g, 'correlation_id', '')
        return resp
```

### 8.4 Rate Limit (Redis + token bucket sketch)
```python
# pseudo: rate_limit(key, limit=100, window=60)
```
(Add real impl using `redis` + lua or `limits` lib.)

### 8.5 Idempotency Store (sketch)
```python
# Key: Idempotency-Key + user_id + route
# Value: hash(request_body) + response + status + ttl(24h)
```

---

## 9) Tests to Add (minimum set)

### 9.1 Contract Tests (backend)
```python
# Validate that handlers match OpenAPI (use prance/openapi-core)
```

### 9.2 Error Taxonomy
- Force each handler to emit a specific problem code; assert status + envelope.

### 9.3 Idempotency
- Repeat a POST with same `Idempotency-Key` → **201** once, subsequent **200** same body.

### 9.4 Pagination/Filtering
- `page_size` bounds enforced; invalid sort/filters → **400** with field errors.

### 9.5 Concurrency/Transactions
- Simulate concurrent updates; verify row‑level locking and correct final state.

### 9.6 Performance (k6 or Locust)
```bash
# k6 example
npm i -D k6
# script at tests/k6/smoke.js runs 50 VUs, 1m; thresholds p(95)<300ms, err<1%
```

---

## 10) Observability & SLOs
- **Golden signals:** RPS, error rate, latency (p50/p95/p99), saturation.
- **SLOs:** e.g., 99.9% availability per 30d; p95 < 300ms for `/api/jobs/*`.
- **ALERTS:** breach on error rate > 2% for 5m, or p95 > budget for 10m.

---

## 11) Risk Scoring & Prioritization
- **Critical:** No contract; inconsistent responses; non‑atomic multi‑write; missing idempotency on financial ops.
- **High:** No rate limits/timeouts; cache invalidation bugs; pagination drift.
- **Medium:** Lack of correlation IDs; vague error messages.
- **Low:** Cosmetic response differences, missing `Link` headers.

Prioritize by **Risk (L×I)** then **Effort (S/M/L)**.

---

## 12) Remediation Plan (example)
- **Day 1–2:** Land OpenAPI v1; wire envelope + correlation ID middleware.
- **Day 3–4:** Add idempotency for POST/financial endpoints; enforce pagination.
- **Day 5:** Implement outbox + transactional boundaries around multi‑write ops.
- **Day 6:** Add rate limits/timeouts; set ETags; add k6 smoke in CI.

---

## 13) CI Enforcement
- CI validates OpenAPI; fails on incompatible diffs.
- `check_envelope.py` warnings treated as errors except allow‑listed.
- Contract tests must pass; k6 smoke under thresholds.

---

## 14) Reviewer Checklist (PR Gate)
- ☐ Handler returns envelope and correct status.
- ☐ OpenAPI updated and diff checked.
- ☐ Pagination/filter/sort consistent with style guide.
- ☐ Transactions atomic; outbox used.
- ☐ Correlation ID + metrics/logs/traces present.

---

## 15) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top issues & owners:
1) `<API‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<API‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 16) Sign‑off
- Backend Lead: `<name>`
- SRE: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*` and this markdown to the PR/release package.
