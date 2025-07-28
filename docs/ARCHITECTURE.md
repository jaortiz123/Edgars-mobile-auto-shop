# ARCHITECTURE.md — Edgar’s Mobile Auto Shop (Updated)

**Date:** 2025‑07‑25
**Owner:** Jesus
**Status:** Target state for Sprints 1–3

> **Principle:** Stay **appointment‑centric**. Calendar is the hub; a new **Status Board** supplies flow visibility; a fast **Appointment Drawer** is the primary workspace. Ship value with **minimal, reversible schema changes**.

---

## 1. High‑Level System Diagram

```
┌────────────────────────────────────────── Frontend (React + TS + Vite + Tailwind) ──────────────────────────────────────────┐
│                                                                                                                            │
│   Calendar View         Status Board                 Appointment Drawer                               Dashboard Widgets    │
│  (time planning)     (flow visibility)       (Overview · Services · Messages · History)              (stats, cars on lot) │
│         │                     │                               │                                         │                 │
│         └──────────────┬──────┴───────────────┬───────────────┴─────────────────────────────────────────┴───────────────┐ │
│                        │                      │                                                                      UI │ │
└────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────┘ │
                         ▼                      ▼                                                                              
                  /api/admin/             /api/appointments/:id                                                                
                 appointments/board       /api/admin/appointments/:id/move   /api/admin/dashboard/stats   …                    
                         │                      │                          │                                                
─────────────────────────┼──────────────────────┼───────────────────────────┼──────────────────────────────────────────────────
                         ▼                      ▼                          ▼                                                
                                   Backend (Flask + Gunicorn)                                                                
                         ┌───────────────────────────────────────────────────────────────────────────┐                      
                         │  local_server.py (Blueprints)                                            │                      
                         │  • board_bp  • appt_bp  • services_bp  • msg_bp  • payments_bp  • stats  │                      
                         │  • webhooks_bp (provider delivery)                                        │                      
                         └───────────────────────────────────────────────────────────────────────────┘                      
                                                │                                                                                 
                           SQLAlchemy / psycopg connection pool                                                                    
                                                │                                                                                 
────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────
                                                ▼                                                                                 
                                         PostgreSQL (RDS/VM)                                                                      
                                  appointments • appointment_services • messages                                                   
                                  payments • inspection_checklists • inspection_items                                             
                                  customers • vehicles • users • audit_logs                                                       
                                                │                                                                                 
                                                ▼                                                                                 
                                          Redis (optional)                                                                        
                                 • 5‑min cache for stats  • queues/retries for messaging                                          
```

**Alternatives:**

* **Serverless path (optional later):** API Gateway + Lambda + RDS Proxy. Flask app can be packaged via AWS Lambda Powertools/Werkzeug adapter. Keep schemas identical.
* **Containers:** Single ECS/Fargate service or Elastic Beanstalk for the Flask API. Frontend stays static on S3/CloudFront or Vercel/Netlify.

---

## 2. Components & Responsibilities

### Frontend (React + TypeScript)

* **Calendar** — primary planning surface; opens Drawer.
* **Status Board** — Kanban‑lite; drag to change `status`; keyboard **Move to…** fallback.
* **Appointment Drawer** — tabs: **Overview, Services, Messages, History**; inline toasts; optimistic updates with reconcile.
* **Widgets** — **DashboardStats**, **CarsOnPremises**.
* **State** — lightweight via React context; cache per‑view filters and last range; no global store required.
* **API client** — thin `api.ts`; retries only for idempotent GETs; mutation errors surface with user‑actionable guidance.

### Backend (Flask)

* **Blueprints**

  * `board_bp` — board aggregation, column summaries, ordered cards, move endpoint.
  * `appt_bp` — CRUD for appointments; patch status/timestamps; conflict validation hooks.
  * `services_bp` — CRUD for `appointment_services` (S2).
  * `msg_bp` — send/list messages; queue + provider adapter; webhook to update delivery (S2).
  * `payments_bp` — record immutable payments; compute unpaid totals (S3).
  * `inspections_bp` — checklist + items (S3).
  * `stats_bp` — KPI aggregation with Redis cache and event invalidation.
  * `webhooks_bp` — HMAC‑verified messaging delivery updates, STOP handling.
* **Middleware** — JWT auth, RBAC, request timing, rate limits, request IDs, PII log filtering.
* **ORM/DB** — SQLAlchemy (or psycopg + sqlc style). All timestamps stored UTC.
* **Observability** — structured logs (JSON), request metrics, SLO exports; optional OpenTelemetry.

### Data Layer (PostgreSQL)

* Minimal evolution around existing `appointments` table; lite linked tables for services, messages, payments, inspections.
* **Audit logs** for critical mutations (status, payment, void, message send).
* **Soft delete** via `deleted_at` on sensitive tables.

### Caching / Queues

* **Redis (optional but recommended):** 5‑minute cache for `stats`; background retry queue for messaging; idempotency keys on message sends.

---

## 3. Request/Response Flows

### 3.1 Board Load

```
UI → GET /api/admin/appointments/board?from&to&techId
Flask (board_bp)
  ├─ Query appointments within range
  ├─ JOIN customer/vehicle minimal fields
  ├─ Aggregate sums per status
  └─ Return {columns[], cards[]}
UI renders; lists are virtualized for perf.
```

### 3.2 Move Card (DnD)

```
UI updates optimistically
UI → PATCH /api/admin/appointments/:id/move {status, position}
Flask
  ├─ RBAC guard (role can move to target?)
  ├─ Update status; set timestamps (check_in/out)
  ├─ Insert audit_logs row
  └─ Emit cache invalidation for stats
On error: UI reverts and shows toast with reason.
```

### 3.3 Drawer Fetch

```
UI → GET /api/appointments/:id
Flask
  ├─ JOIN customer, vehicle
  ├─ LEFT JOIN services, last N messages, payments
  └─ Return single payload for render without chatter
```

### 3.4 Send Message (S2)

```
UI → POST /api/appointments/:id/messages {channel, body}
Flask
  ├─ RBAC + consent check + quiet hours guard
  ├─ Insert messages row (status='sending')
  ├─ Enqueue provider send (or sync call with retry)
  └─ Return provisional message id
Provider → POST /api/webhooks/messaging (HMAC)
Flask updates status → delivered/failed (+retry schedule)
UI receives SSE/poll refresh or next fetch shows updated state.
```

### 3.5 Record Payment (S3)

```
UI → POST /api/appointments/:id/payments {amount, method}
Flask
  ├─ RBAC: Owner/Advisor/Accountant
  ├─ Insert immutable payment row
  ├─ Update appointment.paid_amount
  ├─ Insert audit_logs row
  └─ Invalidate stats cache
```

---

## 4. Domain Model (core)

```
customers(id, name, email, phone, sms_consent_status, created_at, …)
vehicles(id, customer_id, year, make, model, vin, mileage)
appointments(id, customer_id, vehicle_id, status, start, "end", total_amount, paid_amount,
             check_in_at, check_out_at, tech_id, created_at, updated_at, deleted_at)
appointment_services(id, appointment_id, name, notes, estimated_hours, estimated_price, category, created_at)
messages(id, appointment_id, channel, direction, body, status, sent_at)
payments(id, appointment_id, amount, method, note, created_at)
inspection_checklists(id, appointment_id, title, created_at)
inspection_items(id, checklist_id, label, status, notes)
audit_logs(id, user_id, action, entity, entity_id, before, after, ip, user_agent, created_at)
users(id, email, name, role, password_hash?, created_at)
```

**Status transitions (happy path):** `SCHEDULED → IN_PROGRESS → READY → COMPLETED`
Side paths: `NO_SHOW`, `CANCELED`.

**Automatic timestamps:**

* Set `check_in_at` when entering **IN\_PROGRESS** (if null).
* Set `check_out_at` when entering **COMPLETED** (if null).

---

## 5. Security, RBAC, Compliance (essentials)

* **JWT auth** with role claims. Roles: `Owner, Advisor, Tech, Accountant`.
* **Middleware guards** on: messaging, payments, exports, role admin, and transitions to **COMPLETED**.
* **TCPA**: `sms_consent_status`, STOP keyword handling, quiet hours (9pm–8am shop local), template footer.
* **Rate limits:** messaging (20 / customer / 24h, 200 / shop / hour), exports (5 / user / hour), auth (5 / 15m / IP).
* **CSRF/CORS:** CSRF tokens for cookie sessions; CORS pinned to app origins.
* **Signed links:** short‑lived URLs for any customer‑facing pages (TTL ≤ 7 days).
* **Backups & DR:** nightly backups, RPO ≤ 24h, RTO ≤ 4h; quarterly restore drill.

---

## 6. Performance & SLOs

| Path / Action                        | SLO p95  | Notes                                      |
| ------------------------------------ | -------- | ------------------------------------------ |
| `GET /api/admin/appointments/board`  | ≤ 800 ms | Pre‑join customer/vehicle; paginate if big |
| `GET /api/appointments/:id` (Drawer) | ≤ 500 ms | Single payload; no N+1                     |
| Message send → delivered (provider)  | ≤ 2 s    | Queue + retry; surface status              |
| `GET /api/admin/dashboard/stats`     | ≤ 400 ms | 5‑min cache + invalidation                 |

**Frontend targets:** first board paint < **1.2 s** with 200 cards (virtualized); calendar nav < **300 ms**.

---

## 7. Deployment Topologies

### 7.1 Simple VM / Docker (fastest to ship)

* **Frontend**: Static host (Vercel/Netlify/S3+CloudFront).
* **Backend**: Dockerized Flask on a single VM with reverse proxy (Nginx/Caddy).
* **DB**: Managed Postgres (Aiven/RDS/Railway) or VM Postgres with automated backups.
* **Pros**: Lowest ops complexity. **Cons**: Manual scaling.

### 7.2 AWS Standard

* **Frontend**: S3 + CloudFront.
* **Backend**: ECS Fargate service (1–2 tasks), Application Load Balancer, Secrets Manager.
* **DB**: RDS Postgres, automated snapshots.
* **Redis**: Elasticache (optional).
* **Observability**: CloudWatch metrics/logs + alarms.

### 7.3 Serverless Variant (optional later)

* API Gateway (HTTP) → Lambda (Flask adapter) → RDS via **RDS Proxy**.
* Keep the same REST and schema. Use Powertools, cold‑start mitigation, and connection pooling through Proxy.

---

## 8. Environments & Config

* **Envs:** `dev`, `staging`, `prod`.
* **Secrets:** stored in platform secrets manager (AWS Secrets Manager / Doppler / 1Password). Never commit.
* **Key variables:**

  * `DATABASE_URL` (Postgres)
  * `REDIS_URL` (optional)
  * `JWT_PUBLIC_KEY` / `JWT_ISSUER`
  * `MSG_PROVIDER_KEY`, `MSG_WEBHOOK_SECRET`
  * `BRAND_COLOR`, `SHOP_TIMEZONE`, `SHOP_LOCALE`
  * Feature flags: `FF_MESSAGING`, `FF_PAYMENTS`, `FF_INSPECTIONS`, `FF_COMMAND_PALETTE`, `FF_BRAND_THEMING`

---

## 9. Migrations, Backups, and Restore

### 9.1 Migrations

* Versioned SQL migrations in `backend/migrations/` (timestamped).
* **Reversible** where practical; destructive ops require export backup first.
* CI step validates migration runs **forward** and **back** on a scratch DB.

### 9.2 Backups

* Nightly full backup; 7‑day rolling; weekly for 8 weeks; monthly for 12 months.
* Store checksums; verify restore integrity quarterly.

### 9.3 Restore Runbook (summary)

1. Pause writers; snapshot current DB.
2. Restore latest healthy snapshot to a new instance.
3. Run migrations to target version if needed.
4. Flip app `DATABASE_URL`; validate health checks; resume traffic.

---

## 10. Frontend UX & Accessibility Notes

* **Keyboard first:** every board operation has a keyboard path. **Move to…** menu is mandatory.
* **Focus management:** Drawer traps focus, returns to last trigger on close.
* **Live regions:** announce status moves and message delivery updates.
* **Color/contrast:** 4.5:1 minimum; text + icon + label for status (no color‑only).
* **Dark mode:** supported; respect `prefers-color-scheme`.
* **Reduced motion:** honor `prefers-reduced-motion`; shorten/simplify transitions.

---

## 11. Observability & Quality Gates

* **Metrics:** request latency (p50/p95), error rate, queue depths, provider error codes, cache hit rate.
* **Health:** `/healthz` (process up) and `/readyz` (DB reachable) endpoints.
* **SLO reporting:** weekly rollups; alert on breach of error budget or p95 targets.
* **Feature flags:** kill switch supported; UI hides disabled features and backend returns 403.

---

## 12. File Map (essential touchpoints)

**Frontend**

```
src/admin/Dashboard.tsx
src/admin/AdminAppointments.tsx
src/components/admin/{StatusBoard,StatusColumn,AppointmentCard,AppointmentDrawer,
                     AppointmentCalendar,DashboardStats,CarsOnPremisesWidget}.tsx
src/components/ui/{Tabs,Toast,Skeleton,Input,Select,Toggle}.tsx
src/contexts/AppointmentContext.tsx
src/api.ts
```

**Backend**

```
backend/local_server.py
backend/booking_function.py
backend/notification_function_enhanced.py   # (S2 messaging adapter, optional)
backend/reminder_function.py                 # (S3 optional automation)
backend/migrations/                          # SQL files
backend/requirements.txt
```

---

## 13. Roadmap Hooks (post‑launch)

* **Payment gateway** (Stripe/Adyen) with fees and payouts.
* **Inspection media uploads** to S3 + CDN with redaction tooling.
* **Brand theming** (shop logo/color on customer links/PDFs).
* **VIN decode / labor guides / parts vendors** integrations.
* **Tech productivity** and **cycle‑time** analytics.

---

## 14. FAQ

* **Why Postgres over DynamoDB?** Relational joins (customers → vehicles → appointments → services/payments) and ad‑hoc reporting fit SQL best while keeping cost low and logic simple.
* **Can this move to serverless later?** Yes. Keep REST and schema stable; add API Gateway + Lambda + RDS Proxy. Cold starts are acceptable for this workload with caching.
* **What if Redis isn’t available?** Ship without, then add: stats can compute synchronously for small data sets; add cache when p95 slips.

---

**End of file.**
