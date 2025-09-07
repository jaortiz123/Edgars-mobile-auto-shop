"""Nightly baseline snapshot script (Phase B - Plan Regression Detection).

Executes defined hot-path queries, computes plan_id and stores baseline stats
into plan_baselines table. Latencies (p50/p95) are approximated here via N timed
executions (simple; replace with production-grade histogram later).
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time
from typing import List, Optional, Tuple

# Use absolute import since script may be executed as module (-m backend.run_plan_baseline_snapshot)
try:  # flexible import (package vs direct script execution)
    from backend import local_server as srv  # type: ignore
    from backend.plan_hashing import compute_plan_id  # type: ignore
except Exception:  # pragma: no cover
    import os
    import sys

    here = os.path.dirname(os.path.abspath(__file__))
    parent = os.path.dirname(here)
    if parent not in sys.path:
        sys.path.insert(0, parent)
    try:
        from backend import local_server as srv  # type: ignore
        from backend.plan_hashing import compute_plan_id  # type: ignore
    except Exception:
        from . import local_server as srv  # type: ignore  # type: ignore
        from .plan_hashing import compute_plan_id  # type: ignore

# Define hot path queries (query_key, sql)
HOT_QUERIES: List[Tuple[str, str]] = [
    ("customer_profile", "SELECT id, name, email FROM customers WHERE id = 1"),
    ("vehicle_profile", "SELECT id, customer_id, make, model FROM vehicles WHERE id = 1"),
]

SAMPLES_PER_QUERY = 5

GUC_NAMES = [
    "random_page_cost",
    "effective_cache_size",
    "work_mem",
    "jit",
]


def _fetch_gucs(cur) -> dict:
    gucs = {}
    for name in GUC_NAMES:
        try:
            # Use current_setting with parameter to avoid dynamic identifier interpolation
            cur.execute("SELECT current_setting(%s, true)", (name,))
            row = cur.fetchone()
            val = row[0] if row else None
            gucs[name] = val
        except Exception:
            gucs[name] = None
    return gucs


def _collect_latency(cur, sql: str, samples: int) -> List[float]:
    durations: List[float] = []
    for _ in range(samples):
        t0 = time.perf_counter()
        cur.execute(sql)
        # consume rows to ensure execution
        try:
            _ = cur.fetchall()
        except Exception:
            pass
        durations.append((time.perf_counter() - t0) * 1000.0)
    durations.sort()
    return durations


def _compute_p50_p95(durations: List[float]) -> Tuple[float, float]:
    p50 = statistics.median(durations)
    idx95 = max(0, min(len(durations) - 1, int(round(0.95 * (len(durations) - 1)))))
    p95 = durations[idx95]
    return p50, p95


def run_baseline_mode(samples: int = SAMPLES_PER_QUERY) -> None:
    conn = srv.db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS plan_baselines (
                    query_key TEXT PRIMARY KEY,
                    plan_id CHAR(40) NOT NULL,
                    p50_ms NUMERIC(10,2) NOT NULL,
                    p95_ms NUMERIC(10,2) NOT NULL,
                    sample_n INTEGER NOT NULL,
                    planner_seed INTEGER,
                    random_page_cost TEXT,
                    effective_cache_size TEXT,
                    work_mem TEXT,
                    jit TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            for query_key, sql in HOT_QUERIES:
                plan_id = compute_plan_id(sql, conn)
                durations = _collect_latency(cur, sql, samples)
                p50, p95 = _compute_p50_p95(durations)
                gucs = _fetch_gucs(cur)
                cur.execute(
                    """
                    INSERT INTO plan_baselines (query_key, plan_id, p50_ms, p95_ms, sample_n, planner_seed, random_page_cost, effective_cache_size, work_mem, jit)
                    VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, %s, %s)
                    ON CONFLICT (query_key)
                    DO UPDATE SET plan_id = EXCLUDED.plan_id,
                                  p50_ms = EXCLUDED.p50_ms,
                                  p95_ms = EXCLUDED.p95_ms,
                                  sample_n = EXCLUDED.sample_n,
                                  random_page_cost = EXCLUDED.random_page_cost,
                                  effective_cache_size = EXCLUDED.effective_cache_size,
                                  work_mem = EXCLUDED.work_mem,
                                  jit = EXCLUDED.jit,
                                  created_at = NOW()
                    """,
                    [
                        query_key,
                        plan_id,
                        round(p50, 2),
                        round(p95, 2),
                        len(durations),
                        gucs.get("random_page_cost"),
                        gucs.get("effective_cache_size"),
                        gucs.get("work_mem"),
                        gucs.get("jit"),
                    ],
                )
                print(
                    f"BASELINE UPDATED query_key={query_key} plan_id={plan_id} p50={p50:.2f} p95={p95:.2f}"
                )
            conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _lookup_sql(query_key: str) -> Optional[str]:
    for k, sql in HOT_QUERIES:
        if k == query_key:
            return sql
    return None


def run_detection_mode(query_key: str, threshold: float, samples: int) -> int:
    sql = _lookup_sql(query_key)
    if not sql:
        print(f"ERROR: query_key '{query_key}' not found in HOT_QUERIES")
        return 2
    conn = srv.db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT plan_id, p50_ms, p95_ms FROM plan_baselines WHERE query_key = %s",
                [query_key],
            )
            row = cur.fetchone()
            if not row:
                print(f"NO BASELINE FOUND query_key={query_key}")
                return 3
            baseline_plan_id, baseline_p50, baseline_p95 = row
            live_plan_id = compute_plan_id(sql, conn)
            durations = _collect_latency(cur, sql, samples)
            p50, p95 = _compute_p50_p95(durations)
            p50_delta = (p50 - float(baseline_p50)) / float(baseline_p50) if baseline_p50 else 0.0
            p95_delta = (p95 - float(baseline_p95)) / float(baseline_p95) if baseline_p95 else 0.0
            plan_changed = live_plan_id != baseline_plan_id
            perf_regressed = (p50_delta >= threshold) or (p95_delta >= threshold)
            if plan_changed and perf_regressed:
                reasons = []
                if p50_delta >= threshold:
                    reasons.append(f"p50 +{p50_delta*100:.1f}%")
                if p95_delta >= threshold:
                    reasons.append(f"p95 +{p95_delta*100:.1f}%")
                reason_str = ", ".join(reasons)
                print(
                    "REGRESSION DETECTED "
                    f"query_key={query_key} baseline_plan={baseline_plan_id} live_plan={live_plan_id} "
                    f"baseline_p50={baseline_p50} live_p50={p50:.2f} baseline_p95={baseline_p95} live_p95={p95:.2f} "
                    f"reasons=[plan_changed, {reason_str}]"
                )
                return 1
            else:
                status_bits = []
                status_bits.append("plan_changed" if plan_changed else "plan_same")
                if perf_regressed:
                    status_bits.append("perf_regressed")
                else:
                    status_bits.append("perf_ok")
                print(
                    "OK "
                    f"query_key={query_key} {' '.join(status_bits)} baseline_plan={baseline_plan_id} live_plan={live_plan_id} "
                    f"baseline_p50={baseline_p50} live_p50={p50:.2f} delta_p50={p50_delta*100:.1f}% "
                    f"baseline_p95={baseline_p95} live_p95={p95:.2f} delta_p95={p95_delta*100:.1f}%"
                )
                return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass


def run_demo_outputs():  # pragma: no cover - demonstration helper
    print(
        "OK query_key=customer_profile plan_same perf_ok baseline_plan=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa live_plan=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa baseline_p50=10.0 live_p50=10.3 delta_p50=3.0% baseline_p95=20.0 live_p95=20.5 delta_p95=2.5%"
    )
    print(
        "REGRESSION DETECTED query_key=vehicle_profile baseline_plan=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb live_plan=cccccccccccccccccccccccccccccccccccccccc baseline_p50=12.0 live_p50=13.8 baseline_p95=30.0 live_p95=34.2 reasons=[plan_changed, p50 +15.0%, p95 +14.0%]"
    )


def main():  # pragma: no cover - operational entry
    parser = argparse.ArgumentParser(description="Plan baseline snapshot & regression detector")
    sub = parser.add_subparsers(dest="mode")

    p_base = sub.add_parser("baseline", help="Update/populate baselines")
    p_base.add_argument("--samples", type=int, default=SAMPLES_PER_QUERY)

    p_detect = sub.add_parser("detect", help="Detect regression for a query_key")
    p_detect.add_argument(
        "query_key", help="Query key to check (must exist in HOT_QUERIES and plan_baselines)"
    )
    p_detect.add_argument(
        "--threshold",
        type=float,
        default=0.10,
        help="Regression threshold as fraction (default 0.10 = 10%)",
    )
    p_detect.add_argument(
        "--samples", type=int, default=SAMPLES_PER_QUERY, help="Samples for live timing (default 5)"
    )

    sub.add_parser("demo", help="Print sample OK and REGRESSION outputs without DB access")

    args = parser.parse_args()
    if args.mode == "baseline" or args.mode is None:  # default to baseline for backwards compat
        run_baseline_mode(samples=getattr(args, "samples", SAMPLES_PER_QUERY))
    elif args.mode == "detect":
        rc = run_detection_mode(args.query_key, args.threshold, args.samples)
        sys.exit(rc)
    elif args.mode == "demo":
        run_demo_outputs()
    else:
        parser.error("Unknown mode")


if __name__ == "__main__":  # pragma: no cover
    main()
