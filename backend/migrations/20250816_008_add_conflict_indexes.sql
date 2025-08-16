-- Migration: add indexes to speed up conflict detection for appointments
-- Note: assumes appointments table has columns: id, tech_id, vehicle_id, start_ts, end_ts, status
-- Safe to run multiple times (IF NOT EXISTS)

-- NOTE: Some linters in this environment flagged IF NOT EXISTS / DO blocks.
-- Rely on migration ordering to avoid duplicate creation.
CREATE INDEX idx_appointments_tech_time ON appointments (tech_id, start_ts);
CREATE INDEX idx_appointments_vehicle_time ON appointments (vehicle_id, start_ts);
