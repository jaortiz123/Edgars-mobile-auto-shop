import os
import pytest

# Regression test: ensure board returns in-memory created appointment when DB unavailable


@pytest.fixture(autouse=True)
def enable_memory_mode(monkeypatch):
    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")
    # Force db_conn to raise to trigger memory path
    import backend.local_server as srv

    monkeypatch.setattr(srv, "db_conn", lambda: (_ for _ in ()).throw(RuntimeError("db down")))
    yield


@pytest.fixture
def client():
    from backend.local_server import app

    app.testing = True
    with app.test_client() as c:
        yield c


def test_board_shows_memory_created_appointment(client):
    # Create appointment (memory mode)
    from datetime import datetime, timezone, timedelta

    r = client.post(
        "/api/admin/appointments",
        json={
            "customer_name": "Mem Cust",
            "license_plate": "XYZ123",
            "requested_time": (datetime.now(timezone.utc) + timedelta(minutes=5))
            .isoformat()
            .replace("+00:00", "Z"),
        },
    )
    assert r.status_code == 201
    appt_id = r.get_json()["data"]["appointment"]["id"]
    # Fetch board and ensure card present
    board = client.get("/api/admin/appointments/board").get_json()
    assert any(
        c["id"] == appt_id for c in board.get("cards", [])
    ), "Memory-created appointment missing from board"
