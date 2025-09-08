# 🧪 Test Coverage Gaps Audit

**Deliverable**: Save/export this document as `05-test-coverage-gaps-audit.md`

**Repo**: `<project_root>`
**Commit SHA**: `<fill>`
**Auditor**: `<your_name>`
**Date**: 2025‑09‑06

---

## 0) Objectives & Success Criteria
**Goal:** Prove that critical paths, edge cases, and failure modes are tested. Not just high % — **high signal**.

**Done means:**
- Coverage thresholds met **and** mutation score enforced.
- Diff coverage (changed lines) ≥ **90%**; critical packages ≥ **95%**.
- Flake rate < **1%** over 20 CI runs; no quarantined test older than 7 days.
- E2E covers the top 10 user journeys; integration tests for cross‑service flows.
- Accessibility, performance, and cross‑browser smoke run in CI.

---

## 1) Inventory & Baseline

### 1.1 Discover Tests & Count
```bash
# JS/TS tests
rg -n "\.test\.|\.spec\." frontend | tee audit_artifacts/js_test_files.txt

# Python tests
rg -n "^def test_" backend | tee audit_artifacts/py_test_functions.txt

# Count
find frontend -name "*.{test,spec}.{ts,tsx,js}" | wc -l > audit_artifacts/js_test_count.txt
find backend -name "test_*.py" -o -name "*_test.py" | wc -l > audit_artifacts/py_test_count.txt
```

### 1.2 Map Features → Tests (Traceability)
Create a **Requirements‑to‑Tests Matrix**. Fill this from your backlog/routes.

| Feature/Requirement | Area | Unit | Integration | E2E | Neg/Abuse | Perf | A11y |
|---|---|---:|---:|---:|---:|---:|---:|
| Login | Auth | ✅ | ✅ | ✅ | ✅ | ☐ | ✅ |
| Create Appointment | Jobs | ✅ | ✅ | ✅ | ✅ | ☐ | ☐ |

Export as `audit_artifacts/traceability_matrix.csv`.

---

## 2) Coverage, Diff‑Coverage, Mutation

### 2.1 Backend (pytest + coverage.py)
```bash
pip install --upgrade pytest pytest-cov pytest-xdist pytest-randomly
pytest -q \
  --cov=backend \
  --cov-branch \
  --cov-report=term-missing \
  --cov-report=xml:audit_artifacts/coverage_backend.xml \
  -n auto
```

### 2.2 Frontend (Jest + RTL)
```bash
# package.json jest flags
jest --coverage --coverageReporters=json-summary,lcov,text \
  --coverageDirectory=audit_artifacts/jest_coverage
```

### 2.3 Combine & Gate
```bash
# Python: diff-cover to gate changed lines
pip install diff-cover
diff-cover audit_artifacts/coverage_backend.xml --compare-branch=origin/main \
  > audit_artifacts/diff_cover_backend.txt || true

# JS: use jest changed since
jest --changedSince=origin/main --coverage \
  --coverageDirectory=audit_artifacts/jest_changed
```
**Thresholds (CI gates):**
- Global: **lines ≥ 85%**, **branches ≥ 75%**.
- Critical dirs (`backend/auth`, `backend/api`, `frontend/src/pages/appointments`): **lines ≥ 95%**, **branches ≥ 90%**.
- Diff coverage: **≥ 90%**.

### 2.4 Mutation Testing
```bash
# Python
pip install mutmut
mutmut run --paths-to-mutate backend --tests-dir backend/tests \
  --CI --backup \
  > audit_artifacts/mutmut.txt || true

# JS/TS
npx stryker run --reporters html,clear-text --coverageAnalysis perTest \
  --jsonFile a=udit_artifacts/stryker_report.json || true
```
**Pass/Fail:** Mutation score ≥ **60%** initially (raise to 75% over time); no Critical components < **70%**.

---

## 3) Flakiness & Stability

### 3.1 Detect Flakes
```bash
pip install pytest-rerunfailures pytest-flakefinder
pytest -q --flake-finder --maxfail=1 \
  --reruns 2 --only-rerun AssertionError \
  | tee audit_artifacts/flake_output.txt
```

### 3.2 Quarantine Policy
- First failure: classify and fix within **48h**.
- If root cause unclear: **quarantine** with tag `@flake` + owner + ticket; auto‑unquarantine after 7 days or fail CI.
- Disallow `sleep()` in tests; use proper waits/mocks.

### 3.3 Order Randomization
```bash
pytest --random-order --random-order-bucket=module
jest --runInBand --testSequencer=./tests/sequencer-random.js
```

---

## 4) What To Test (Gaps Focus)

### 4.1 Backend
- **Auth negative paths**: expired tokens, wrong roles, cross‑tenant IDs.
- **Transactions**: multi‑step operations rollback.
- **Error taxonomy**: every handler emits exact RFC7807 code + status.
- **Rate limits**: 429 with `Retry-After`.
- **Idempotency**: POST replay returns same response.

### 4.2 Frontend
- **State matrix**: loading/empty/error/403/offline per critical screen.
- **Form UX**: preserved inputs on error, focus to first invalid, aria‑links.
- **Accessibility**: jest‑axe on complex components; no serious/critical.
- **Routing guards**: protected route redirects preserve `returnTo`.

### 4.3 Integration/E2E (Playwright)
- **Happy path**: login → create → list → update → delete appointment.
- **Abuse path**: cross‑tenant fetch denied; mutation rejected.
- **Offline**: toggle `context.setOffline(true)`; queue or disable safely.
- **Visual**: key screens baseline snapshots (small set, stable selectors).

### 4.4 Performance/Resilience
- **k6/Locust smoke**: 50 VU for 1m; p95 < 300ms; err < 1%.
- **Timeouts**: downstream fail yields friendly error; no request > 2s.

---

## 5) Test Data & Environments
- **Factories**: `factory_boy`/`model_bakery` for Python; `@faker-js/faker` for JS.
- **Isolated DB**: `testcontainers` for Postgres; run migrations up on start.
- **AWS mocks**: `moto` or localstack for S3/SES/SNS; signed URL tests.
- **Determinism**: freeze time with `freezegun` / Jest fake timers.
- **Seeds**: minimal fixtures for E2E; reset between tests.

---

## 6) Helper Scripts

### 6.1 Routes Without Tests (heuristic)
```bash
# Collect backend routes
rg -n "@app\.route\([\"']([^\"']+)" backend | sed -E 's/.*\("([^"]+)".*/\1/' | sort -u > audit_artifacts/routes.txt

# Grep tests referencing those routes
while read r; do rg -n "$r" backend/tests || echo "MISSING:$r"; done < audit_artifacts/routes.txt \
  > audit_artifacts/route_test_coverage.txt
```

### 6.2 Per‑Dir Coverage Gate (coverage.py rc)
```ini
# .coveragerc
[report]
omit = */venv/*, */site-packages/*
fail_under = 85
[paths]
source = backend
[run]
branch = True
```
Add **directory‑specific** gates in CI job (python step) to enforce 95% for `backend/auth`, etc.

### 6.3 Jest Thresholds (package.json)
```json
{
  "jest": {
    "coverageThreshold": {
      "global": { "lines": 85, "branches": 75 },
      "./frontend/src/pages/appointments/": { "lines": 95, "branches": 90 }
    }
  }
}
```

### 6.4 Minimal Playwright E2E Skeleton
```ts
import { test, expect } from '@playwright/test'

test('appointments happy path', async ({ page, context }) => {
  await page.goto('/login')
  // ... login helper
  await page.goto('/appointments')
  await page.getByRole('button', { name: /new appointment/i }).click()
  await page.getByLabel(/customer/i).fill('Jane Doe')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByText(/created successfully/i)).toBeVisible()
})
```

---

## 7) CI Pipeline Wiring
- **Stages**: Lint → Unit (BE/FE) → Integration → Mutation (nightly) → E2E → A11y → Perf smoke.
- **Artifacts**: publish coverage XML/LCOV, mutation reports, Playwright traces, axe/pa11y JSON.
- **Quality Gates**: thresholds above + diff coverage + no open flakes.

---

## 8) Risk Scoring & Prioritization
- **Critical:** No tests for auth/tenant boundaries; failing diff coverage on hot code; flaky tests on critical paths.
- **High:** No E2E for main journeys; low branch coverage in validation; missing error‑path tests.
- **Medium:** Weak a11y tests; no performance smoke.
- **Low:** Cosmetic snapshot churn.

---

## 9) Remediation Plan (example)
- **Day 1–2:** Land diff‑coverage + per‑dir thresholds; add top‑5 negative path tests.
- **Day 3–4:** Implement Playwright E2E happy + abuse paths; seed fixtures.
- **Day 5:** Add mutation testing nightly; fix low‑hanging mutators.
- **Day 6:** Wire flake detection + quarantine policy; kill old quarantines.

---

## 10) Reviewer Checklist (PR Gate)
- ☐ Changed lines have tests (diff coverage ok).
- ☐ Error/negative paths tested.
- ☐ No `sleep()`; stable selectors only.
- ☐ A11y checks pass for new UI.
- ☐ Added/updated factories/fixtures as needed.

---

## 11) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top issues & owners:
1) `<TEST‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<TEST‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 12) Sign‑off
- QA Lead: `<name>`
- Backend Lead: `<name>`
- Frontend Lead: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*` and this markdown to the PR/release artifacts.
