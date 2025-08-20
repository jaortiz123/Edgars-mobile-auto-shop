from http import HTTPStatus
from backend.local_server import app
from .utils.error_contract import run_error_contract_tests  # type: ignore


def test_service_operations_error_contract(client):
    # Sanity check success shape
    ok = client.get("/api/admin/service-operations")
    assert ok.status_code == 200
    # Execute reusable contract test for forced variants
    run_error_contract_tests(
        client,
        "/api/admin/service-operations",
        ["bad_request", "forbidden", "not_found", "internal"],
    )
