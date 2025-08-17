# Service Catalog Seed (Phase 1)

This directory contains the Phase 1 foundation assets for the evolving service catalog.

## Files

- `service_catalog_master.csv` – authoritative list (~50) of normalized services.
- `generate_seed_v2.py` – generator producing `seed_v2_catalog.sql` matching the **current** lean schema.
- `seed_v2_catalog.sql` – generated output (not committed until produced locally).

## Workflow

1. Edit / append rows in `service_catalog_master.csv` (keep header as-is).
1. Run the generator:

```bash
python3 backend/catalog_seed/generate_seed_v2.py
```

1. Apply to a fresh / sandbox database (DO NOT blindly apply to prod with existing data):

```bash
psql "$DATABASE_URL" -f backend/catalog_seed/seed_v2_catalog.sql
```

## Data Rules

- `internal_code`: unique, acts as `id` pre-migration.
- `category`: one of the 10 Phase 1 categories. Enforced by generator.
- `keywords`: comma-separated; generator converts to Postgres text[] literal.
- `default_price_cents`: integer (labor list). Converted to decimal `base_labor_rate`.
- Hours: `min_hours`, `typical_hours`, `max_hours` derived (0.6x / 1.0x / 1.4x with lower bound +0.25 slack rule).
- `skill_level` >=4 marks `requires_senior_tech=true`.

## Post-Migration (Phase 2)

After adding `internal_code`, `subcategory`, `display_order`, switch `SCHEMA_MODE` to `rich` and extend `row_to_insert_rich` accordingly.

## QA Checklist (Phase 1)

- [ ] No duplicate `internal_code` values.
- [ ] All categories valid.
- [ ] Generated SQL runs cleanly (no constraint errors) on empty DB.
- [ ] Spot-check a few services for correct hour derivation & base labor rate.
- [ ] Search endpoint returns new services (verify 2-3 queries).

## Future Enhancements

- Add optional validation script that loads both CSV & generated SQL and performs a dry-run parse.
- Introduce `subcategory` & `display_order` columns to CSV (behind a feature flag) prior to Phase 2 migration.
