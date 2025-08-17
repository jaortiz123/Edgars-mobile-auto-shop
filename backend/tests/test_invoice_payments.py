import pytest
from backend import local_server as srv
from backend import invoice_service


def _new_completed_invoice(conn, initial_services=None):
    initial_services = initial_services or [('Service A', 5000)]  # cents
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO appointments (customer_id, vehicle_id, status, created_at)
                       VALUES (1,1,'COMPLETED', now()) RETURNING id""")
        appt_row = cur.fetchone()
        appt_id = appt_row['id'] if isinstance(appt_row, dict) else appt_row[0]
        for name, cents in initial_services:
            cur.execute("""INSERT INTO appointment_services (appointment_id, name, estimated_price, created_at)
                           VALUES (%s,%s,%s/100.0, now())""", (appt_id, name, cents))
    conn.commit()
    inv = invoice_service.generate_invoice_for_appointment(str(appt_id))
    return inv['id'], str(appt_id), inv


def test_partial_payment_sets_partially_paid(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id, appt_id, inv = _new_completed_invoice(conn, [('Service X', 10000)])
    finally:
        conn.close()
    client = srv.app.test_client()
    # pay half (5000)
    resp = client.post(f"/api/admin/invoices/{invoice_id}/payments", json={'amountCents': 5000, 'method': 'card'})
    data = resp.get_json()
    assert resp.status_code == 201, data
    assert data['data']['invoice']['status'] == 'PARTIALLY_PAID'
    assert data['data']['invoice']['amount_paid_cents'] == 5000
    assert data['data']['invoice']['amount_due_cents'] == 5000


def test_full_payment_sets_paid(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id, appt_id, inv = _new_completed_invoice(conn, [('Service Y', 4200)])
    finally:
        conn.close()
    client = srv.app.test_client()
    resp = client.post(f"/api/admin/invoices/{invoice_id}/payments", json={'amountCents': 4200, 'method': 'cash'})
    data = resp.get_json()
    assert resp.status_code == 201, data
    assert data['data']['invoice']['status'] == 'PAID'
    assert data['data']['invoice']['amount_due_cents'] == 0


def test_overpayment_rejected(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id, appt_id, inv = _new_completed_invoice(conn, [('Service Z', 3000)])
    finally:
        conn.close()
    client = srv.app.test_client()
    resp = client.post(f"/api/admin/invoices/{invoice_id}/payments", json={'amountCents': 4000, 'method': 'card'})
    data = resp.get_json()
    assert resp.status_code == 400, data
    assert data['errors'][0]['code'] == 'OVERPAYMENT'


def test_payment_on_paid_invoice_rejected(pg_container):
    conn = srv.db_conn()
    try:
        invoice_id, appt_id, inv = _new_completed_invoice(conn, [('Service Q', 1000)])
    finally:
        conn.close()
    client = srv.app.test_client()
    # pay full first
    resp1 = client.post(f"/api/admin/invoices/{invoice_id}/payments", json={'amountCents': 1000, 'method': 'cash'})
    assert resp1.status_code == 201, resp1.get_json()
    # attempt second payment
    resp2 = client.post(f"/api/admin/invoices/{invoice_id}/payments", json={'amountCents': 100, 'method': 'cash'})
    data2 = resp2.get_json()
    assert resp2.status_code in (400,409), data2
    assert data2['errors'][0]['code'] in ('ALREADY_PAID','INVALID_STATE')
