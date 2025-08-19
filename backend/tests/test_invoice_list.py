import pytest
from backend import local_server as srv
from backend import invoice_service


def _seed_invoices(conn):
    # Create several invoices with varying status & customers
    created_appt_ids = []
    # Helper: customer ids 1..3 exist from seed
    specs = [
        (1, "COMPLETED", 10000),
        (1, "COMPLETED", 5000),
        (2, "COMPLETED", 7500),
        (3, "COMPLETED", 2500),
    ]
    with conn.cursor() as cur:
        for cust_id, appt_status, cents in specs:
            cur.execute(
                """INSERT INTO appointments (customer_id, vehicle_id, status, created_at)
                           VALUES (%s,1,%s, now()) RETURNING id""",
                (cust_id, appt_status),
            )
            appt_row = cur.fetchone()
            # fetchone may return tuple or mapping depending on cursor factory
            appt_id = appt_row["id"] if isinstance(appt_row, dict) else appt_row[0]
            created_appt_ids.append(appt_id)
            cur.execute(
                """INSERT INTO appointment_services (appointment_id, name, estimated_price, created_at)
                           VALUES (%s,'Svc',%s/100.0, now())""",
                (appt_id, cents),
            )
    conn.commit()
    # Generate invoices directly from collected appointment ids
    invoice_ids = []
    for aid in created_appt_ids:
        inv = invoice_service.generate_invoice_for_appointment(str(aid))
        invoice_ids.append(inv["id"])
    return invoice_ids


def test_list_invoices_basic(pg_container):
    conn = srv.db_conn()
    try:
        _seed_invoices(conn)
    finally:
        conn.close()
    client = srv.app.test_client()
    resp = client.get("/api/admin/invoices?page=1&pageSize=2")
    data = resp.get_json()
    assert resp.status_code == 200, data
    assert data["data"]["page"] == 1
    assert data["data"]["page_size"] == 2
    assert len(data["data"]["items"]) == 2
    assert data["data"]["total_items"] >= 4


def test_list_invoices_filter_customer(pg_container):
    conn = srv.db_conn()
    try:
        _seed_invoices(conn)
    finally:
        conn.close()
    client = srv.app.test_client()
    resp = client.get("/api/admin/invoices?customerId=1")
    data = resp.get_json()
    assert resp.status_code == 200, data
    # All returned rows have customer_id 1
    assert all(r["customer_id"] == 1 for r in data["data"]["items"])


def test_list_invoices_filter_status(pg_container):
    # Void one invoice then filter
    conn = srv.db_conn()
    try:
        ids = _seed_invoices(conn)
    finally:
        conn.close()
    client = srv.app.test_client()
    # Void first invoice
    client.post(f"/api/admin/invoices/{ids[0]}/void")
    resp = client.get("/api/admin/invoices?status=VOID")
    data = resp.get_json()
    assert resp.status_code == 200
    assert all(r["status"] == "VOID" for r in data["data"]["items"])
