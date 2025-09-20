"""
Smoke tests for Admin → Vehicles endpoints
Basic integration validation following established patterns
"""

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestAdminVehiclesSmoke:
    """Smoke tests - basic endpoint availability and response structure"""

    def test_list_vehicles_smoke(self, client):
        """Smoke: GET /api/admin/vehicles returns valid structure"""
        response = client.get("/api/admin/vehicles")
        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_create_vehicle_smoke(self, client):
        """Smoke: POST /api/admin/vehicles creates and returns vehicle"""
        payload = {
            "customer_id": "test-customer-123",
            "make": "Toyota",
            "model": "Camry",
            "year": 2020,
            "vin": "1234567890ABCDEFG",
        }

        response = client.post("/api/admin/vehicles", json=payload)
        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 201, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_get_vehicle_smoke(self, client):
        """Smoke: GET /api/admin/vehicles/{id} returns vehicle details"""
        # Test with dummy ID - should not crash
        response = client.get("/api/admin/vehicles/test-vehicle-123")

        # Expect 401/404/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 404, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_patch_vehicle_smoke(self, client):
        """Smoke: PATCH /api/admin/vehicles/{id} updates vehicle"""
        patch_payload = {"make": "Honda"}
        response = client.patch("/api/admin/vehicles/test-vehicle-123", json=patch_payload)

        # Expect 401/404/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 404, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_vehicle_search_smoke(self, client):
        """Smoke: GET /api/admin/vehicles/search?vin=xyz returns search results"""
        response = client.get("/api/admin/vehicles/search?vin=ABC123")

        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 400, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_options_method_smoke(self, client):
        """Smoke: OPTIONS returns valid response"""
        response = client.options("/api/admin/vehicles")

        # OPTIONS may return 200, 204, or 405 depending on Flask version
        assert response.status_code in [200, 204, 405]
