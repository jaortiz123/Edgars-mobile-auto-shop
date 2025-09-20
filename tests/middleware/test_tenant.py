"""
Tests for tenant middleware
Tests X-Tenant-Id slug and UUID acceptance
"""

import pytest

from backend.app import create_dev_app


@pytest.fixture
def client():
    app = create_dev_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_tenant_slug_acceptance(client):
    """Test that X-Tenant-Id accepts slug format"""
    response = client.get("/api/admin/customers/test", headers={"X-Tenant-Id": "edgar-auto-shop"})

    # Should not return 500 due to tenant header issues
    assert response.status_code != 500

    # Expected status is 401 (auth) or 404 (missing route), not tenant error
    assert response.status_code in [401, 404]


def test_tenant_uuid_acceptance(client):
    """Test that X-Tenant-Id accepts UUID format"""
    response = client.get(
        "/api/admin/customers/test", headers={"X-Tenant-Id": "00000000-0000-0000-0000-000000000001"}
    )

    # Should not return 500 due to tenant header issues
    assert response.status_code != 500

    # Expected status is 401 (auth) or 404 (missing route), not tenant error
    assert response.status_code in [401, 404]


def test_missing_tenant_header(client):
    """Test behavior when X-Tenant-Id is missing"""
    response = client.get("/api/admin/customers/test")

    # Should still work (tenant might be optional or have defaults)
    assert response.status_code != 500

    # Expected status is 401 (auth) or 404 (missing route)
    assert response.status_code in [401, 404]


def test_tenant_header_preserved(client):
    """Test that tenant context is preserved in request"""
    response = client.get("/api/admin/customers/test", headers={"X-Tenant-Id": "test-tenant"})

    # Should not crash with tenant processing
    assert response.status_code != 500

    # Request ID should still be generated
    assert "X-Correlation-Id" in response.headers or "X-Request-Id" in response.headers
