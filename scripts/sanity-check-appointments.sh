#!/bin/bash
# Sanity checks for appointment schema before RDS migration
# Run this locally first, then against RDS before applying migrations

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get database URL - use local by default
DB_URL="${1:-postgres://postgres:postgres@localhost:5432/edgar_db}"

echo -e "${YELLOW}🔍 Running appointment schema sanity checks...${NC}"
echo -e "${YELLOW}Database: ${DB_URL}${NC}"
echo

# 1. Check column types
echo -e "${YELLOW}📋 Checking appointment time columns and types...${NC}"
psql "$DB_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='appointments'
  AND column_name IN ('start_ts','end_ts','appointment_date','scheduled_at')
ORDER BY column_name;
"

# 2. Check constraints
echo -e "${YELLOW}🔒 Checking time bounds constraint...${NC}"
psql "$DB_URL" -c "
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%time_bounds%';
"

# 3. Check indexes for performance queries
echo -e "${YELLOW}📊 Checking performance indexes...${NC}"
psql "$DB_URL" -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'appointments'
  AND indexname ~ '(customer|vehicle).*time';
"

# 4. Test constraint enforcement (should fail)
echo -e "${YELLOW}⚠️  Testing time bounds constraint (should fail)...${NC}"
CONSTRAINT_TEST=$(psql "$DB_URL" -tAc "
INSERT INTO appointments(id, customer_id, start_ts, end_ts)
VALUES (999999, 1, NOW(), NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;
SELECT 'CONSTRAINT_FAILED' WHERE NOT EXISTS (
  SELECT 1 FROM appointments WHERE id = 999999
);
" 2>&1 || echo "CONSTRAINT_WORKED")

if echo "$CONSTRAINT_TEST" | grep -q "CONSTRAINT_WORKED"; then
    echo -e "${GREEN}✅ Time bounds constraint is working${NC}"
else
    echo -e "${RED}❌ Time bounds constraint may not be working${NC}"
fi

# Clean up test record
psql "$DB_URL" -c "DELETE FROM appointments WHERE id = 999999;" >/dev/null 2>&1 || true

# 5. Check sample data quality
echo -e "${YELLOW}📈 Checking data quality...${NC}"
psql "$DB_URL" -c "
SELECT
  COUNT(*) as total_appointments,
  COUNT(start_ts) as with_start_ts,
  COUNT(end_ts) as with_end_ts,
  COUNT(appointment_date) as with_appointment_date,
  COUNT(CASE WHEN start_ts >= end_ts THEN 1 END) as invalid_time_ranges
FROM appointments;
"

# 6. Test index usage (if we have data)
echo -e "${YELLOW}🚀 Testing index usage on customer query...${NC}"
psql "$DB_URL" -c "
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, start_ts, end_ts
FROM appointments
WHERE customer_id = 1
ORDER BY start_ts DESC, id DESC
LIMIT 5;
"

echo -e "${GREEN}✅ Sanity checks complete${NC}"
echo
echo -e "${YELLOW}💡 Before RDS migration:${NC}"
echo -e "   1. Take an RDS snapshot"
echo -e "   2. Run this script against RDS: $0 'your-rds-connection-string'"
echo -e "   3. Apply migrations with MIGRATIONS_USE_REMOTE_DB=true"
echo -e "   4. Run this script again to verify"
