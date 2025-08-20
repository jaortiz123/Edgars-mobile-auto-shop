#!/usr/bin/env python3
"""Measure write amplification for hot write tables.

Definition (initial baseline version):
  write_amplification = (n_tup_ins + n_tup_upd + n_tup_del) / total_block_writes

Where total_block_writes is the sum of heap + index + toast + toast index blocks written as
reported by pg_statio_all_tables. This provides a coarse ratio of logical row-level
mutation operations to physical block write activity. A higher ratio can indicate
efficient packing (many logical ops per physical write) while a lower ratio may
signal churn / fragmentation (or simply low activity so far).

Tables monitored: invoices, invoice_line_items, appointments.

Data Sources:
  - pg_stat_all_tables  (logical tuple counters)
  - pg_statio_all_tables (block write counters)

Environment (any one of):
  DB_DSN OR PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE

Exit Codes:
  0 on success (metrics printed)
  0 on connection failure (we *log* the issue but do not fail CI at this stage)

This is a baseline instrumentation script; thresholds / alerting will be layered later.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from typing import List, Optional

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except Exception:  # pragma: no cover
    psycopg2 = None  # type: ignore

TABLES = ["invoices", "invoice_line_items", "appointments"]
LOGGER = logging.getLogger("write_amp")
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
LOGGER.addHandler(_handler)
LOGGER.setLevel(logging.INFO)


@dataclass
class WriteAmpMetric:
    table: str
    logical_ops: int
    block_writes: int
    ratio: Optional[float]  # None when block_writes == 0
    method: str = "statio_v1"

    def to_line(self) -> str:
        ratio_str = f"{self.ratio:.4f}" if self.ratio is not None else "NA"
        return (
            f"WRITE_AMP table={self.table} logical_ops={self.logical_ops} "
            f"block_writes={self.block_writes} ratio={ratio_str} method={self.method}"
        )


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


def fetch_metrics() -> List[WriteAmpMetric]:
    dsn = build_dsn()
    if not dsn:
        LOGGER.error("No database connection info provided (set DB_DSN or PG* env vars)")
        return []
    if psycopg2 is None:
        LOGGER.error("psycopg2 module not available")
        return []

    sql = """
    SELECT
        s.relname AS table_name,
        s.n_tup_ins,
        s.n_tup_upd,
        s.n_tup_del,
        COALESCE(io.heap_blks_written,0) AS heap_blks_written,
        COALESCE(io.idx_blks_written,0) AS idx_blks_written,
        COALESCE(io.toast_blks_written,0) AS toast_blks_written,
        COALESCE(io.tidx_blks_written,0) AS tidx_blks_written
    FROM pg_stat_all_tables s
    JOIN pg_statio_all_tables io ON s.relid = io.relid
    WHERE s.schemaname='public' AND s.relname = ANY(%s)
    ORDER BY s.relname
    """

    out: List[WriteAmpMetric] = []
    try:
        with psycopg2.connect(dsn, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (TABLES,))
                for row in cur.fetchall():
                    logical_ops = (
                        int(row["n_tup_ins"]) + int(row["n_tup_upd"]) + int(row["n_tup_del"])
                    )
                    block_writes = (
                        int(row["heap_blks_written"])
                        + int(row["idx_blks_written"])
                        + int(row["toast_blks_written"])
                        + int(row["tidx_blks_written"])
                    )
                    ratio: Optional[float]
                    if block_writes > 0:
                        ratio = logical_ops / block_writes
                    else:
                        ratio = None
                    out.append(WriteAmpMetric(row["table_name"], logical_ops, block_writes, ratio))
    except Exception as exc:  # pragma: no cover
        LOGGER.error("Failed to collect write amplification metrics: %s", exc)
    return out


def simulate() -> List[WriteAmpMetric]:
    # Deterministic fixed numbers for demonstration / tests.
    demo = [
        WriteAmpMetric("invoices", 1200, 150, 1200 / 150 if 150 else None, method="simulated"),
        WriteAmpMetric(
            "invoice_line_items", 4800, 500, 4800 / 500 if 500 else None, method="simulated"
        ),
        WriteAmpMetric("appointments", 300, 40, 300 / 40 if 40 else None, method="simulated"),
    ]
    return demo


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Measure write amplification ratios")
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Emit deterministic simulated metrics (offline mode)",
    )
    args = parser.parse_args(argv)

    metrics = simulate() if args.simulate else fetch_metrics()
    if not metrics:
        LOGGER.warning("No metrics gathered")
        return 0

    for m in metrics:
        print(m.to_line())

    # Summary line for quick grep / dashboard parsing
    avg_ratio_values = [m.ratio for m in metrics if m.ratio is not None]
    if avg_ratio_values:
        avg_ratio = sum(avg_ratio_values) / len(avg_ratio_values)
        print(f"WRITE_AMP_SUMMARY tables={len(metrics)} avg_ratio={avg_ratio:.4f}")
    else:
        print(f"WRITE_AMP_SUMMARY tables={len(metrics)} avg_ratio=NA")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
