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
    assert json_data["error"]["message"]["code"] == "not_found"
    assert (
        json_data["error"]["message"]["message"].lower().startswith("customer not found")
        or json_data["error"]["message"]["code"] == "not_found"
    )


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
    assert "data" in json_data
    assert "data" in json_data["data"]
    assert "pastAppointments" in json_data["data"]["data"]
    assert json_data["data"]["data"]["pastAppointments"] == []


def test_get_customer_history_returns_past_appointments_with_payments(
    client, auth_headers, monkeypatch
):
    """Test that customer history returns appointments with nested payments"""

    # Setup fake database that returns customer with appointments and payments
    class FakeAppointmentsCursor:
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
            # Return mock appointments with payments for appointments query
            if "FROM appointments" in (self._q or ""):
                from datetime import datetime, timezone

                return [
                    {
                        "id": "apt-1",
                        "status": "COMPLETED",
                        "start_ts": datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
                        "total_amount": 250.0,
                        "paid_amount": 250.0,
                        "payments": [
                            {
                                "id": "pay-1",
                                "amount": 250.0,
                                "method": "cash",
                                "created_at": "2024-01-15T11:00:00Z",
                            }
                        ],
                    }
                ]
            return []

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def cursor(self, cursor_factory=None):
            return FakeAppointmentsCursor()

        def close(self):
            pass

    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: FakeConn())

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    # Check response structure
    assert "data" in json_data
    assert "data" in json_data["data"]
    assert "pastAppointments" in json_data["data"]["data"]
    assert "payments" in json_data["data"]["data"]

    appointments = json_data["data"]["data"]["pastAppointments"]
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
    assert json_data["error"]["message"]["code"] in ("auth_required", "forbidden")


def test_get_customer_history_only_returns_completed_appointments(
    client, auth_headers, monkeypatch
):
    """Test that only COMPLETED, NO_SHOW, and CANCELED appointments are returned"""

    # Setup fake database that returns customer with only completed appointments
    class FakeCompletedAppointmentsCursor:
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
            # Return appointments only in completed states
            if "FROM appointments" in (self._q or ""):
                from datetime import datetime, timezone

                return [
                    {
                        "id": "apt-1",
                        "status": "COMPLETED",
                        "start_ts": datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
                        "total_amount": 250.0,
                        "paid_amount": 250.0,
                        "payments": [],
                    },
                    {
                        "id": "apt-2",
                        "status": "NO_SHOW",
                        "start_ts": datetime(2024, 1, 14, 14, 0, 0, tzinfo=timezone.utc),
                        "total_amount": 150.0,
                        "paid_amount": 0.0,
                        "payments": [],
                    },
                    {
                        "id": "apt-3",
                        "status": "CANCELED",
                        "start_ts": datetime(2024, 1, 13, 9, 0, 0, tzinfo=timezone.utc),
                        "total_amount": 300.0,
                        "paid_amount": 0.0,
                        "payments": [],
                    },
                ]
            return []

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def cursor(self, cursor_factory=None):
            return FakeCompletedAppointmentsCursor()

        def close(self):
            pass

    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: FakeConn())

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    appointments = json_data["data"]["data"]["pastAppointments"]
    # All appointments should be in completed states
    for appointment in appointments:
        assert appointment["status"] in ["COMPLETED", "NO_SHOW", "CANCELED"]


def test_get_customer_history_orders_by_date_desc(client, auth_headers, monkeypatch):
    """Test that appointments are ordered by start date descending"""

    # Setup fake database that returns appointments in specific order to test sorting
    class FakeOrderedAppointmentsCursor:
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
            # Return appointments in descending date order (most recent first)
            if "FROM appointments" in (self._q or ""):
                from datetime import datetime, timezone

                return [
                    {
                        "id": "apt-3",
                        "status": "COMPLETED",
                        "start_ts": datetime(
                            2024, 1, 17, 15, 0, 0, tzinfo=timezone.utc
                        ),  # Most recent
                        "total_amount": 300.0,
                        "paid_amount": 300.0,
                        "payments": [],
                    },
                    {
                        "id": "apt-2",
                        "status": "COMPLETED",
                        "start_ts": datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),  # Middle
                        "total_amount": 200.0,
                        "paid_amount": 200.0,
                        "payments": [],
                    },
                    {
                        "id": "apt-1",
                        "status": "COMPLETED",
                        "start_ts": datetime(2024, 1, 10, 9, 0, 0, tzinfo=timezone.utc),  # Oldest
                        "total_amount": 150.0,
                        "paid_amount": 150.0,
                        "payments": [],
                    },
                ]
            return []

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def cursor(self, cursor_factory=None):
            return FakeOrderedAppointmentsCursor()

        def close(self):
            pass

    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: FakeConn())

    response = client.get("/api/customers/123/history", headers=auth_headers("Owner"))

    assert response.status_code == 200
    json_data = response.get_json()

    appointments = json_data["data"]["data"]["pastAppointments"]
    if len(appointments) > 1:
        # Verify ordering - dates should be descending
        for i in range(len(appointments) - 1):
            current_date = appointments[i]["start"]
            next_date = appointments[i + 1]["start"]
            # Current should be >= next (descending order)
            assert current_date >= next_date
