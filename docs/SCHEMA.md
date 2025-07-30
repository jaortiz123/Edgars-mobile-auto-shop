# SCHEMA.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Status:** Target schema for Sprints 1–3 (minimal, reversible)

> **Rule:** Stay **appointment‑centric**. Extend `appointments`, add **lite** linked tables for services, messages, payments, inspections. Everything stores **UTC**. Prefer **soft deletes**. All critical mutations are **audited**.

---

## 0. ERD (ASCII)

```
 customers 1───* vehicles 1───* appointments 1───* appointment_services
      │                         │  └──* payments
      │                         │  └──* messages
      │                         │  └──* inspection_checklists 1───* inspection_items
      └──* appointments         

 users 1───* audit_logs (by user_id)

 shops 1───* customers / vehicles / appointments … (optional multi‑tenant)
```

> **Multi‑tenant note:** If you plan to serve multiple shops, add `shop_id UUID` to all top‑level tables and enable RLS. If single‑tenant, skip `shop_id` and RLS for now.

---

## 1. Tables

### 1.1 shops (optional; recommended for future multi‑tenant)

```
shops(
  id UUID PK,
  name TEXT NOT NULL,
  brand_color TEXT NULL,
  logo_url TEXT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  locale TEXT NOT NULL DEFAULT 'en-US',
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
```

### 1.2 users

```
users(
  id UUID PK,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner','Advisor','Tech','Accountant')),
  password_hash TEXT NULL,         -- if using session login; else external IdP/JWT
  shop_id UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
```

### 1.3 customers

```
customers(
  id UUID PK,
  shop_id UUID NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  sms_consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (sms_consent_status IN ('granted','denied','unknown')),
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
)
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
```

### 1.4 vehicles

```
vehicles(
  id UUID PK,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  year INT NULL,
  make TEXT NULL,
  model TEXT NULL,
  vin TEXT NULL,
  mileage INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
)
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_customer_vin ON vehicles(customer_id, vin) WHERE vin IS NOT NULL;
```

### 1.5 appointments (core)

**Status enum**

```
CREATE TYPE appointment_status AS ENUM (
  'SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'
);
```

**Table**

```
appointments(
  id UUID PK,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  shop_id UUID NULL REFERENCES shops(id) ON DELETE CASCADE,

  status appointment_status NOT NULL DEFAULT 'SCHEDULED',
  start TIMESTAMP NOT NULL,
  "end" TIMESTAMP NULL,
  start_ts TIMESTAMPTZ NULL,    -- canonical start timestamp (backfilled)
  end_ts TIMESTAMPTZ NULL,      -- canonical end timestamp (backfilled)

  total_amount NUMERIC(10,2) NULL,
  paid_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,

  check_in_at  TIMESTAMP NULL,
  check_out_at TIMESTAMP NULL,

  tech_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  title TEXT NULL,
  notes TEXT NULL,

  position INT NOT NULL DEFAULT 0,   -- for board ordering within a column

  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL
)
CREATE INDEX IF NOT EXISTS idx_appt_shop ON appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_time ON appointments(start);
CREATE INDEX IF NOT EXISTS idx_appt_start_ts ON appointments(start_ts);
CREATE INDEX IF NOT EXISTS idx_appt_customer ON appointments(customer_id);
```

### 1.6 appointment\_services (lite)

```
appointment_services(
  id UUID PK,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT NULL,
  estimated_hours NUMERIC(5,2) NULL,
  estimated_price NUMERIC(10,2) NULL,
  category TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
CREATE INDEX IF NOT EXISTS idx_services_appt ON appointment_services(appointment_id);
```

### 1.7 messages

```
messages(
  id UUID PK,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
  direction TEXT NOT NULL CHECK (direction IN ('out','in')),
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending','delivered','failed')),
  provider_id TEXT NULL,
  error_code TEXT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT now()
)
CREATE INDEX IF NOT EXISTS idx_messages_appt ON messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages(sent_at);
```

### 1.8 payments (immutable)

```
payments(
  id UUID PK,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','card','ach','other')),
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  voided_at TIMESTAMP NULL,
  void_reason TEXT NULL
)
CREATE INDEX IF NOT EXISTS idx_payments_appt ON payments(appointment_id);
```

### 1.9 inspection\_checklists & inspection\_items

```
inspection_checklists(
  id UUID PK,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_appt ON inspection_checklists(appointment_id);

inspection_items(
  id UUID PK,
  checklist_id UUID NOT NULL REFERENCES inspection_checklists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass','attention','fail')),
  notes TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_checklist ON inspection_items(checklist_id);
```

### 1.10 audit\_logs

```
audit_logs(
  id UUID PK,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before JSONB NULL,
  after  JSONB NULL,
  ip TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
```

---

## 2. Business Rules (DB‑level)

### 2.1 Status timestamp triggers

Set timestamps automatically on key transitions.

```sql
CREATE OR REPLACE FUNCTION trg_set_appt_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'IN_PROGRESS' AND (OLD.status IS DISTINCT FROM 'IN_PROGRESS') AND NEW.check_in_at IS NULL THEN
      NEW.check_in_at := now();
    END IF;

    IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') AND NEW.check_out_at IS NULL THEN
      NEW.check_out_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_appt_timestamps ON appointments;
CREATE TRIGGER set_appt_timestamps
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION trg_set_appt_timestamps();
```

### 2.2 Payments are append‑only

* Never update amount; use `voided_at` + compensating entry if needed.
* Application logic must recompute `appointments.paid_amount` as the SUM of **non‑voided** payments.

```sql
-- Helper view
CREATE OR REPLACE VIEW appointment_payment_totals AS
SELECT appointment_id,
       COALESCE(SUM(CASE WHEN voided_at IS NULL THEN amount ELSE 0 END),0) AS paid
FROM payments
GROUP BY appointment_id;
```

### 2.3 Soft deletes

* Use `deleted_at` instead of hard deletes for appointments/customers/vehicles.
* Add `WHERE deleted_at IS NULL` to application queries; create partial indexes when needed.

---

## 3. Index & Performance Plan

* **Appointments**: `(status)`, `(start)`, `(customer_id)`, partial `(deleted_at IS NULL)` if high churn.
* **Messages**: `(appointment_id)`, `(sent_at)`.
* **Payments**: `(appointment_id)`.
* **Stats**: pre‑aggregate by day using `date_trunc('day', start)` when ranges are large.
* **Vacuum/Analyze**: tune autovacuum for messages if volume is high.

---

## 4. Migrations

### 4.1 File naming

```
backend/migrations/
  20250725_0001_core_enums_tables.sql
  20250725_0002_triggers_indexes.sql
  20250725_0003_audit_logs.sql
```

### 4.2 0001 — core enums & tables (excerpt)

```sql
BEGIN;
-- enum
DO $$ BEGIN CREATE TYPE appointment_status AS ENUM ('SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- customers, vehicles, appointments, services, messages, payments, inspections
-- (use full definitions from section 1)
COMMIT;
```

### 4.3 0002 — triggers & indexes

```sql
BEGIN;
-- triggers from §2.1
-- indexes from §3
COMMIT;
```

### 4.4 0003 — audit logs

```sql
BEGIN;
-- audit_logs create + indexes
COMMIT;
```

### 4.5 Down migrations (dev only)

Include `DROP TABLE ...` and `DROP TYPE appointment_status` in reverse order. **Production:** prefer forward‑only with restore‑from‑backup for destructive rollbacks.

---

## 5. Sample Queries

### 5.1 Board payload

```sql
-- cards
SELECT a.id,
       a.status,
       a.position,
       a.start,
       a."end",
       c.name AS customer_name,
       CONCAT(v.year,' ',COALESCE(v.make,''),' ',COALESCE(v.model,'')) AS vehicle,
       a.total_amount AS price
FROM appointments a
JOIN customers c ON c.id = a.customer_id
JOIN vehicles  v ON v.id = a.vehicle_id
WHERE a.deleted_at IS NULL
  AND a.start >= $1 AND a.start < $2;

-- column summaries
SELECT status,
       COUNT(*) AS count,
       COALESCE(SUM(total_amount),0) AS sum
FROM appointments
WHERE deleted_at IS NULL AND start >= $1 AND start < $2
GROUP BY status;
```

### 5.2 Cars on premises

```sql
SELECT a.id, c.name, v.make, v.model, a.check_in_at
FROM appointments a
JOIN customers c ON c.id = a.customer_id
JOIN vehicles  v ON v.id = a.vehicle_id
WHERE a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
ORDER BY a.check_in_at ASC;
```

### 5.3 Unpaid total

```sql
SELECT COALESCE(SUM(total_amount - paid_amount),0) AS unpaid_total
FROM appointments
WHERE status IN ('IN_PROGRESS','READY','COMPLETED')
  AND deleted_at IS NULL;
```

---

## 6. Data Retention & PII

* **Messages:** retain body for 24 months by default; longer retention raises cost + risk. Consider redaction.
* **Audit logs:** retain 36 months minimum.
* **PII in logs:** filter phone/email in server logs; store raw values only in DB.

---

## 7. RLS (optional multi‑tenant)

If multi‑tenant is required, enable RLS and add policies per `shop_id`:

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_isolation ON customers USING (shop_id = current_setting('app.shop_id')::uuid);
-- Repeat for vehicles, appointments, etc.
```

Backend sets `SET app.shop_id = '<uuid>'` per request after JWT validation.

---

## 8. Validation Matrix (app + DB)

| Field                          | Validation                  |
| ------------------------------ | --------------------------- |
| `appointments.start` < `end`   | app + DB CHECK if needed    |
| `payments.amount > 0`          | DB CHECK                    |
| `messages.direction`           | DB CHECK ENUM‑like          |
| `status` transitions           | app‑level guard + audit log |
| `customers.sms_consent_status` | DB CHECK + app STOP handler |

---

## 8.1. Canonical Timestamps Migration Rationale (T-010)

### Background
The appointments table has evolved to include timezone-aware canonical timestamp fields (`start_ts`, `end_ts`) alongside the legacy timing fields (`start`, `end`, `scheduled_date`, `scheduled_time`). This migration (Alembic revision `abcdef123456`) ensures backward compatibility while providing a clear path forward.

### Migration Strategy
- **Additive**: New `start_ts` and `end_ts` columns are added as nullable `TIMESTAMPTZ` fields
- **Backfill Logic**: Uses COALESCE to prioritize existing data in this order:
  1. `start_ts` (if already exists)
  2. `start` (primary timing field)
  3. `scheduled_date + scheduled_time` (legacy combination)
  4. `scheduled_date` (date-only, defaults to midnight)
- **Indexing**: Creates performance index on `start_ts` for query optimization
- **Zero Downtime**: Legacy fields remain functional during transition

### Data Integrity
- Migration includes comprehensive test coverage (`test_migrations.py`)
- Validates that no NULL `start_ts` values remain for appointments with valid scheduling data
- Handles edge cases: date-only appointments, missing scheduling information, mixed field scenarios
- Preserves all existing appointment data without loss

### Future Evolution
- Legacy fields (`start`, `end`, `scheduled_date`, `scheduled_time`) can be deprecated once application migration is complete
- All new functionality should use `start_ts`/`end_ts` for timezone consistency
- Provides foundation for multi-timezone shop support

---

## 9. Open Questions

1. Single shop vs. multi‑tenant? (decides `shop_id` + RLS)
2. Do we need partial payments per appointment? (current model supports multiple payments)
3. Do we need taxes/fees breakdown now? (out of scope, can add `charges` table later)
4. Will we store inbound MMS/media later? (add `message_media` table + S3)

---

**Done.** This schema keeps V1 lean, safe, and fast — and gives you clean growth paths for everything we deferred. Ready for `API.md` next?
