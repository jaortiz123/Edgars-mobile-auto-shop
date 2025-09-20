# AGENTS.md — Command Center

**Pro---

## 3) Today's Focus (Sprint 3 Ready)

**🎉 SPRINT 2 COMPLETE - All Backend Systems Production Ready**

* [x] **T7 Load Testing:** SLOs validated (Board 385ms p95, Stats 411ms p95)
* [x] **T8 Frontend Contracts:** Complete TypeScript integration framework
* [x] **Performance Framework:** k6/Artillery with automated SLO validation
* [x] **Ops Tooling:** Release, rollback, monitoring, security hardening complete
* [x] **Final Report & Sprint 3 Plan:** Comprehensive documentation and roadmap

**Sprint 3 Execution Ready:**
* **P1-P8 Plan:** Frontend integration, observability, security, CI/CD, UAT
* **Artifacts Available:** All contracts, scripts, and documentation complete
* **SLOs Validated:** Board ≤ 800ms (achieved 385ms), Stats ≤ 500ms (achieved 411ms)

**Next Action:** Begin Sprint 3 implementation using `docs/SPRINT_2_FINAL_REPORT_SUMMARY.md` plan.gar’s Mobile Auto Shop — Admin Dashboard Overhaul
**Owner:** Jesus
**Timezone:** America/Los\_Angeles
**Updated:** 2025‑07‑25

> **Mantra:** **Calendar first · Board next · Drawer always.** Stay **appointment‑centric**. Ship in **three sprints** with **minimal, reversible schema changes**.

---

## 1) Mission & Outcomes (read first)

* Keep **Calendar** as the hub. Add a **Kanban‑lite Status Board** and a **context Drawer**.
* Layer **Services + Messaging** (S2), then **Payments + Inspections** (S3).
* Ship fast, keep scope tight, guard with **RBAC, TCPA, a11y, SLOs**.

**Acceptance snapshot**

* Drawer tabs: **Overview · Services · Messages · History**
* Status columns: **Scheduled · In Progress · Ready · Completed · No‑Show**
* KPIs: **JobsToday, CarsOnPremises, Status counts, UnpaidTotal**

---

## 2) Sprint Tracker

| Sprint                   | Goal                                                               | Status                                 | Demo Gate                                                                          |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------- |
| **S1 – Dual‑View**       | Calendar + **Status Board** + Drawer shell; stats                  | ☐ Planned / ☐ In dev / ☐ Demo / ☐ Done | Move card → status changes; Drawer opens from Calendar **and** Board; KPIs update. |
| **S2 – Backend Ready**   | **Load Testing**, **Frontend Contracts**, Security, Ops tooling    | ☑️ **COMPLETE** / ☑️ **VALIDATED** | T7: SLOs achieved (385ms Board, 411ms Stats); T8: TypeScript integration ready.   |
| **S3 – Frontend & Launch** | **UI Implementation**, **Production SLO monitoring**, Polish       | ☐ Planned / ☐ In dev / ☐ Demo / ☐ Done | Full Status Board UI with optimistic moves; Production monitoring dashboard.       |

> Update the checkbox row as you progress. Demos are mandatory at the end of each sprint.

---

## 3) Today’s Focus (edit me)

* [ ] Create **board endpoint** and **stats endpoint**.
* [ ] Implement **StatusBoard.tsx** with optimistic move + revert.
* [ ] Drawer shell with **Overview, Services (read‑only)**.
* [ ] Seed DB with sample data for all statuses.

**Blockers?** Add to `RISK_REGISTER.md` and note owner/date.

---

## 4) Files to Touch (S1 only — nothing extra)

**Frontend pages**

* `frontend/src/admin/Dashboard.tsx`
* `frontend/src/admin/AdminAppointments.tsx`

**Components**

* `components/admin/StatusBoard.tsx`
* `components/admin/StatusColumn.tsx`
* `components/admin/AppointmentCard.tsx`
* `components/admin/AppointmentDrawer.tsx` *(Overview, Services read‑only)*
* `components/admin/AppointmentCalendar.tsx`
* `components/admin/DashboardStats.tsx`
* `components/admin/CarsOnPremisesWidget.tsx`

**UI primitives**

* `components/ui/Tabs.tsx` · `Toast.tsx` · `Skeleton.tsx` · `Input.tsx` · `Select.tsx` · `Toggle.tsx`

**State & API**

* `contexts/AppointmentContext.tsx`
* `lib/api.ts` · `services/apiService.ts`

**Backend**

* `backend/local_server.py` · `booking_function.py` · `requirements.txt` · `migrations/`

---

## 5) Core Endpoints (S1)

* `GET /api/admin/appointments/board?from&to&techId` → `{ columns[], cards[] }`
* `PATCH /api/admin/appointments/:id/move` → `{ status, position }`
* `GET /api/admin/dashboard/stats?from&to` → KPIs
* `GET /api/appointments/:id` → Drawer payload
* `PATCH /api/appointments/:id` → status/time/tech/totals

> Full spec and payloads live in **API.md**.

---

## 6) Schema (S1)

Extend **appointments** with `status, total_amount, paid_amount, check_in_at, check_out_at, tech_id`.
Create lite tables: **appointment\_services, messages, payments, inspection\_checklists, inspection\_items**.
SQL stubs in **SCHEMA.md**.

---

## 7) Guardrails (must‑have before launch)

* **RBAC:** Owner, Advisor, Tech, Accountant — middleware enforced.
* **TCPA:** consent flag, STOP handler, quiet hours, delivery webhook.
* **SLOs:** Board ≤ **800ms p95**, Drawer ≤ **500ms p95**.
* **A11y:** keyboard alternative to DnD (**Move to…**), WCAG 2.2 AA pass.
* **Backups/DR:** Nightly backups; RPO ≤ 24h, RTO ≤ 4h.
  Details: **SECURITY.md**, **PERFORMANCE.md**, **TESTING\_QA.md**, **DR\_PLAN.md**.

---

## 8) Runbook (local)

```bash
# Backend
cd backend && python local_server.py

# Frontend
cd frontend && pnpm i && pnpm dev
```

---

## 9) Links — Open these when you need detail

* **Docs index:** `./docs/INDEX.md`
* **Overview:** `./docs/PROJECT_OVERVIEW.md`
* **Plan:** `./docs/PROJECT_PLAN.md`
* **Architecture:** `./docs/ARCHITECTURE.md`
* **Schema & SQL:** `./docs/SCHEMA.md`
* **API spec:** `./docs/API.md`
* **Frontend spec:** `./docs/FRONTEND.md`
* **Security:** `./docs/SECURITY.md` · **Performance:** `./docs/PERFORMANCE.md` · **Testing:** `./docs/TESTING_QA.md`
* **DR & Deploy:** `./docs/DR_PLAN.md` · `./docs/DEPLOYMENT_CHECKLIST.md` · `./docs/LAUNCH_PLAN.md`
* **Reminders:** `./docs/APPOINTMENT_REMINDERS.md`
* **Risks (live):** `./docs/RISK_REGISTER.md`
* **Roadmap:** `./docs/ROADMAP.md`

---

## 10) Definition of Done — Sprint 1

1. Calendar ↔ Board switch persists user preference.
2. Drag card to change status with **optimistic UI** and error revert.
3. Drawer opens from **both** Calendar and Board; Overview + Services (read‑only).
4. KPIs reflect status moves within 60s (or manual refresh).
5. Axe a11y scan: **0 serious/critical** on Calendar, Board, Drawer.

**Build it. Demo it. Iterate.**
