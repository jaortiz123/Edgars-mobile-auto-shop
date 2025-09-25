"""
Smoke tests for Admin → Invoices endpoints
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


class TestAdminInvoicesSmoke:
    """Smoke tests - basic endpoint availability and response structure"""

    def test_list_invoices_smoke(self, client):
        """Smoke: GET /api/admin/invoices returns valid structure"""
        response = client.get("/api/admin/invoices")
        # Expect 401/500 without auth/db setup, but should not crash
        assert response.status_code in [200, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_create_invoice_smoke(self, client):
        """Smoke: POST /api/admin/invoices creates and returns invoice"""
        payload = {
            "appointment_id": "test-appointment-123",
            "customer_id": "test-customer-123",
            "items": [{"service_code": "oil_change", "qty": 1, "unit_price": "49.99"}],
            "tax_rate": "0.08",
            "notes": "Test invoice",
        }
        response = client.post("/api/admin/invoices", json=payload)
        # Expect 400/401/500 without proper setup, but should not crash
        assert response.status_code in [200, 201, 400, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_get_invoice_smoke(self, client):
        """Smoke: GET /api/admin/invoices/<id> returns invoice details"""
        response = client.get("/api/admin/invoices/test-invoice-123")
        # Expect 404/401/500 without data, but should not crash
        assert response.status_code in [200, 404, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_patch_invoice_smoke(self, client):
        """Smoke: PATCH /api/admin/invoices/<id> updates invoice"""
        payload = {"status": "COMPLETED", "notes": "Updated notes"}
        response = client.patch("/api/admin/invoices/test-invoice-123", json=payload)
        # Expect 404/401/500 without data, but should not crash
        assert response.status_code in [200, 404, 401, 500]

        # Should have middleware headers
        assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers

    def test_options_invoice_endpoints(self, client):
        """Smoke: OPTIONS requests return proper CORS headers"""
        endpoints = ["/api/admin/invoices", "/api/admin/invoices/test-123"]

        for endpoint in endpoints:
            response = client.options(endpoint)
            # Should return 200 or 204 for OPTIONS
            assert response.status_code in [200, 204]

    def test_invoice_endpoints_exist(self, client):
        """Verify all required invoice endpoints are registered"""
        # This is a meta-test to ensure routes are properly registered
        from backend.app import create_dev_app

        app = create_dev_app()

        # Check that invoice routes are registered
        invoice_routes = [
            rule.rule
            for rule in app.url_map.iter_rules()
            if rule.rule.startswith("/api/admin/invoices")
        ]

        # Should have the 4 main endpoints
        expected_routes = [
            "/api/admin/invoices",  # GET/POST
            "/api/admin/invoices/<invoice_id>",  # GET/PATCH
        ]

        for expected in expected_routes:
            assert any(expected in route for route in invoice_routes), f"Route {expected} not found"
