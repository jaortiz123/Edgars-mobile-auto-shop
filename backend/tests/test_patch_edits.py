from http import HTTPStatus
import json
import pytest
import backend.local_server as srv
from .fake_db import FakeConn


@pytest.fixture(autouse=True)
def _patch_db(monkeypatch):
    fake = FakeConn()
    monkeypatch.setattr(srv, "db_conn", lambda: fake)
    return fake


@pytest.fixture()
def client(monkeypatch):
    from flask.testing import FlaskClient
    import time, jwt, uuid

    srv.app.config.update(TESTING=True)
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")

    token = jwt.encode(
        {"sub": "owner", "role": "Owner", "iat": int(time.time()), "exp": int(time.time()) + 3600},
        srv.JWT_SECRET,
        algorithm=srv.JWT_ALG,
    )
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    class _AuthClient(FlaskClient):
        def open(self, *a, **kw):  # type: ignore[override]
            headers = kw.setdefault("headers", {})
            headers.setdefault("Authorization", f"Bearer {token}")
            headers.setdefault("X-Tenant-Id", str(uuid.uuid4()))
            return super().open(*a, **kw)

    prev = getattr(srv.app, "test_client_class", FlaskClient)
    try:
        srv.app.test_client_class = _AuthClient
        with srv.app.test_client() as c:
            yield c
    finally:
        srv.app.test_client_class = prev


def _seed_customer(conn, name="Patch User"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO customers(name,email,phone) VALUES(%s,%s,%s) RETURNING id",
            (name, "patch@example.com", "555"),
        )
        rid = cur.fetchone()[0]
    conn.commit()
    return rid


def _seed_vehicle(conn, customer_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO vehicles(customer_id,make,model,year,vin,license_plate) VALUES(%s,'Ford','F150',2020,'1FTFW1E50LFAAAAAA','ABC123') RETURNING id",
            (customer_id,),
        )
        vid = cur.fetchone()[0]
    conn.commit()
    return vid


def _get_etag(client, cid):
    # Compute strong ETag mirroring server logic
    conn = srv.db_conn()
    row = conn.customers.get(cid)
    if not row:
        return 'W/"0"'
    ts = max(row["updated_at"], row["created_at"])
    row_for = {
        "id": row["id"],
        "name": row.get("name"),
        "full_name": row.get("full_name") or row.get("name"),
        "email": row.get("email"),
        "phone": row.get("phone"),
        "tags": row.get("tags", []),
        "notes": row.get("notes"),
        "sms_consent": bool(row.get("sms_consent", False)),
        "ts": ts,
    }
    return srv._strong_etag(
        "customer",
        row_for,
        ["name", "full_name", "email", "phone", "tags", "notes", "sms_consent"],
    )


def _get_vehicle_etag(client, vid, cust):
    conn = srv.db_conn()
    vrow = conn.vehicles.get(vid)
    if not vrow:
        return 'W/"0"'
    ts = max(vrow["updated_at"], vrow["created_at"])
    row_for = {
        "id": vrow["id"],
        "customer_id": vrow["customer_id"],
        "make": vrow["make"],
        "model": vrow["model"],
        "year": vrow["year"],
        "vin": vrow["vin"],
        "license_plate": vrow["license_plate"],
        "ts": ts,
    }
    return srv._strong_etag("vehicle", row_for, ["make", "model", "year", "vin", "license_plate"])


@pytest.mark.integration
def test_customer_patch_success_creates_audit(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn)
    et = _get_etag(client, cid)
    r = client.patch(
        f"/api/admin/customers/{cid}", json={"name": "New Name"}, headers={"If-Match": et}
    )
    assert r.status_code == HTTPStatus.OK
    assert r.headers.get("Cache-Control") == "private, max-age=30"
    new_etag = r.headers.get("ETag")
    assert new_etag and new_etag != et
    with conn.cursor() as cur:
        cur.execute(
            "SELECT fields_changed FROM customer_audits WHERE customer_id=%s ORDER BY created_at DESC LIMIT 1",
            (cid,),
        )
        row = cur.fetchone()
    assert row and "name" in (row[0] if isinstance(row, tuple) else row["fields_changed"])


@pytest.mark.integration
def test_customer_patch_conflict_no_audit(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Conflict User")
    stale = 'W/"stale"'
    r = client.patch(f"/api/admin/customers/{cid}", json={"name": "X"}, headers={"If-Match": stale})
    assert r.status_code == HTTPStatus.PRECONDITION_FAILED
    assert r.headers.get("Cache-Control") == "no-store"
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customer_audits WHERE customer_id=%s", (cid,))
        count = cur.fetchone()[0]
    assert count == 0


@pytest.mark.integration
def test_customer_patch_validation_error(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Val User")
    et = _get_etag(client, cid)
    r = client.patch(
        f"/api/admin/customers/{cid}", json={"email": "bad@@example"}, headers={"If-Match": et}
    )
    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] in ("validation_failed", "bad_request")
    # email validation detail now under error.details
    if "details" in body["error"]:
        assert body["error"]["details"].get("email") == "invalid"
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customer_audits WHERE customer_id=%s", (cid,))
        count = cur.fetchone()[0]
    assert count == 0


@pytest.mark.integration
def test_vehicle_patch_success_audit(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Vehicle Owner")
        vid = _seed_vehicle(conn, cid)
    et = _get_vehicle_etag(client, vid, cid)
    r = client.patch(f"/api/admin/vehicles/{vid}", json={"make": "Tesla"}, headers={"If-Match": et})
    # Accept either customer-level etag change or same (since we piggyback on customer etag)
    assert r.status_code == HTTPStatus.OK
    assert r.headers.get("Cache-Control") == "private, max-age=30"
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM vehicle_audits WHERE vehicle_id=%s", (vid,))
        count = cur.fetchone()[0]
    assert count == 1


@pytest.mark.integration
def test_vehicle_patch_conflict(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Vehicle Conflict")
        vid = _seed_vehicle(conn, cid)
    r = client.patch(
        f"/api/admin/vehicles/{vid}", json={"make": "X"}, headers={"If-Match": 'W/"stale"'}
    )
    assert r.status_code == HTTPStatus.PRECONDITION_FAILED
    assert r.headers.get("Cache-Control") == "no-store"
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM vehicle_audits WHERE vehicle_id=%s", (vid,))
        count = cur.fetchone()[0]
    assert count == 0


@pytest.mark.integration
def test_vehicle_patch_validation(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Vehicle Val")
        vid = _seed_vehicle(conn, cid)
    et = _get_vehicle_etag(client, vid, cid)
    r = client.patch(f"/api/admin/vehicles/{vid}", json={"vin": "SHORT"}, headers={"If-Match": et})
    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] in ("validation_failed", "bad_request")
    if "details" in body["error"]:
        assert body["error"]["details"].get("vin") == "length"
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM vehicle_audits WHERE vehicle_id=%s", (vid,))
        count = cur.fetchone()[0]
    assert count == 0


@pytest.mark.integration
def test_customer_patch_missing_if_match(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Missing IfMatch")
    r = client.patch(f"/api/admin/customers/{cid}", json={"name": "X"})  # no If-Match
    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] == "bad_request"
    assert "If-Match required" in body["error"]["message"]


@pytest.mark.integration
def test_vehicle_patch_missing_if_match(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Missing IfMatch Veh")
        vid = _seed_vehicle(conn, cid)
    r = client.patch(f"/api/admin/vehicles/{vid}", json={"make": "X"})
    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] == "bad_request"
    assert "If-Match required" in body["error"]["message"]


@pytest.mark.integration
def test_customer_patch_forbidden(monkeypatch, client):
    # Simulate unauthorized by forcing require_or_maybe to return None
    monkeypatch.setattr(srv, "require_or_maybe", lambda required=None: None)
    r = client.patch("/api/admin/customers/1", json={"name": "X"})
    assert r.status_code == HTTPStatus.FORBIDDEN
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] == "forbidden"


@pytest.mark.integration
def test_vehicle_patch_forbidden(monkeypatch, client):
    monkeypatch.setattr(srv, "require_or_maybe", lambda required=None: None)
    r = client.patch("/api/admin/vehicles/1", json={"make": "X"})
    assert r.status_code == HTTPStatus.FORBIDDEN
    assert r.headers.get("Cache-Control") == "no-store"
    body = r.get_json()
    assert body["error"]["code"] == "forbidden"


@pytest.mark.integration
def test_vehicle_get_basic_etag(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="GET Veh Owner")
        vid = _seed_vehicle(conn, cid)
    resp = client.get(f"/api/admin/vehicles/{vid}")
    assert resp.status_code == HTTPStatus.OK
    assert resp.headers.get("Cache-Control") == "private, max-age=30"
    data = resp.get_json()["data"]
    assert data["id"] == vid
    # Recompute expected etag to compare
    etag = _get_vehicle_etag(client, vid, cid)
    assert resp.headers.get("ETag") == etag


@pytest.mark.integration
def test_customer_audit_diff_structure(client):
    # Ensure audit log captures from/to structure
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Orig Name")
    et = _get_etag(client, cid)
    r = client.patch(
        f"/api/admin/customers/{cid}",
        json={"name": "Newer Name", "phone": "999"},
        headers={"If-Match": et},
    )
    assert r.status_code == HTTPStatus.OK
    with conn.cursor() as cur:
        cur.execute(
            "SELECT fields_changed FROM customer_audits WHERE customer_id=%s ORDER BY created_at DESC LIMIT 1",
            (cid,),
        )
        row = cur.fetchone()
    fields = row[0] if isinstance(row, tuple) else row["fields_changed"]
    assert "name" in fields and "phone" in fields
    assert fields["name"].get("from") == "Orig Name"
    assert fields["name"].get("to") == "Newer Name"
    assert fields["phone"].get("from") == "555"  # seeded phone
    assert fields["phone"].get("to") == "999"


@pytest.mark.integration
def test_vehicle_audit_diff_structure(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Veh Diff")
        vid = _seed_vehicle(conn, cid)
    et = _get_vehicle_etag(client, vid, cid)
    r = client.patch(
        f"/api/admin/vehicles/{vid}",
        json={"make": "Honda", "model": "Civic"},
        headers={"If-Match": et},
    )
    assert r.status_code == HTTPStatus.OK
    with conn.cursor() as cur:
        cur.execute(
            "SELECT fields_changed FROM vehicle_audits WHERE vehicle_id=%s ORDER BY created_at DESC LIMIT 1",
            (vid,),
        )
        row = cur.fetchone()
    fields = row[0] if isinstance(row, tuple) else row["fields_changed"]
    assert set(["make", "model"]) <= set(fields.keys())
    assert fields["make"]["from"] == "Ford"
    assert fields["make"]["to"] == "Honda"
    assert fields["model"]["from"] == "F150"
    assert fields["model"]["to"] == "Civic"


@pytest.mark.integration
def test_customer_patch_noop_no_audit(client):
    conn = srv.db_conn()
    with conn:
        cid = _seed_customer(conn, name="Same Name")
    # initial etag
    et = _get_etag(client, cid)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customer_audits WHERE customer_id=%s", (cid,))
        before = cur.fetchone()[0]
    # Send patch with identical data
    r = client.patch(
        f"/api/admin/customers/{cid}", json={"name": "Same Name"}, headers={"If-Match": et}
    )
    assert r.status_code == HTTPStatus.OK
    # Expect ETag remains logically same content representation; recompute and compare
    post = _get_etag(client, cid)
    assert r.headers.get("ETag") == post
    # For a no-op the ETag should not change; if it does this indicates ts mutated erroneously
    assert post == et
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customer_audits WHERE customer_id=%s", (cid,))
        after = cur.fetchone()[0]
    assert after == before  # no new audit row
