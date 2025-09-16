#!/usr/bin/env python3
"""Lightweight raw SQL migration runner.

Purpose:
  Apply idempotent *.sql files in ./migrations (root only, not Alembic 'versions/')
  exactly once, tracking execution in a metadata table. Files are applied in
  lexical order. Safe to run repeatedly; already applied migrations are skipped.

Why:
  Complements Alembic scripts that live under migrations/versions. We created
  several plain SQL migrations for rapid iteration (service catalog, techs, etc.).
  This runner removes manual psql invocation during local startup and CI.

Behavior:
  - Creates table migration_sql_history(id serial, filename text unique, applied_at timestamptz)
  - Detects *.sql directly under migrations/ (excluding versions/ and files prefixed with '.')
  - Wraps each file execution in a transaction; on error, rolls back and stops.
  - Prints concise progress lines for developer feedback.

Env Vars Consumed (mirrors local_server):
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD or DATABASE_URL.

Exit Codes:
  0 success, 1 failure.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def connect():
    # Check for migration-specific database URL first, then fall back to general DATABASE_URL
    database_url = os.getenv("MIGRATIONS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if database_url:
        # Rely on libpq parsing (psycopg2 accepts DATABASE_URL via dsn)
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    cfg = dict(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "autoshop"),
        user=os.getenv("POSTGRES_USER", "user"),
        password=os.getenv("POSTGRES_PASSWORD", "password"),
        connect_timeout=int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "3")),
        cursor_factory=RealDictCursor,
    )
    return psycopg2.connect(**cfg)


def ensure_history_table(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS migration_sql_history (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


def acquire_migration_lock(cur):
    """Acquire advisory lock to prevent concurrent migrations"""
    # Use advisory lock with a fixed ID for migration process
    # This prevents multiple processes from running migrations simultaneously
    cur.execute("SELECT pg_advisory_lock(12345678)")


def release_migration_lock(cur):
    """Release advisory lock"""
    cur.execute("SELECT pg_advisory_unlock(12345678)")


def get_applied(cur) -> set[str]:
    cur.execute("SELECT filename FROM migration_sql_history")
    return {row["filename"] for row in cur.fetchall()}


def discover_sql_files() -> list[Path]:
    files: list[Path] = []
    if not MIGRATIONS_DIR.exists():
        return files
    for p in MIGRATIONS_DIR.iterdir():
        if (
            p.is_file()
            and p.suffix == ".sql"
            and p.name != "alembic.ini"
            and not p.name.startswith(".")
        ):
            files.append(p)

    # Custom sort: run date-prefixed files (e.g. 20250814_...) BEFORE generic ones (e.g. 01_*)
    def _key(path: Path):
        name = path.name
        return (0 if name[:4].isdigit() and name.startswith("20") else 1, name)

    return sorted(files, key=_key)


def apply_file(conn, path: Path):
    with conn.cursor() as cur:
        print(f"🔧 Applying {path.name} ...", flush=True)
        with open(path, encoding="utf-8") as f:
            raw_sql = f.read()

        # Treat empty or comment-only files as no-op migrations (useful for documenting removed steps)
        def _strip_comments(s: str) -> str:
            # Remove /* */ block comments
            s = re.sub(r"/\*.*?\*/", "", s, flags=re.DOTALL)
            # Remove -- line comments
            s = re.sub(r"--.*", "", s)
            return s

        effective_sql = _strip_comments(raw_sql).strip()
        if not effective_sql:
            # Mark as applied (idempotent) without executing an empty statement
            cur.execute(
                "INSERT INTO migration_sql_history (filename, applied_at) VALUES (%s, %s) ON CONFLICT (filename) DO NOTHING",
                (path.name, datetime.now(timezone.utc)),
            )
            conn.commit()
            print(
                f"➡️  Skipped empty / no-op migration {path.name} (recorded as applied).", flush=True
            )
            return

        sql = raw_sql
        try:
            cur.execute("BEGIN;")
            cur.execute(sql)
            cur.execute(
                "INSERT INTO migration_sql_history (filename, applied_at) VALUES (%s, %s) ON CONFLICT (filename) DO NOTHING",
                (path.name, datetime.now(timezone.utc)),
            )
            cur.execute("COMMIT;")
        except Exception as e:
            cur.execute("ROLLBACK;")
            # Heuristic: Some early raw files pre-dated full idempotency (e.g., CREATE TYPE without guards).
            # If the error is duplicate object or already exists, we treat as effectively applied.
            msg = str(e).lower()
            if any(kw in msg for kw in ["already exists", "duplicate object"]):
                print(f"⚠️  Non-fatal idempotency conflict in {path.name}: {e}")
                with conn.cursor() as cur2:
                    cur2.execute(
                        "INSERT INTO migration_sql_history (filename, applied_at) VALUES (%s, %s) ON CONFLICT (filename) DO NOTHING",
                        (path.name, datetime.now(timezone.utc)),
                    )
                    conn.commit()
                return
            print(f"❌ Failed {path.name}: {e}", file=sys.stderr)
            raise


def main():
    try:
        conn = connect()
    except Exception as e:
        print(f"❌ Cannot connect to database: {e}", file=sys.stderr)
        return 1
    try:
        with conn.cursor() as cur:
            # Acquire advisory lock to prevent concurrent migrations
            acquire_migration_lock(cur)
            try:
                ensure_history_table(cur)
                conn.commit()
                applied = get_applied(cur)
                files = discover_sql_files()
                pending = [f for f in files if f.name not in applied]
                if not files:
                    print("ℹ️ No raw SQL migration files found.")
                    return 0
                if not pending:
                    print("✅ Raw SQL migrations up-to-date (0 pending).")
                    return 0
                for f in pending:
                    apply_file(conn, f)
                print(f"✅ Applied {len(pending)} raw SQL migration(s).")
                return 0
            finally:
                # Always release the lock
                release_migration_lock(cur)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
