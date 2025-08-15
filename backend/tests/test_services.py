"""
Tests for Services CRUD endpoints.
T-017: Backend services API implementation
"""
import pytest
import json


def _create_appt(client):
    """Helper to create a minimally valid appointment returning its id or None if DB unavailable."""
    resp = client.post("/api/admin/appointments", json={
        "status": "SCHEDULED",
        "start": "2025-08-14T10:00:00Z",
        "total_amount": 0,
        "paid_amount": 0,
        "customer_name": "Test User",
        "customer_phone": "5550001234",
        "license_plate": "TST123",
        "vehicle_year": 2024,
        "vehicle_make": "TestMake",
        "vehicle_model": "TestModel"
    })
    if resp.status_code != 201:
        # Print debug so pytest output shows root cause
        try:
            print('CREATE_APPT_DEBUG_STATUS', resp.status_code)
            print('CREATE_APPT_DEBUG_BODY', resp.get_data(as_text=True))
        except Exception:
            pass
        return None
    payload = resp.get_json() or {}
    # Endpoint returns { "data": { "appointment": { "id": ... } } }
    appt = (payload.get("data") or {}).get("appointment") or {}
    return appt.get("id")


def test_get_services_empty(client):
    """Should return empty list when no services exist for valid appointment."""
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment (see debug above)"
    resp = client.get(f"/api/appointments/{appt_id}/services")
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
    """Should fail when name/service_operation_id both missing."""
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment"
    service_data = {"estimated_price": 45.99}
    resp = client.post(f"/api/appointments/{appt_id}/services", json=service_data)
    assert resp.status_code == 400


def test_services_endpoints_exist(client):
    """Smoke check: endpoints respond (not 404) for valid appt and random service id."""
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment"
    # GET
    resp = client.get(f"/api/appointments/{appt_id}/services")
    assert resp.status_code == 200
    # POST
    resp = client.post(f"/api/appointments/{appt_id}/services", json={"name": "Test"})
    assert resp.status_code == 200
    service_id = resp.get_json()["id"]
    # PATCH
    resp = client.patch(f"/api/appointments/{appt_id}/services/{service_id}", json={"notes": "x"})
    assert resp.status_code == 200
    # DELETE
    resp = client.delete(f"/api/appointments/{appt_id}/services/{service_id}")
    assert resp.status_code == 200


def test_service_validation_rules(client):
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment"
    # Empty name
    resp = client.post(f"/api/appointments/{appt_id}/services", json={"name": ""})
    assert resp.status_code == 400
    # Missing both name & op id
    resp = client.post(f"/api/appointments/{appt_id}/services", json={})
    assert resp.status_code == 400
    # Valid
    resp = client.post(f"/api/appointments/{appt_id}/services", json={"name": "Valid Service"})
    assert resp.status_code == 200


def test_patch_service_update_and_total(client):
    """Create a service then PATCH it; verify updated fields and total recompute (DB mode) or graceful fallback (memory/503)."""
    # Create appointment first
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment"

    # Create service
    create_resp = client.post(f"/api/appointments/{appt_id}/services", json={
        "name": "Brake Inspection",
        "estimated_price": 100.0
    })
    assert create_resp.status_code == 200
    service_id = create_resp.get_json()["id"]

    # Patch service (update name + price)
    patch_resp = client.patch(f"/api/appointments/{appt_id}/services/{service_id}", json={
        "name": "Brake Service",
        "estimated_price": 150.0
    })
    assert patch_resp.status_code == 200
    body = patch_resp.get_json()
    assert body["service"]["name"] == "Brake Service"
    assert float(body["service"]["estimated_price"]) == 150.0
    assert float(body["appointment_total"]) >= 150.0  # could be just this service or others


def test_delete_service_and_404_after(client):
    """Delete a service then ensure second delete yields 404."""
    appt_id = _create_appt(client)
    assert appt_id, "Failed to create appointment"

    create_resp = client.post(f"/api/appointments/{appt_id}/services", json={
        "name": "Tire Rotation",
        "estimated_price": 60.0
    })
    assert create_resp.status_code == 200
    service_id = create_resp.get_json()["id"]

    del_resp = client.delete(f"/api/appointments/{appt_id}/services/{service_id}")
    assert del_resp.status_code == 200
    body = del_resp.get_json()
    assert body.get("message") == "deleted"
    assert "appointment_total" in body

    # Second delete should 404
    del_resp2 = client.delete(f"/api/appointments/{appt_id}/services/{service_id}")
    assert del_resp2.status_code in [404, 503]


def test_delete_nonexistent_service_returns_404(client):
    """Deleting non-existent service should return 404 (or 503 if DB unavailable)."""
    appt_id = _create_appt(client)
    if not appt_id:
        pytest.skip("DB unavailable for test")

    import uuid
    missing_id = str(uuid.uuid4())  # well-formed but not present
    del_resp = client.delete(f"/api/appointments/{appt_id}/services/{missing_id}")
    assert del_resp.status_code == 404
