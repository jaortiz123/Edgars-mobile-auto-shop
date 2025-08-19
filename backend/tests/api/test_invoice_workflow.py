from http import HTTPStatus

# Assumes existing test client fixture named `client` (Flask test client) and any auth bypass via DEV_NO_AUTH.
# End-to-end API workflow (no UI): create appointment -> generate invoice -> pay invoice -> verify paid.


def test_invoice_full_workflow(client):
    # 1. Create appointment (minimal required fields based on existing tests)
    from datetime import datetime, timezone, timedelta

    start_ts = (
        (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    )
    create_resp = client.post(
        "/api/admin/appointments",
        json={
            "customer_name": "WF Cust",
            "license_plate": "WFLOW1",
            "start_ts": start_ts,
            # Start in SCHEDULED (valid), later logic allows invoice after marking complete; for now try direct COMPLETED
            "status": "COMPLETED",
        },
    )
    assert create_resp.status_code == HTTPStatus.CREATED, create_resp.get_data(as_text=True)
    appt_payload = create_resp.get_json()["data"]
    # Response envelope: { data: { appointment: { id }, id } }
    appt_id = appt_payload.get("appointment", {}).get("id") or appt_payload.get("id")
    assert appt_id, f"No appointment id in payload: {appt_payload}"

    # 2. Add a service so the invoice has a non-zero amount (exercise payment path)
    svc_resp = client.post(
        f"/api/appointments/{appt_id}/services",
        json={
            "name": "WF Service",
            "estimated_price": 50,  # dollars -> 5000 cents
        },
    )
    assert svc_resp.status_code in (HTTPStatus.OK, HTTPStatus.CREATED), svc_resp.get_data(
        as_text=True
    )

    # 3. Generate invoice
    gen_resp = client.post(f"/api/admin/appointments/{appt_id}/invoice")
    assert gen_resp.status_code == HTTPStatus.CREATED, gen_resp.get_data(as_text=True)
    invoice_payload = gen_resp.get_json()["data"]
    invoice_id = invoice_payload.get("invoice", {}).get("id") or invoice_payload.get("id")
    assert invoice_id, f"No invoice id in payload: {invoice_payload}"

    # 4. Fetch invoice detail
    detail_resp = client.get(f"/api/admin/invoices/{invoice_id}")
    assert detail_resp.status_code == HTTPStatus.OK
    detail_json = detail_resp.get_json()["data"]
    amount_due_cents = detail_json.get("invoice", {}).get("amount_due_cents")
    if amount_due_cents is None:
        amount_due_cents = detail_json.get("amount_due_cents")
    assert isinstance(amount_due_cents, int) and amount_due_cents >= 0

    # 5. Pay full amount (if zero, skip payment step but still assert status logic)
    if amount_due_cents > 0:
        pay_resp = client.post(
            f"/api/admin/invoices/{invoice_id}/payments",
            json={"amountCents": amount_due_cents, "method": "cash"},
        )
        assert pay_resp.status_code == HTTPStatus.CREATED, pay_resp.get_data(as_text=True)

    # 6. Verify final status is PAID (or remains PAID if zero due)
    final_resp = client.get(f"/api/admin/invoices/{invoice_id}")
    assert final_resp.status_code == HTTPStatus.OK
    final_json = final_resp.get_json()["data"]
    final_status = (final_json.get("invoice", {}) or final_json).get("status")
    assert final_status == "PAID", f"Expected PAID got {final_status}"
