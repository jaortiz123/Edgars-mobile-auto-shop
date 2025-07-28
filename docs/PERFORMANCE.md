# PERFORMANCE.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Scope:** Perf objectives, SLOs, budgets, instrumentation, and test plans for Sprints 1–3.

> **Prime directive:** Fast under load. Board ≤ **800ms p95**, Drawer ≤ **500ms p95**. Ship with observability and error budgets, not vibes.

---

## 1. User‑Centric Targets (RUM)

Measure with real‑user monitoring (RUM) on the admin app. Report weekly.

| Metric                              | Target          | Notes                                             |
| ----------------------------------- | --------------- | ------------------------------------------------- |
| **LCP** (Largest Contentful Paint)  | ≤ **2.5s** p75  | On broadband desktop. Calendar/Board pages.       |
| **INP** (Interaction to Next Paint) | ≤ **200ms** p75 | Drag, tab switch, open drawer, fast actions.      |
| **CLS**                             | ≤ **0.1** p75   | Avoid layout shifts; reserve space for skeletons. |
| **TTI**                             | ≤ **2.0s**      | Initial admin load with code‑split Drawer/Board.  |
| **First Drawer Open**               | ≤ **350ms** p95 | Cached shell + single fetch.                      |
| **Drag Card → visual commit**       | ≤ **120ms** p95 | Optimistic UI must feel instant.                  |

---

## 2. API SLOs (server‑side)

Error budget per route: **0.5% 5xx per month** unless noted. Alert at 50% budget burn.

| Route / Action                           |            SLO p95 | Payload cap | Notes                                                                                     |
| ---------------------------------------- | -----------------: | ----------: | ----------------------------------------------------------------------------------------- |
| `GET /api/admin/appointments/board`      |        **≤ 800ms** |    ≤ 1.2 MB | Pre‑joined, paginatable columns. Virtualize UI.                                           |
| `GET /api/appointments/:id` (drawer)     |        **≤ 500ms** |     ≤ 64 KB | Single payload: appointment, customer, vehicle, services, messages (latest 20), payments. |
| `PATCH /api/admin/appointments/:id/move` |        **≤ 250ms** |      ≤ 4 KB | Optimistic UI, then reconcile. Emits stat invalidation.                                   |
| `PATCH /api/appointments/:id`            |        **≤ 350ms** |      ≤ 8 KB | Status/time/tech/totals.                                                                  |
| `GET /api/admin/dashboard/stats`         |        **≤ 400ms** |      ≤ 8 KB | **Cached 5 min**; invalidate on mutations.                                                |
| `POST /api/appointments/:id/messages`    | **≤ 2s** or queued |      ≤ 8 KB | Queue + backoff; provider latency excluded if async.                                      |
| `POST /api/appointments/:id/payments`    |        **≤ 400ms** |      ≤ 8 KB | Atomic record + totals update.                                                            |

---

## 3. Frontend Budgets

| Budget                       |                     Target | Enforcement                                   |
| ---------------------------- | -------------------------: | --------------------------------------------- |
| **Initial JS** (admin shell) |            ≤ **150 KB gz** | Bundle analyzer in CI; fail PRs exceeding.    |
| **Route chunk: Board**       |             ≤ **90 KB gz** | Code split: DnD lib isolated.                 |
| **Route chunk: Drawer**      |             ≤ **60 KB gz** | Lazy mount; tabs further split (Messages).    |
| **CPU main thread work**     | ≤ **150ms** on open drawer | Profiler runs in CI (Lighthouse).             |
| **Memory**                   |       ≤ **200 MB** runtime | Watch leaks with devtools; dispose listeners. |

Tactics: tree‑shake icons, prefer CSS over JS where possible, memo heavy lists, avoid deep prop chains.

---

## 4. Database & Query Budgets

| Operation                 | Max queries | Notes                                                                        |
| ------------------------- | ----------: | ---------------------------------------------------------------------------- |
| Board fetch (all columns) |     **≤ 6** | 1 stats + 1 per status column join; or single union view.                    |
| Drawer fetch              |     **≤ 3** | Appointment+customer+vehicle (join), services, messages/payments (windowed). |
| Status move               |     **≤ 1** | Single update with position recalculation in SQL CTE.                        |
| Stats                     |     **≤ 2** | Aggregates by status + unpaid sum; cache 5 min.                              |

Add a perf test that asserts query counts in CI for critical routes.

---

## 5. Caching Strategy

* **API**: `GET /admin/dashboard/stats` cached **5 minutes** (Redis). Invalidate on: status change, payment, service CRUD.
* **Board**: prefer uncached due to frequent changes; allow **client cache** for 30s with `ETag` and `If-None-Match` to reduce bandwidth. Support `?since=` delta in future.
* **Drawer**: no server cache. Client keeps in memory for the session; stale‑while‑revalidate on reopen within 60s.

---

## 6. Instrumentation

### 6.1 Server

* Log per‑route: latency (ms), status code, bytes, user id, shop id, correlation id.
* Metrics: p50/p95/p99 latency, RPS, 5xx rate, rejected due to rate limit, provider error codes.
* Export to Prometheus/OpenTelemetry → Grafana dashboards.

### 6.2 Client (RUM)

* LCP/INP/CLS via web‑vitals. Ship events to `/api/rum` (batch) or a vendor.
* Custom spans: Drawer open latency, Board render time, DnD frame time, Message send time to toast.
* Sample rate: 10% of sessions in prod to limit cost.

---

## 7. Load & Soak Testing

### 7.1 k6 baseline (examples)

#### Board fetch

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, duration: '2m', thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed:   ['rate<0.005'],
  }
};

export default function () {
  const res = http.get('https://api.local/api/admin/appointments/board?from=2025-07-28&to=2025-08-03', {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` }
  });
  check(res, { 'status 200': r => r.status === 200 });
  sleep(1);
}
```

#### Status move

```js
export const options = { vus: 20, duration: '1m', thresholds: { http_req_duration: ['p(95)<250'] } };
export default function () {
  const body = JSON.stringify({ status: 'IN_PROGRESS', position: 1 });
  const res = http.patch('https://api.local/api/admin/appointments/APT-1/move', body, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.TOKEN}` } });
}
```

### 7.2 Soak

* 2 hours, 10 VUs, mixed scenario (70% board, 20% drawer, 10% move). Ensure no memory growth, no error budget burn.

---

## 8. Degradation & Backpressure

* When Redis is down, **bypass cache** and serve fresh; raise alert.
* When provider (SMS) is slow, **queue** messages and surface "queued" status; retry with backoff.
* When DB is slow, **return partial** stats and show stale badge; never block UI completely.

---

## 9. Alerting Policy

Trigger Pager/Slack when:

* Any key route exceeds SLO p95 for **5 consecutive minutes**.
* 5xx rate > **0.5%** for a route over 10 minutes.
* Error budget burn > **50%** mid‑window.
* Redis unavailable or cache hit rate < **60%** for stats.
* SMS provider failure rate > **1%** over 15 minutes.

---

## 10. CI Performance Gates

* Lighthouse CI on admin shell: **LCP ≤ 2.5s**, **INP ≤ 200ms**, **bundle budgets respected**.
* k6 smoke: board 10 VUs, p95 < **800ms**.
* Query‑count tests on board/drawer.

Fail PRs that breach budgets; allow override with explicit waiver + plan.

---

## 11. Sprint‑Level Commitments

### Sprint 1

* Implement instrumentation, dashboards, and alerts for Board/Drawer/Stats.
* Virtualize Board columns; code‑split Drawer; cache stats.
* k6 baseline tests committed to repo + Make targets.

### Sprint 2

* Add RUM collection; instrument Messages send pipeline.
* Optimize services CRUD round‑trips; batch updates where possible.

### Sprint 3

* Payment flows measured; unpaid KPI latency < **400ms** p95 after record.
* Full perf review; tune slow queries; finalize CI gates.

---

## 12. Make targets (suggested)

```makefile
perf:k6-board

k6-board:
	k6 run tests/perf/board.js

k6-move:
	k6 run tests/perf/move.js

lhci:
	npx @lhci/cli autorun
```

---

## 13. Open Items

1. Decide on RUM vendor vs. in‑house `/api/rum` endpoint.
2. Choose Redis provider and eviction policy (volatile‑ttl).
3. Confirm payload caps; add gzip/deflate on API.
4. Evaluate SSE vs. polling once traffic increases.

---

**This doc pairs with:** `API.md` (SLOs), `SECURITY.md` (rate limits, headers), `FRONTEND.md` (budgets & virtualization), `PERFORMANCE_METRICS.md` (operational dashboards, if kept).
