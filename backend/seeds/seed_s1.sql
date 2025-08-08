-- backend/seeds/seed_s1.sql
-- Dashboard SoT seed: exactly 5 complete appointments spread across today (UTC)

BEGIN;
SET TIME ZONE 'UTC';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Clean existing appointment data (keep customers/vehicles)
TRUNCATE appointment_services, messages, payments, inspection_items, inspection_checklists RESTART IDENTITY CASCADE;
TRUNCATE appointments RESTART IDENTITY CASCADE;

-- 1) Anchor customers
CREATE TEMP TABLE tmp_customers (
  k  TEXT PRIMARY KEY,
  id INTEGER NOT NULL
) ON COMMIT DROP;

WITH cust_data(k,name,email,phone,address) AS (
  VALUES
    ('C1','Noah Bell','noah.bell@example.com','+1-555-0100','123 Cherry Rd'),
    ('C2','Mia Lee','mia.lee@example.com','+1-555-0101','456 Oak St'),
    ('C3','Ezra Kim','ezra.kim@example.com','+1-555-0102','789 Pine Ave'),
    ('C4','Ava Patel','ava.patel@example.com','+1-555-0103','321 Elm Dr'),
    ('C5','Liam Torres','liam.torres@example.com','+1-555-0104','654 Maple Ln')
), ins AS (
  INSERT INTO customers (name,email,phone,address,created_at)
  SELECT name,email,phone,address, now() FROM cust_data
  RETURNING id, name
)
INSERT INTO tmp_customers(k,id)
SELECT cd.k, i.id
FROM cust_data cd
JOIN ins i ON i.name = cd.name;

-- 2) Anchor vehicles
CREATE TEMP TABLE tmp_vehicles (
  k  TEXT PRIMARY KEY,
  id INTEGER NOT NULL
) ON COMMIT DROP;

WITH veh_data(k, customer_key, make, model, year, vin, license_plate) AS (
  VALUES
    ('V1','C1','Honda','HR-V',2019,'HRV-2019-0001','7ABC123'),
    ('V2','C2','Toyota','Corolla',2020,'COR-2020-0001','8DEF456'),
    ('V3','C3','Ford','F-150',2021,'F15-2021-0001','9GHI789'),
    ('V4','C4','Nissan','Altima',2018,'ALT-2018-0001','1JKL012'),
    ('V5','C5','BMW','328i',2020,'B32-2020-0001','2MNO345')
), ins AS (
  INSERT INTO vehicles (customer_id, make, model, year, vin, license_plate, created_at)
  SELECT c.id, vd.make, vd.model, vd.year, vd.vin, vd.license_plate, now()
  FROM veh_data vd
  JOIN tmp_customers c ON c.k = vd.customer_key
  RETURNING id, make, model, year
)
INSERT INTO tmp_vehicles(k,id)
SELECT vd.k, i.id
FROM veh_data vd
JOIN ins i ON i.make = vd.make AND i.model = vd.model AND i.year = vd.year;

-- 3) Insert 5 appointments and capture their IDs keyed by status
CREATE TEMP TABLE appt_anchors (
  status TEXT PRIMARY KEY,
  id     INTEGER NOT NULL
) ON COMMIT DROP;

WITH slots AS (
  SELECT 
    date_trunc('day', now()) + interval '9 hour'  AS s1_start,
    date_trunc('day', now()) + interval '10 hour' AS s1_end,
    date_trunc('day', now()) + interval '11 hour' AS s2_start,
    date_trunc('day', now()) + interval '12 hour' AS s2_end,
    date_trunc('day', now()) + interval '13 hour' AS s3_start,
    date_trunc('day', now()) + interval '14 hour' AS s3_end,
    date_trunc('day', now()) + interval '15 hour' AS s4_start,
    date_trunc('day', now()) + interval '16 hour' AS s4_end,
    date_trunc('day', now()) + interval '17 hour' AS s5_start,
    date_trunc('day', now()) + interval '18 hour' AS s5_end
), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes)
  SELECT (SELECT id FROM tmp_customers WHERE k='C1'), (SELECT id FROM tmp_vehicles WHERE k='V1'), 'SCHEDULED', s1_start, s1_end, 256.65, 0, NULL, NULL, 'Brake pads (front)', NULL
  FROM slots
  UNION ALL
  SELECT (SELECT id FROM tmp_customers WHERE k='C2'), (SELECT id FROM tmp_vehicles WHERE k='V2'), 'IN_PROGRESS', s2_start, s2_end, 180.00, 0, s2_start, NULL, '60k service', NULL
  FROM slots
  UNION ALL
  SELECT (SELECT id FROM tmp_customers WHERE k='C3'), (SELECT id FROM tmp_vehicles WHERE k='V3'), 'READY', s3_start, s3_end, 712.10, 0, s3_start, NULL, 'Battery & alternator', NULL
  FROM slots
  UNION ALL
  SELECT (SELECT id FROM tmp_customers WHERE k='C4'), (SELECT id FROM tmp_vehicles WHERE k='V4'), 'COMPLETED', s4_start, s4_end, 5240.00, 5240.00, s4_start, s4_end, 'Front brakes + rotors', NULL
  FROM slots
  UNION ALL
  SELECT (SELECT id FROM tmp_customers WHERE k='C5'), (SELECT id FROM tmp_vehicles WHERE k='V5'), 'NO_SHOW', s5_start, s5_end, NULL, 0, NULL, NULL, 'Diagnostics', NULL
  FROM slots
  RETURNING id, status
)
INSERT INTO appt_anchors(status, id)
SELECT status, id FROM ins;

-- 4) Services
INSERT INTO appointment_services (id, appointment_id, name, notes, estimated_hours, estimated_price, category, created_at)
SELECT gen_random_uuid(), a.id, 'Front brake pad replacement', NULL, 1.5, 180.00, 'Brakes', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Brake pads (front)', 'OEM preferred', NULL, 62.50, 'Brakes', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Comprehensive 60k service', NULL, 2.0, 180.00, 'Maintenance', now()
FROM appt_anchors a WHERE a.status = 'IN_PROGRESS'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Charging system diagnosis', NULL, 1.0, 120.00, 'Electrical', now()
FROM appt_anchors a WHERE a.status = 'READY'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Rotor + pad kit', NULL, 3.0, 5100.00, 'Brakes', now()
FROM appt_anchors a WHERE a.status = 'COMPLETED'
UNION ALL
SELECT gen_random_uuid(), a.id, 'Initial diagnostics', NULL, 1.0, NULL, 'Diagnostic', now()
FROM appt_anchors a WHERE a.status = 'NO_SHOW';

-- 5) Payment for the COMPLETED job
INSERT INTO payments (id, appointment_id, amount, method, note, created_at)
SELECT gen_random_uuid(), a.id, 5240.00, 'cash', 'paid in full', now()
FROM appt_anchors a WHERE a.status = 'COMPLETED';

-- 6) Outbound message on the SCHEDULED job
INSERT INTO messages (id, appointment_id, channel, direction, body, status, sent_at)
SELECT gen_random_uuid(), a.id, 'sms', 'out',
       'Your estimate is $256.65. Reply YES to approve.',
       'delivered', now()
FROM appt_anchors a WHERE a.status = 'SCHEDULED';

-- 7) Checklist + one item on the IN_PROGRESS job
WITH chk AS (
  INSERT INTO inspection_checklists (id, appointment_id, title, created_at)
  SELECT gen_random_uuid(), a.id, 'Vehicle Check-in', now()
  FROM appt_anchors a WHERE a.status = 'IN_PROGRESS'
  RETURNING id
)
INSERT INTO inspection_items (id, checklist_id, label, status, notes)
SELECT gen_random_uuid(), id, 'Headlights', 'pass', NULL FROM chk;

COMMIT;
