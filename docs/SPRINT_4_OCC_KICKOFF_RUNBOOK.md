# Sprint 4 – OCC Hardening Kickoff Pack (Copilot Runbook)

**Mission:** Drive Move API error rate **< 1%** and p95 **< 400ms** under load by hardening optimistic concurrency back to front. Keep our "ship fast, stay focused" energy. This is copy‑paste‑ready.

---

## 0) Pre‑flight

* **Branch**

  ```bash
  git checkout -b feat/s4-occ-hardening
  ```
* **Env**

  ```bash
  export AWS_REGION=us-west-2
  export FN=edgar-auto-shop-dev-flask-app
  export URL="https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.${AWS_REGION}.on.aws"
  ```
* **Quick sanity**

  ```bash
  curl -s "$URL/healthz" | jq
  ```

---

## P1 — Backend OCC Enforcement (Highest ROI)

**Goal:** Make the move endpoint truly OCC‑safe and return the incremented version.

### 1.1 Modify repository update to enforce version match

* **Target (pseudo‑SQL):**

  ```sql
  UPDATE appointments
  SET status = :new_status,
      version = version + 1,
      updated_at = NOW()
  WHERE id = :id AND version = :expected_version;
  ```
* **Acceptance:** rows\_affected **== 1** → success; **== 0** → return **409** with `{ code: "version_conflict" }`.

### 1.2 Return updated version & timestamps

* **Response shape:**

  ```json
  {
    "ok": true,
    "data": {
      "appointment_id": "<id>",
      "status": "ready",
      "version": 42,
      "updated_at": "2025-09-20T20:15:00Z"
    }
  }
  ```

### 1.3 Lightweight server retry on transient deadlocks

* **Guideline:** max **1** retry with 10–25ms backoff + jitter for DB deadlocks only; never loop on 409.

### 1.4 Unit test

```bash
pytest backend/tests/test_move_occ.py -q
```

* Cases: happy path, stale version → 409, deadlock → 200 on single retry, response includes incremented version.

---

## P2 — Observability for Move API

**Goal:** Make issues measurable.

### 2.1 Add custom metrics (CloudWatch)

* On every move attempt, emit:

  * `MoveAPI/OCCConflicts` (Count=1 when 409)
  * `MoveAPI/MoveLatency` (Milliseconds)

### 2.2 Alarms (once metrics emit)

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name MoveAPI-HighConflictRate \
  --metric-name OCCConflicts --namespace EdgarAutoShop/MoveAPI \
  --statistic Sum --period 300 --threshold 30 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

---

## P3 — Frontend Resilience

**Goal:** Zero user pain on conflicts; instant feedback; safe optimistic UX.

### 3.1 StatusBoard client: send `expected_version`

* Ensure `moveAppointment(id, newStatus, expectedVersion)` includes last known version.

### 3.2 Conflict handler

* On 409 `version_conflict`:

  * **Silent refetch** board
  * **Toast**: "Board updated; try again"
  * **Do not rollback** if server already moved it; reconcile from refetch

### 3.3 Double‑move guard

* Track `movingCards:Set<string>`; ignore duplicate moves until prior resolves.

### 3.4 Optimistic move + rollback

* Optimistically shift card; if non‑409 failure, rollback and toast error.

### 3.5 UX timing metrics

* Record `move_ms` and surface slow‑op toast > 2s.

---

## P4 — Validation (k6 OCC scenario)

**Goal:** Prove error rate < 1% and p95 < 400ms.

### 4.1 Seed data (tomorrow)

```bash
export DATE_TOMORROW=$(date -u -d '+1 day' +%F 2>/dev/null || date -v+1d -u +%F)
# Use existing admin POSTs (ensure at least 8 scheduled appts)
# …(reuse your seeding snippet from perf setup)…
```

### 4.2 Run k6 move test

```bash
URL=$URL DATE=$DATE_TOMORROW k6 run perf/k6-move.js
```

### 4.3 Success criteria

* Error rate < **1%**
* p95 < **400ms**
* Conflict rate < **10%**, all conflicts auto‑recovered in UX

### 4.4 Artifact

```bash
mkdir -p load_test_results
mv ./summary.json ./load_test_results/k6_move_$(date +%Y%m%d_%H%M).json || true
```

---

## P5 — Deploy + Rollback Safety Net

**Goal:** Boring deploys with instant backout.

```bash
./scripts/release.sh s4-occ-v1
# If any red flags:
./scripts/rollback.sh
```

---

## P6 — Docs & Hand‑off

* Update:

  * `docs/SPRINT_4_OCC_README.md` (create)
  * `docs/OCC_HARDENING_QUICK_REFERENCE.md` → link in README
  * `perf/` README: how to run k6 scenario
* Paste k6 results + CloudWatch screenshots.

---

## Checklist (tick as you go)

* [ ] Move repository update uses `WHERE id AND version` & returns 409 on stale
* [ ] Response includes **incremented** `version`
* [ ] Server retry: ≤1 attempt on deadlock only
* [ ] FE sends `expected_version`
* [ ] FE handles 409 with refetch + toast, guards double‑moves
* [ ] Metrics: conflicts + latency emitted
* [ ] k6: error <1%, p95 <400ms
* [ ] Release completed; rollback tested

---

## Quick Commands (copy/paste)

```bash
# Sanity
curl -s "$URL/api/admin/appointments/board?date=$(date -u +%F)" | jq '.ok'

# One happy move (manually):
APPT_ID=1; CUR_VER=3
curl -s -X POST "$URL/api/admin/appointments/$APPT_ID/move" \
  -H 'Content-Type: application/json' \
  -d "{\"new_status\":\"in_progress\",\"expected_version\":$CUR_VER}" | jq

# Conflict demo (use stale version):
curl -s -X POST "$URL/api/admin/appointments/$APPT_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"new_status":"ready","expected_version":1}' | jq

# k6 validation
URL=$URL DATE=$DATE_TOMORROW k6 run perf/k6-move.js
```

---

## Timeboxes

* **P1 Backend OCC:** 0.5–1.0 day
* **P3 Frontend Resilience:** 0.5 day
* **P4 Validation + Tune:** 0.5 day
* **Docs + Deploy:** 0.25 day

Let's ship it. 🏁
