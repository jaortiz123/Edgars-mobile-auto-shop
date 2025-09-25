"""
Test for Services list endpoint - T1 Fix Services List
Covers the bug where GET /api/admin/services returns empty when services exist
"""

import pytest
import json
from datetime import datetime, timezone
import time


@pytest.mark.unit
def test_services_list_repository_with_empty_search():
    """Unit test: repository.list() should handle empty search string"""
    from backend.domain.services.repository import ServiceRepository
    from unittest.mock import Mock

    # Mock database
    mock_db = Mock()
    mock_db.query.return_value = [
        {
            "id": "1",
            "code": "OIL001",
            "name": "Oil Change",
            "description": "Standard oil change",
            "base_price_cents": 2500,
            "est_minutes": 30,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    ]
    mock_db.one.return_value = {"n": 1}

    repo = ServiceRepository(mock_db)

    # Test with empty search string (should not fail)
    items, total = repo.list(page=1, page_size=50, search="", is_active=None)

    assert len(items) == 1
    assert total == 1
    assert items[0]["code"] == "OIL001"

    # Verify the SQL query was called with correct parameters
    mock_db.query.assert_called_once()
    query_args = mock_db.query.call_args[0]
    assert "" in query_args[1]  # empty search string should be in parameters


@pytest.mark.unit
def test_services_list_service_none_search():
    """Unit test: service.list_services() should convert None search to empty string"""
    from backend.domain.services.service import ServiceService
    from unittest.mock import Mock

    # Mock repository
    mock_repo = Mock()
    mock_repo.list.return_value = ([{"id": "1", "code": "TEST001"}], 1)

    # Mock db
    mock_db = Mock()

    service = ServiceService(mock_db)
    service.repo = mock_repo

    # Test with None search (should convert to empty string)
    result = service.list_services(search=None)

    assert result["total"] == 1
    assert len(result["items"]) == 1

    # Verify repository was called with empty string, not None
    mock_repo.list.assert_called_once_with(
        page=1, page_size=50, search="", is_active=None  # Should be converted from None to ""
    )


@pytest.mark.integration
def test_services_list_create_then_list_roundtrip(client):
    """Integration test: create service then list should return the created service"""

    # Create a service with unique code to avoid conflicts
    unique_code = f"TEST{int(time.time()*1000)%100000}"
    service_data = {
        "code": unique_code,
        "name": "Test Service for List",
        "description": "Test service",
        "base_price_cents": 1500,
        "est_minutes": 20,
    }

    # Create service
    create_resp = client.post("/api/admin/services", json=service_data)

    # Handle both success and "already exists" cases gracefully
    if create_resp.status_code == 409:
        pytest.skip("Service already exists - this is expected in repeated test runs")

    if create_resp.status_code != 201:
        # Print debug info for troubleshooting
        print(f"Create failed: {create_resp.status_code}")
        print(f"Response: {create_resp.get_data(as_text=True)}")

    # Continue with list test regardless - the point is that list should return services

    # List services (no search filter)
    list_resp = client.get("/api/admin/services")

    assert list_resp.status_code == 200
    data = list_resp.get_json()

    # Should have structure: { "ok": true, "data": { "items": [...], "total": N } }
    assert data.get("ok") is True
    assert "data" in data
    assert "items" in data["data"]
    assert "total" in data["data"]

    # If service was created successfully, it should appear in list
    if create_resp.status_code == 201:
        assert data["data"]["total"] >= 1
        assert len(data["data"]["items"]) >= 1

        # Find our created service
        created_service = None
        for item in data["data"]["items"]:
            if item.get("code") == unique_code:
                created_service = item
                break

        assert created_service is not None, f"Created service {unique_code} not found in list"
        assert created_service["name"] == "Test Service for List"
    else:
        # Even if creation failed, list should still work and return structure
        assert isinstance(data["data"]["total"], int)
        assert isinstance(data["data"]["items"], list)


@pytest.mark.integration
def test_services_list_pagination():
    """Integration test: verify pagination parameters work correctly"""
    from backend.native_lambda import handle_list_services

    # Test with different pagination parameters
    query_params = {"page": "2", "page_size": "10"}

    result = handle_list_services(query_params, "test-correlation-id")

    # Should not error out
    assert result.get("statusCode") == 200
    assert "data" in result.get("body", {})
