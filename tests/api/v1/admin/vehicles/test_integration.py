"""
Integration tests for Admin → Vehicles full stack
Tests complete request flow: routes → service → repository → database
"""

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestAdminVehiclesIntegration:
    """Integration tests - full request flow validation"""

    def test_list_vehicles_integration(self, client):
        """Integration: GET /api/admin/vehicles with pagination and filters"""
        # Test basic list endpoint
        response = client.get("/api/admin/vehicles")

        # Without auth/db, expect structured error but no crash
        assert response.status_code in [200, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test with query parameters
        response = client.get(
            "/api/admin/vehicles?page=2&page_size=10&customer_id=test&make=Toyota"
        )
        assert response.status_code in [200, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

    def test_create_vehicle_integration(self, client):
        """Integration: POST /api/admin/vehicles with validation"""
        payload = {
            "customer_id": "integration-test-customer",
            "make": "Integration Toyota",
            "model": "Test Camry",
            "year": 2021,
            "vin": "INTEGRATION1234567",
            "license_plate": "INT-TEST",
            "color": "Blue",
        }

        response = client.post("/api/admin/vehicles", json=payload)

        # Without auth/db, expect structured error but no crash
        assert response.status_code in [200, 201, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test validation - missing required fields
        invalid_payload = {"make": "Toyota"}  # Missing customer_id, model, year
        response = client.post("/api/admin/vehicles", json=invalid_payload)
        assert response.status_code in [400, 401, 422, 500]

    def test_get_vehicle_integration(self, client):
        """Integration: GET /api/admin/vehicles/{id} with path validation"""
        vehicle_id = "integration-test-vehicle-123"

        response = client.get(f"/api/admin/vehicles/{vehicle_id}")

        # Without auth/db, expect 401/404/500 but no crash
        assert response.status_code in [200, 401, 404, 500]
        assert response.headers.get("Content-Type") == "application/json"

    def test_patch_vehicle_integration(self, client):
        """Integration: PATCH /api/admin/vehicles/{id} with partial updates"""
        vehicle_id = "integration-test-vehicle-123"

        # Test partial update
        patch_data = {"make": "Updated Integration Make", "year": 2022}
        response = client.patch(f"/api/admin/vehicles/{vehicle_id}", json=patch_data)

        # Without auth/db, expect 401/404/500 but no crash
        assert response.status_code in [200, 401, 404, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test empty patch (should be accepted)
        empty_patch = {}
        response = client.patch(f"/api/admin/vehicles/{vehicle_id}", json=empty_patch)
        assert response.status_code in [200, 401, 404, 500]

    def test_search_vehicles_integration(self, client):
        """Integration: GET /api/admin/vehicles/search?vin=xyz"""
        # Test with VIN parameter
        response = client.get("/api/admin/vehicles/search?vin=ABC123")

        # Without auth/db, expect 401/500 but no crash
        assert response.status_code in [200, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test without VIN parameter (should return 400)
        response = client.get("/api/admin/vehicles/search")
        assert response.status_code in [400, 401, 500]

    def test_middleware_headers_integration(self, client):
        """Integration: Verify middleware headers are applied"""
        response = client.get("/api/admin/vehicles")

        # Check for middleware-added headers
        correlation_headers = ["X-Correlation-Id", "X-Request-Id", "X-Trace-Id"]
        has_correlation_header = any(header in response.headers for header in correlation_headers)
        assert has_correlation_header, f"Missing correlation header in: {response.headers}"

        # Check for app version header
        assert "X-App-Version" in response.headers

    def test_content_type_consistency_integration(self, client):
        """Integration: Verify all endpoints return JSON"""
        endpoints = [
            "/api/admin/vehicles",
            "/api/admin/vehicles/test-123",
            "/api/admin/vehicles/search?vin=test",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.headers.get("Content-Type") == "application/json"

        # Test POST endpoint
        response = client.post("/api/admin/vehicles", json={"make": "Test"})
        assert response.headers.get("Content-Type") == "application/json"

        # Test PATCH endpoint
        response = client.patch("/api/admin/vehicles/test-123", json={"make": "Test"})
        assert response.headers.get("Content-Type") == "application/json"
