# Backend SQL and Data Model Overview

This document summarizes where the Appointment model (and related tables) are defined, the required fields, and which seed/init scripts populate appointments.

Sources referenced:

- `database/init.sql` (baseline SQL schema for prod-like Postgres)
- `init_db.py` and `init_db_simple.py` (schema creation/initialization via AWS RDS)
- `backend/migrations/20250725_001_add_appt_status_and_lite_tables.sql` (adds status enum and domain tables)
- `backend/tests/test_schema.sql` (canonical shape used in containerized tests)
- `backend/local_server.py` (SQLite fallback initializer and API queries)
- `backend/seeds/seed_s1.sql` (sample seed for S1 domain tables)
- `backend/tests/seed.sql` (richer test seed)

## Where the Appointment model is defined

There is no ORM class; the model is defined in SQL. Two variants exist depending on environment:

### Variant 1: Baseline app schema (simple)

Defined in `database/init.sql` (also created by `init_db_simple.py`).

- Table: `appointments`
- Columns:
  - `id SERIAL PRIMARY KEY`
  - `customer_id INTEGER REFERENCES customers(id)`
  - `vehicle_id INTEGER REFERENCES vehicles(id)`
  - `service_id INTEGER REFERENCES services(id)`
  - `scheduled_date DATE`
  - `scheduled_time TIME`
  - `location_address TEXT`
  - `status VARCHAR(50) DEFAULT 'scheduled'`
  - `notes TEXT`
  - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### Variant 2: Enhanced domain schema (recommended)

Added by `backend/migrations/20250725_001_add_appt_status_and_lite_tables.sql` and reflected in `backend/tests/test_schema.sql`.

- Table: `appointments`
- Columns:
  - `id SERIAL PRIMARY KEY`
  - `customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT`
  - `vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT`
  - `status appointment_status NOT NULL DEFAULT 'SCHEDULED'`
  - `start_ts TIMESTAMPTZ`
  - `end_ts   TIMESTAMPTZ`
  - `total_amount NUMERIC(10,2)`
  - `paid_amount  NUMERIC(10,2) NOT NULL DEFAULT 0`
  - `check_in_at  TIMESTAMP`
  - `check_out_at TIMESTAMP`
  - `tech_id UUID`
  - `title TEXT`
  - `notes TEXT`
  - `created_at TIMESTAMP NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMP NOT NULL DEFAULT now()`

- Related domain tables (UUID PKs referencing `appointments.id` INTEGER):
  - `appointment_services(id UUID, appointment_id INTEGER, name, notes, estimated_hours, estimated_price, category, created_at)`
  - `messages(id UUID, appointment_id INTEGER, channel, direction, body, status, sent_at)`
  - `payments(id UUID, appointment_id INTEGER, amount, method, note, created_at)`
  - `inspection_checklists(id UUID, appointment_id INTEGER, title, created_at)`
  - `inspection_items(id UUID, checklist_id UUID, label, status, notes)`

- Enums defined:
  - `appointment_status`: `SCHEDULED | IN_PROGRESS | READY | COMPLETED | NO_SHOW | CANCELED`
  - `message_channel`: `sms | email`
  - `message_direction`: `out | in`
  - `message_status`: `sending | delivered | failed`
  - `payment_method`: `cash | card | ach | other`
  - `inspection_item_status`: `pass | attention | fail`

See also the high-level schema doc: `docs/SCHEMA.md`.

## Required fields to insert appointments (practical)

- Baseline schema: `customer_id`, `vehicle_id`, and `service_id` are referenced (not strictly `NOT NULL` in that file), `status` defaults to `'scheduled'`, and scheduling uses `scheduled_date` + `scheduled_time`.
- Enhanced schema: `customer_id` and `vehicle_id` are `NOT NULL`; `status` is an enum defaulting to `'SCHEDULED'`. Use `start_ts`/`end_ts` for scheduling.

Minimal safe insert (enhanced schema):

- `customer_id` (existing integer FK)
- `vehicle_id` (existing integer FK)
- `status` (enum value)
- `start_ts` (TIMESTAMPTZ)
- Optional: `end_ts`, `total_amount`, `paid_amount`, `title`, `notes`

## Which scripts seed appointments

- `backend/tests/seed.sql`: inserts 10 appointments across multiple statuses with child records.
- `backend/local_server.py`: when using SQLite fallback in dev, seeds ~8 sample appointments each run (today/tomorrow/this week) plus services.
- `backend/seeds/seed_s1.sql`: inserts 5 appointments (one per status) with related rows; currently does not set `start_ts`/`end_ts` or customer/vehicle FKs.
- `database/init.sql`, `init_db.py`, `init_db_simple.py`: create tables and default services only; they do not bulk-insert appointments.

If you see “39 appointments,” it likely comes from repeated local/demo/test seeds (e.g., multiple runs of the SQLite seeding in `local_server.py` and/or executing `backend/tests/seed.sql` multiple times) rather than the init scripts.

## Next steps to keep exactly 5 appointments

- For Postgres, run a cleanup and apply a 5-appointment seed:

  1) Cleanup (CASCADE ensures children are removed):
     - `TRUNCATE appointment_services, messages, payments, inspection_items, inspection_checklists, appointments RESTART IDENTITY CASCADE;`

  2) Seed 5 appointments. We can update `backend/seeds/seed_s1.sql` to:
     - create or reference 1–2 customers/vehicles
     - insert exactly 5 appointments with `start_ts` at 09:00, 11:00, 13:00, 15:00, 17:00 UTC today (with `end_ts` 60–90 min after)
     - include amounts, one or two services per appointment, and a payment for the COMPLETED one

- To execute: `psql "$DATABASE_URL" -f backend/seeds/seed_s1.sql`

If you prefer SQLite-only dev data, we can alter `backend/local_server.py`’s initializer to insert exactly 5 instead of ~8.
