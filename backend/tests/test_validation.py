import pytest
from datetime import datetime, timedelta, timezone
from backend.validation import validate_appointment_payload, find_conflicts

class DummyConn:
    def __init__(self, rows_map):
        self.rows_map = rows_map
        self.executed = []
    def cursor(self):
        return self
    def execute(self, sql, params):
        self.executed.append((sql, params))
        if 'tech_id =' in sql:
            self._current = self.rows_map.get('tech', [])
        else:
            self._current = self.rows_map.get('vehicle', [])
    def fetchall(self):
        return [(r,) for r in self._current]


def test_validate_happy_path():
    now = datetime.now(timezone.utc) + timedelta(minutes=10)
    res = validate_appointment_payload({
        'start_ts': now.isoformat(),
        'end_ts': (now + timedelta(hours=1)).isoformat(),
        'status': 'scheduled',
        'total_amount': 100,
        'paid_amount': 50,
        'tech_id': 't1',
        'vehicle_id': 1,
    })
    assert not res.errors
    assert res.cleaned['status'] == 'SCHEDULED'


def test_validate_past_start_rejected():
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    res = validate_appointment_payload({'start_ts': past.isoformat()})
    assert any(e.field == 'start_ts' for e in res.errors)


def test_validate_transition_invalid():
    now = datetime.now(timezone.utc) + timedelta(minutes=5)
    existing = {'status': 'SCHEDULED', 'start_ts': now}
    res = validate_appointment_payload({'status': 'COMPLETED'}, mode='edit', existing=existing)
    assert any(e.code == 'INVALID_TRANSITION' for e in res.errors)


def test_validate_paid_exceeds_total():
    now = datetime.now(timezone.utc) + timedelta(minutes=5)
    res = validate_appointment_payload({'start_ts': now.isoformat(), 'total_amount': 10, 'paid_amount': 20})
    assert any(e.field == 'paid_amount' for e in res.errors)


def test_find_conflicts_returns_ids():
    now = datetime.now(timezone.utc)
    conn = DummyConn({'tech': [1,2], 'vehicle': []})
    conflicts = find_conflicts(conn, tech_id='t1', vehicle_id=9, start_ts=now, end_ts=now + timedelta(hours=1))
    assert conflicts['tech'] == [1,2]
    assert conflicts['vehicle'] == []


def test_find_conflicts_vehicle():
    now = datetime.now(timezone.utc)
    conn = DummyConn({'vehicle': [42]})
    conflicts = find_conflicts(conn, tech_id=None, vehicle_id=5, start_ts=now, end_ts=now + timedelta(hours=1))
    assert conflicts['vehicle'] == [42]
