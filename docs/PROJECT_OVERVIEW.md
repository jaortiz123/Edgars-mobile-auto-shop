# PROJECT_OVERVIEW — Edgar’s Mobile Auto Shop

**Date:** 2025-07-25 (PT)
**Owner:** Jesus (Edgar’s Admin Overhaul)
**Status:** In flight — Sprint 1 groundwork

---

## Purpose

Build a fast, appointment-centric admin that gives the shop an **instant command center**: Calendar remains the hub; a new **Status Board** shows flow; a focused **Appointment Drawer** handles the work.

We deliver value every sprint with **minimal, reversible schema changes**. No heavy “Orders” rewrite.

---

## Strategy (one sentence)

**Calendar first, Board next, Drawer always.** Ship dual views, enrich with services + messaging, then close the loop with payments + inspections.

---

## Scope

### In-scope (V1)
- **Dual Views:** Calendar + **Status Board** (Kanban-lite).
- **Appointment Drawer:** tabs **Overview · Services · Messages · History**.
- **Lite domain objects:** services, messages, payments, inspection checklists.
- **Dashboard stats** and **Cars on Premises**.
- **CSV exports** (T-024): One-click CSV downloads for accounting integration.

### Out of scope (V1)
- Payment gateway processing (record only).
- Media uploads for inspections (photos/video).
- Deep line-item engine / full Orders system.
- Complex vendor parts integrations.

---

## Business Outcomes (acceptance)

- Operator can manage the day from **Calendar or Board**, interchangeably.
- Status change via drag-and-drop or keyboard **Move to…**.
- Drawer shows complete appointment context and totals without page hops.
- Customer communication logged with **delivery status**.
- **Unpaid total** drops immediately when a payment is recorded.
- **CSV exports** (T-024) enable one-click data downloads for accounting tools.
- Meets **TCPA**, **RBAC**, **WCAG 2.2 AA**, **SLO p95** targets.

---

## Sprint Plan (high-level)

| Sprint | Goal | Ships |
|---|---|---|
| **S1** | Dual-View foundation | Board, Drawer shell (Overview + Services read-only), stats tiles, status drag→PATCH, persisted view pref |
| **S2** | Communication & context | Services **CRUD**, Messages thread + provider webhook, Customer history, Reports + CSV |
| **S3** | Operational loop closure | **Record payments**, Inspections checklist, keyboard Move to…, a11y audit, rate limits |

**S1 DoD:** Calendar/Board parity for status + Drawer with core details working end-to-end.

---

## Architecture Snapshot

- **Frontend:** React + TypeScript + Vite + Tailwind.
  - Key components: `StatusBoard`, `AppointmentCalendar`, `AppointmentDrawer`, `DashboardStats`.
  - State: `AppointmentContext`.
- **Backend:** Flask + PostgreSQL.
  - Endpoints: board, stats, appointment get/patch; later services/messages/payments/inspections.
- **Data:** extend `appointments`; add lite tables `appointment_services`, `messages`, `payments`, `inspection_checklists`, `inspection_items`.
- **Auth:** JWT with role claims; RBAC middleware.
- **Observability:** p95 latency SLOs + weekly report.
- **Flags:** `ff.messaging`, `ff.payments`, `ff.inspections`, `ff.command_palette`, `ff.brand_theming`.

---

## Essential Files (Sprint 1 only)

**Frontend**
- `src/admin/Dashboard.tsx`, `src/admin/AdminAppointments.tsx`
- `src/components/admin/{StatusBoard,StatusColumn,AppointmentCard,AppointmentDrawer,AppointmentCalendar,DashboardStats,CarsOnPremisesWidget}.tsx`
- `src/components/ui/{Tabs,Toast,Skeleton,Input,Select,Toggle}.tsx`
- `src/contexts/AppointmentContext.tsx`
- `src/api.ts` (S1 endpoints only)

**Backend**
- `backend/local_server.py`, `backend/booking_function.py`
- `backend/migrations/` (minimal schema)
- `backend/requirements.txt`

---

## Guardrails (must-haves)

- **RBAC:** Owner / Advisor / Tech / Accountant. Guard **COMPLETED**, payments, exports, messaging.
- **TCPA:** consent field, STOP handler, quiet hours, HMAC-signed delivery webhooks.
- **SLOs p95:** Board ≤ **800 ms** · Drawer ≤ **500 ms** · Send→Delivered ≤ **2 s** · Stats ≤ **400 ms** (cached).
- **A11y:** keyboard path, **Move to…** alternative to DnD, WCAG 2.2 AA.
- **DR:** nightly backups, **RPO ≤ 24h**, **RTO ≤ 4h**, quarterly restore drill.
- **N+1 protection:** pre-joined queries; tests assert query counts.

---

## KPIs

- **Operational**
  - Jobs completed per day
  - Unpaid total
  - Avg cycle time (Scheduled → Completed)

- **Product**
  - p95 Board latency
  - p95 Drawer latency
  - Message delivery success rate
  - Error budget burn (5xx)

---

## Dependencies

- SMS provider with delivery webhooks (HMAC).
- Postgres with backup/restore access.
- Redis (optional) for stats cache / queues (can defer if not available).

---

## Links

- **API:** `docs/API.md`
- **Schema:** `docs/SCHEMA.md`
- **Risk Register:** `docs/RISK_REGISTER.md`
- **Security Checklist:** `docs/SECURITY_CHECKLIST.md`
- **Performance Metrics:** `docs/PERFORMANCE_METRICS.md`
- **DR Plan:** `docs/DR_PLAN.md`
- **Frontend Playbook:** `docs/FRONTEND_PLAYBOOK.md`
- **Appointment Reminders:** `docs/APPOINTMENT_REMINDERS.md`
- **Deployment Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
- **Launch Plan:** `docs/LAUNCH_PLAN.md`

---

## Glossary

- **Drawer:** Right-side panel used for editing/viewing an appointment.
- **Board:** Kanban-lite status view of appointments.
- **Quiet hours:** 9pm–8am shop local time; messaging blocked unless Owner override.
- **RPO/RTO:** Recovery Point/Time Objectives for backups.

---

## Next Step

Confirm this overview, then I’ll lock **API.md**, **SCHEMA.md**, and seed **RISK_REGISTER.md** with owners and due dates. Does this match what you want to ship?
