import pytest
from backend import local_server as srv
from backend import invoice_service


def _make_appt(conn, status="COMPLETED", customer_id=1, vehicle_id=1):
    """Insert an appointment letting SERIAL id auto-generate; return id as str.

    We use existing seeded customer/vehicle IDs (1) to satisfy FK constraints.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO appointments (customer_id, vehicle_id, status, created_at)
            VALUES (%s, %s, %s, now())
            RETURNING id
            """,
            (customer_id, vehicle_id, status)
        )
        row = cur.fetchone()
        # RealDictCursor returns dict; fallback to index if tuple (unlikely here)
        appt_id = row['id'] if isinstance(row, dict) else row[0]
    return str(appt_id)

def _add_service(conn, appt_id, name="Oil Change", price=50):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO appointment_services (appointment_id, name, estimated_price, created_at)
            VALUES (%s, %s, %s, now())
            """,
            (int(appt_id), name, price)
        )


def test_generate_invoice_success(pg_container):  # ensure container/env ready
    conn = srv.db_conn()
    try:
        appt_id = _make_appt(conn)
        _add_service(conn, appt_id, price=100)
        _add_service(conn, appt_id, name="Tire Rotation", price=25)
        conn.commit()  # make rows visible to new connection used by service

        result = invoice_service.generate_invoice_for_appointment(appt_id)
        assert result['subtotal_cents'] == 12500
        assert len(result['line_items']) == 2
        assert result['amount_due_cents'] == 12500

        with pytest.raises(invoice_service.InvoiceError) as ei:
            invoice_service.generate_invoice_for_appointment(appt_id)
        assert ei.value.code == 'ALREADY_EXISTS'
    finally:
        conn.close()


def test_generate_invoice_invalid_state(pg_container):
    conn = srv.db_conn()
    try:
        appt_id = _make_appt(conn, status="SCHEDULED")
        conn.commit()
        with pytest.raises(invoice_service.InvoiceError) as ei:
            invoice_service.generate_invoice_for_appointment(appt_id)
        assert ei.value.code == 'INVALID_STATE'
    finally:
        conn.close()


def test_generate_invoice_endpoint(client, pg_container):  # reuse client fixture from conftest
    conn = srv.db_conn()
    try:
        appt_id = _make_appt(conn)
        _add_service(conn, appt_id, price=42)
        conn.commit()
    finally:
        conn.close()

    resp = client.post(f"/api/admin/appointments/{appt_id}/invoice")
    data = resp.get_json()
    assert resp.status_code == 201, data
    assert data['data']['subtotal_cents'] == 4200

    resp2 = client.post(f"/api/admin/appointments/{appt_id}/invoice")
    data2 = resp2.get_json()
    assert resp2.status_code == 409, data2
    assert data2['errors'][0]['code'] == 'ALREADY_EXISTS'


def test_generate_invoice_zero_services(pg_container):
    """Invoice generation for an appointment with no services should succeed with all zero totals."""
    conn = srv.db_conn()
    try:
        appt_id = _make_appt(conn)  # don't add any services
        conn.commit()
    finally:
        conn.close()

    result = invoice_service.generate_invoice_for_appointment(appt_id)
    assert result['subtotal_cents'] == 0
    assert result['tax_cents'] == 0
    assert result['total_cents'] == 0
    assert result['amount_due_cents'] == 0
    assert result['line_items'] == []


def test_generate_invoice_not_found_endpoint(client, pg_container):
    """POSTing invoice generation for a non-existent appointment returns 404."""
    # Use an id far beyond seeded/created sequences to ensure NOT FOUND
    missing_id = "99999999"  # sequences reset way lower; safe sentinel
    resp = client.post(f"/api/admin/appointments/{missing_id}/invoice")
    data = resp.get_json()
    assert resp.status_code == 404, data
    assert data['errors'][0]['code'] in ('NOT_FOUND','NOT_FOUND_APPOINTMENT')
