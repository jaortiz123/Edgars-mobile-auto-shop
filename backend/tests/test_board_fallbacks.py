import pytest
import local_server


def _make_conn_with_rows(rows):
    class Cursor:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            pass
        def execute(self, sql, params=None):
            self._q = sql
        def fetchall(self):
            # Return appointment rows for the main board query, and summary rows for the aggregate query
            sql = (self._q or "").upper()
            if "FROM APPOINTMENTS A" in sql and "GROUP BY" in sql and "COUNT" in sql:
                # Return empty aggregates (no counts) to avoid KeyError
                return []
            # Default: main rows
            return rows
        def fetchone(self):
            return None

    class Conn:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            pass
        def cursor(self, *a, **k):
            return Cursor()
        def close(self):
            pass

    return Conn()


def test_board_fallbacks_nulls(client, monkeypatch):
    """If DB returns NULLs for customer/vehicle, API should return fallback strings."""
    from datetime import datetime, timezone

    rows = [
        {
            "id": "apt-1",
            "status": "SCHEDULED",
            "start_ts": datetime(2025, 1, 1, 9, 0, 0, tzinfo=timezone.utc),
            "end_ts": datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            "price": 100.0,
            "customer_name": None,
            "vehicle_label": None,
            "services_summary": "Oil change",
            "position": 1,
        }
    ]

    monkeypatch.setattr(local_server, "db_conn", lambda: _make_conn_with_rows(rows))
    resp = client.get('/api/admin/appointments/board')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["cards"] and len(data["cards"]) == 1
    assert data["cards"][0]["customerName"] == "Unknown Customer"
    assert data["cards"][0]["vehicle"] == "Unknown Vehicle"


def test_board_fallbacks_empty_string(client, monkeypatch):
    """If DB returns empty/whitespace strings, API should normalize to fallback strings."""
    from datetime import datetime, timezone

    rows = [
        {
            "id": "apt-2",
            "status": "SCHEDULED",
            "start_ts": datetime(2025, 1, 2, 9, 0, 0, tzinfo=timezone.utc),
            "end_ts": None,
            "price": 0,
            "customer_name": "   ",
            "vehicle_label": "",
            "services_summary": None,
            "position": 1,
        }
    ]

    monkeypatch.setattr(local_server, "db_conn", lambda: _make_conn_with_rows(rows))
    resp = client.get('/api/admin/appointments/board')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["cards"] and len(data["cards"]) == 1
    assert data["cards"][0]["customerName"] == "Unknown Customer"
    assert data["cards"][0]["vehicle"] == "Unknown Vehicle"


