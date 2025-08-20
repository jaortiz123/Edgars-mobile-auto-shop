import importlib
import os
import sys
from typing import List

import pytest

MODULE_NAME = "backend.run_plan_baseline_snapshot"


class FakeCursor:
    def __init__(self, baseline_row, expect_baseline_query=True):
        self._baseline_row = baseline_row
        self._baseline_consumed = False
        self.last_sql = None
        self.expect_baseline_query = expect_baseline_query

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):  # pragma: no cover - trivial
        self.last_sql = sql

    def fetchone(self):
        # Only used for baseline SELECT in these tests
        if self._baseline_row is None:
            return None
        if not self._baseline_consumed:
            self._baseline_consumed = True
            return self._baseline_row
        return self._baseline_row  # idempotent for safety

    def fetchall(self):  # not used because latency collector is patched
        return []


class FakeConn:
    def __init__(self, baseline_row):
        self._baseline_row = baseline_row

    def cursor(self):
        return FakeCursor(self._baseline_row)

    def close(self):  # pragma: no cover - trivial
        pass


@pytest.fixture(autouse=True)
def ensure_module_imported():
    # Import (or reload) the module each test to get a clean surface to patch.
    # Ensure project root (one level up from this tests directory) is on path
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)
    if MODULE_NAME in sys.modules:
        del sys.modules[MODULE_NAME]
    mod = importlib.import_module(MODULE_NAME)
    return mod


def _patch(monkeypatch, mod, *, baseline_row, live_plan_id, durations: List[float]):
    # Patch db_conn to return a fake connection with provided baseline row
    monkeypatch.setattr(mod.srv, "db_conn", lambda: FakeConn(baseline_row))
    # Patch compute_plan_id
    monkeypatch.setattr(mod, "compute_plan_id", lambda sql, conn=None: live_plan_id)
    # Patch latency collector to deterministic list
    monkeypatch.setattr(mod, "_collect_latency", lambda cur, sql, samples: list(durations))


def test_detect_ok_plan_same_perf_ok(monkeypatch, ensure_module_imported, capsys):
    mod = ensure_module_imported
    baseline_row = ("plan123", 10.0, 20.0)
    _patch(
        monkeypatch,
        mod,
        baseline_row=baseline_row,
        live_plan_id="plan123",
        durations=[9.9, 10.2, 10.3, 10.1, 10.0],
    )
    rc = mod.run_detection_mode("customer_profile", threshold=0.10, samples=5)
    captured = capsys.readouterr().out
    assert rc == 0
    assert captured.startswith("OK ")
    assert "plan_same" in captured
    assert "perf_ok" in captured


def test_detect_regression_plan_changed_perf_worse(monkeypatch, ensure_module_imported, capsys):
    mod = ensure_module_imported
    baseline_row = ("planABC", 10.0, 20.0)
    # durations produce p50 ~ 11.6 (> +10%) and p95 ~ 23 (> +10%)
    _patch(
        monkeypatch,
        mod,
        baseline_row=baseline_row,
        live_plan_id="planDEF",
        durations=[11.5, 11.7, 11.6, 22.5, 23.0],
    )
    rc = mod.run_detection_mode("customer_profile", threshold=0.10, samples=5)
    captured = capsys.readouterr().out
    assert rc == 1
    assert captured.startswith("REGRESSION DETECTED")
    assert "plan_changed" in captured
    assert "p50" in captured and "+" in captured  # contains percentage increase marker


def test_detect_query_key_not_found(monkeypatch, ensure_module_imported, capsys):
    mod = ensure_module_imported
    # No DB interaction expected because key missing early
    rc = mod.run_detection_mode("nonexistent_key", threshold=0.10, samples=5)
    captured = capsys.readouterr().out
    assert rc == 2
    assert "ERROR: query_key 'nonexistent_key' not found" in captured


def test_detect_baseline_missing(monkeypatch, ensure_module_imported, capsys):
    mod = ensure_module_imported
    # baseline_row None simulates missing baseline entry
    monkeypatch.setattr(mod.srv, "db_conn", lambda: FakeConn(None))
    rc = mod.run_detection_mode("customer_profile", threshold=0.10, samples=5)
    captured = capsys.readouterr().out
    assert rc == 3
    assert captured.startswith("NO BASELINE FOUND")
