from http import HTTPStatus

# New tests for invoice export (HTML/PDF) + send stub endpoints


def _create_completed_appt_with_service(client):
    from datetime import datetime, timezone, timedelta

    start_ts = (
        (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    )
    create_resp = client.post(
        "/api/admin/appointments",
        json={
            "customer_name": "Export Cust",
            "license_plate": "EXP111",
            "start_ts": start_ts,
            "status": "COMPLETED",
        },
    )
    assert create_resp.status_code == HTTPStatus.CREATED, create_resp.get_data(as_text=True)
    appt_payload = create_resp.get_json()["data"]
    appt_id = appt_payload.get("appointment", {}).get("id") or appt_payload.get("id")
    svc_resp = client.post(
        f"/api/appointments/{appt_id}/services",
        json={"name": "Export Svc", "estimated_price": 42},
    )
    assert svc_resp.status_code in (HTTPStatus.OK, HTTPStatus.CREATED)
    inv_resp = client.post(f"/api/admin/appointments/{appt_id}/invoice")
    assert inv_resp.status_code == HTTPStatus.CREATED, inv_resp.get_data(as_text=True)
    invoice_payload = inv_resp.get_json()["data"]
    invoice_id = invoice_payload.get("invoice", {}).get("id") or invoice_payload.get("id")
    return invoice_id


def test_invoice_export_endpoints(client):
    invoice_id = _create_completed_appt_with_service(client)

    # HTML receipt
    r_html = client.get(f"/api/admin/invoices/{invoice_id}/receipt.html")
    assert r_html.status_code == HTTPStatus.OK, r_html.get_data(as_text=True)
    assert "text/html" in r_html.headers.get("Content-Type", "")
    assert invoice_id in r_html.get_data(as_text=True)

    # HTML estimate
    e_html = client.get(f"/api/admin/invoices/{invoice_id}/estimate.html")
    assert e_html.status_code == HTTPStatus.OK
    assert "Invoice Estimate" in e_html.get_data(as_text=True)

    # PDF receipt
    r_pdf = client.get(f"/api/admin/invoices/{invoice_id}/receipt.pdf")
    assert r_pdf.status_code == HTTPStatus.OK
    assert r_pdf.data.startswith(b"%PDF"), r_pdf.data[:10]
    assert "application/pdf" in r_pdf.headers.get("Content-Type", "")

    # PDF estimate
    e_pdf = client.get(f"/api/admin/invoices/{invoice_id}/estimate.pdf")
    assert e_pdf.status_code == HTTPStatus.OK
    assert e_pdf.data.startswith(b"%PDF")

    # Send stub
    send_resp = client.post(
        f"/api/admin/invoices/{invoice_id}/send",
        json={"type": "receipt", "destinationEmail": "test@example.com"},
    )
    assert send_resp.status_code == HTTPStatus.ACCEPTED, send_resp.get_data(as_text=True)
    payload = send_resp.get_json()["data"]
    assert payload["status"] == "QUEUED"
    assert payload["invoice_id"] == invoice_id


def test_invoice_export_not_found(client):
    # A random UUID should not exist
    bad_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/api/admin/invoices/{bad_id}/receipt.html")
    assert resp.status_code == HTTPStatus.NOT_FOUND
    resp_pdf = client.get(f"/api/admin/invoices/{bad_id}/receipt.pdf")
    assert resp_pdf.status_code == HTTPStatus.NOT_FOUND
    send_resp = client.post(f"/api/admin/invoices/{bad_id}/send")
    assert send_resp.status_code == HTTPStatus.NOT_FOUND


def test_invoice_export_rbac_forbidden(monkeypatch, client, no_auto_auth_client):
    """Force authorization helper to fail and assert 403 on all export + send endpoints."""
    import local_server as root_srv

    # Create valid invoice first under normal dev bypass
    from datetime import datetime, timezone, timedelta

    start_ts = (
        (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat().replace("+00:00", "Z")
    )
    appt_resp = client.post(
        "/api/admin/appointments",
        json={
            "customer_name": "RBAC Cust",
            "license_plate": "RBAC1",
            "start_ts": start_ts,
            "status": "COMPLETED",
        },
    )
    assert appt_resp.status_code == HTTPStatus.CREATED, appt_resp.get_data(as_text=True)
    appt_payload = appt_resp.get_json()["data"]
    appt_id = appt_payload.get("appointment", {}).get("id") or appt_payload.get("id")
    client.post(
        f"/api/appointments/{appt_id}/services",
        json={"name": "RBAC Svc", "estimated_price": 10},
    )
    inv_resp = client.post(f"/api/admin/appointments/{appt_id}/invoice")
    assert inv_resp.status_code == HTTPStatus.CREATED
    invoice_id = inv_resp.get_json()["data"].get("id") or inv_resp.get_json()["data"].get(
        "invoice", {}
    ).get("id")

    # Now disable dev bypass to enforce auth
    monkeypatch.setattr(root_srv, "DEV_NO_AUTH", False)

    for path in [
        f"/api/admin/invoices/{invoice_id}/receipt.html",
        f"/api/admin/invoices/{invoice_id}/estimate.html",
        f"/api/admin/invoices/{invoice_id}/receipt.pdf",
        f"/api/admin/invoices/{invoice_id}/estimate.pdf",
        f"/api/admin/invoices/{invoice_id}/send",
    ]:
        resp = (
            no_auto_auth_client.get(path)
            if path.endswith((".html", ".pdf"))
            else no_auto_auth_client.post(path)
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, (path, resp.get_data(as_text=True))
        body = resp.get_json()
    assert body["error"]["code"] in ("forbidden", "auth_required")
