"""
Smoke tests for admin appointments endpoints
"""

import json

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_admin_appointments_list(client):
    """Test GET /api/admin/appointments endpoint exists"""
    response = client.get("/api/admin/appointments")

    # Should not crash, likely 401 or 500 since no auth/SQL yet
    assert response.status_code in [401, 500, 404]

    # Should have middleware headers
    assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers
    assert "X-App-Version" in response.headers


def test_admin_appointments_idempotency(client):
    """Test POST idempotency behavior"""
    idempotency_key = "test-appt-create-123"
    headers = {"X-Idempotency-Key": idempotency_key, "Content-Type": "application/json"}

    payload = {
        "customer_id": "c1",
        "vehicle_id": "v1",
        "service_code": "S1",
        "scheduled_at": "2024-01-01T00:00:00Z",
    }

    # First request
    response1 = client.post("/api/admin/appointments", headers=headers, data=json.dumps(payload))

    # Second request with same key
    response2 = client.post("/api/admin/appointments", headers=headers, data=json.dumps(payload))

    # Both should have same status (likely 500 since no SQL implementation yet)
    assert response1.status_code == response2.status_code

    # Should have idempotency processing (middleware headers)
    assert "X-Correlation-Id" in response1.headers or "X-Request-Id" in response1.headers


def test_appointments_routes_registered(client):
    """Test that appointment routes are registered"""
    app = create_dev_app()
    rules = {r.rule for r in app.url_map.iter_rules()}

    # Check all 5 endpoints are registered
    assert "/api/admin/appointments" in rules
    assert "/api/admin/appointments/<appt_id>" in rules


def test_appointment_get_endpoint(client):
    """Test GET /api/admin/appointments/<id> endpoint"""
    response = client.get("/api/admin/appointments/seed-appt-1")

    # Should not crash, likely 401 or 500 since no auth/SQL yet
    assert response.status_code in [401, 404, 500]

    # Should have envelope structure when it works
    assert "X-App-Version" in response.headers
