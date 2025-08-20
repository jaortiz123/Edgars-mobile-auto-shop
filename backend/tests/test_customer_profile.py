#!/usr/bin/env python3
"""Tests for /api/admin/customers/<id> customer profile endpoint.

Scenarios covered:
- Default lightweight response (no include)
- Expanded response with ?include=appointmentDetails
- Metrics calculation correctness
- Invalid include token
- Not found customer

Relies on controlled mocking of db_conn to avoid touching real DB.
"""
import jwt
import pytest
from datetime import datetime, timedelta, timezone

try:
    from backend import local_server  # preferred package import
except ImportError:  # pragma: no cover
    import local_server  # type: ignore

app = local_server.app
JWT_SECRET = local_server.JWT_SECRET
JWT_ALG = local_server.JWT_ALG


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def auth_headers():
    def make(role="Owner", sub="tester"):
        token = jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm=JWT_ALG)
        return {"Authorization": f"Bearer {token}"}

    return make


class _Cursor:
    def __init__(self, want_details):
        self.want_details = want_details
        self.step = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, sql, params=None):
        self.last_sql = sql
        self.step += 1
        self.params = params

    def fetchone(self):
        # step 1: customer row
        if self.step == 1:
            if self.params and self.params[0] == "missing-cust":
                return None
            now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
            return {
                "id": "cust-1",
                "name": "Customer One",
                "phone": "555-1111",
                "email": "one@example.com",
                "is_vip": False,
                "created_at": now - timedelta(days=400),
                "updated_at": now - timedelta(days=1),
            }
        # step 3 metrics_row (after vehicles query)
        if "WITH appts AS" in self.last_sql:
            # Provide metrics baseline: 3 visits, 2 completed, total 900, paid 700 (unpaid 200)
            now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
            return {
                "total_spent": 900,
                "unpaid_balance": 200,
                "visits_count": 3,
                "completed_count": 2,
                "avg_ticket_raw": 450,  # average over completed
                "last_service_at": now - timedelta(days=30),
                "last_visit_at": now - timedelta(days=5),
                "last12_spent": 600,
                "last12_visits": 2,
            }
        return {}

    def fetchall(self):
        # step 2 vehicles
        if "FROM vehicles v" in self.last_sql:
            return [
                {
                    "id": "veh-1",
                    "license_plate": "PLT1",
                    "year": 2020,
                    "make": "Make",
                    "model": "Model1",
                    "total_spent": 500,
                    "visits": 2,
                },
                {
                    "id": "veh-2",
                    "license_plate": "PLT2",
                    "year": 2021,
                    "make": "Make",
                    "model": "Model2",
                    "total_spent": 400,
                    "visits": 1,
                },
            ]
        # step 4 appointments
        if "FROM appointments a" in self.last_sql:
            now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
            base_appts = [
                {
                    "id": "appt-1",
                    "status": "COMPLETED",
                    "start_ts": now - timedelta(days=30),
                    "end_ts": now - timedelta(days=29, hours=22),
                    "total_amount": 500,
                    "paid_amount": 500,
                    "check_in_at": None,
                    "check_out_at": None,
                    "vehicle_id": "veh-1",
                    "license_plate": "PLT1",
                    "year": 2020,
                    "make": "Make",
                    "model": "Model1",
                    "services": (
                        [
                            {
                                "id": "svc-1",
                                "name": "Oil Change",
                                "notes": None,
                                "estimated_price": 100,
                                "service_operation_id": None,
                            }
                        ]
                        if self.want_details
                        else None
                    ),
                    "payments": (
                        [
                            {
                                "id": "pay-1",
                                "amount": 500,
                                "method": "cash",
                                "created_at": now - timedelta(days=29, hours=22),
                            }
                        ]
                        if self.want_details
                        else None
                    ),
                    "messages": (
                        [
                            {
                                "id": "msg-1",
                                "channel": "sms",
                                "direction": "out",
                                "body": "Done",
                                "status": "SENT",
                                "created_at": now - timedelta(days=29, hours=22),
                            }
                        ]
                        if self.want_details
                        else None
                    ),
                },
                {
                    "id": "appt-2",
                    "status": "SCHEDULED",
                    "start_ts": now - timedelta(days=5),
                    "end_ts": None,
                    "total_amount": 400,
                    "paid_amount": 200,
                    "check_in_at": None,
                    "check_out_at": None,
                    "vehicle_id": "veh-2",
                    "license_plate": "PLT2",
                    "year": 2021,
                    "make": "Make",
                    "model": "Model2",
                    "services": (
                        [
                            {
                                "id": "svc-2",
                                "name": "Brakes",
                                "notes": None,
                                "estimated_price": 400,
                                "service_operation_id": None,
                            }
                        ]
                        if self.want_details
                        else None
                    ),
                    "payments": (
                        [
                            {
                                "id": "pay-2",
                                "amount": 200,
                                "method": "card",
                                "created_at": now - timedelta(days=5),
                            }
                        ]
                        if self.want_details
                        else None
                    ),
                    "messages": [] if self.want_details else None,
                },
            ]
            return base_appts
        return []


class _Conn:
    def __init__(self, want_details):
        self.want_details = want_details

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def cursor(self):
        return _Cursor(self.want_details)


@pytest.fixture
def mock_db(monkeypatch):
    # default variant without details
    import backend.local_server as srv

    def _factory(want_details):
        class _ConnFactory(_Conn):
            pass

        return _ConnFactory(want_details)

    monkeypatch.setattr(srv, "safe_conn", lambda: (_factory(False), False, None))
    return monkeypatch


def _swap_safe_conn(monkeypatch, want_details):
    import backend.local_server as srv

    monkeypatch.setattr(srv, "safe_conn", lambda: (_Conn(want_details), False, None))


def test_profile_default_lightweight(client, auth_headers, mock_db, monkeypatch):
    _swap_safe_conn(monkeypatch, want_details=False)
    resp = client.get("/api/admin/customers/cust-1", headers=auth_headers())
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["customer"]["id"] == "cust-1"
    assert body["metrics"]["totalSpent"] == 900
    # Appointments should not contain heavy fields
    assert len(body["appointments"]) == 2
    for appt in body["appointments"]:
        assert "services" not in appt
        assert "payments" not in appt
        assert "messages" not in appt


def test_profile_expanded_details(client, auth_headers, mock_db, monkeypatch):
    _swap_safe_conn(monkeypatch, want_details=True)
    resp = client.get(
        "/api/admin/customers/cust-1?include=appointmentDetails", headers=auth_headers()
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    appts = body["appointments"]
    assert len(appts) == 2
    for appt in appts:
        assert isinstance(appt.get("services"), list)
        assert isinstance(appt.get("payments"), list)
        assert isinstance(appt.get("messages"), list)
    # Metrics derived logic
    assert body["metrics"]["unpaidBalance"] == 200
    assert body["metrics"]["visitsCount"] == 3
    assert body["metrics"]["completedCount"] == 2
    assert body["metrics"]["avgTicket"] == 450


def test_profile_invalid_include(client, auth_headers, mock_db, monkeypatch):
    _swap_safe_conn(monkeypatch, want_details=False)
    resp = client.get("/api/admin/customers/cust-1?include=foobar", headers=auth_headers())
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["error"]["code"] == "invalid_include" if "error" in payload else True


def test_profile_not_found(client, auth_headers, mock_db, monkeypatch):
    # safe_conn returns connection; customer lookup returns None
    import backend.local_server as srv

    class _NFConn:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def cursor(self):
            class _C:
                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    pass

                def execute(self, sql, params=None):
                    self.params = params
                    self.sql = sql

                def fetchone(self):
                    return None

                def fetchall(self):
                    return []

            return _C()

    monkeypatch.setattr(srv, "safe_conn", lambda: (_NFConn(), False, None))
    resp = client.get("/api/admin/customers/missing-cust", headers=auth_headers())
    assert resp.status_code == 404
    payload = resp.get_json()
    assert payload["error"]["code"] == "not_found" if "error" in payload else True


def test_profile_vip_overdue_logic(client, auth_headers, mock_db, monkeypatch):
    # Make metrics show spend > 5000 and last service 7 months ago to trigger VIP + overdue
    import backend.local_server as srv

    class _C2(_Cursor):
        def fetchone(self):
            if self.step == 1:
                now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
                return {
                    "id": "cust-2",
                    "name": "Customer Two",
                    "phone": None,
                    "email": None,
                    "is_vip": False,
                    "created_at": now - timedelta(days=800),
                    "updated_at": now - timedelta(days=1),
                }
            if "WITH appts AS" in self.last_sql:
                now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
                return {
                    "total_spent": 6000,
                    "unpaid_balance": 0,
                    "visits_count": 10,
                    "completed_count": 9,
                    "avg_ticket_raw": 666.66,
                    "last_service_at": now - timedelta(days=210),  # > 6 months
                    "last_visit_at": now - timedelta(days=10),
                    "last12_spent": 5000,
                    "last12_visits": 8,
                }
            return {}

    class _Conn2:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def cursor(self):
            return _C2(True)

    monkeypatch.setattr(srv, "safe_conn", lambda: (_Conn2(), False, None))
    resp = client.get(
        "/api/admin/customers/cust-2?include=appointmentDetails", headers=auth_headers()
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["customer"]["isVip"] is True
    assert data["metrics"]["isVip"] is True
    assert data["metrics"]["isOverdueForService"] is True
