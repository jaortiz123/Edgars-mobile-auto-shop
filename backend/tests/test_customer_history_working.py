import pytest
import jwt
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# Use shared client and fake_db fixtures from conftest

# Import JWT constants for testing
try:
    from local_server import JWT_SECRET, JWT_ALG
except ImportError:
    from backend import local_server

    JWT_SECRET = local_server.JWT_SECRET
    JWT_ALG = local_server.JWT_ALG


@pytest.fixture
def auth_headers():
    """Generate JWT tokens for different user roles."""

    def make_token(role="Owner", user_id="test-user"):
        payload = {"sub": user_id, "role": role}
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
        return {"Authorization": f"Bearer {token}"}

    return make_token


@pytest.fixture
def mock_db():
    """Mock database connection for testing."""
    with patch("local_server.db_conn") as mock_conn:
        mock_connection = MagicMock()
        mock_cursor = MagicMock()
        mock_connection.__enter__.return_value = mock_connection
        mock_connection.__exit__.return_value = None
        mock_connection.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connection.cursor.return_value.__exit__.return_value = None
        mock_conn.return_value = mock_connection
        yield mock_cursor


@pytest.fixture(autouse=True)
def _bypass_tenant(monkeypatch):
    # Avoid tenant membership queries interfering with mocked DB
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")


def test_get_customer_history_returns_404_for_nonexistent_customer(
    client, auth_headers, monkeypatch
):
    """Test that requests for non-existent customers return 404"""

    # Setup fake database that returns None for customer lookup
    class FakeCustomerNotFoundCursor:
        def __init__(self):
            self._q = None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def execute(self, sql, params=None):
            self._q = sql

        def fetchone(self):
            if "FROM customers WHERE id" in (self._q or ""):
                return None  # Customer not found
            return None

        def fetchall(self):
            return []

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def cursor(self, cursor_factory=None):
            return FakeCustomerNotFoundCursor()

        def close(self):
            pass

    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: FakeConn())

    response = client.get("/api/customers/999/history", headers=auth_headers("Owner"))

    assert response.status_code == 404
    json_data = response.get_json()
    assert json_data["error"]["code"] == "not_found"
    assert "customer" in json_data["error"]["message"].lower()


def test_get_customer_history_returns_empty_for_customer_with_no_appointments(
    client, auth_headers, monkeypatch
):
    """Test that customers with no past appointments get empty history"""

    # Setup fake database that returns customer but no appointments
    class FakeEmptyHistoryCursor:
        def __init__(self):
            self._q = None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def execute(self, sql, params=None):
            self._q = sql

        def fetchone(self):
            if "FROM customers WHERE id" in (self._q or ""):
                return {"id": "123", "name": "John Doe"}
            return None

        def fetchall(self):
            # Return empty list for appointments query
            return []

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def cursor(self, cursor_factory=None):
            return FakeEmptyHistoryCursor()

        def close(self):
            pass

    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: FakeConn())

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["data"]["pastAppointments"] == []
    if response.status_code == 200:
        json_data = response.get_json()
        assert "data" in json_data
        assert "data" in json_data["data"]
        assert "pastAppointments" in json_data["data"]["data"]
    assert json_data["data"]["data"]["payments"] == []


def test_get_customer_history_returns_past_appointments_with_payments(
    client, auth_headers, mock_db
):
    """Test that customer history returns appointments with nested payments"""
    # Mock customer exists
    mock_db.fetchone.return_value = {"id": "123", "name": "John Doe"}

    # Mock appointments with payments (in the format the SQL query returns)
    mock_appointments = [
        {
            "id": "apt-1",
            "status": "COMPLETED",
            "start": datetime(2025, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
            "total_amount": 250.00,
            "paid_amount": 250.00,
            "appointment_created_at": datetime(2025, 7, 10, 9, 0, 0, tzinfo=timezone.utc),
            "payments": [
                {
                    "id": "pay-1",
                    "amount": 250.00,
                    "method": "cash",
                    "created_at": datetime(2025, 7, 15, 10, 30, 0, tzinfo=timezone.utc),
                }
            ],
        },
        {
            "id": "apt-2",
            "status": "COMPLETED",
            "start": datetime(2025, 6, 20, 14, 0, 0, tzinfo=timezone.utc),
            "total_amount": 180.00,
            "paid_amount": 100.00,
            "appointment_created_at": datetime(2025, 6, 18, 8, 0, 0, tzinfo=timezone.utc),
            "payments": [
                {
                    "id": "pay-2",
                    "amount": 100.00,
                    "method": "card",
                    "created_at": datetime(2025, 6, 20, 14, 45, 0, tzinfo=timezone.utc),
                }
            ],
        },
    ]

    mock_db.fetchall.return_value = mock_appointments

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    # Verify structure
    assert "data" in json_data
    assert "data" in json_data["data"]
    assert "pastAppointments" in json_data["data"]["data"]
    assert "payments" in json_data["data"]["data"]

    past_appointments = json_data["data"]["data"]["pastAppointments"]
    assert len(past_appointments) == 2

    # Verify first appointment (most recent)
    apt1 = past_appointments[0]
    assert apt1["id"] == "apt-1"
    assert apt1["status"] == "COMPLETED"
    assert apt1["total_amount"] == 250.00
    assert apt1["paid_amount"] == 250.00
    assert len(apt1["payments"]) == 1
    assert apt1["payments"][0]["amount"] == 250.00
    assert apt1["payments"][0]["method"] == "cash"

    # Verify second appointment
    apt2 = past_appointments[1]
    assert apt2["id"] == "apt-2"
    assert apt2["status"] == "COMPLETED"
    assert apt2["total_amount"] == 180.00
    assert apt2["paid_amount"] == 100.00
    assert len(apt2["payments"]) == 1


def test_get_customer_history_requires_authentication(no_auto_auth_client):
    """Test that the endpoint requires authentication"""
    response = no_auto_auth_client.get("/api/customers/123/history")

    assert response.status_code == 403
    json_data = response.get_json()
    assert json_data["error"]["code"] in ("auth_required", "forbidden")


def test_get_customer_history_only_returns_completed_appointments(client, auth_headers, mock_db):
    """Test that only COMPLETED, NO_SHOW, and CANCELED appointments are returned"""
    # Mock customer exists
    mock_db.fetchone.return_value = {"id": "123", "name": "John Doe"}

    # Only past appointments should be returned by the query
    mock_appointments = [
        {
            "id": "apt-completed",
            "status": "COMPLETED",
            "start": datetime(2025, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
            "total_amount": 250.00,
            "paid_amount": 250.00,
            "appointment_created_at": datetime(2025, 7, 10, 9, 0, 0, tzinfo=timezone.utc),
            "payments": [],
        }
    ]

    mock_db.fetchall.return_value = mock_appointments

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    # Verify SQL query was called with correct WHERE clause
    # The SQL should filter for completed/no_show/canceled appointments
    mock_db.execute.assert_called()
    sql_query = mock_db.execute.call_args[0][0]
    assert "a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELED')" in sql_query

    past_appointments = json_data["data"]["data"]["pastAppointments"]
    assert len(past_appointments) == 1
    assert past_appointments[0]["status"] == "COMPLETED"


def test_get_customer_history_orders_by_date_desc(client, auth_headers, mock_db):
    """Test that appointments are ordered by start date descending"""
    # Mock customer exists
    mock_db.fetchone.return_value = {"id": "123", "name": "John Doe"}

    # Appointments already ordered by SQL query (most recent first)
    mock_appointments = [
        {
            "id": "apt-recent",
            "status": "COMPLETED",
            "start": datetime(2025, 7, 20, 10, 0, 0, tzinfo=timezone.utc),
            "total_amount": 300.00,
            "paid_amount": 300.00,
            "appointment_created_at": datetime(2025, 7, 18, 9, 0, 0, tzinfo=timezone.utc),
            "payments": [],
        },
        {
            "id": "apt-older",
            "status": "COMPLETED",
            "start": datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc),
            "total_amount": 200.00,
            "paid_amount": 200.00,
            "appointment_created_at": datetime(2025, 6, 13, 9, 0, 0, tzinfo=timezone.utc),
            "payments": [],
        },
    ]

    mock_db.fetchall.return_value = mock_appointments

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    # Verify SQL query includes correct ORDER BY clause
    mock_db.execute.assert_called()
    sql_query = mock_db.execute.call_args[0][0]
    assert "ORDER BY a.start DESC, a.id DESC" in sql_query

    past_appointments = json_data["data"]["data"]["pastAppointments"]
    assert len(past_appointments) == 2
    assert past_appointments[0]["id"] == "apt-recent"  # Most recent first
    assert past_appointments[1]["id"] == "apt-older"  # Older second
