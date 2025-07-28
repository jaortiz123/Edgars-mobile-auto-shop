import os
# Set FALLBACK_TO_MEMORY before importing local_server
os.environ.setdefault("FALLBACK_TO_MEMORY", "true")

import pytest
from backend.local_server import app as flask_app

@pytest.fixture()
def client():
    flask_app.testing = True
    flask_app.config["PROPAGATE_EXCEPTIONS"] = False
    with flask_app.test_client() as c:
        yield c

class _FakeCursor:
    def __init__(self):
        self._q = None
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        pass
    def execute(self, sql, params=None):
        self._q = sql
    def fetchall(self):
        # SELECT status::text, COUNT(*)
        return [
            {"status": "SCHEDULED", "count": 3},
            {"status": "IN_PROGRESS", "count": 2},
            {"status": "READY", "count": 1},
            {"status": "COMPLETED", "count": 5},
            {"status": "NO_SHOW", "count": 0},
        ]
    def fetchone(self):
        # called by different queries; return numbers in sequence
        # cars_on_premises -> COUNT(*)
        if "check_in_at" in (self._q or ""):
            return [2]
        # jobs_today -> COUNT(*) WHERE scheduled_date = %s
        if "scheduled_date = %s" in (self._q or ""):
            return [4]
        # unpaid total -> SUM(...)
        if "COALESCE(SUM" in (self._q or ""):
            return [1234.56]
        return [0]

class _FakeConn:
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        pass
    def cursor(self, *a, **k):
        return _FakeCursor()
    def close(self):
        pass

@pytest.fixture()
def fake_db(monkeypatch):
    import backend.local_server as srv
    monkeypatch.setattr(srv, "db_conn", lambda: _FakeConn())