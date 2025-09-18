-- Migration: Vehicle Management System - Phase 1 Schema Updates
-- Date: 2025-09-17
-- Purpose: Add vehicle management columns and performance indexes for vehicle linkage system
--
-- PRD Reference: Vehicle Management & Linkage System for Quick Add Appointments
-- Phase 1, Task 1: Update database schema with new columns and performance indexes

BEGIN;

-- Add new columns to the vehicles table (SQLite-compatible syntax)
ALTER TABLE vehicles ADD COLUMN is_active BOOLEAN DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN last_service_date DATE;
ALTER TABLE vehicles ADD COLUMN total_services INTEGER DEFAULT 0;

-- Add updated_at timestamp column for audit trail
ALTER TABLE vehicles ADD COLUMN updated_at TIMESTAMP;

-- Update existing records with default values
UPDATE vehicles SET is_active = 1 WHERE is_active IS NULL;
UPDATE vehicles SET total_services = 0 WHERE total_services IS NULL;

-- Add indexes for faster lookups during customer/vehicle operations
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);

-- Add index for active vehicles (performance optimization)
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

COMMIT;

-- Verification queries (run after migration)
-- SELECT sql FROM sqlite_master WHERE name='vehicles' AND type='table';
-- PRAGMA index_list(vehicles);
-- PRAGMA table_info(vehicles);
