from http import HTTPStatus
from backend.local_server import app  # noqa: F401
from .utils.error_contract import run_error_contract_tests  # type: ignore

# Contract tests for invoice rendering (HTML/PDF) endpoints and send endpoint.
# Even though success returns HTML/PDF or 202 JSON, forced errors must return unified JSON envelope.


def test_invoice_receipt_html_forced_errors(client):
    run_error_contract_tests(
        client,
        "/api/admin/invoices/inv-1/receipt.html",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_invoice_estimate_html_forced_errors(client):
    run_error_contract_tests(
        client,
        "/api/admin/invoices/inv-1/estimate.html",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_invoice_receipt_pdf_forced_errors(client):
    run_error_contract_tests(
        client,
        "/api/admin/invoices/inv-1/receipt.pdf",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_invoice_estimate_pdf_forced_errors(client):
    run_error_contract_tests(
        client,
        "/api/admin/invoices/inv-1/estimate.pdf",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_invoice_send_forced_errors(client):
    # For POST we still use query param to force error; body not needed (short-circuit)
    for key in ["bad_request", "forbidden", "not_found", "internal"]:
        r = client.post(f"/api/admin/invoices/inv-1/send?test_error={key}", json={})
        data = r.get_json()
        assert isinstance(data, dict)
        assert "error" in data and "meta" in data
        # Basic mapping expectations (lowercase code in envelope)
        expected_status = {
            "bad_request": HTTPStatus.BAD_REQUEST,
            "forbidden": HTTPStatus.FORBIDDEN,
            "not_found": HTTPStatus.NOT_FOUND,
            "internal": HTTPStatus.INTERNAL_SERVER_ERROR,
        }[key]
        assert r.status_code == expected_status
        assert data["error"]["code"] == key
