import pytest

print("Starting test file import")

import pytest

print("pytest imported")

import jwt

print("jwt imported")


@pytest.mark.integration
def test_simple():
    """Simple test to verify pytest is working"""
    assert True


print("test_simple function defined")


@pytest.mark.integration
def test_get_customer_history_requires_authentication(no_auto_auth_client):
    """Test that the endpoint requires authentication"""
    response = no_auto_auth_client.get("/api/customers/123/history")

    assert response.status_code == 403
    json_data = response.get_json()
    assert json_data["error"]["code"] == "auth_required"


print("test_get_customer_history_requires_authentication function defined")
print("Test file completed")
import pytest


@pytest.fixture(autouse=True)
def _bypass_tenant(monkeypatch):
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
