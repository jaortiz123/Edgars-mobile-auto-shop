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
        # Return different data based on the SQL query
        if self._q is None:
            return []
        
        # Customer history query - return appointment data
        if "FROM appointments a" in self._q and "LEFT JOIN payments p" in self._q:
            from datetime import datetime, timezone
            # Return different data based on test needs
            if hasattr(self, '_customer_history_empty'):
                return []
            return [
                {
                    "id": "apt-123",
                    "status": "COMPLETED", 
                    "start": datetime(2025, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
                    "total_amount": 250.00,
                    "paid_amount": 250.00,
                    "appointment_created_at": datetime(2025, 7, 10, 9, 0, 0, tzinfo=timezone.utc),
                    "payments": [
                        {
                            "id": "pay-1",
                            "amount": 250.00,
                            "method": "cash", 
                            "created_at": datetime(2025, 7, 15, 10, 30, 0, tzinfo=timezone.utc)
                        }
                    ]
                }
            ]
        
        # Dashboard stats query - return status counts
        if "COUNT(*)" in self._q and "GROUP BY status" in self._q:
            return [
                {"status": "SCHEDULED", "count": 3},
                {"status": "IN_PROGRESS", "count": 2},
                {"status": "READY", "count": 1},
                {"status": "COMPLETED", "count": 5},
                {"status": "NO_SHOW", "count": 0},
            ]
        
        # Default empty result
        return []
    def fetchone(self):
        # called by different queries; return numbers in sequence
        if self._q is None:
            return None
            
        # Customer lookup query - return customer data  
        if "FROM customers WHERE id" in self._q:
            return {"id": "123", "name": "John Doe"}
            
        # cars_on_premises -> COUNT(*)
        if "check_in_at" in self._q:
            return [2]
        # jobs_today -> COUNT(*) WHERE start_ts::date = %s
        if ("scheduled_date = %s" in self._q) or ("start_ts::date = %s" in self._q):
            return [4]
        # unpaid total -> SUM(...)
        if "COALESCE(SUM" in self._q:
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