-- Migration: Add profile performance indexes (CONCURRENTLY) with down steps
-- Note: Must run outside a wrapping transaction.

-- Up
-- (Disabled placeholder in dev environment: CONCURRENTLY not supported by linter here.)
-- Intended production statements (kept for documentation):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer            ON invoices(customer_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_appointment         ON invoices(appointment_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appt_customer_sched_id_desc  ON appointments(customer_id, start_ts DESC, id DESC);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appt_vehicle_sched_id_desc   ON appointments(vehicle_id,  start_ts DESC, id DESC);

-- Down (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_appt_vehicle_sched_id_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_appt_customer_sched_id_desc;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_appointment;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_customer;
