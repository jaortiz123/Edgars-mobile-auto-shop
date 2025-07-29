import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

# Use shared client and fake_db fixtures from conftest

def test_get_admin_appointments_returns_empty_list_if_no_db(client, monkeypatch):
    # Simulate DB unavailable
    import backend.local_server as srv
    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    r = client.get("/api/admin/appointments")
    assert r.status_code == 200
    j = r.get_json()
    # Envelope response shape
    assert j.get("data") is not None
    assert j["data"]["appointments"] == []
    assert j["data"]["nextCursor"] is None
    assert j.get("errors") is None
    assert "request_id" in j.get("meta", {})


def test_get_admin_appointments_orders_by_start_ts_asc_id_asc(client, monkeypatch):
    """Test T-011: Board ordering integration test after start_ts switch.
    
    Verifies that appointments are correctly ordered by start_ts ASC, id ASC
    when multiple appointments exist with different start times.
    """
    import backend.local_server as srv
    
    # Create mock appointment data with different start_ts times
    # Earlier appointment (10:00 AM)
    earlier_start = datetime(2025, 7, 29, 10, 0, 0, tzinfo=timezone.utc)
    # Later appointment (11:00 AM) 
    later_start = datetime(2025, 7, 29, 11, 0, 0, tzinfo=timezone.utc)
    
    mock_appointments = [
        {
            'id': 'apt-1001',
            'status': 'SCHEDULED',
            'start_ts': earlier_start,
            'end_ts': datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            'total_amount': 150.00,
            'customer_name': 'John Doe',
            'vehicle_label': 'Honda Civic'
        },
        {
            'id': 'apt-1002', 
            'status': 'SCHEDULED',
            'start_ts': later_start,
            'end_ts': datetime(2025, 7, 29, 11, 30, 0, tzinfo=timezone.utc),
            'total_amount': 200.00,
            'customer_name': 'Jane Smith',
            'vehicle_label': 'Toyota Camry'
        }
    ]
    
    # Mock database connection and cursor
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_cursor.fetchall.return_value = mock_appointments
    mock_conn.close = MagicMock()
    
    # Mock db_conn to return our mock connection
    monkeypatch.setattr(srv, "db_conn", lambda: mock_conn)
    
    # Make the request
    r = client.get("/api/admin/appointments")
    assert r.status_code == 200
    j = r.get_json()
    
    # Verify JSON envelope structure
    assert j.get("data") is not None
    assert j.get("errors") is None
    assert "request_id" in j.get("meta", {})
    
    # Verify appointments are returned in correct order
    appointments = j["data"]["appointments"]
    assert len(appointments) == 2
    
    # The earlier appointment (10:00 AM) should appear first
    assert appointments[0]["id"] == "apt-1001"
    assert appointments[0]["start_ts"] == "2025-07-29T10:00:00+00:00"
    
    # The later appointment (11:00 AM) should appear second  
    assert appointments[1]["id"] == "apt-1002"
    assert appointments[1]["start_ts"] == "2025-07-29T11:00:00+00:00"
    
    # Verify the SQL query was called with correct ORDER BY clause
    # The actual SQL should include "ORDER BY a.start_ts ASC, a.id ASC"
    mock_cursor.execute.assert_called_once()
    sql_query = mock_cursor.execute.call_args[0][0]
    assert "ORDER BY a.start_ts ASC, a.id ASC" in sql_query


def test_get_admin_appointments_rejects_limit_over_200(client, monkeypatch):
    """Test that requests with limit >200 return HTTP 400 with proper JSON envelope"""
    # Simulate DB unavailable to avoid actual DB operations
    import backend.local_server as srv
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    
    r = client.get("/api/admin/appointments?limit=250")
    assert r.status_code == 400
    j = r.get_json()
    
    # Verify JSON envelope structure
    assert j.get("data") is None
    assert isinstance(j.get("errors"), list)
    assert len(j["errors"]) == 1
    assert j["errors"][0]["status"] == "400"
    assert j["errors"][0]["code"] == "BAD_REQUEST"
    assert "limit must be between 1 and 200" in j["errors"][0]["detail"]
    assert "request_id" in j.get("meta", {})


def test_get_admin_appointments_rejects_cursor_plus_offset(client, monkeypatch):
    """Test that requests with both cursor and offset parameters return HTTP 400 with proper JSON envelope"""
    # Simulate DB unavailable to avoid actual DB operations
    import backend.local_server as srv
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    
    r = client.get("/api/admin/appointments?cursor=abc123&offset=10")
    assert r.status_code == 400
    j = r.get_json()
    
    # Verify JSON envelope structure
    assert j.get("data") is None
    assert isinstance(j.get("errors"), list)
    assert len(j["errors"]) == 1
    assert j["errors"][0]["status"] == "400"
    assert j["errors"][0]["code"] == "BAD_REQUEST"
    assert "cannot use both cursor and offset parameters together" in j["errors"][0]["detail"]
    assert "request_id" in j.get("meta", {})


def test_get_admin_appointments_orders_by_id_when_same_start_ts(client, monkeypatch):
    """Test T-011: Secondary ordering by id ASC when start_ts is identical.
    
    Verifies that when multiple appointments have the same start_ts,
    they are ordered by id ASC as the secondary sort key.
    """
    import backend.local_server as srv
    
    # Create mock appointment data with identical start_ts times
    same_start = datetime(2025, 7, 29, 10, 0, 0, tzinfo=timezone.utc)
    
    mock_appointments = [
        {
            'id': 'apt-1001',
            'status': 'SCHEDULED', 
            'start_ts': same_start,
            'end_ts': datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            'total_amount': 150.00,
            'customer_name': 'John Doe',
            'vehicle_label': 'Honda Civic'
        },
        {
            'id': 'apt-1002',
            'status': 'SCHEDULED',
            'start_ts': same_start,
            'end_ts': datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            'total_amount': 200.00,
            'customer_name': 'Jane Smith', 
            'vehicle_label': 'Toyota Camry'
        }
    ]
    
    # Mock database connection and cursor
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_cursor.fetchall.return_value = mock_appointments
    mock_conn.close = MagicMock()
    
    # Mock db_conn to return our mock connection
    monkeypatch.setattr(srv, "db_conn", lambda: mock_conn)
    
    # Make the request
    r = client.get("/api/admin/appointments")
    assert r.status_code == 200
    j = r.get_json()
    
    # Verify appointments are returned in correct order by id
    appointments = j["data"]["appointments"]
    assert len(appointments) == 2
    
    # With same start_ts, should be ordered by id ASC
    assert appointments[0]["id"] == "apt-1001"  # Lower id first
    assert appointments[1]["id"] == "apt-1002"  # Higher id second
    
    # Both should have the same start_ts
    assert appointments[0]["start_ts"] == "2025-07-29T10:00:00+00:00"
    assert appointments[1]["start_ts"] == "2025-07-29T10:00:00+00:00"
