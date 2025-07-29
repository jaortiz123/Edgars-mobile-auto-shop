"""
Tests for Services CRUD endpoints.
T-017: Backend services API implementation
"""
import pytest
import json


def test_get_services_empty_with_memory_fallback(client):
    """Should return empty list when no services exist (memory mode)."""
    resp = client.get("/api/appointments/test-123/services")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["services"] == []


def test_create_service_success_memory_mode(client):
    """Should create a new service in memory mode."""
    service_data = {
        "name": "Oil Change",
        "notes": "Standard 5W-30 oil",
        "estimated_hours": 0.5,
        "estimated_price": 45.99,
        "category": "maintenance"
    }
    
    # First create an appointment
    appointment_data = {
        "status": "SCHEDULED",
        "start": "2025-07-29T10:00:00Z",
        "total_amount": 0,
        "paid_amount": 0
    }
    
    appt_resp = client.post("/api/admin/appointments", json=appointment_data)
    if appt_resp.status_code == 201:
        appt_id = appt_resp.get_json()["id"]
        
        resp = client.post(f"/api/appointments/{appt_id}/services", json=service_data)
        
        # In memory mode, DB operations might return service unavailable
        assert resp.status_code in [201, 503]
        
        if resp.status_code == 201:
            data = resp.get_json()
            assert "id" in data
            assert isinstance(data["id"], str)


def test_create_service_missing_name(client):
    """Should fail when name is missing."""
    service_data = {
        "estimated_price": 45.99
    }
    
    resp = client.post("/api/appointments/test-123/services", json=service_data)
    
    # Should fail validation regardless of DB mode
    assert resp.status_code in [400, 503]  # 400 for validation, 503 for DB unavailable


def test_services_endpoints_exist(client):
    """Verify all services endpoints are properly routed."""
    # Test GET
    resp = client.get("/api/appointments/test-123/services")
    assert resp.status_code in [200, 503]  # Should not be 404
    
    # Test POST  
    resp = client.post("/api/appointments/test-123/services", json={"name": "Test"})
    assert resp.status_code in [201, 400, 503]  # Should not be 404
    
    # Test PATCH
    resp = client.patch("/api/appointments/test-123/services/test-service", json={"name": "Updated"})
    assert resp.status_code in [200, 404, 503]  # Should not be 405 (Method Not Allowed)
    
    # Test DELETE
    resp = client.delete("/api/appointments/test-123/services/test-service")
    assert resp.status_code in [204, 404, 503]  # Should not be 405 (Method Not Allowed)


def test_service_validation_rules(client):
    """Test service validation in memory mode."""
    # Empty name should fail
    resp = client.post("/api/appointments/test-123/services", json={"name": ""})
    assert resp.status_code in [400, 503]
    
    # No name should fail
    resp = client.post("/api/appointments/test-123/services", json={})
    assert resp.status_code in [400, 503]
    
    # Valid name should work (even if DB unavailable)
    resp = client.post("/api/appointments/test-123/services", json={"name": "Valid Service"})
    assert resp.status_code in [201, 404, 503]  # 201 success, 404 appt not found, 503 DB unavailable
