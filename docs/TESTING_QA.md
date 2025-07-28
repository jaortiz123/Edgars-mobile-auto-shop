# TESTING\_QA.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Scope:** End‑to‑end test strategy for Sprints 1–3. Aligns with **AGENTS.md**, **API.md**, **SECURITY.md**, and **PERFORMANCE.md**.

> **Rule #1:** Ship with tests that fail for the right reasons. Every critical user flow has: **unit → component → E2E** coverage, plus **a11y, perf, and security gates**.

---

## 1. Tooling Stack

| Layer                  | Tool                                      | Why                                              |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| Unit / Utils (FE)      | **Vitest**                                | Fast, TS‑native, great watch mode.               |
| Component (FE)         | **React Testing Library**                 | Test behavior over internals.                    |
| Mocking (FE)           | **MSW** (Mock Service Worker)             | Deterministic API mocks; also used in Storybook. |
| E2E (FE+BE)            | **Playwright** (or Cypress)               | Cross‑browser, trace viewer, network control.    |
| Unit / API (BE)        | **pytest**                                | Parametrized tests, fixtures, coverage.          |
| API schema / contracts | **pydantic/marshmallow + jsonschema**     | Validate inbound/outbound.                       |
| a11y                   | **axe-core**                              | Automated WCAG checks in CI.                     |
| Perf (API)             | **k6**                                    | Thresholds & soak tests.                         |
| Lint/Format            | **ESLint**, **Prettier**, **ruff/flake8** | Code quality gates.                              |

---

## 2. Test Coverage Targets

| Area                               | Target                             |
| ---------------------------------- | ---------------------------------- |
| FE unit+component (critical files) | **≥ 80%** lines/branches           |
| BE unit / API handlers             | **≥ 85%** lines                    |
| E2E core paths                     | **100%** of acceptance criteria    |
| a11y automated checks              | **0** serious/critical issues      |
| API SLOs (perf)                    | Meet **PERFORMANCE.md** thresholds |

> Coverage is a **guardrail**, not the goal. Focus on meaningful assertions, state transitions, and error handling.

---

## 3. Test Matrix — Acceptance Criteria Traceability

### 3.1 Sprint 1 — Dual‑View Paradigm

| Acceptance Criterion                                         | Unit                     | Component                                                 | E2E                                                           | Notes                                 |
| ------------------------------------------------------------ | ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| Calendar shows appointments for range; opens Drawer on click | date utils, selectors    | `AppointmentCalendar` click → `AppointmentDrawer` visible | **E2E‑S1‑01**: load calendar, click event, drawer opens       | Mock data; assert ARIA roles          |
| Status Board renders columns with counts and sums            | board reducers           | `StatusBoard` columns + totals                            | **E2E‑S1‑02**: open Board, verify columns and counts          | API seeded fixture                    |
| Drag card to change status (optimistic)                      | `optimisticMove` reducer | `StatusBoard` DnD + revert on 500                         | **E2E‑S1‑03**: move card, toast success, column counts update | Also test failure path → revert       |
| Drawer shows Overview + Services (read‑only)                 | payload parser           | `AppointmentDrawer` tabs, focus trap                      | **E2E‑S1‑04**: open drawer, tab switch via keyboard           | Axe pass                              |
| Dashboard stats update after status change                   | stats invalidation       | `DashboardStats` poll/invalidate                          | **E2E‑S1‑05**: move card → stats reflect change               | Within 60s or via manual refresh hook |

### 3.2 Sprint 2 — Communication & Context Engine

| Acceptance Criterion                             | Unit           | Component                         | E2E                                                   | Notes                          |
| ------------------------------------------------ | -------------- | --------------------------------- | ----------------------------------------------------- | ------------------------------ |
| Services CRUD updates total\_amount              | totals math    | `ServicesTab` add/edit/delete row | **E2E‑S2‑01**: add service → total updates            | Server canonical recompute     |
| Send SMS; status transitions to delivered/failed | status mapping | `MessagesThread` composer + chips | **E2E‑S2‑02**: send message → webhook marks delivered | MSW simulates webhook callback |
| Customer history shows last 5 appointments + LTV | aggregators    | `HistoryTab` list                 | **E2E‑S2‑03**: open history → values correct          | Seed 6+ records                |
| Reports page exports CSV                         | csv generator  | `/reports` UI                     | **E2E‑S2‑04**: date range → CSV downloaded            | Validate header/row count      |

### 3.3 Sprint 3 — Operational Loop Closure

| Acceptance Criterion                         | Unit            | Component            | E2E                                                         | Notes                    |
| -------------------------------------------- | --------------- | -------------------- | ----------------------------------------------------------- | ------------------------ |
| Record payment updates paid\_amount and KPIs | validations     | `PaymentPanel` modal | **E2E‑S3‑01**: record payment → unpaid KPI decreases        | Immutable payment record |
| Inspection checklist create/add/mark         | checklist utils | `InspectionsTab`     | **E2E‑S3‑02**: create checklist → items pass/attention/fail | No media in V1           |
| Keyboard Move to… works as DnD alt           | key handlers    | Card menu            | **E2E‑S3‑03**: open menu with keyboard, move status         | a11y requirement         |

---

## 4. Mocking & Fixtures

### 4.1 MSW Handlers (frontend)

Create `src/test/msw/handlers.ts` with route handlers mirroring **API.md**. Provide variants for success, validation error (400), denied (403), and server error (500).

### 4.2 Seed Data (backend)

Use pytest fixtures to create:

* **customers(3)**, **vehicles(3)**
* **appointments(12)** across all statuses and dates
* **services(>5)** on 3 appointments
* **messages(>3)** with mixed statuses
* **payments(2)** on completed jobs

---

## 5. Backend Tests (pytest)

### 5.1 Structure

```
backend/tests/
  conftest.py          # app, db, client fixtures
  test_board.py        # /admin/appointments/board
  test_drawer.py       # /appointments/:id
  test_status_move.py  # /admin/appointments/:id/move
  test_stats.py        # /admin/dashboard/stats
  test_services.py     # CRUD
  test_messages.py     # send + webhook
  test_payments.py     # record + void (S3)
  test_authz.py        # RBAC matrix
```

### 5.2 Examples

**Status transition guard**

```python
def test_invalid_transition_returns_400(client, appt):
    res = client.patch(f"/api/admin/appointments/{appt.id}/move", json={"status":"COMPLETED","position":1})
    assert res.status_code == 400
    assert res.json["error"].startswith("Invalid transition")
```

**Board SLO** (simple latency assertion in CI)

```python
import time

def test_board_p95_under_slo(client):
    latencies = []
    for _ in range(20):
        t0 = time.time(); client.get("/api/admin/appointments/board"); latencies.append((time.time()-t0)*1000)
    latencies.sort()
    p95 = latencies[int(len(latencies)*0.95)-1]
    assert p95 < 800
```

---

## 6. Frontend Tests (Vitest + RTL)

### 6.1 Examples

**Optimistic move + revert**

```ts
it('reverts on server error', async () => {
  server.use(
    rest.patch('/api/admin/appointments/:id/move', (_req, res, ctx) => res(ctx.status(500)))
  );
  render(<StatusBoard initialCards={seed.cards} />);
  await user.drag(card('APT-1'), column('IN_PROGRESS'));
  expect(column('IN_PROGRESS')).toContainCard('APT-1');
  await screen.findByText(/could not move card/i); // toast
  expect(column('SCHEDULED')).toContainCard('APT-1'); // reverted
});
```

**Drawer focus trap**

```ts
it('traps focus and returns to trigger', async () => {
  render(<Dashboard/>);
  const btn = await screen.findByRole('button', { name: /open/i });
  await user.click(btn);
  const close = await screen.findByRole('button', { name: /close drawer/i });
  await user.tab(); // cycle within drawer
  await user.keyboard('{Escape}');
  expect(btn).toHaveFocus();
});
```

---

## 7. E2E Scenarios (Playwright)

### 7.1 Config

* Run against **staging** with seeded data.
* Upload Playwright **trace** on failure.
* Mask PII in screenshots/logs.

### 7.2 Scripts (examples)

**E2E‑S1‑03: Card move updates stats**

```ts
import { test, expect } from '@playwright/test';

test('move card to In Progress updates stats', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await page.getByRole('tab', { name: /board/i }).click();
  const before = await page.getByTestId('kpi-inprogress').innerText();
  await page.dragAndDrop('[data-card-id="APT-1201"]', '[data-col="IN_PROGRESS"]');
  await expect(page.getByText(/moved to in progress/i)).toBeVisible();
  await expect(page.getByTestId('kpi-inprogress')).not.toHaveText(before);
});
```

**E2E‑S2‑02: Message send → delivered**

```ts
test('send sms shows delivered', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await page.click('[data-card-id="APT-1201"]');
  await page.getByRole('tab', { name: /messages/i }).click();
  await page.getByRole('textbox', { name: /message/i }).fill('Your car is ready.');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText(/sending/i)).toBeVisible();
  await expect(page.getByText(/delivered/i)).toBeVisible({ timeout: 5000 });
});
```

---

## 8. Accessibility Testing

### 8.1 Automated

* Run **axe-core** on: Calendar, Board, Drawer (each tab). Fail CI on serious/critical.

### 8.2 Manual checklist

* Keyboard path through Calendar → open Drawer → tab switch → status move via menu.
* Focus rings visible and non‑overlapping; contrast ≥ 4.5:1.
* Live region announces status changes on Board.
* `prefers-reduced-motion` respected.

---

## 9. Performance Testing

* k6 thresholds: match **PERFORMANCE.md** tables.
* Lighthouse CI: **LCP ≤ 2.5s**, **INP ≤ 200ms**.
* Query‑count assertions in backend tests.

---

## 10. Security Testing

* **SECURITY\_CHECKLIST.md** completed for each deploy.
* OWASP ZAP baseline scan on staging: no high findings.
* AuthZ tests proving RBAC matrix (Tech can’t complete, etc.).
* Webhook HMAC verification tests.

---

## 11. CI Pipeline Gates

1. **Lint/format** pass.
2. **Unit + component** tests pass; coverage thresholds met.
3. **Backend pytest** pass; coverage threshold met.
4. **axe** automated checks pass.
5. **k6 smoke** within SLOs.
6. **Playwright E2E** green for happy paths.
7. Docs updated when API/Schema changed (PR checklist).

Override requires: explicit waiver, owner sign‑off, and follow‑up ticket.

---

## 12. Make Targets (suggested)

```makefile
# Frontend
unit:
	pnpm vitest run --coverage

component:
	pnpm vitest run --coverage --dir src/components

e2e:
	pnpm playwright test --reporter=line

a11y:
	pnpm axe-ci

lhci:
	npx @lhci/cli autorun

# Backend
py:
	pytest -q --cov=backend --cov-report=term-missing

# Perf
k6-board:
	k6 run tests/perf/board.js
k6-move:
	k6 run tests/perf/move.js
```

---

## 13. Data Management for Tests

* Use **unique prefixes** for created entities in E2E to allow parallel runs.
* Provide a `/api/test/reset` endpoint **only in test/stage** to reseed data. Protect with secret header.
* Avoid using production phone numbers/emails in fixtures.

---

## 14. Release QA — Manual Pass

Before each release:

* [ ] Calendar renders, switches views, and opens Drawer.
* [ ] Board drag + keyboard move work; counts update.
* [ ] Stats tiles reflect changes.
* [ ] a11y manual path passes.
* [ ] Perf smoke meets thresholds.
* [ ] Security checklist complete; ZAP scan clean.
* [ ] DR restore plan validated (see `DR_PLAN.md`).

---

## 15. Open Items

1. Choose Playwright vs. Cypress (default to **Playwright**).
2. Decide where to run k6 (CI vs. nightly).
3. Add RUM endpoint or vendor for LCP/INP/CLS.

---

**Done.** This plan pairs directly with acceptance criteria and SLOs. Implement the S1 tests first: Calendar → Drawer, Board render, optimistic move, stats refresh, axe checks, k6 smoke. Then layer S2 messaging and S3 payments/inspections.
