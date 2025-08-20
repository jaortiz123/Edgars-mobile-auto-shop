"""Plan hashing helper (Phase B - Plan Regression Detection).

Given a SQL text, obtains EXPLAIN (FORMAT JSON) and produces a stable SHA1 hash
of the normalized plan where volatile attributes are removed.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict

from . import local_server as srv  # type: ignore

VOLATILE_KEYS = {
    "Actual Startup Time",
    "Actual Total Time",
    "Actual Rows",
    "Actual Loops",
    "Rows Removed by Filter",
    "Rows Removed by Join Filter",
    "Plan Width",  # optional depending on stability preference
    "JIT",  # entire JIT object can vary
}

# Regex patterns for ephemeral values inside node strings (e.g., cost=.. rows=.. width=..)
COST_PATTERN = re.compile(r"cost=([0-9\.]+)\.\.([0-9\.]+)")
ROWS_PATTERN = re.compile(r"rows=\d+")
WIDTH_PATTERN = re.compile(r"width=\d+")


def _normalize_node(node: Any) -> Any:
    if isinstance(node, dict):
        clean: Dict[str, Any] = {}
        for k, v in node.items():
            if k in VOLATILE_KEYS:
                continue
            if k == "Plans" and isinstance(v, list):
                clean[k] = [_normalize_node(p) for p in v]
            elif isinstance(v, (dict, list)):
                clean[k] = _normalize_node(v)
            elif isinstance(v, str):
                # Scrub volatile inline attributes
                s = COST_PATTERN.sub("cost=X..Y", v)
                s = ROWS_PATTERN.sub("rows=N", s)
                s = WIDTH_PATTERN.sub("width=W", s)
                clean[k] = s
            else:
                clean[k] = v
        # Sort keys deterministically
        return {k: clean[k] for k in sorted(clean)}
    if isinstance(node, list):
        return [_normalize_node(x) for x in node]
    return node


def compute_plan_id(sql: str, conn=None) -> str:
    """Return stable SHA1 for normalized plan JSON.

    Caller may supply an existing connection; otherwise a new one is created.
    """
    owns_conn = False
    if conn is None:
        conn = srv.db_conn()
        owns_conn = True
    try:
        with conn.cursor() as cur:
            cur.execute(f"EXPLAIN (FORMAT JSON) {sql}")
            row = cur.fetchone()
            if not row:
                raise RuntimeError("No EXPLAIN output")
            plan_json = row[0]
            norm = _normalize_node(plan_json)
            encoded = json.dumps(norm, sort_keys=True, separators=(",", ":")).encode()
            return hashlib.sha1(encoded).hexdigest()
    finally:
        if owns_conn and conn:
            try:
                conn.close()
            except Exception:
                pass
