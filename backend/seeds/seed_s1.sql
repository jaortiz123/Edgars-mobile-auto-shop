-- Phase-1 service_operations seed inserted (see migration 0f1e2d3c4b5a)
-- If appointments already seeded, run an UPDATE later to backfill primary_operation_id
-- backend/seeds/seed_s1.sql
-- Dashboard SoT seed: exactly 5 complete appointments spread across today (UTC)

BEGIN;
SET TIME ZONE 'UTC';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed service_operations (Phase-1 catalog)
INSERT INTO service_operations (id,name,category,keywords,default_hours,default_price,flags,is_active,replaced_by_id,labor_matrix_code,skill_level)
VALUES
  ('oil-change-synthetic','Full Synthetic Oil Change','Maintenance','{oil,filter,synthetic,premium}',0.50,60.00,'{quick-service,no-appointment}',TRUE,NULL,'EXPRESS',1),
  ('tire-rotation-awd','AWD Tire Rotation','Maintenance','{tire,rotation,all-wheel-drive}',0.75,90.00,'{appointment-recommended}',TRUE,NULL,'STD',2),
  ('brake-inspection-old','Basic Brake Inspection','Brakes','{brake,inspection}',0.50,60.00,'{}',FALSE,'brake-inspection-comprehensive','STD',2),
  ('brake-inspection-comprehensive','Comprehensive Brake Inspection','Brakes','{brake,inspection,safety,comprehensive}',0.75,90.00,'{free-with-service}',TRUE,NULL,'STD',2),
  ('brake-pad-rotor-front','Front Brake Pads & Rotors','Brakes','{pads,rotors,brake-noise}',2.00,280.00,'{safety-critical}',TRUE,NULL,'BRAKE-STD',3),
  ('engine-diagnostic-advanced','Advanced Engine Diagnostics','Diagnostics','{engine,diagnostic,troubleshoot,check-engine}',2.00,300.00,'{requires-test-drive}',TRUE,NULL,'DIAG-A',4),
  ('electrical-diagnostic','Electrical System Diagnostic','Diagnostics','{battery-drain,short,no-start}',1.50,225.00,'{intermittent-possible}',TRUE,NULL,'DIAG-B',4),
  ('transmission-service-cvt','CVT Transmission Service','Transmission','{transmission,cvt,fluid,filter}',2.00,280.00,'{dealer-recommended}',TRUE,NULL,'TRANS-ADV',4),
  ('ac-recharge-r134a','A/C Recharge R-134a','HVAC','{air-conditioning,ac,recharge,r134a}',1.00,130.00,'{seasonal-service}',TRUE,NULL,'HVAC-STD',3),
  ('four-wheel-alignment','4-Wheel Alignment','Suspension','{alignment,pull,tire-wear}',1.00,130.00,'{post-suspension}',TRUE,NULL,'SUSP-ALIGN',3),
  ('strut-assembly-pair','Front Strut Assembly (Pair)','Suspension','{ride-height,clunk,strut}',3.50,507.50,'{alignment-recommended}',TRUE,NULL,'SUSP-ADV',4),
  ('cv-axle-front','Front CV Axle Replacement (Each)','Drivetrain','{cv,clicking,boot}',2.00,280.00,'{alignment-recommended}',TRUE,NULL,'DRIVE-STD',3),
  ('cabin-filter-replacement','Cabin Air Filter Replacement','Maintenance','{filter,cabin,hvac}',0.30,33.00,'{upsell-hvac}',TRUE,NULL,'EXPRESS',1),
  ('spark-plug-replacement','Spark Plug Replacement (4-cyl)','Engine','{tune-up,spark,misfire}',1.50,202.50,'{engine-hot}',TRUE,NULL,'ENG-TUNE',3),
  ('water-pump-replacement','Water Pump Replacement','Cooling','{overheat,coolant-leak,bearing-noise}',2.50,362.50,'{timing-belt-related}',TRUE,NULL,'COOL-ADV',3),
  ('fuel-injector-clean','Fuel Injector Cleaning (Machine-Assisted)','Fuel','{injector,rough-idle,mpg}',1.00,130.00,'{emissions-related}',TRUE,NULL,'FUEL-SVC',2),
  ('cat-converter-replacement','Catalytic Converter Replacement','Emissions','{catalytic,P0420,emissions}',2.50,400.00,'{theft-prone,regulatory}',TRUE,NULL,'EMISS-ADV',4),
  ('hybrid-battery-service','Hybrid Battery Service','Electrical','{hybrid,battery,high-voltage}',3.00,540.00,'{certification-required}',TRUE,NULL,'EV-HIGH',5),
  ('ev-inverter-coolant-flush','EV Inverter/Charger Coolant Service','Electrical','{inverter,coolant,ev}',1.25,212.50,'{oem-spec-only}',TRUE,NULL,'EV-COOL',4),
  ('adas-front-camera-cal','ADAS Front Camera Calibration','Safety','{ADAS,camera,calibration}',2.00,350.00,'{level-floor-required,post-windshield}',TRUE,NULL,'ADAS-CAL',5),
  ('diesel-dpf-regeneration','Diesel DPF Forced Regeneration','Diesel','{DPF,regen,soot}',1.00,165.00,'{hot-exhaust}',TRUE,NULL,'DIESEL-DIAG',4),
  ('safety-inspection','General Safety Inspection','Safety','{inspection,safety,pre-trip}',0.75,90.00,'{paperwork}',TRUE,NULL,'SAFETY',2),
  ('smog-check-obd2','Smog Check (OBD-II)','Emissions','{smog,emissions,obd2}',0.75,97.50,'{regulatory,state-specific}',TRUE,NULL,'EMISS-TEST',3)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  category=EXCLUDED.category,
  keywords=EXCLUDED.keywords,
  default_hours=EXCLUDED.default_hours,
  default_price=EXCLUDED.default_price,
  flags=EXCLUDED.flags,
  is_active=EXCLUDED.is_active,
  replaced_by_id=EXCLUDED.replaced_by_id,
  labor_matrix_code=EXCLUDED.labor_matrix_code,
  skill_level=EXCLUDED.skill_level;

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
  ('C5','Liam Torres','liam.torres@example.com','+1-555-0104','654 Maple Ln'),
  -- Test lookup customer with multiple vehicles for /api/customers/lookup endpoint
  ('LOOK','Lookup Test','lookup.test@example.com','5305555555','777 Lookup Blvd')
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
  ('V5','C5','BMW','328i',2020,'B32-2020-0001','2MNO345'),
  -- Two vehicles for lookup test customer
  ('LV1','LOOK','Lamborghini','Revuelto',2026,'LREV-2026-0001','LOOKUP1'),
  ('LV2','LOOK','Honda','Civic',2024,'CIV-2024-0002','LOOKUP2')
), ins AS (
  INSERT INTO vehicles (customer_id, make, model, year, vin, license_plate)
  SELECT c.id, vd.make, vd.model, vd.year, vd.vin, vd.license_plate
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

CREATE TEMP TABLE slots AS
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
  date_trunc('day', now()) + interval '18 hour' AS s5_end;

-- Insert each appointment separately capturing id
WITH s AS (SELECT * FROM slots), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes, primary_operation_id, service_category)
  SELECT (SELECT id FROM tmp_customers WHERE k='C1'), (SELECT id FROM tmp_vehicles WHERE k='V1'), 'SCHEDULED', s1_start, s1_end, 256.65, 0, NULL, NULL, 'Brake pads (front)', NULL,'brake-pad-rotor-front','Brakes' FROM s
  RETURNING id
)
INSERT INTO appt_anchors(status,id) SELECT 'SCHEDULED', id FROM ins;

WITH s AS (SELECT * FROM slots), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes, primary_operation_id, service_category)
  SELECT (SELECT id FROM tmp_customers WHERE k='C2'), (SELECT id FROM tmp_vehicles WHERE k='V2'), 'IN_PROGRESS', s2_start, s2_end, 180.00, 0, s2_start, NULL, '60k service', NULL,'oil-change-synthetic','Maintenance' FROM s
  RETURNING id
)
INSERT INTO appt_anchors(status,id) SELECT 'IN_PROGRESS', id FROM ins;

WITH s AS (SELECT * FROM slots), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes, primary_operation_id, service_category)
  SELECT (SELECT id FROM tmp_customers WHERE k='C3'), (SELECT id FROM tmp_vehicles WHERE k='V3'), 'READY', s3_start, s3_end, 712.10, 0, s3_start, NULL, 'Battery & alternator', NULL,'electrical-diagnostic','Diagnostics' FROM s
  RETURNING id
)
INSERT INTO appt_anchors(status,id) SELECT 'READY', id FROM ins;

WITH s AS (SELECT * FROM slots), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes, primary_operation_id, service_category)
  SELECT (SELECT id FROM tmp_customers WHERE k='C4'), (SELECT id FROM tmp_vehicles WHERE k='V4'), 'COMPLETED', s4_start, s4_end, 5240.00, 5240.00, s4_start, s4_end, 'Front brakes + rotors', NULL,'brake-pad-rotor-front','Brakes' FROM s
  RETURNING id
)
INSERT INTO appt_anchors(status,id) SELECT 'COMPLETED', id FROM ins;

WITH s AS (SELECT * FROM slots), ins AS (
  INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, check_in_at, check_out_at, title, notes, primary_operation_id, service_category)
  SELECT (SELECT id FROM tmp_customers WHERE k='C5'), (SELECT id FROM tmp_vehicles WHERE k='V5'), 'NO_SHOW', s5_start, s5_end, NULL, 0, NULL, NULL, 'Diagnostics', NULL,'engine-diagnostic-advanced','Diagnostics' FROM s
  RETURNING id
)
INSERT INTO appt_anchors(status,id) SELECT 'NO_SHOW', id FROM ins;

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
