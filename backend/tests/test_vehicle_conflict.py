from http import HTTPStatus
from datetime import datetime, timedelta, timezone
import pytest

@pytest.fixture
def future_start():
    return (datetime.now(timezone.utc) + timedelta(minutes=45)).replace(microsecond=0)

def _iso(dt):
    return dt.isoformat().replace('+00:00','Z')

# Vehicle conflict: same license plate creates two overlapping appointments (different tech allowed) should 409
# We rely on implicit vehicle creation/resolution via license_plate.

def test_create_vehicle_conflict(client, db_connection, future_start):
    tech1 = '11111111-1111-1111-1111-111111111111'
    tech2 = '22222222-2222-2222-2222-222222222222'
    start_iso = _iso(future_start)
    payload1 = {"customer_id":"Cust V1", "requested_time": start_iso, "tech_id": tech1, "license_plate": "VEH777"}
    r1 = client.post('/api/admin/appointments', json=payload1)
    assert r1.status_code in (HTTPStatus.CREATED, 201), r1.data
    payload2 = {"customer_id":"Cust V2", "requested_time": start_iso, "tech_id": tech2, "license_plate": "VEH777"}
    r2 = client.post('/api/admin/appointments', json=payload2)
    assert r2.status_code == HTTPStatus.CONFLICT, r2.data
    body = r2.get_json(); assert body and body['errors'][0]['code'] == 'CONFLICT'
