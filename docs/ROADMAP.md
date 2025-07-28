# ROADMAP.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Vision:** Appointment‑centric shop OS that’s faster, cleaner, and completely modern  — Calendar first, Board next, Drawer always.

---

## 0. North‑Star Outcomes

* **Single‑screen ops:** Create → communicate → complete → record payment without leaving the Drawer.
* **Speed as a feature:** Board ≤ **800ms p95**, Drawer ≤ **500ms p95**.
* **Compliance by default:** TCPA, RBAC, audit logs, rate limits, signed links.
* **Upgrade path, not rewrite:** Minimal reversible schema changes; feature‑flag everything risky.

---

## 1. Milestones & Dates (target)

| Milestone                     | Window                    | What ships                                                        | Proof                                                                |
| ----------------------------- | ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| **M1 — Dual‑View Foundation** | **Aug 05 – Aug 16, 2025** | Status Board, Drawer shell, Stats, schema extensions              | Demo: drag to move; Drawer shows Overview+Services (RO); KPIs update |
| **M2 — Comms & Services**     | **Aug 19 – Aug 30, 2025** | Services CRUD, Messaging with delivery, History, Exports, Reports | Demo: add service → total updates; send SMS → delivered; export CSV  |
| **M3 — Ops Closure**          | **Sep 02 – Sep 13, 2025** | Payments record, Inspections checklists, a11y & rate‑limits       | Demo: record cash → unpaid KPI drops; checklist pass/attention/fail  |
| **M4 — Hardening & Pilot**    | **Sep 16 – Sep 27, 2025** | Perf tuning, RBAC audit logs, DR test, staging pilot              | Report: SLOs green, ZAP clean, DR restore validated                  |

> Dates are targets. Slide a week if needed, but **don’t widen scope**.

---

## 2. Scope per Milestone

### M1 — Dual‑View Foundation

* **UI:** Calendar kept; **StatusBoard** with DnD + keyboard Move; **AppointmentDrawer** (Overview, Services RO).
* **API:** `GET /admin/appointments/board`, `PATCH /admin/appointments/:id/move`, `GET /admin/dashboard/stats`, enriched `GET /appointments/:id`.
* **Schema:** `appointments.status/total/paid/check_in/out/tech_id`; tables: `appointment_services`, `messages`, `payments`, `inspection_*` (created but unused).
* **Perf:** virtualize Board; cache stats 5m; query‑count tests.
* **DoD:** All S1 acceptance tests in **TESTING\_QA.md** pass; SLOs met.

### M2 — Communication & Services

* **UI:** `ServicesTab` CRUD with live totals; `MessagesThread` with delivery chips; `History` tab; `/reports` with CSV export.
* **API:** Services CRUD, `GET/POST /messages` + provider webhook, `GET /customers/:id/history`, exports.
* **Compliance:** TCPA consent & STOP handling; webhook HMAC; quiet hours.
* **DoD:** Message send→delivered E2E passes. CSV exports validated.

### M3 — Operational Loop Closure

* **UI:** `PaymentPanel` (immutable records + void via reversal); `InspectionsTab` (checklists + items).
* **API:** `POST /payments`, void endpoint, checklists/items.
* **Security:** Rate limits, RBAC guards, audit logs.
* **A11y:** Keyboard Move‑to, axe clean, manual path validated.
* **DoD:** Unpaid KPI drops within 400ms p95 after payment.

### M4 — Hardening & Pilot

* **Perf:** Tune slow queries, reduce bundle size, enable RUM.
* **Reliability:** DR restore rehearsal; backup verification; SLO report baseline.
* **Pilot:** 1–2 real shops; collect feedback; bug burn‑down.
* **Go/No‑Go** for broader rollout.

---

## 3. Dependencies & Flags

| Area            | Dependency                                    | Flag                 |
| --------------- | --------------------------------------------- | -------------------- |
| Messaging       | SMS provider creds, webhook URL + HMAC secret | `ff.messaging`       |
| Payments        | Business rules for voids/refunds              | `ff.payments`        |
| Inspections     | Checklist schema finalized                    | `ff.inspections`     |
| Command Palette | Provider list & shortcuts                     | `ff.command_palette` |
| Theming         | Shop settings fields                          | `ff.brand_theming`   |

---

## 4. Non‑Negotiables (baked in)

* **RBAC**: Owner, Advisor, Tech, Accountant — enforced in middleware.
* **Audit trail** for status changes, messages, payments, exports.
* **UTC in DB**, TZ convert on client.
* **Soft deletes** on core tables.
* **PII‑safe logs**.
* **Backups** nightly; quarterly restore test.
* **Accessibility** WCAG 2.2 AA path.

---

## 5. Success Metrics

| Goal                  | Metric                             | Target              |
| --------------------- | ---------------------------------- | ------------------- |
| Operator speed        | Drag → status visual commit        | **≤120ms p95**      |
| Drawer responsiveness | Drawer data loaded                 | **≤350ms p95**      |
| Reliability           | 5xx rate (key APIs)                | **<0.5% monthly**   |
| Messaging             | Delivered within                   | **≤2s** (or queued) |
| Adoption              | Pilot user satisfaction (CSAT 1–5) | **≥4.5**            |

---

## 6. Risks & Cut Lines

| Risk                          | Impact               | Mitigation                                 | Cut Line                                                    |
| ----------------------------- | -------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Messaging provider throttling | Delays, failed sends | Queue + retry backoff; per‑shop limits     | If noisy, disable `ff.messaging` and keep Services/Payments |
| Board payload too heavy       | Slow render          | Date filters, pagination, virtualization   | Limit to active week; lazy load long columns                |
| Scope creep into Orders       | Delay                | Keep appointments central; defer promotion | Hard stop: no Orders until after Pilot                      |
| A11y deadlines slip           | Compliance risk      | Keyboard Move‑to early; axe in CI          | Ship with Move‑to; defer advanced DnD a11y                  |
| Perf SLOs missed              | UX degradation       | Profile & cache; split bundles             | Gate release on p95 SLOs                                    |

---

## 7. Post‑Pilot Roadmap (nice‑to‑haves)

### Tier A — High impact

* **Command Palette (⌘K)** actions/search.
* **Brand theming** (logo + primary color) for customer links.
* **SSE/WebSockets** for live updates on Board.

### Tier B — Integrations

* **Stripe/Adyen** payment gateway.
* **VIN decode, labor guides, parts vendors.**
* **QuickBooks export schema** and push API.

### Tier C — Analytics

* Tech productivity, cycle‑time, repeat visits, profit per RO.
* Cohort dashboards and weekly email summaries.

---

## 8. Hand‑Off Checklist per Milestone

* [ ] DoD acceptance tests pass (see **TESTING\_QA.md**).
* [ ] SLO dashboards green; error budget within targets.
* [ ] Security checklist complete; ZAP baseline clean.
* [ ] Docs updated: **API.md**, **SCHEMA.md**, **FRONTEND.md**.
* [ ] Demo recorded and uploaded.
* [ ] Risks reviewed; next milestone re‑scoped if needed.

---

## 9. One‑Pager TL;DR (print this)

* **M1:** Board + Drawer + Stats.
* **M2:** Services CRUD + Messaging + History + Exports.
* **M3:** Payments + Inspections + a11y + limits.
* **M4:** Perf/Reliability + Pilot.
* **Never rewrite.** Add capability, keep velocity, protect uptime.
