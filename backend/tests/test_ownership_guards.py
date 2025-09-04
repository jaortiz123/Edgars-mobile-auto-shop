from http import HTTPStatus
import uuid
import pytest
import backend.local_server as srv
from .fake_db import FakeConn
from flask import request


@pytest.fixture(autouse=True)
def _patch_db(monkeypatch):
    fake = FakeConn()
    monkeypatch.setattr(srv, "db_conn", lambda: fake)
    # Bypass strict tenant enforcement and ensure RBAC is active
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
    try:
        srv.DEV_NO_AUTH = False  # type: ignore
    except Exception:
        pass
    return fake


@pytest.fixture()
def client(no_auto_auth_client):
    srv.app.config.update(TESTING=True)
    return no_auto_auth_client


def _auth_headers(role: str = "Owner"):
    import time, jwt  # type: ignore

    now = int(time.time())
    payload = {"sub": role.lower(), "role": role, "iat": now, "exp": now + 3600}
    token = jwt.encode(
        payload,
        getattr(srv, "JWT_SECRET", "dev_secret"),
        algorithm=getattr(srv, "JWT_ALG", "HS256"),
    )
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": str(uuid.uuid4())}


def _seed_customer(conn, name="Own Guard User"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO customers(name,email,phone) VALUES(%s,%s,%s) RETURNING id",
            (name, f"{name.lower().replace(' ','')}@ex.com", "555"),
        )
        return cur.fetchone()[0]


def _seed_vehicle(conn, customer_id: int, plate="VG1234"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO vehicles(customer_id,make,model,year,vin,license_plate) VALUES(%s,'Toyota','Camry',2021,'JTNBE46KX73000000',%s) RETURNING id",
            (customer_id, plate),
        )
        return cur.fetchone()[0]


@pytest.mark.integration
def test_vehicle_profile_ownership_violation(client):
    conn = srv.db_conn()
    with conn:
        cust_owner = _seed_customer(conn, "Owner A")
        veh_id = _seed_vehicle(conn, cust_owner, plate="OWN123")
        other_customer = _seed_customer(conn, "Other B")
    resp = client.get(
        f"/api/admin/vehicles/{veh_id}/profile?customer_id={other_customer}",
        headers=_auth_headers(),
    )
    assert resp.status_code == HTTPStatus.BAD_REQUEST
    body = resp.get_json()
    assert body["error"]["message"] == "vehicle does not belong to customer"


@pytest.mark.integration
@pytest.mark.parametrize(
    "endpoint", ["estimate.pdf", "receipt.pdf", "estimate.html", "receipt.html"]
)
def test_invoice_export_ownership_violation(monkeypatch, client, endpoint):
    conn = srv.db_conn()
    with conn:
        correct_customer = _seed_customer(conn, "Cust Correct")
        vehicle_id = _seed_vehicle(conn, correct_customer, plate="INVOWN")
        wrong_customer = _seed_customer(conn, "Cust Wrong")

    import backend.invoice_service as invsvc

    # Monkeypatch to return mismatched invoice record; production inline check should detect
    def _fake_fetch(invoice_id: str):
        return {
            "invoice": {
                "id": invoice_id,
                "customer_id": str(wrong_customer),
                "vehicle_id": str(vehicle_id),
                "status": "DRAFT",
                "total_cents": 0,
            },
            "lineItems": [],
            "payments": [],
        }

    monkeypatch.setattr(invsvc, "fetch_invoice_details", _fake_fetch)

    url = f"/api/admin/invoices/inv-own-guard/{endpoint}"
    resp = client.get(url, headers=_auth_headers())
    assert resp.status_code == HTTPStatus.BAD_REQUEST
    body = resp.get_json()
    assert body["error"]["message"] == "vehicle does not belong to customer"
