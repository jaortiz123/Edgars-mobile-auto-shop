-- Migration: Add indexes to support unified customer profile endpoint
-- Date: 2025-08-18
-- Idempotent (IF NOT EXISTS) for safety on repeated deploys

-- Safe: won't error if the index was created earlier by seed/manual/migration reruns
CREATE INDEX IF NOT EXISTS idx_appt_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appt_customer_start_desc ON appointments(customer_id, start_ts DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_appt_vehicle_start_desc ON appointments(vehicle_id, start_ts DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
-- Additional index to support invoice lookup by appointment for pagination / joins
CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON invoices(appointment_id);
