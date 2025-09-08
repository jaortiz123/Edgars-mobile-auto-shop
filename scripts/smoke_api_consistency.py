import os
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

# Ensure backend import works when running as a script
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Enable E2E auth bypass and memory fallback for smoke tests
os.environ.setdefault("APP_INSTANCE_ID", "ci")
os.environ.setdefault("FALLBACK_TO_MEMORY", "true")
os.environ.setdefault("DEV_NO_AUTH", "false")  # use explicit headers/bypass, not auto-dev

from backend.local_server import app  # type: ignore


@contextmanager
def test_client():
    # Configure testing mode and default tenant
    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def auth_headers():
    # Use E2E bypass path: any Bearer + specific tenant with APP_INSTANCE_ID=ci
    return {
        "Authorization": "Bearer anything",
        "X-Tenant-Id": os.getenv("DEFAULT_TEST_TENANT", "00000000-0000-0000-0000-000000000001"),
    }


def assert_envelope(resp_json):
    assert isinstance(resp_json, dict), "Response should be a dict envelope"
    assert (
        "ok" in resp_json and "data" in resp_json and "error" in resp_json
    ), "Missing envelope keys"


def smoke_get_pagination(client):
    # Use invoices list endpoint; page params intentionally not matching server's pageSize param,
    # because middleware-level pagination applies to list-style JSON arrays from other routes.
    # Here, invoices returns an object with items; still verify envelope + that meta.pagination exists
    # when the body is a list (covered by technicians endpoint below).
    r = client.get(
        "/api/admin/technicians?page=2&page_size=10",
        headers=auth_headers(),
    )
    assert r.status_code == 200, r.data
    payload = r.get_json(silent=True)
    assert_envelope(payload)
    # List endpoints should be wrapped and paginated by middleware (body is list)
    meta = payload.get("meta") or {}
    pag = meta.get("pagination") if isinstance(meta, dict) else None
    assert (
        pag and pag.get("page") == 2 and pag.get("page_size") == 10
    ), f"Bad pagination meta: {meta}"


def smoke_post_idempotency(client):
    # Create appointment twice with same Idempotency-Key and same body
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    body = {
        "status": "SCHEDULED",
        "start_ts": future.isoformat().replace("+00:00", "Z"),
        "customer_name": "Smoke Test",
        "license_plate": "SMOKE-123",
    }
    key = "smoke-key-123"
    hdrs = {**auth_headers(), "Idempotency-Key": key}

    r1 = client.post("/api/admin/appointments", json=body, headers=hdrs)
    assert r1.status_code in (200, 201), r1.data
    # First should set stored status (may be set by after_request)
    s1 = r1.headers.get("X-Idempotency-Status")
    assert s1 in (None, "stored"), f"unexpected first X-Idempotency-Status={s1}"

    r2 = client.post("/api/admin/appointments", json=body, headers=hdrs)
    assert r2.status_code in (200, 201), r2.data
    s2 = r2.headers.get("X-Idempotency-Status")
    assert s2 == "replayed", f"expected replayed on second request, got {s2}"


def main():
    try:
        with test_client() as c:
            smoke_get_pagination(c)
            smoke_post_idempotency(c)
        print("SMOKE_OK")
    except AssertionError as e:
        print("SMOKE_FAIL:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
