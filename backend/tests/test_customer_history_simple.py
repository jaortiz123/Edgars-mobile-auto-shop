import pytest
import jwt


def test_simple():
    """Simple test to verify pytest is working"""
    assert True


def test_get_customer_history_requires_authentication(client):
    """Test that the endpoint requires authentication"""
    response = client.get("/api/customers/123/history")

    assert response.status_code == 403
    json_data = response.get_json()
    assert json_data["errors"][0]["code"] == "AUTH_REQUIRED"
