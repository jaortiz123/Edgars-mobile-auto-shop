import csv
import re
from pathlib import Path

import os
import importlib
import pytest
from flask.testing import FlaskClient


CSV_REL_PATH = "audit_artifacts/endpoint_auth_matrix.csv"


def _repo_root() -> Path:
    # backend/tests/test_*.py -> repo_root is two levels up
    return Path(__file__).resolve().parents[2]


def _csv_path() -> Path:
    return _repo_root() / CSV_REL_PATH


_PARAM_PLACEHOLDERS = {
    "appt_id": "apt-1",
    "invoice_id": "inv-1",
    "service_id": "svc-1",
    "vehicle_id": "veh-1",
    "vid": "veh-1",
    "license_plate": "ABC-123",
    "cust_id": "1",
    "cid": "1",
    "tid": "tmpl-1",
}


def _materialize_path(rule: str) -> str:
    # Replace Flask params like <name> with stable placeholders
    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        return _PARAM_PLACEHOLDERS.get(name, "test")

    return re.sub(r"<([^>]+)>", repl, rule)


def _load_guarded_admin_routes():
    csv_path = _csv_path()
    assert csv_path.exists(), f"Missing CSV artifact: {csv_path}"
    cases: list[tuple[str, str]] = []  # (method, path)
    with csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rule = row["rule"].strip()
            effective_has = (row.get("effective_has_require_auth") or "").strip().lower()
            if not rule.startswith("/api/admin/"):
                continue
            if effective_has != "yes":
                continue
            methods = [m.strip() for m in (row.get("methods") or "").split(";") if m.strip()]
            if not methods:
                # Default to GET if empty for safety
                methods = ["GET"]
            path = _materialize_path(rule)
            for m in methods:
                cases.append((m, path))
    # Deduplicate in case of duplicates in CSV
    cases = sorted(set(cases))
    return cases


GUARDED_CASES = _load_guarded_admin_routes()
CASE_IDS = [f"{m}-{p}" for m, p in GUARDED_CASES]


@pytest.fixture()
def unauth_client():
    """Raw Flask client with no auth and in-memory fallback to avoid Docker.

    This bypasses dockerized Postgres by relying on early auth checks to short-circuit.
    """
    # Ensure in-memory mode
    os.environ.setdefault("FALLBACK_TO_MEMORY", "true")
    os.environ.setdefault("DISABLE_DB_CONFIG_CACHE", "true")

    try:
        srv = importlib.import_module("backend.local_server")
    except Exception:
        srv = importlib.import_module("local_server")
    srv.app.testing = True
    prev_class = getattr(srv.app, "test_client_class", FlaskClient)
    try:
        srv.app.test_client_class = FlaskClient
        with srv.app.test_client() as c:
            yield c
    finally:
        srv.app.test_client_class = prev_class


@pytest.mark.parametrize("method,path", GUARDED_CASES, ids=CASE_IDS)
def test_guarded_admin_routes_require_auth(unauth_client, method: str, path: str):
    # Always include a tenant header to avoid 400s for missing tenant; no Authorization on purpose
    headers = {
        "X-Tenant-Id": "00000000-0000-0000-0000-000000000001",
        "Content-Type": "application/json",
    }
    client = unauth_client

    # Use json={} for non-GET to avoid 415/400 content-type parsing errors.
    method_upper = method.upper()
    if method_upper in {"POST", "PATCH", "PUT", "DELETE"}:
        resp = client.open(path, method=method_upper, headers=headers, json={})
    else:
        resp = client.open(path, method=method_upper, headers=headers)

    assert resp.status_code in (
        401,
        403,
    ), f"{method} {path} -> {resp.status_code} (expected 401/403); body={getattr(resp, 'data', b'')[:200]}"
