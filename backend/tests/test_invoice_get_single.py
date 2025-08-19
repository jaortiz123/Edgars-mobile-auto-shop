import pytest
from backend import local_server as srv
from backend import invoice_service


def _create_completed_invoice(conn):
    # Make completed appointment with one service, then generate invoice
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO appointments (customer_id, vehicle_id, status, created_at)
            VALUES (1, 1, 'COMPLETED', now()) RETURNING id
            """
        )
        row = cur.fetchone()
        appt_id = row["id"] if isinstance(row, dict) else row[0]
        cur.execute(
            """
            INSERT INTO appointment_services (appointment_id, name, estimated_price, created_at)
            VALUES (%s, %s, %s, now())
            """,
            (appt_id, "Test Service", 123.45),
        )
    conn.commit()
    inv = invoice_service.generate_invoice_for_appointment(str(appt_id))
    return inv["id"], str(appt_id)


def test_get_invoice_happy_path(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id, appt_id = _create_completed_invoice(conn)
    finally:
        conn.close()

    client = srv.app.test_client()
    resp = client.get(f"/api/admin/invoices/{invoice_id}")
    data = resp.get_json()
    assert resp.status_code == 200, data
    assert data["data"]["invoice"]["id"] == invoice_id
    assert data["data"]["invoice"]["subtotal_cents"] == 12345
    assert len(data["data"]["lineItems"]) == 1
    assert data["data"]["lineItems"][0]["unit_price_cents"] == 12345
    # payments should be empty initially
    assert data["data"]["payments"] == []


def test_get_invoice_not_found(pg_container):
    client = srv.app.test_client()
    resp = client.get("/api/admin/invoices/does-not-exist")
    data = resp.get_json()
    assert resp.status_code == 404, data
    assert data["errors"][0]["code"] == "NOT_FOUND"
