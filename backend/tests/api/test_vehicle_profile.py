from http import HTTPStatus
from datetime import datetime, timedelta, timezone

# Tests for GET /api/admin/vehicles/<id>/profile
# Coverage:
# 1. Response shape & data integrity
# 2. ETag + 304 conditional flow
# 3. Pagination integrity & no duplicates
# 4. RBAC 403 (simulate by providing no/bad auth with DEV_NO_AUTH disabled)
# 5. 404 not found
# 6. Cursor precedence over date filters


def _create_vehicle_and_appointments(client, plate: str, count: int = 3):
    """Create a vehicle implicitly via appointment creation and return (vehicle_id, appt_ids)."""
    appt_ids = []
    vehicle_id = None
    now = datetime.now(timezone.utc)
    for i in range(count):
        start_ts = (now + timedelta(minutes=5 + i)).isoformat().replace("+00:00", "Z")
        resp = client.post(
            "/api/admin/appointments",
            json={
                "customer_name": f"Cust {plate}",
                "license_plate": plate,
                "start_ts": start_ts,
                "status": "COMPLETED",
            },
        )
        assert resp.status_code in (HTTPStatus.CREATED, HTTPStatus.OK), resp.get_data(as_text=True)
        appt_payload = resp.get_json()["data"]
        appt_id = appt_payload.get("appointment", {}).get("id") or appt_payload.get("id")
        appt_ids.append(appt_id)
        if not vehicle_id:
            # Vehicle info nested in payload (schema may not surface separate vehicles table id in simplified test schema)
            vehicle_id = (
                appt_payload.get("appointment", {}).get("vehicle_id")
                or appt_payload.get("vehicle", {}).get("id")
                or plate  # fallback to license plate string (legacy form)
            )
        svc = client.post(
            f"/api/appointments/{appt_id}/services",
            json={"name": f"Svc {i}", "estimated_price": 10 + i},
        )
        assert svc.status_code in (HTTPStatus.OK, HTTPStatus.CREATED)
    return vehicle_id, appt_ids


def test_vehicle_profile_basic_shape_and_stats(client):
    vehicle_id, _ = _create_vehicle_and_appointments(client, "VPROF1", 2)
    assert vehicle_id, "Vehicle id missing from creation payload"

    resp = client.get(f"/api/admin/vehicles/{vehicle_id}/profile")
    assert resp.status_code == HTTPStatus.OK
    js = resp.get_json()["data"]
    assert "vehicle" in js and "stats" in js and "timeline" in js
    stats = js["stats"]
    assert isinstance(stats.get("total_visits"), int)
    assert "lifetime_spend" in stats
    timeline = js["timeline"]
    assert "rows" in timeline and isinstance(timeline["rows"], list)


def test_vehicle_profile_etag_flow(client):
    vehicle_id, _ = _create_vehicle_and_appointments(client, "VPROF2", 1)
    first = client.get(f"/api/admin/vehicles/{vehicle_id}/profile")
    etag = first.headers.get("ETag")
    assert etag, "ETag missing"
    second = client.get(
        f"/api/admin/vehicles/{vehicle_id}/profile", headers={"If-None-Match": etag}
    )
    assert second.status_code == HTTPStatus.NOT_MODIFIED


def test_vehicle_profile_pagination_no_duplicates(client):
    vehicle_id, _ = _create_vehicle_and_appointments(client, "VPROF3", 6)
    first = client.get(f"/api/admin/vehicles/{vehicle_id}/profile?page_size=3")
    js1 = first.get_json()["data"]["timeline"]
    assert js1["has_more"] is True
    cursor = js1["next_cursor"]
    second = client.get(f"/api/admin/vehicles/{vehicle_id}/profile?page_size=3&cursor={cursor}")
    js2 = second.get_json()["data"]["timeline"]
    ids1 = {r["id"] for r in js1["rows"]}
    ids2 = {r["id"] for r in js2["rows"]}
    assert ids1.isdisjoint(ids2), "Duplicate appointment IDs across pages"


def test_vehicle_profile_not_found(client):
    resp = client.get("/api/admin/vehicles/00000000-0000-0000-0000-000000000000/profile")
    assert resp.status_code == HTTPStatus.NOT_FOUND


def test_vehicle_profile_cursor_precedence_over_dates(client):
    vehicle_id, _ = _create_vehicle_and_appointments(client, "VPROF4", 4)
    first = client.get(f"/api/admin/vehicles/{vehicle_id}/profile?page_size=2")
    cur = first.get_json()["data"]["timeline"]["next_cursor"]
    second = client.get(
        f"/api/admin/vehicles/{vehicle_id}/profile?page_size=2&cursor={cur}&from=2000-01-01&to=1999-01-01"
    )
    assert second.status_code == HTTPStatus.OK


# RBAC negative: disable dev bypass and ensure no token results in 403 (before 404)


def test_vehicle_profile_rbac_forbidden(client):
    import local_server as srv

    prev = srv.DEV_NO_AUTH
    try:
        srv.DEV_NO_AUTH = False
        resp = client.get("/api/admin/vehicles/999999/profile", headers={"X-Test-NoAuth": "1"})
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.get_data(as_text=True)
    finally:
        srv.DEV_NO_AUTH = prev
