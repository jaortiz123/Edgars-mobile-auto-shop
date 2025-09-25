"""
Test that profile routes are registered correctly
"""

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_profile_routes_registered():
    """Test that both profile routes are registered"""
    app = create_dev_app()
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert "/api/customers/profile" in rules
    assert "/customers/profile" in rules


def test_profile_options_fast_path(client):
    """Test OPTIONS returns 204 for both routes"""

    # Test canonical route
    response = client.options("/api/customers/profile")
    assert response.status_code == 204
    assert response.data == b""

    # Test legacy route
    response = client.options("/customers/profile")
    assert response.status_code == 204
    assert response.data == b""


def test_profile_fallback_behavior(client):
    """Test that GET/PUT return 501 when no legacy handler"""

    # Test canonical route
    response = client.get("/api/customers/profile")
    assert response.status_code == 501
    data = response.get_json()
    # Response is envelope wrapped
    assert data["ok"] == False
    assert "error" in data

    # Test legacy route
    response = client.get("/customers/profile")
    assert response.status_code == 501
    data = response.get_json()
    # Response is envelope wrapped
    assert data["ok"] == False
    assert "error" in data
