#!/usr/bin/env python3
"""Tests for /api/admin/recent-customers endpoint.

Validates:
- Default limit (<= 8) structure
- Custom limit param (capped at 25)
- Shape of returned records including vehicles + totals
"""
import jwt
import pytest

pytestmark = pytest.mark.unit_fast
from datetime import datetime, timezone

try:
    from backend import local_server  # preferred
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


@pytest.fixture
def mock_db(mocker):
    mock_connection = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.cursor.return_value.__enter__.return_value = mock_cursor
    mocker.patch("backend.local_server.db_conn", return_value=mock_connection)
    return mock_cursor


def make_row(
    idx: int,
    vehicles_json=None,
    *,
    visits=0,
    last_service_at=None,
    is_vip=False,
    total_spent=None,
    is_overdue=False,
):
    if vehicles_json is None:
        vehicles_json = [
            {
                "id": f"veh-{idx}",
                "plate": f"PLT{idx}",
                "year": 2020,
                "make": "Make",
                "model": f"Model{idx}",
            }
        ]
    now = datetime(2025, 8, 15, 12, 0, 0, tzinfo=timezone.utc)
    if total_spent is None:
        total_spent = 123.45 * idx
    return {
        "customer_id": f"cust-{idx}",
        "customer_name": f"Customer {idx}",
        "phone": "555-0000",
        "email": f"c{idx}@ex.com",
        "latest_appointment_id": f"appt-{idx}",
        "latest_ts": now,
        "latest_status": "COMPLETED",
        "vehicles": vehicles_json,
        "total_spent": total_spent,
        "visits_count": visits,
        "last_service_at": last_service_at,
        "is_vip": is_vip,
        "is_overdue_for_service": is_overdue,
    }


def test_recent_customers_default_limit(client, auth_headers, mock_db):
    # Simulate 3 rows returned
    mock_db.fetchall.return_value = [make_row(1), make_row(2), make_row(3)]

    resp = client.get("/api/admin/recent-customers", headers=auth_headers())
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "recent_customers" in data
    assert data["limit"] == 8
    assert len(data["recent_customers"]) == 3
    first = data["recent_customers"][0]
    assert {
        "customerId",
        "name",
        "phone",
        "email",
        "latestAppointmentId",
        "latestAppointmentAt",
        "latestStatus",
        "vehicles",
        "totalSpent",
        "visitsCount",
        "lastServiceAt",
        "isVip",
        "isOverdueForService",
    }.issubset(first.keys())
    assert isinstance(first["vehicles"], list)


def test_recent_customers_custom_limit(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_row(i) for i in range(1, 6)]

    resp = client.get("/api/admin/recent-customers?limit=5", headers=auth_headers())
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["limit"] == 5
    assert len(data["recent_customers"]) == 5


def test_recent_customers_limit_cap(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = []
    resp = client.get("/api/admin/recent-customers?limit=999", headers=auth_headers())
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["limit"] == 25  # capped
    assert data["recent_customers"] == []


def test_recent_customers_vip_and_overdue_logic(client, auth_headers, mock_db):
    # Row 1: Derived VIP via spend >= 5000
    mock_row1 = make_row(
        1,
        total_spent=6000,
        visits=10,
        last_service_at=datetime(2025, 7, 1, tzinfo=timezone.utc),
        is_vip=False,
        is_overdue=False,
    )
    # Row 2: Explicit VIP flag but not enough spend, overdue (older than 6 months)
    mock_row2 = make_row(
        2,
        total_spent=200,
        visits=3,
        last_service_at=datetime(2024, 12, 1, tzinfo=timezone.utc),
        is_vip=True,
        is_overdue=True,
    )
    mock_db.fetchall.return_value = [mock_row1, mock_row2]

    resp = client.get("/api/admin/recent-customers", headers=auth_headers())
    assert resp.status_code == 200
    data = resp.get_json()["data"]["recent_customers"]

    row1 = data[0]
    row2 = data[1]
    assert row1["isVip"] is True  # derived
    assert row1["isOverdueForService"] is False
    assert row2["isVip"] is True  # explicit flag
    assert row2["isOverdueForService"] is True
