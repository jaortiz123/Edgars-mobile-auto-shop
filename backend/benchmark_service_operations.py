#!/usr/bin/env python3
"""Benchmark script for /api/admin/service-operations endpoint.

Scenarios:
1. Empty query (?q=)
2. Common query (?q=oil)
3. Substring query (?q=ion)

For each scenario we perform N runs (default 10) and compute average, median,
min, max, and p95 response times in milliseconds.

Usage:
  python benchmark_service_operations.py --base-url http://localhost:5001 \
      --runs 15
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from typing import Any, Dict, List

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover
    print(
        "[benchmark] Missing 'requests' package. Install with: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)

SCENARIOS = [
    ("empty", ""),
    ("common", "oil"),
    ("substring", "ion"),
]


def measure(base_url: str, query: str, timeout: float) -> float:
    url = f"{base_url.rstrip('/')}/api/admin/service-operations"
    params = {"q": query}
    start = time.perf_counter()
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        elapsed = (time.perf_counter() - start) * 1000.0
        if resp.status_code != 200:
            print(f"[warn] Non-200 status {resp.status_code} for q='{query}'", file=sys.stderr)
        # Optionally validate shape
        try:
            data = resp.json()
            if "service_operations" not in data:
                print(f"[warn] Unexpected payload keys: {list(data.keys())}", file=sys.stderr)
        except Exception:
            print("[warn] Response not JSON decodable", file=sys.stderr)
        return elapsed
    except requests.RequestException as e:
        elapsed = (time.perf_counter() - start) * 1000.0
        print(f"[error] Request failed for q='{query}': {e}", file=sys.stderr)
        return elapsed


def summarize(samples: List[float]) -> Dict[str, Any]:
    samples_sorted = sorted(samples)
    return {
        "runs": len(samples),
        "avg_ms": round(sum(samples_sorted) / len(samples_sorted), 2),
        "median_ms": round(statistics.median(samples_sorted), 2),
        "min_ms": round(samples_sorted[0], 2),
        "max_ms": round(samples_sorted[-1], 2),
        "p95_ms": (
            round(samples_sorted[int(len(samples_sorted) * 0.95) - 1], 2)
            if len(samples_sorted) >= 2
            else round(samples_sorted[0], 2)
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--base-url",
        default="http://localhost:5001",
        help="Base URL of running backend (default: %(default)s)",
    )
    ap.add_argument(
        "--runs", type=int, default=10, help="Number of runs per scenario (default: %(default)s)"
    )
    ap.add_argument(
        "--timeout", type=float, default=5.0, help="Request timeout seconds (default: %(default)s)"
    )
    ap.add_argument("--json", action="store_true", help="Output JSON summary only")
    args = ap.parse_args()

    results: Dict[str, Dict[str, Any]] = {}
    print(f"[benchmark] Running {args.runs} runs per scenario against {args.base_url}")
    for label, q in SCENARIOS:
        samples: List[float] = []
        for i in range(args.runs):
            ms = measure(args.base_url, q, args.timeout)
            samples.append(ms)
            print(f"  scenario={label} run={i+1}/{args.runs} q='{q}' took={ms:.2f}ms")
        results[label] = summarize(samples)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print("\n=== Summary ===")
        for k, v in results.items():
            print(
                f"{k}: avg={v['avg_ms']}ms median={v['median_ms']}ms p95={v['p95_ms']}ms min={v['min_ms']}ms max={v['max_ms']}ms runs={v['runs']}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
