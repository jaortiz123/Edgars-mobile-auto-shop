-- migrations/verify_phase2.sql
-- Verification queries for Phase 2 catalog migration.
-- Run AFTER 01_add_catalog_v2_columns.sql is applied.

-- 1. NULL internal_code count (expect 0)
SELECT COUNT(*) AS null_internal_code_count
FROM service_operations
WHERE internal_code IS NULL;

-- 2. Duplicate internal_codes (expect 0 rows)
SELECT internal_code, COUNT(*) AS dup_count
FROM service_operations
GROUP BY internal_code
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, internal_code;

-- 3. NULL display_order count (expect 0)
SELECT COUNT(*) AS null_display_order_count
FROM service_operations
WHERE display_order IS NULL;

-- 4. Duplicate display_order within a category (expect 0 rows)
SELECT category, display_order, COUNT(*) AS dup_count
FROM service_operations
GROUP BY category, display_order
HAVING COUNT(*) > 1
ORDER BY category, display_order;

-- 5. Sample preview (first 15 rows) to eyeball new columns
SELECT id, name, category, subcategory, internal_code, display_order
FROM service_operations
ORDER BY category, display_order
LIMIT 15;
