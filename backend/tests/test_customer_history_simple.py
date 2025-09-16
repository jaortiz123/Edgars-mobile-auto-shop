import pytest
import jwt


@pytest.mark.integration
def test_simple():
    """Simple test to verify pytest is working"""
    assert True


@pytest.mark.integration
def test_get_customer_history_requires_authentication(no_auto_auth_client):
    """Test that the endpoint requires authentication"""
    response = no_auto_auth_client.get("/api/customers/123/history")

    assert response.status_code == 403
    json_data = response.get_json()
    assert json_data["error"]["code"] in ("auth_required", "forbidden")


import pytest


@pytest.fixture(autouse=True)
def _bypass_tenant(monkeypatch):
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
