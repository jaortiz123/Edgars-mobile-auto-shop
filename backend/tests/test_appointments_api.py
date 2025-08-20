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
    assert "errors" not in j
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
            "id": "apt-1001",
            "status": "SCHEDULED",
            "start_ts": earlier_start,
            "end_ts": datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            "total_amount": 150.00,
            "customer_name": "John Doe",
            "vehicle_label": "Honda Civic",
        },
        {
            "id": "apt-1002",
            "status": "SCHEDULED",
            "start_ts": later_start,
            "end_ts": datetime(2025, 7, 29, 11, 30, 0, tzinfo=timezone.utc),
            "total_amount": 200.00,
            "customer_name": "Jane Smith",
            "vehicle_label": "Toyota Camry",
        },
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
    assert "errors" not in j
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
    assert "error" in j and j["error"]["code"] == "bad_request"
    assert "limit must be between 1 and 200" in j["error"]["message"].lower()
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
    assert "error" in j and j["error"]["code"] == "bad_request"
    assert "cannot use both cursor and offset" in j["error"]["message"].lower()
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
            "id": "apt-1001",
            "status": "SCHEDULED",
            "start_ts": same_start,
            "end_ts": datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            "total_amount": 150.00,
            "customer_name": "John Doe",
            "vehicle_label": "Honda Civic",
        },
        {
            "id": "apt-1002",
            "status": "SCHEDULED",
            "start_ts": same_start,
            "end_ts": datetime(2025, 7, 29, 10, 30, 0, tzinfo=timezone.utc),
            "total_amount": 200.00,
            "customer_name": "Jane Smith",
            "vehicle_label": "Toyota Camry",
        },
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


def test_get_admin_appointments_invalid_from_date_format_returns_400(client):
    """Test T-008: Invalid 'from' date format should return HTTP 400"""
    r = client.get("/api/admin/appointments?from=invalid-date")
    assert r.status_code == 400
    j = r.get_json()
    assert "error" in j
    assert j["error"]["code"] == "bad_request"
    assert "invalid 'from' date format" in j["error"]["message"].lower()


def test_get_admin_appointments_invalid_to_date_format_returns_400(client):
    """Test T-008: Invalid 'to' date format should return HTTP 400"""
    r = client.get("/api/admin/appointments?to=not-a-date")
    assert r.status_code == 400
    j = r.get_json()
    assert "error" in j
    assert j["error"]["code"] == "bad_request"
    assert "invalid 'to' date format" in j["error"]["message"].lower()


def test_get_admin_appointments_malformed_date_formats_return_400(client):
    """Test T-008: Various malformed date formats should return HTTP 400"""
    malformed_dates = [
        "2023-13-01",  # Invalid month
        "2023-02-30",  # Invalid day
        "23-01-01",  # Wrong year format
        "2023/01/01",  # Wrong separator
        "January 1, 2023",  # Text format
        "2023-01-01T25:00:00Z",  # Invalid hour
        "invalid-date",  # Completely invalid
        "not-a-date",  # Completely invalid
    ]

    for bad_date in malformed_dates:
        r = client.get(f"/api/admin/appointments?from={bad_date}")
        assert r.status_code == 400, f"Expected 400 for date: {bad_date}"

        r = client.get(f"/api/admin/appointments?to={bad_date}")
        assert r.status_code == 400, f"Expected 400 for date: {bad_date}"


def test_get_admin_appointments_valid_date_formats_accepted(client, monkeypatch):
    """Test T-008: Valid ISO date formats should be accepted"""
    import backend.local_server as srv

    # Mock DB to avoid actual database calls
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_cursor.fetchall.return_value = []
    monkeypatch.setattr(srv, "db_conn", lambda: mock_conn)

    valid_dates = [
        "2023-01-01T00:00:00Z",
        "2023-12-31T23:59:59Z",
        "2023-06-15T12:30:45Z",
        "2023-01-01T00:00:00+00:00",
        "2023-01-01T10:30:00-05:00",
        "2023-01-01",  # Date only format
        "2023-01-01 10:00:00",  # Space separator (valid in Python)
    ]

    for valid_date in valid_dates:
        r = client.get(f"/api/admin/appointments?from={valid_date}")
        assert r.status_code == 200, f"Expected 200 for valid date: {valid_date}"

        r = client.get(f"/api/admin/appointments?to={valid_date}")
        assert r.status_code == 200, f"Expected 200 for valid date: {valid_date}"


def test_get_admin_appointments_limit_validation_edge_cases(client):
    """Test T-008: Edge cases for limit parameter validation"""
    # Test boundary values
    r = client.get("/api/admin/appointments?limit=1")
    assert r.status_code == 200  # Minimum valid limit

    r = client.get("/api/admin/appointments?limit=200")
    assert r.status_code == 200  # Maximum valid limit

    # Test invalid values
    r = client.get("/api/admin/appointments?limit=0")
    assert r.status_code == 400

    r = client.get("/api/admin/appointments?limit=201")
    assert r.status_code == 400

    r = client.get("/api/admin/appointments?limit=-1")
    assert r.status_code == 400


def test_get_admin_appointments_offset_validation_edge_cases(client):
    """Test T-008: Edge cases for offset parameter validation"""
    # Test valid values
    r = client.get("/api/admin/appointments?offset=0")
    assert r.status_code == 200  # Minimum valid offset

    r = client.get("/api/admin/appointments?offset=1000")
    assert r.status_code == 200  # Large valid offset

    # Test invalid values
    r = client.get("/api/admin/appointments?offset=-1")
    assert r.status_code == 400


def test_get_admin_appointments_all_filters_combined(client, monkeypatch):
    """Test T-008: All filter parameters working together"""
    import backend.local_server as srv

    # Mock DB to capture the SQL query and parameters
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_cursor.fetchall.return_value = []
    monkeypatch.setattr(srv, "db_conn", lambda: mock_conn)

    # Make request with all filters
    params = {
        "status": "scheduled",
        "from": "2023-01-01T00:00:00Z",
        "to": "2023-12-31T23:59:59Z",
        "techId": "tech-123",
        "q": "honda",
        "limit": "50",
        "offset": "10",
    }

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    r = client.get(f"/api/admin/appointments?{query_string}")
    assert r.status_code == 200

    # Verify the SQL query was executed (mock was called)
    assert mock_cursor.execute.called

    # Get the executed query and parameters
    call_args = mock_cursor.execute.call_args
    executed_query = call_args[0][0]
    executed_params = call_args[0][1]

    # Verify all filter conditions are in the query
    assert "a.status = %s" in executed_query
    assert "a.start_ts >= %s" in executed_query
    assert "a.end_ts <= %s" in executed_query
    assert "a.tech_id = %s" in executed_query
    assert "ILIKE %s" in executed_query  # Text search
    assert "ORDER BY a.start_ts ASC, a.id ASC" in executed_query
    assert "LIMIT %s OFFSET %s" in executed_query

    # Verify parameters match expected values (convert tuple to list for comparison)
    expected_params = [
        "SCHEDULED",  # normalized status
        "2023-01-01T00:00:00Z",  # from
        "2023-12-31T23:59:59Z",  # to
        "tech-123",  # techId
        "%honda%",
        "%honda%",
        "%honda%",
        "%honda%",
        "%honda%",  # q search (5 fields)
        50,  # limit
        10,  # offset
    ]
    assert list(executed_params) == expected_params


def test_get_admin_appointments_cursor_offset_conflict_returns_400(client):
    """Test T-008: Using both cursor and offset parameters should return HTTP 400"""
    r = client.get("/api/admin/appointments?cursor=some-cursor&offset=10")
    assert r.status_code == 400
    j = r.get_json()
    assert "error" in j
    assert j["error"]["code"] == "bad_request"
    assert "cannot use both cursor and offset" in j["error"]["message"].lower()
