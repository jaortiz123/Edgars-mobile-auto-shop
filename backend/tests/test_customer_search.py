#!/usr/bin/env python3
"""Tests for /api/admin/customers/search endpoint.

import pytest

Validates new enrichment fields:
- totalSpent aggregation
- lastServiceAt derived from completed appointments
- isVip flag (manual OR spend >= 5000)
- isOverdueForService (last completed service > 6 months)
"""
import jwt
import pytest
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


def make_search_row(
    idx: int,
    *,
    vehicle_id: str = None,
    visits=0,
    total_spent=0,
    last_visit=None,
    last_service_at=None,
    is_vip=False,
    is_overdue=False,
):
    # Shape mirrors row dict usage via .get() in endpoint
    return {
        "vehicle_id": vehicle_id or f"veh-{idx}",
        "customer_id": f"cust-{idx}",
        "customer_name": f"Customer {idx}",
        "phone": "555-0000",
        "email": f"c{idx}@ex.com",
        "license_plate": f"PLT{idx}",
        "year": 2020,
        "make": "Make",
        "model": f"Model{idx}",
        "visits_count": visits,
        "total_spent": total_spent,
        "last_visit": last_visit,
        "last_service_at": last_service_at,
        "is_vip": is_vip,
        "is_overdue_for_service": is_overdue,
    }


@pytest.mark.integration
def test_customer_search_basic_shape(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_search_row(1, visits=2, total_spent=150, last_visit=None)]
    resp = client.get("/api/admin/customers/search?q=PLT1", headers=auth_headers())
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "items" in data
    first = data["items"][0]
    # new fields included
    assert {"totalSpent", "lastServiceAt", "isVip", "isOverdueForService"}.issubset(first.keys())
    assert first["totalSpent"] == 150.0
    assert first["isVip"] is False


@pytest.mark.integration
def test_customer_search_vip_via_spend_threshold(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_search_row(1, visits=20, total_spent=6000, is_vip=False)]
    resp = client.get("/api/admin/customers/search?q=PLT1", headers=auth_headers())
    assert resp.status_code == 200
    first = resp.get_json()["data"]["items"][0]
    assert first["isVip"] is True  # derived from spend
    assert first["totalSpent"] == 6000.0


@pytest.mark.integration
def test_customer_search_vip_explicit_flag(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_search_row(2, visits=3, total_spent=200, is_vip=True)]
    resp = client.get("/api/admin/customers/search?q=PLT2", headers=auth_headers())
    assert resp.status_code == 200
    first = resp.get_json()["data"]["items"][0]
    assert first["isVip"] is True
    assert first["totalSpent"] == 200.0


@pytest.mark.integration
def test_customer_search_overdue_logic(client, auth_headers, mock_db):
    old_service = datetime(2024, 12, 1, tzinfo=timezone.utc)
    recent_service = datetime(2025, 7, 1, tzinfo=timezone.utc)
    mock_db.fetchall.return_value = [
        make_search_row(1, total_spent=1000, last_service_at=old_service, is_overdue=True),
        make_search_row(2, total_spent=800, last_service_at=recent_service, is_overdue=False),
    ]
    resp = client.get("/api/admin/customers/search?q=PLT", headers=auth_headers())
    assert resp.status_code == 200
    items = resp.get_json()["data"]["items"]
    assert items[0]["isOverdueForService"] is True
    assert items[1]["isOverdueForService"] is False


@pytest.mark.integration
def test_customer_search_filter_vip(client, auth_headers, mock_db):
    # Only VIP row should survive HAVING when filter=vip
    vip_row = make_search_row(1, total_spent=6000, is_vip=False)  # derived vip
    non_vip = make_search_row(2, total_spent=100, is_vip=False)
    mock_db.fetchall.return_value = [vip_row]  # Simulate DB already filtered
    resp = client.get("/api/admin/customers/search?q=PLT&filter=vip", headers=auth_headers())
    assert resp.status_code == 200
    items = resp.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["isVip"] is True


@pytest.mark.integration
def test_customer_search_filter_overdue(client, auth_headers, mock_db):
    overdue_row = make_search_row(3, total_spent=200, is_overdue=True)
    mock_db.fetchall.return_value = [overdue_row]
    resp = client.get("/api/admin/customers/search?q=PLT&filter=overdue", headers=auth_headers())
    assert resp.status_code == 200
    items = resp.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["isOverdueForService"] is True


@pytest.mark.integration
def test_customer_search_filter_invalid_ignored(client, auth_headers, mock_db):
    row1 = make_search_row(1, total_spent=10)
    row2 = make_search_row(2, total_spent=20)
    mock_db.fetchall.return_value = [row1, row2]
    resp = client.get("/api/admin/customers/search?q=PLT&filter=bogus", headers=auth_headers())
    assert resp.status_code == 200
    items = resp.get_json()["data"]["items"]
    assert len(items) == 2  # behaves like 'all'


# ----------------------- Sorting Tests ------------------------------------


@pytest.mark.integration
def test_customer_search_sort_default_relevance(client, auth_headers, mock_db):
    # Ensure default ordering path used when sortBy absent (relevance)
    mock_db.fetchall.return_value = [make_search_row(1), make_search_row(2)]
    resp = client.get("/api/admin/customers/search?q=PLT", headers=auth_headers())
    assert resp.status_code == 200
    # Verify SQL ORDER BY fragment chosen by checking the executed SQL
    executed_sql = mock_db.execute.call_args[0][0]
    assert "ORDER BY (h.license_plate ILIKE %(prefix)s) DESC" in executed_sql


@pytest.mark.parametrize(
    "param,expected_fragment",
    [
        ("name_asc", "ORDER BY h.customer_name ASC"),
        ("name_desc", "ORDER BY h.customer_name DESC"),
        ("most_recent_visit", "ORDER BY last_service_at DESC"),
        ("highest_lifetime_spend", "ORDER BY total_spent DESC"),
    ],
)
@pytest.mark.integration
def test_customer_search_sort_variants(client, auth_headers, mock_db, param, expected_fragment):
    mock_db.fetchall.return_value = [make_search_row(1), make_search_row(2)]
    resp = client.get(f"/api/admin/customers/search?q=PLT&sortBy={param}", headers=auth_headers())
    assert resp.status_code == 200
    executed_sql = mock_db.execute.call_args[0][0]
    assert expected_fragment in executed_sql


@pytest.mark.integration
def test_customer_search_sort_invalid_falls_back(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_search_row(1), make_search_row(2)]
    resp = client.get("/api/admin/customers/search?q=PLT&sortBy=bogus", headers=auth_headers())
    assert resp.status_code == 200
    executed_sql = mock_db.execute.call_args[0][0]
    # Falls back to relevance ordering
    assert "ORDER BY (h.license_plate ILIKE %(prefix)s) DESC" in executed_sql
