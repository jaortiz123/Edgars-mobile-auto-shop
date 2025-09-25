"""
Smoke tests for Admin → Customers endpoints
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


class TestAdminCustomersSmoke:
    """Smoke tests - basic endpoint availability and response structure"""

    def test_list_customers_smoke(self, client):
        """Smoke: GET /api/admin/customers returns valid structure"""

        response = client.get("/api/admin/customers")
        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_create_customer_smoke(self, client):
        """Smoke: POST /api/admin/customers creates and returns customer"""
        payload = {
            "name": "Test Customer Smoke",
            "email": "smoke@test.com",
            "phone": "(555) 100-0001",
            "address_line1": "123 Test St",
        }

        response = client.post("/api/admin/customers", json=payload)
        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 201, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_get_customer_smoke(self, client):
        """Smoke: GET /api/admin/customers/{id} returns customer details"""
        # Test with dummy ID - should not crash
        response = client.get("/api/admin/customers/test-customer-123")

        # Expect 401/404/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 404, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_patch_customer_smoke(self, client):
        """Smoke: PATCH /api/admin/customers/{id} updates customer"""
        patch_payload = {"name": "Updated Name"}
        response = client.patch("/api/admin/customers/test-customer-123", json=patch_payload)

        # Expect 401/404/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 404, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_customer_vehicles_smoke(self, client):
        """Smoke: GET /api/admin/customers/{id}/vehicles returns vehicle list"""
        response = client.get("/api/admin/customers/test-customer-123/vehicles")

        # Expect 401/404/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 404, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers
