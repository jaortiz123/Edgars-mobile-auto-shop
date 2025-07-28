-- backend/seeds/seed_s1.sql
-- Robust: persists inserted IDs via a temp table, no hardcoded IDs.
-- Works whether appointments.status is TEXT or ENUM.

BEGIN;
SET TIME ZONE 'UTC';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Temp anchors: use TEXT for status to avoid enum cast issues
CREATE TEMP TABLE appt_anchors (
  status TEXT PRIMARY KEY,
  id     INTEGER NOT NULL
) ON COMMIT DROP;

-- Insert sample appointments and capture IDs
WITH ins AS (
  INSERT INTO appointments (status, total_amount, paid_amount, check_in_at, check_out_at, tech_id, title)
  VALUES
    ('SCHEDULED',   256.65,    0,        NULL,                              NULL, NULL, 'Brake pads (front)'),
    ('IN_PROGRESS', 180.00,    0,        now(),                             NULL, NULL, '60k service'),
    ('READY',       712.10,    0,        now(),                             NULL, NULL, 'Battery & alternator'),
    ('COMPLETED',  5240.00, 5240.00,     now() - interval '1 hour',         now(), NULL, 'Front brakes + rotors'),
    ('NO_SHOW',        NULL,    0,        NULL,                              NULL, NULL, 'Diagnostics')
  RETURNING id, status
)
INSERT INTO appt_anchors(status, id)
SELECT status, id FROM ins;

-- Services for the SCHEDULED job
INSERT INTO appointment_services (id, appointment_id, name, notes, estimated_hours, estimated_price, category, created_at)
SELECT gen_random_uuid(), a.id, 'Front brake pad replacement', NULL, 1.5, 180.00, 'Brakes', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Brake pads (front)', 'OEM preferred', NULL, 62.50, 'Brakes', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED';

-- Payment for the COMPLETED job
INSERT INTO payments (id, appointment_id, amount, method, note, created_at)
SELECT gen_random_uuid(), a.id, 5240.00, 'cash', 'paid in full', now()
FROM appt_anchors a WHERE a.status = 'COMPLETED';

-- Outbound message on the SCHEDULED job
INSERT INTO messages (id, appointment_id, channel, direction, body, status, sent_at)
SELECT gen_random_uuid(), a.id, 'sms', 'out',
       'Your estimate is $256.65. Reply YES to approve.',
       'delivered', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED';

-- Checklist + one item on the IN_PROGRESS job
WITH chk AS (
  INSERT INTO inspection_checklists (id, appointment_id, title, created_at)
  SELECT gen_random_uuid(), a.id, 'Vehicle Check-in', now()
  FROM appt_anchors a WHERE a.status = 'IN_PROGRESS'
  RETURNING id
)
INSERT INTO inspection_items (id, checklist_id, label, status, notes)
SELECT gen_random_uuid(), id, 'Headlights', 'pass', NULL FROM chk;

COMMIT;
