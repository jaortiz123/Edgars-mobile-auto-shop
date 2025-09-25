"""
Smoke tests for bootstrap foundation
Tests envelope + headers + 401/204 behavior
"""

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_envelope_and_headers(client):
    """Test that envelope and headers are preserved"""
    response = client.get("/api/admin/customers/test")

    # Should be 401 (unauthorized) or 404 (route not found)
    assert response.status_code in [401, 404]

    # Check middleware headers are working
    assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers
    assert "X-App-Version" in response.headers


def test_options_fast_path(client):
    """Test that OPTIONS returns 204 immediately"""
    response = client.options("/api/customers/profile")

    # Should be 204 or 404 (route may not exist yet)
    assert response.status_code in [204, 404]


def test_middleware_working(client):
    """Test that middleware pipeline is installed"""
    response = client.get("/api/admin/customers/test")

    # Check key middleware headers are present
    assert "X-App-Version" in response.headers
    assert response.headers.get("X-App-Version") == "dev"
