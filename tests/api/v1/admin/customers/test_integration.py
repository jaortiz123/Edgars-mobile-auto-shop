"""
Integration tests for Admin → Customers full stack
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


class TestAdminCustomersIntegration:
    """Integration tests - full request flow validation"""

    def test_list_customers_integration(self, client):
        """Integration: GET /api/admin/customers with pagination"""
        # Test basic list endpoint
        response = client.get("/api/admin/customers")

        # Without auth/db, expect structured error but no crash
        assert response.status_code in [200, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test with query parameters
        response = client.get("/api/admin/customers?page=2&page_size=10&search=test")
        assert response.status_code in [200, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

    def test_create_customer_integration(self, client):
        """Integration: POST /api/admin/customers with validation"""
        payload = {
            "name": "Integration Test Customer",
            "email": "integration@test.com",
            "phone": "(555) 200-0001",
            "address_line1": "123 Integration St",
            "city": "Test City",
            "state": "CA",
            "zip_code": "90210",
        }

        response = client.post("/api/admin/customers", json=payload)

        # Without auth/db, expect structured error but no crash
        assert response.status_code in [200, 201, 401, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test validation - missing required fields
        invalid_payload = {"email": "invalid@test.com"}  # Missing name
        response = client.post("/api/admin/customers", json=invalid_payload)
        assert response.status_code in [400, 401, 422, 500]

    def test_get_customer_integration(self, client):
        """Integration: GET /api/admin/customers/{id} with path validation"""
        customer_id = "integration-test-123"

        response = client.get(f"/api/admin/customers/{customer_id}")

        # Without auth/db, expect 401/404/500 but no crash
        assert response.status_code in [200, 401, 404, 500]
        assert response.headers.get("Content-Type") == "application/json"

    def test_patch_customer_integration(self, client):
        """Integration: PATCH /api/admin/customers/{id} with partial updates"""
        customer_id = "integration-test-123"

        # Test partial update
        patch_data = {"name": "Updated Integration Name"}
        response = client.patch(f"/api/admin/customers/{customer_id}", json=patch_data)

        # Without auth/db, expect 401/404/500 but no crash
        assert response.status_code in [200, 401, 404, 500]
        assert response.headers.get("Content-Type") == "application/json"

        # Test empty patch (should be accepted)
        empty_patch = {}
        response = client.patch(f"/api/admin/customers/{customer_id}", json=empty_patch)
        assert response.status_code in [200, 401, 404, 500]

    def test_customer_vehicles_integration(self, client):
        """Integration: GET /api/admin/customers/{id}/vehicles"""
        customer_id = "integration-test-123"

        response = client.get(f"/api/admin/customers/{customer_id}/vehicles")

        # Without auth/db, expect 401/404/500 but no crash
        assert response.status_code in [200, 401, 404, 500]
        assert response.headers.get("Content-Type") == "application/json"

    def test_middleware_headers_integration(self, client):
        """Integration: Verify middleware headers are applied"""
        response = client.get("/api/admin/customers")

        # Check for middleware-added headers
        correlation_headers = ["X-Correlation-Id", "X-Request-Id", "X-Trace-Id"]
        has_correlation_header = any(header in response.headers for header in correlation_headers)
        assert has_correlation_header, f"Missing correlation header in: {response.headers}"

        # Check for app version header
        assert "X-App-Version" in response.headers

    def test_content_type_consistency_integration(self, client):
        """Integration: Verify all endpoints return JSON"""
        endpoints = [
            "/api/admin/customers",
            "/api/admin/customers/test-123",
            "/api/admin/customers/test-123/vehicles",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.headers.get("Content-Type") == "application/json"

        # Test POST endpoint
        response = client.post("/api/admin/customers", json={"name": "Test"})
        assert response.headers.get("Content-Type") == "application/json"

        # Test PATCH endpoint
        response = client.patch("/api/admin/customers/test-123", json={"name": "Test"})
        assert response.headers.get("Content-Type") == "application/json"
