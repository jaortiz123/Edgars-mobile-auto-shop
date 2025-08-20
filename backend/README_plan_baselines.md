# Plan Baselines (Phase B)

This folder now contains the baseline snapshot script for plan regression detection.

## Components

- `plan_hashing.py` (added earlier): Normalizes `EXPLAIN (FORMAT JSON)` output and produces deterministic SHA1 `plan_id`.
- `run_plan_baseline_snapshot.py`: Nightly (or on-demand) script which:
  1. Ensures `plan_baselines` table exists (idempotent inline DDL for bootstrap).
  2. Iterates a curated HOT_QUERIES list (query_key, sql text).
  3. Computes `plan_id` for each via `EXPLAIN` normalization.
  4. Executes the query N times (default 5) collecting elapsed ms.
  5. Calculates p50 and p95 (approximate) and captures selected planner GUCs.
  6. UPSERTs a row into `plan_baselines`.

## Table Schema (Bootstrap Version)

```sql
CREATE TABLE plan_baselines (
  query_key TEXT PRIMARY KEY,
  plan_id CHAR(40) NOT NULL,
  p50_ms NUMERIC(10,2) NOT NULL,
  p95_ms NUMERIC(10,2) NOT NULL,
  sample_n INTEGER NOT NULL,
  planner_seed INTEGER NULL,
  random_page_cost TEXT NULL,
  effective_cache_size TEXT NULL,
  work_mem TEXT NULL,
  jit TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Extending HOT_QUERIES

Edit `HOT_QUERIES` in `run_plan_baseline_snapshot.py`. Query keys should be stable identifiers (snake_case) representing functional query intent, not literal SQL, so they persist across minor SQL edits.

## Scheduling

Add a cron entry (example daily at 02:10):

```cron
10 2 * * * /path/to/venv/bin/python -m backend.run_plan_baseline_snapshot >> /var/log/plan_baseline.log 2>&1
```

## Next Steps (Future Tasks)

- Integrate real latency histograms from production telemetry instead of ad‑hoc timing loop.
- Capture `planner_seed` if set explicitly.
- Add regression detector comparing current `plan_id` + latency deltas vs baseline with alerting.
- Store explain JSON snapshot for diffing (separate large-text or compressed column / side table).
- Introduce change reason tracking and manual baseline approval workflow.
