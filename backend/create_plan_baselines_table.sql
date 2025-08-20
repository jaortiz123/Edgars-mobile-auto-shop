-- DDL: plan_baselines table (Phase B - Plan Regression Detection)
-- Stores stable normalized plan signature metrics.
-- Adjust types if needed for target Postgres version.

CREATE TABLE IF NOT EXISTS plan_baselines (
    query_key TEXT PRIMARY KEY,              -- logical identifier for hot-path query
    plan_id CHAR(40) NOT NULL,               -- SHA1 of normalized plan JSON
    p50_ms NUMERIC(10,2) NOT NULL,           -- median latency (ms) at snapshot time
    p95_ms NUMERIC(10,2) NOT NULL,           -- p95 latency (ms) at snapshot time
    sample_n INTEGER NOT NULL,               -- number of samples used to compute stats
    planner_seed INTEGER,                    -- captured planner GUCs for reproducibility
    random_page_cost NUMERIC(6,2),
    effective_cache_size TEXT,               -- store raw show all style values if desired
    work_mem TEXT,
    jit TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional supporting index if we later want historical snapshots by (query_key, created_at)
-- CREATE INDEX IF NOT EXISTS plan_baselines_created_at_idx ON plan_baselines (query_key, created_at DESC);
