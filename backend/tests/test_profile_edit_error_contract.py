from backend.local_server import app
from http import HTTPStatus
from .utils.error_contract import run_error_contract_tests
import pytest


@pytest.fixture
def client():
    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_customer_profile_contract(client):
    run_error_contract_tests(
        client,
        "/api/admin/customers/123/profile",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_vehicle_profile_contract(client):
    run_error_contract_tests(
        client,
        "/api/admin/vehicles/veh-1/profile",
        ["bad_request", "forbidden", "not_found", "internal"],
    )


def test_patch_customer_contract(client):
    run_error_contract_tests(
        client,
        "/api/admin/customers/123",
        ["bad_request", "forbidden", "not_found", "internal"],
        method="PATCH",
    )


def test_patch_vehicle_contract(client):
    run_error_contract_tests(
        client,
        "/api/admin/vehicles/456",
        ["bad_request", "forbidden", "not_found", "internal"],
        method="PATCH",
    )
