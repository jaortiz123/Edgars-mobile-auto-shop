## 🧱 Database Migrations (Raw SQL + Alembic)

Two complementary layers manage schema changes:

1. **Alembic (Python)** — Versioned migrations under `backend/migrations/versions/`.
2. **Raw Idempotent SQL** — Timestamped `*.sql` files directly inside `backend/migrations/` (excluding `versions/`).

### Raw SQL Migration Runner

The script `backend/run_sql_migrations.py` is invoked automatically by `./start-dev.sh` after PostgreSQL is healthy. It:

- Applies pending `.sql` files in lexical order.
- Records applied files in `migration_sql_history` (ensuring one-time execution).
- Is safe to re-run (idempotent) and tolerant of legacy duplicate-object errors.

### Add a New Raw Migration

1. Create: `backend/migrations/20250815_005_add_customer_indexes.sql`.
2. Make it idempotent (`IF NOT EXISTS`, guarded `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).
3. Restart `./start-dev.sh` or run `python backend/run_sql_migrations.py`.

### Check Applied Migrations

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT filename, applied_at FROM migration_sql_history ORDER BY applied_at;"
```

### Alembic Commands

```bash
cd backend
make alembic-rev m="add new table"
make alembic-up
```

### CI (Recommended)

Add before running backend tests:

```bash
python backend/run_sql_migrations.py
```

### Choose the Right Tool

| Scenario | Raw SQL | Alembic |
|----------|---------|---------|
| Simple additive column / index | ✅ | ✅ |
| Complex data transform / Python logic | ❌ | ✅ |
| Rapid prototype | ✅ | ❌ |
| Need downgrade path | ❌ | ✅ |

### Future Improvements

- Convert any remaining unguarded legacy statements to idempotent blocks.
- Remove duplicate-object heuristic once all files are hardened.
- Enforce runner success as a CI gate.

---
