import pytest
from backend import local_server as srv
from backend import invoice_service


def _make_invoice(conn, price_cents=10000, status="COMPLETED"):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO appointments (customer_id, vehicle_id, status, created_at)
                       VALUES (1,1,%s, now()) RETURNING id""",
            (status,),
        )
        row = cur.fetchone()
        appt_id = row["id"] if isinstance(row, dict) else row[0]
        if price_cents:
            cur.execute(
                """INSERT INTO appointment_services (appointment_id, name, estimated_price, created_at)
                           VALUES (%s,'Svc',%s/100.0, now())""",
                (appt_id, price_cents),
            )
    conn.commit()
    inv = invoice_service.generate_invoice_for_appointment(str(appt_id))
    return inv["id"]


def test_void_draft_invoice(pg_container):
    # Create draft (generation sets DRAFT). Void it.
    conn = srv.db_conn()
    try:
        invoice_id = _make_invoice(conn, 2500)
    finally:
        conn.close()
    client = srv.app.test_client()
    resp = client.post(f"/api/admin/invoices/{invoice_id}/void")
    data = resp.get_json()
    assert resp.status_code == 200, data
    assert data["data"]["status"] == "VOID"
    # Since unpaid, amount_due_cents remains equal to total (preserving constraint & history)
    assert data["data"]["amount_paid_cents"] == 0
    assert data["data"]["amount_due_cents"] == data["data"]["total_cents"]


def test_void_partially_paid_invoice(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id = _make_invoice(conn, 10000)
    finally:
        conn.close()
    client = srv.app.test_client()
    # pay part (4000)
    pay_resp = client.post(
        f"/api/admin/invoices/{invoice_id}/payments", json={"amountCents": 4000, "method": "cash"}
    )
    assert pay_resp.status_code == 201, pay_resp.get_json()
    void_resp = client.post(f"/api/admin/invoices/{invoice_id}/void")
    data = void_resp.get_json()
    assert void_resp.status_code == 200, data
    assert data["data"]["status"] == "VOID"
    # amount_due_cents remains total - paid (not forced to zero)
    assert data["data"]["amount_paid_cents"] == 4000
    assert data["data"]["amount_due_cents"] == data["data"]["total_cents"] - 4000


def test_void_already_void_invoice(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id = _make_invoice(conn, 3000)
    finally:
        conn.close()
    client = srv.app.test_client()
    first = client.post(f"/api/admin/invoices/{invoice_id}/void")
    assert first.status_code == 200, first.get_json()
    second = client.post(f"/api/admin/invoices/{invoice_id}/void")
    data2 = second.get_json()
    assert second.status_code == 409, data2
    assert data2["errors"][0]["code"] == "ALREADY_VOID"


def test_void_paid_invoice_rejected(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id = _make_invoice(conn, 5000)
    finally:
        conn.close()
    client = srv.app.test_client()
    # pay full
    pay = client.post(
        f"/api/admin/invoices/{invoice_id}/payments", json={"amountCents": 5000, "method": "cash"}
    )
    assert pay.status_code == 201, pay.get_json()
    # attempt void
    void = client.post(f"/api/admin/invoices/{invoice_id}/void")
    data = void.get_json()
    assert void.status_code == 409, data
    assert data["errors"][0]["code"] == "ALREADY_PAID"
