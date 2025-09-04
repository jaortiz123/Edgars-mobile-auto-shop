import pytest
from datetime import datetime


@pytest.fixture(autouse=True)
def enable_memory(monkeypatch):
    # Ensure fallback to memory for other tests
    import backend.local_server as srv

    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
    yield


class DummyConn:
    def __init__(self):
        self.calls = []  # list of (query, params)

    def cursor(self, *args, **kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, query, params=None):
        self.calls.append((query, list(params) if params else []))

    def fetchall(self):
        # Return a single dummy appointment row matching SELECT columns
        return [
            {
                "id": "1",
                "status": "SCHEDULED",
                "start_ts": datetime.now(),
                "end_ts": None,
                "total_amount": 0,
                "customer_name": "Test",
                "vehicle_label": "TestCar",
                "position": 1,
            }
        ]


@pytest.mark.parametrize(
    "param,expected_sql_fragment,expected_param",
    [
        ("status=scheduled", "a.status = %s", "SCHEDULED"),
        ("from=2025-07-01T00:00:00Z", "COALESCE(", "2025-07-01T00:00:00Z"),
        ("to=2025-07-31T23:59:59Z", "COALESCE(", "2025-07-31T23:59:59Z"),
        ("techId=tech123", "a.tech_id = %s", "tech123"),
        ("q=test", "ILIKE", "%test%"),
        ("limit=1", "LIMIT %s", 1),
        ("offset=2", "OFFSET %s", 2),
    ],
)
def test_filters_applied(client, monkeypatch, param, expected_sql_fragment, expected_param):
    # Monkeypatch db_conn to use DummyConn
    import backend.local_server as srv

    conn = DummyConn()
    monkeypatch.setattr(srv, "db_conn", lambda: conn)

    r = client.get(f"/api/admin/appointments?{param}")
    assert r.status_code == 200
    # Find the main appointments SELECT among calls (ignore set_config etc.)
    target_query = ""
    target_params = []
    for q, ps in conn.calls:
        qs = q if isinstance(q, str) else str(q)
        if "FROM appointments a" in qs and "ORDER BY a.start_ts" in qs:
            target_query = qs
            target_params = ps
            break
    assert target_query, f"appointments SELECT not executed; calls={conn.calls!r}"
    assert expected_sql_fragment in target_query
    # Params should include expected_param (string compare)
    assert any(str(expected_param) in str(p) for p in target_params), (
        expected_param,
        target_params,
    )


def test_invalid_limit_offset(client, monkeypatch):
    import backend.local_server as srv

    # Test invalid limit
    r1 = client.get("/api/admin/appointments?limit=0")
    assert r1.status_code == 400
    # Invalid offset
    r2 = client.get("/api/admin/appointments?offset=-1")
    assert r2.status_code == 400
