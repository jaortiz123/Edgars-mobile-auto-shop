import pytest
from http import HTTPStatus
from datetime import datetime, timedelta, timezone
import backend.local_server as srv

# These tests use the real Postgres test container via the shared client fixture.
# They exercise the newly integrated validation + conflict detection logic.


@pytest.fixture
def future_start():
    return (datetime.now(timezone.utc) + timedelta(minutes=30)).replace(microsecond=0)


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


@pytest.mark.integration
def test_create_conflict_same_tech(client, db_connection, future_start):
    # Create first appointment
    tech_uuid = "11111111-1111-1111-1111-111111111111"
    payload1 = {
        "customer_id": "Cust A",
        "requested_time": _iso(future_start),
        "tech_id": tech_uuid,
        "license_plate": "ABC123",
    }
    r1 = client.post("/api/admin/appointments", json=payload1)
    assert r1.status_code in (HTTPStatus.CREATED, 201), r1.data

    # Second overlapping appointment for same tech (same start time)
    payload2 = {
        "customer_id": "Cust B",
        "requested_time": _iso(future_start),
        "tech_id": tech_uuid,
        "license_plate": "ABC123",
    }
    r2 = client.post("/api/admin/appointments", json=payload2)
    assert r2.status_code == HTTPStatus.CONFLICT, r2.data
    body = r2.get_json()
    assert body and body.get("error"), body
    err = body["error"]
    assert err["code"] == "conflict"


@pytest.mark.integration
def test_edit_conflict_same_tech(client, db_connection, future_start):
    # Create two non-overlapping (different tech or time) appointments then force a conflict via PATCH
    tech_uuid = "22222222-2222-2222-2222-222222222222"
    payloadA = {
        "customer_id": "Cust A",
        "requested_time": _iso(future_start),
        "tech_id": tech_uuid,
        "license_plate": "ABC123",
        "end_ts": _iso(future_start + timedelta(hours=2)),
    }
    rA = client.post("/api/admin/appointments", json=payloadA)
    assert rA.status_code in (HTTPStatus.CREATED, 201)
    idA = (rA.get_json().get("data") or {}).get("id") or rA.get_json().get("id")

    # Second appointment starts 3h later so it doesn't overlap given default block duration (2h)
    payloadB = {
        "customer_id": "Cust B",
        "requested_time": _iso(future_start + timedelta(hours=3)),
        "tech_id": tech_uuid,
        "license_plate": "ABC123",
        "end_ts": _iso(future_start + timedelta(hours=5)),
    }
    rB = client.post("/api/admin/appointments", json=payloadB)
    # Should succeed (different time block) prior to conflicting edit
    assert rB.status_code in (HTTPStatus.CREATED, 201), rB.get_data()
    idB = (rB.get_json().get("data") or {}).get("id") or rB.get_json().get("id")

    # Now PATCH B to overlap A's time
    patch_payload = {
        "start": _iso(future_start)
    }  # move B to overlap A using default block duration
    rPatch = client.patch(f"/api/admin/appointments/{idB}", json=patch_payload)
    assert rPatch.status_code == HTTPStatus.CONFLICT, rPatch.data
    body = rPatch.get_json()
    assert body and body["error"]["code"] == "conflict"


@pytest.mark.integration
def test_create_validation_error_paid_exceeds_total(client, db_connection, future_start):
    payload = {
        "customer_id": "Cust C",
        "requested_time": _iso(future_start),
        "tech_id": "33333333-3333-3333-3333-333333333333",
        "total_amount": 50,
        "paid_amount": 100,
        "license_plate": "DEF456",
    }
    r = client.post("/api/admin/appointments", json=payload)
    assert r.status_code == HTTPStatus.BAD_REQUEST, r.data
    body = r.get_json()
    assert body and body["error"]["code"] == "validation_failed"


@pytest.mark.integration
def test_edit_validation_error_paid_exceeds_total(client, db_connection, future_start):
    # Create valid appointment
    payload_ok = {
        "customer_id": "Cust D",
        "requested_time": _iso(future_start),
        "tech_id": "44444444-4444-4444-4444-444444444444",
        "total_amount": 100,
        "paid_amount": 20,
        "license_plate": "GHI789",
    }
    r_ok = client.post("/api/admin/appointments", json=payload_ok)
    assert r_ok.status_code in (HTTPStatus.CREATED, 201)
    appt_id = (r_ok.get_json().get("data") or {}).get("id") or r_ok.get_json().get("id")

    # Patch with invalid monetary relationship
    patch_payload = {"paid_amount": 200, "total_amount": 100}
    r_patch = client.patch(f"/api/admin/appointments/{appt_id}", json=patch_payload)
    assert r_patch.status_code == HTTPStatus.BAD_REQUEST, r_patch.data
    body = r_patch.get_json()
    assert body and body["error"]["code"] == "validation_failed"
