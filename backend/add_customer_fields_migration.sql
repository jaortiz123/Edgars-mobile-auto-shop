-- Migration to add missing customer fields for PR1 Edit Customer functionality
-- Updates customers table to support full PR1 specification

-- Add full_name column (keeping name for backward compatibility initially)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add tags as JSONB array
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add notes field
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing records to use name as full_name if full_name is null
UPDATE customers SET full_name = name WHERE full_name IS NULL;

-- Create index for tags searches
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);

-- Add comment for future reference
COMMENT ON COLUMN customers.full_name IS 'Customer full name (replaces name field)';
COMMENT ON COLUMN customers.tags IS 'Customer tags as JSONB array, e.g. ["vip", "loyal"]';
COMMENT ON COLUMN customers.notes IS 'Internal notes about the customer';
