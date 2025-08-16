-- Composite index to optimize analytics queries filtering by time range and grouping by template/channel
-- Safe / idempotent: IF NOT EXISTS guards.

BEGIN;
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE c.relkind = 'i'
			AND c.relname = 'idx_template_usage_range'
	) THEN
		EXECUTE 'CREATE INDEX idx_template_usage_range ON template_usage_events (sent_at, template_id, channel)';
	END IF;
END $$;
COMMIT;

-- Down (development only)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_template_usage_range;
-- COMMIT;
