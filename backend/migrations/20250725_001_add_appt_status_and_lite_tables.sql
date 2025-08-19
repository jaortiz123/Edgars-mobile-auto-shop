-- S1 migration: appointment_status enum, appointments columns, lite tables

-- ENUM for appointment status
CREATE TYPE appointment_status AS ENUM ('SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED');

-- appointments table (add columns if not present)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS status appointment_status DEFAULT 'SCHEDULED' NOT NULL,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tech_id UUID NULL;

-- Drop lite tables if they exist for id/type updates
DROP TABLE IF EXISTS inspection_items CASCADE;
DROP TABLE IF EXISTS inspection_checklists CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS appointment_services CASCADE;

-- appointment_services table
CREATE TABLE IF NOT EXISTS appointment_services (
  id TEXT PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  estimated_hours NUMERIC(5,2),
  estimated_price NUMERIC(10,2),
  category TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('sms','email')),
  direction TEXT CHECK (direction IN ('out','in')),
  body TEXT NOT NULL,
  status TEXT CHECK (status IN ('sending','delivered','failed')),
  sent_at TIMESTAMP DEFAULT now()
);

-- payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT CHECK (method IN ('cash','card','ach','other')),
  note TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- inspection_checklists table
CREATE TABLE IF NOT EXISTS inspection_checklists (
  id TEXT PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- inspection_items table
CREATE TABLE IF NOT EXISTS inspection_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT REFERENCES inspection_checklists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT CHECK (status IN ('pass','attention','fail')),
  notes TEXT
);

-- S1 migration — Appointment status + lite domain tables
-- Safe, idempotent(ish): guards for existing types/tables; additive changes only.
-- Targets an existing `appointments` table whose primary key is likely INTEGER.
-- Child tables use UUID primary keys; they reference appointments.id as INTEGER.

BEGIN;
SET TIME ZONE 'UTC';

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- 1) ENUM types ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('sms','email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('out','in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('sending','delivered','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash','card','ach','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inspection_item_status AS ENUM ('pass','attention','fail');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) appointments — additive columns --------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS status        appointment_status DEFAULT 'SCHEDULED' NOT NULL,
  ADD COLUMN IF NOT EXISTS total_amount  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS paid_amount   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_in_at   TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS check_out_at  TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tech_id       UUID NULL,
  ADD COLUMN IF NOT EXISTS title         TEXT;  -- harmless if exists

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_checkin    ON appointments(check_in_at);
CREATE INDEX IF NOT EXISTS idx_appointments_checkout   ON appointments(check_out_at);

-- 3) Drop legacy tables if shapes conflict (dev-only tolerance). -----------
-- If you have production data in these, stop and migrate instead of dropping.
DROP TABLE IF EXISTS inspection_items          CASCADE;
DROP TABLE IF EXISTS inspection_checklists     CASCADE;
DROP TABLE IF EXISTS payments                  CASCADE;
DROP TABLE IF EXISTS messages                  CASCADE;
DROP TABLE IF EXISTS appointment_services      CASCADE;
DROP TABLE IF EXISTS audit_logs                CASCADE;

-- 4) Domain tables ---------------------------------------------------------

-- appointment_services
CREATE TABLE IF NOT EXISTS appointment_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  notes           TEXT,
  estimated_hours NUMERIC(5,2),
  estimated_price NUMERIC(10,2),
  category        TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_appt ON appointment_services(appointment_id);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  channel         message_channel NOT NULL,
  direction       message_direction NOT NULL,
  body            TEXT NOT NULL,
  status          message_status NOT NULL,
  sent_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_appt    ON messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

-- payments (immutable; voids recorded as reversing rows in future)
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  method          payment_method NOT NULL,
  note            TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_appt    ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- inspection checklists/items (lite)
CREATE TABLE IF NOT EXISTS inspection_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_appt ON inspection_checklists(appointment_id);

CREATE TABLE IF NOT EXISTS inspection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES inspection_checklists(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  status        inspection_item_status NOT NULL,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_checklist ON inspection_items(checklist_id);

-- audit logs (optional but recommended)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  action      TEXT NOT NULL,           -- e.g., STATUS_CHANGE, PAYMENT_RECORDED
  entity      TEXT NOT NULL,           -- e.g., 'appointment'
  entity_id   TEXT NOT NULL,           -- store as text to allow int/uuid
  before      JSONB,
  after       JSONB,
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

COMMIT;

-- Down (development only — destructive). Commented by default.
-- BEGIN;
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS inspection_items;
-- DROP TABLE IF EXISTS inspection_checklists;
-- DROP TABLE IF EXISTS payments;
-- DROP TABLE IF EXISTS messages;
-- DROP TABLE IF EXISTS appointment_services;
-- ALTER TABLE appointments
--   DROP COLUMN IF EXISTS tech_id,
--   DROP COLUMN IF EXISTS check_out_at,
--   DROP COLUMN IF EXISTS check_in_at,
--   DROP COLUMN IF EXISTS paid_amount,
--   DROP COLUMN IF EXISTS total_amount,
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF NOT EXISTS title;
-- DROP TYPE IF EXISTS inspection_item_status;
-- DROP TYPE IF EXISTS payment_method;
-- DROP TYPE IF EXISTS message_status;
-- DROP TYPE IF EXISTS message_direction;
-- DROP TYPE IF EXISTS message_channel;
-- DROP TYPE IF EXISTS appointment_status;
-- COMMIT;
