import pytest
import jwt
from datetime import datetime, timezone

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
    assert json_data["errors"][0]["code"] == "NOT_FOUND"
    assert json_data["errors"][0]["detail"] == "Customer not found"


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


def test_get_customer_history_returns_past_appointments_with_payments(
    client, auth_headers, fake_db
):
    """Test that customer history returns appointments with nested payments"""
    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    # Check response structure
    assert "data" in json_data
    assert "pastAppointments" in json_data["data"]
    assert "payments" in json_data["data"]

    appointments = json_data["data"]["pastAppointments"]
    assert len(appointments) >= 1

    # Check first appointment structure
    appointment = appointments[0]
    assert "id" in appointment
    assert "status" in appointment
    assert "start" in appointment
    assert "total_amount" in appointment
    assert "paid_amount" in appointment
    assert "payments" in appointment


def test_get_customer_history_requires_authentication(client):
    """Test that the endpoint requires authentication"""
    response = client.get("/api/customers/123/history")

    assert response.status_code == 403
    json_data = response.get_json()
    assert json_data["errors"][0]["code"] == "AUTH_REQUIRED"


def test_get_customer_history_only_returns_completed_appointments(client, auth_headers, fake_db):
    """Test that only COMPLETED, NO_SHOW, and CANCELED appointments are returned"""
    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    appointments = json_data["data"]["pastAppointments"]
    # All appointments should be in completed states
    for appointment in appointments:
        assert appointment["status"] in ["COMPLETED", "NO_SHOW", "CANCELED"]


def test_get_customer_history_orders_by_date_desc(client, auth_headers, fake_db):
    """Test that appointments are ordered by start date descending"""
    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    appointments = json_data["data"]["pastAppointments"]
    if len(appointments) > 1:
        # Verify ordering - dates should be descending
        for i in range(len(appointments) - 1):
            current_date = appointments[i]["start"]
            next_date = appointments[i + 1]["start"]
            # Current should be >= next (descending order)
            assert current_date >= next_date
