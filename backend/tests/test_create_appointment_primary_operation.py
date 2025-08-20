import pytest
from http import HTTPStatus
import backend.local_server as srv


class _FakeCursor:
    def __init__(self, invalid_op=False):
        self.invalid_op = invalid_op
        self._last_sql = ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, sql, params=None):  # pylint: disable=unused-argument
        self._last_sql = sql.upper()

    def fetchone(self):
        sql = self._last_sql
        if "INSERT INTO CUSTOMERS" in sql:
            return {"id": "cust-1"}
        if "SELECT CATEGORY FROM SERVICE_OPERATIONS" in sql:
            if self.invalid_op:
                return None
            return {"category": "brakes"}
        if "INSERT INTO APPOINTMENTS" in sql:
            return {"id": "apt-1"}
        return None

    def fetchall(self):
        return []


class _FakeConn:
    def __init__(self, invalid_op=False):
        self.invalid_op = invalid_op

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def cursor(self, *a, **k):  # noqa
        return _FakeCursor(invalid_op=self.invalid_op)

    def close(self):
        pass


@pytest.fixture
def client():
    srv.app.config["TESTING"] = True
    with srv.app.test_client() as c:
        yield c


def test_create_appointment_rejects_invalid_primary_operation_id(client, monkeypatch):
    """POST /api/admin/appointments should 400 when primary_operation_id does not exist."""
    monkeypatch.setattr(srv, "db_conn", lambda: _FakeConn(invalid_op=True))
    payload = {
        "customer_id": "Test Customer",  # treated as name
        "service": "Brake Service",
        "requested_time": "2025-08-14T15:00:00Z",
        "primary_operation_id": "non-existent-op-id",
    }
    resp = client.post("/api/admin/appointments", json=payload)
    assert resp.status_code == HTTPStatus.BAD_REQUEST, resp.data
    j = resp.get_json()
    assert j
    # Accept generic envelope
    msg = None
    if "error" in j:
        msg = j["error"].get("message") or j["error"].get("code")
    assert msg and "primary_operation_id" in msg.lower()


def test_create_appointment_allows_absent_primary_operation_id(client, monkeypatch):
    """POST should succeed when no primary_operation_id provided (backward compatibility)."""
    monkeypatch.setattr(srv, "db_conn", lambda: _FakeConn(invalid_op=False))
    payload = {
        "customer_id": "Test Customer 2",
        "service": "Oil Change",
        "requested_time": "2025-08-14T16:00:00Z",
    }
    resp = client.post("/api/admin/appointments", json=payload)
    assert resp.status_code in (HTTPStatus.CREATED, 201), resp.data
    j = resp.get_json()
    assert j
    new_id = j.get("id") or (j.get("data") or {}).get("id")
    assert new_id == "apt-1"
