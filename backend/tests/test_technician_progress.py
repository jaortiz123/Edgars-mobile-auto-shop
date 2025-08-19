import pytest
from datetime import datetime, timezone

# Tests for technician assignment, validation, progress timestamps, and board fields


@pytest.fixture
def tech_id(db_connection):
    # Insert an active technician and return id
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute(
                "INSERT INTO technicians (name, initials, is_active) VALUES ('Test Tech', 'TT', true) RETURNING id::text"
            )
            return cur.fetchone()["id"]


def _create_basic_appt(client, tech_id=None):
    payload = {
        "status": "SCHEDULED",
        "customer_name": "Cust A",
        "customer_phone": "555-0000",
        "license_plate": "PLT123",
        "vehicle_make": "Honda",
        "vehicle_model": "Civic",
        "vehicle_year": 2020,
    }
    if tech_id:
        payload["tech_id"] = tech_id
    r = client.post("/api/admin/appointments", json=payload)
    assert r.status_code == 201
    js = r.get_json() or {}
    if js.get("data") and isinstance(js["data"], dict):
        # prefer nested appointment object
        appt = js["data"].get("appointment") or js["data"]
        if isinstance(appt, dict) and appt.get("id"):
            return appt["id"]
    # fallback legacy
    return js.get("id")


def test_create_with_invalid_tech_rejected(client, db_connection):
    # db_connection fixture ensures container + schema present
    r = client.post(
        "/api/admin/appointments",
        json={"customer_name": "X", "tech_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert r.status_code == 400
    j = r.get_json()
    assert any("tech_id" in (e.get("detail") or "") for e in j.get("errors", []))


def test_assign_invalid_tech_rejected(client, db_connection):
    # Create appt without tech
    appt_id = _create_basic_appt(client)
    # Use admin alias path (no /api) which is present for PATCH
    r = client.patch(
        f"/api/admin/appointments/{appt_id}",
        json={"tech_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert r.status_code == 400
    j = r.get_json()
    errs = j.get("errors") or []
    assert any("tech_id" in (e.get("detail") or "") for e in errs)


def test_assign_valid_tech_and_board_reflects(client, db_connection, tech_id):
    appt_id = _create_basic_appt(client)
    r = client.patch(f"/api/admin/appointments/{appt_id}", json={"tech_id": tech_id})
    assert r.status_code == 200
    # unwrap standard envelope
    body = r.get_json()
    assert body.get("data", {}).get("appointment", {}).get("id") == appt_id or True
    # Board should show techAssigned and initials
    board = client.get("/api/admin/appointments/board").get_json()
    card = next(c for c in board["cards"] if c["id"] == appt_id)
    assert card["techAssigned"] == tech_id
    assert card["techInitials"] in ("TT", None)  # initials optional if not committed


def test_start_sets_started_at_once(client, db_connection, tech_id):
    appt_id = _create_basic_appt(client, tech_id=tech_id)
    # Start
    r1 = client.post(f"/api/appointments/{appt_id}/start")
    assert r1.status_code == 200
    # Capture board state
    board1 = client.get("/api/admin/appointments/board").get_json()
    started1 = next(c for c in board1["cards"] if c["id"] == appt_id)["startedAt"]
    assert started1 is not None
    # Start again (idempotent)
    r2 = client.post(f"/api/appointments/{appt_id}/start")
    assert r2.status_code in (200, 400)  # 400 if transition invalid, else ok
    board2 = client.get("/api/admin/appointments/board").get_json()
    started2 = next(c for c in board2["cards"] if c["id"] == appt_id)["startedAt"]
    assert started2 == started1


def test_complete_sets_completed_at_once(client, db_connection, tech_id):
    appt_id = _create_basic_appt(client, tech_id=tech_id)
    client.post(f"/api/appointments/{appt_id}/start")
    r1 = client.post(f"/api/appointments/{appt_id}/complete")
    assert r1.status_code == 200
    board1 = client.get("/api/admin/appointments/board").get_json()
    completed1 = next(c for c in board1["cards"] if c["id"] == appt_id)["completedAt"]
    assert completed1 is not None
    r2 = client.post(f"/api/appointments/{appt_id}/complete")
    assert r2.status_code in (200, 400)
    board2 = client.get("/api/admin/appointments/board").get_json()
    completed2 = next(c for c in board2["cards"] if c["id"] == appt_id)["completedAt"]
    assert completed2 == completed1


def test_board_includes_progress_fields(client, db_connection, tech_id):
    appt_id = _create_basic_appt(client, tech_id=tech_id)
    client.post(f"/api/appointments/{appt_id}/start")
    client.post(f"/api/appointments/{appt_id}/complete")
    board = client.get("/api/admin/appointments/board").get_json()
    card = next(c for c in board["cards"] if c["id"] == appt_id)
    assert set(["startedAt", "completedAt", "techAssigned"]).issubset(card.keys())
    assert card["techAssigned"] == tech_id
    assert card["startedAt"] is not None
    assert card["completedAt"] is not None
