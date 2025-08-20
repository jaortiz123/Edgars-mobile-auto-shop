#!/usr/bin/env python3
"""Daily database bloat check.

Features:
- Checks table + index bloat for hot write tables: invoices, invoice_line_items, appointments.
- Uses pgstattuple for precise measurements when available.
- Falls back to pg_stat_all_tables (approximation: dead_tup/(live+dead)).
- Thresholds: table bloat >20% OR any index bloat >30% => CRITICAL.
- Supports simulation mode (for CI / dry-run) via --simulate {healthy,bloated,custom}.
- Exits non‑zero (2) on CRITICAL, 0 otherwise.

Environment (any one of):
  DB_DSN (full psycopg2 DSN) OR individual PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE.

Example cron entry (UTC 02:15 daily):
  15 2 * * * /usr/bin/env python /app/backend/check_db_bloat.py >> /var/log/bloat_check.log 2>&1
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from typing import List, Optional, Tuple

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except Exception:  # pragma: no cover - module resolution error surfaced in runtime logs
    psycopg2 = None  # type: ignore

TABLES = ["invoices", "invoice_line_items", "appointments"]
TABLE_BLOAT_THRESHOLD = 20.0  # percent
INDEX_BLOAT_THRESHOLD = 30.0  # percent

LOGGER = logging.getLogger("db_bloat_check")
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
LOGGER.addHandler(_handler)
LOGGER.setLevel(logging.INFO)


@dataclass
class TableBloat:
    table: str
    table_bloat_pct: float
    index_bloat: List[Tuple[str, float]]  # (index_name, pct)
    method: str  # 'pgstattuple' | 'approx' | 'simulated'

    @property
    def max_index_bloat(self) -> Optional[float]:
        return max((p for _, p in self.index_bloat), default=None)


def build_dsn() -> Optional[str]:
    if os.getenv("DB_DSN"):
        return os.getenv("DB_DSN")
    parts = {
        "host": os.getenv("PGHOST"),
        "port": os.getenv("PGPORT"),
        "user": os.getenv("PGUSER"),
        "password": os.getenv("PGPASSWORD"),
        "dbname": os.getenv("PGDATABASE"),
    }
    if not parts["host"]:
        return None
    return " ".join(f"{k}={v}" for k, v in parts.items() if v)


def simulate(mode: str) -> List[TableBloat]:
    if mode == "healthy":
        return [
            TableBloat(t, table_bloat_pct=5.0, index_bloat=[(f"{t}_pkey", 8.0)], method="simulated")
            for t in TABLES
        ]
    if mode == "bloated":
        return [
            TableBloat("invoices", 12.0, [("invoices_pkey", 18.0)], "simulated"),
            TableBloat(
                "invoice_line_items", 24.5, [("invoice_line_items_pkey", 12.0)], "simulated"
            ),  # table bloat breach
            TableBloat(
                "appointments", 9.0, [("appointments_pkey", 36.2)], "simulated"
            ),  # index bloat breach
        ]
    # custom: allow environment overrides per table like SIM_BLOAT_invoices=25, SIM_IDX_invoices_pkey=40
    results: List[TableBloat] = []
    for t in TABLES:
        tb = float(os.getenv(f"SIM_BLOAT_{t}", "10"))
        idx_name = f"{t}_pkey"
        ib = float(os.getenv(f"SIM_IDX_{idx_name}", "10"))
        results.append(TableBloat(t, tb, [(idx_name, ib)], "simulated"))
    return results


def fetch_with_pgstattuple(cur, table: str) -> Optional[TableBloat]:
    try:
        cur.execute("SELECT * FROM pg_catalog.pg_extension WHERE extname='pgstattuple'")
        if not cur.fetchone():
            return None  # extension not installed
        # Table stats
        cur.execute("SELECT * FROM pgstattuple(%s)", (f"public.{table}",))
        trow = cur.fetchone() or {}
        table_len = float(trow.get("table_len", 0) or 0)
        dead_tuple_len = float(trow.get("dead_tuple_len", 0) or 0)
        table_bloat_pct = round(100 * dead_tuple_len / table_len, 2) if table_len else 0.0
        # Indexes
        cur.execute(
            """
            SELECT indexrelid::regclass::text AS index_name
            FROM pg_index WHERE indrelid = %s::regclass
            """,
            (f"public.{table}",),
        )
        index_names = [
            r[0] if isinstance(r, (list, tuple)) else r["index_name"] for r in cur.fetchall()
        ]
        index_bloat: List[Tuple[str, float]] = []
        for idx in index_names:
            try:
                cur.execute("SELECT * FROM pgstattuple(%s)", (idx,))
                irow = cur.fetchone() or {}
                idx_len = float(irow.get("table_len", 0) or 0)
                dead_idx_len = float(irow.get("dead_tuple_len", 0) or 0)
                pct = round(100 * dead_idx_len / idx_len, 2) if idx_len else 0.0
                index_bloat.append((idx, pct))
            except Exception:
                continue
        return TableBloat(table, table_bloat_pct, index_bloat, method="pgstattuple")
    except Exception:
        return None


def fetch_with_approx(cur, table: str) -> Optional[TableBloat]:
    try:
        cur.execute(
            """
            SELECT n_live_tup, n_dead_tup
            FROM pg_stat_all_tables WHERE schemaname='public' AND relname=%s
            """,
            (table,),
        )
        row = cur.fetchone()
        if not row:
            return None
        if isinstance(row, dict):
            live = float(row.get("n_live_tup", 0) or 0)
            dead = float(row.get("n_dead_tup", 0) or 0)
        else:
            live, dead = row  # type: ignore
        denom = live + dead
        pct = round(100 * dead / denom, 2) if denom else 0.0
        return TableBloat(table, pct, [], method="approx")
    except Exception:
        return None


def gather_real_stats() -> List[TableBloat]:
    dsn = build_dsn()
    if not dsn:
        LOGGER.error("No database connection info provided (set DB_DSN or PG* env vars)")
        return []
    if psycopg2 is None:
        LOGGER.error("psycopg2 not available in environment")
        return []
    out: List[TableBloat] = []
    try:
        with psycopg2.connect(dsn, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                for t in TABLES:
                    stat = fetch_with_pgstattuple(cur, t)
                    if not stat:
                        stat = fetch_with_approx(cur, t)
                    if stat:
                        out.append(stat)
    except Exception as exc:  # pragma: no cover
        LOGGER.error("Failed to collect bloat stats: %s", exc)
    return out


def evaluate(results: List[TableBloat]) -> int:
    criticals: List[str] = []
    for r in results:
        if r.table_bloat_pct > TABLE_BLOAT_THRESHOLD:
            criticals.append(
                f"table {r.table} bloat {r.table_bloat_pct:.2f}% > {TABLE_BLOAT_THRESHOLD}%"
            )
        max_idx = r.max_index_bloat
        if max_idx is not None and max_idx > INDEX_BLOAT_THRESHOLD:
            offenders = [
                f"{name}:{pct:.2f}%" for name, pct in r.index_bloat if pct > INDEX_BLOAT_THRESHOLD
            ]
            if offenders:
                criticals.append(
                    f"index {r.table} [{', '.join(offenders)}] > {INDEX_BLOAT_THRESHOLD}%"
                )
    if criticals:
        for line in criticals:
            LOGGER.critical("BLOAT_THRESHOLD_EXCEEDED %s", line)
        return 2
    LOGGER.info(
        "BLOAT_CHECK_OK all tables within thresholds (table<=%.1f%% index<=%.1f%%)",
        TABLE_BLOAT_THRESHOLD,
        INDEX_BLOAT_THRESHOLD,
    )
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Daily DB bloat check")
    parser.add_argument(
        "--simulate", choices=["healthy", "bloated", "custom"], help="Return simulated results"
    )
    args = parser.parse_args(argv)

    if args.simulate:
        results = simulate(args.simulate)
    else:
        results = gather_real_stats()
        if not results:
            LOGGER.warning("No results gathered (connection or permission issue?)")
            return 0  # do not page on collection failure; infra alert should handle

    for r in results:
        LOGGER.debug(
            "RESULT table=%s method=%s table_bloat=%.2f max_index_bloat=%s",
            r.table,
            r.method,
            r.table_bloat_pct,
            r.max_index_bloat,
        )
    return evaluate(results)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
