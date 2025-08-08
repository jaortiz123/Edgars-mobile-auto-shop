# Dashboard Source of Truth (SoT)

Decision: Use the enhanced Postgres schema and a single backend endpoint as the authoritative source for all dashboard data.

## Canonical Data Store

- Postgres with the enhanced schema (see `backend/migrations/20250725_001_add_appt_status_and_lite_tables.sql` and `backend/tests/test_schema.sql`).
- Scheduling fields: `start_ts`/`end_ts` (TIMESTAMPTZ), not `scheduled_date`/`scheduled_time`.
- Status: ENUM `appointment_status` (`SCHEDULED | IN_PROGRESS | READY | COMPLETED | NO_SHOW | CANCELED`).

## Canonical API

- Read: `GET /api/admin/appointments/board?from&to&techId` (board payload)
  - Returns `columns[]` and `cards[]` (see `docs/API.md` for the exact envelope).
- Create/Update: only via admin appointments endpoints under `/api/admin/appointments*`.
- Frontend MUST NOT read from any other endpoints or local mock sources for the dashboard.

## Canonical Data Contract (Board Cards)

Fields used by the dashboard cards (subset):

- `id: string` (appointment id)
- `status: 'SCHEDULED'|'IN_PROGRESS'|'READY'|'COMPLETED'|'NO_SHOW'|'CANCELED'`
- `position: number` (board order within status column)
- `start: string (ISO)`
- `end: string (ISO | null)`
- `customer_name: string`
- `vehicle: string` (e.g., "2019 Honda HR-V")
- `price: number | null` (maps from `total_amount`)

The backend is responsible for mapping `appointments + customers + vehicles` -> this shape. Frontend displays it without additional joins/heuristics.

## Seeds (Authoritative)

- Single seed file: `backend/seeds/seed_s1.sql`
- Behavior:
  1) Truncate domain tables (CASCADE) and reset sequences
  2) Insert minimal customers/vehicles
  3) Insert exactly 5 appointments for today at 09:00, 11:00, 13:00, 15:00, 17:00 UTC with complete data
  4) Insert services/messages/payments for realism

Run:

- `psql "$DATABASE_URL" -f backend/seeds/seed_s1.sql`

## Enforcement

- Disable SQLite demo auto-seeding for dashboard flows. Local dev should point to Postgres and consume only `/api/admin/appointments/board`.
- CI check:
  - A smoke test that hits `/api/admin/appointments/board` and validates the contract (fields + types).
  - A DB schema check that asserts presence of `start_ts`, enum `appointment_status`, and child tables.

## Cleanup Plan (to avoid drift)

- Remove or gate any alternate seeds that populate dashboard data (`backend/tests/seed.sql`, local SQLite bootstrap) from production/dev workflows.
- Quick start should optionally run: `psql -f backend/seeds/seed_s1.sql` when `DASHBOARD_SOT=true`.

## Next steps

- [ ] Update `backend/seeds/seed_s1.sql` per the spec above (5 fully-filled appointments; uses FKs; sets `start_ts`/`end_ts`).
- [ ] Add a thin SQL view (optional) `admin_dashboard_cards_v` used by the board endpoint to guarantee a stable contract.
- [ ] Wire a CI smoke test against `/api/admin/appointments/board`.
