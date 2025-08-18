import types
import pytest

import local_server as srv


class _CursorMock:
    def __init__(self, first_raises: Exception, rows):
        self._first_raises = first_raises
        self._rows = rows
        self._calls = 0

    def execute(self, sql, params=None):  # noqa: D401
        self._calls += 1
        # First call simulates missing column error on default_price
        if self._calls == 1:
            raise self._first_raises
        # Second call returns minimal rows using new column name base_labor_rate
        return None

    def fetchall(self):
        return self._rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _ConnMock:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_service_operations_retry_new_column(monkeypatch, client):
    """Simulate legacy query failing (missing default_price) then retry using base_labor_rate.

    We patch db_conn to return a connection whose first cursor.execute raises a column missing
    error referencing default_price. The endpoint should catch, rebuild the query with the new
    projection including base_labor_rate and succeed, setting X-Catalog-Handler=v2-flat-newcol.
    """
    error = Exception('column "default_price" does not exist')
    rows = [
        {
            "id": 1,
            "name": "Brake Service",
            "category": "SAFETY",
            "subcategory": None,
            "internal_code": None,
            "skill_level": None,
            "default_hours": 2,
            "base_labor_rate": 120.0,
            "keywords": None,
            "flags": None,
            "is_active": True,
            "display_order": 10,
        }
    ]

    cursor = _CursorMock(error, rows)
    conn = _ConnMock(cursor)

    monkeypatch.setattr(srv, "db_conn", lambda: conn)

    resp = client.get("/api/admin/service-operations")
    assert resp.status_code == 200
    assert resp.headers.get("X-Catalog-Handler") == "v2-flat-newcol"
    data = resp.get_json()
    assert isinstance(data, list)
    assert data[0]["base_labor_rate"] == 120.0
