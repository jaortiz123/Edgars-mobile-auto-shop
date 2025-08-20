import os
import json
import pytest
from backend.local_server import app, _RATE
from http import HTTPStatus


@pytest.fixture(autouse=True)
def clear_rate_limit():
    # Clear rate limit state before each test
    _RATE.clear()
    yield
    _RATE.clear()


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.mark.parametrize(
    "old_status,new_status,expected_code,expected_msg",
    [
        (
            "SCHEDULED",
            "COMPLETED",
            "INVALID_TRANSITION",
            "Invalid transition SCHEDULED → COMPLETED",
        ),
    ],
)
def test_invalid_transition(
    client, old_status, new_status, expected_code, expected_msg, monkeypatch
):
    # Insert a fake appointment row in memory by bypassing DB
    # Monkeypatch norm_status and ALLOWED_TRANSITIONS for this test
    # Instead, simulate direct call
    url = f"/api/admin/appointments/apt1/move"
    resp = client.patch(url, json={"status": new_status, "position": 1})
    data = resp.get_json()
    assert resp.status_code == 400
    # Unified error envelope
    assert "error" in data
    err = data["error"]
    assert err["code"] == expected_code.lower()
    assert expected_msg.lower().split(" ")[:3] == err["message"].lower().split(" ")[:3]


def test_rate_limited(client):
    # Exceed rate limit by setting count beyond limit
    # We define RATE_LIMIT_PER_MINUTE small for test
    from backend.local_server import RATE_LIMIT_PER_MINUTE

    # Pre-fill rate limit
    key = f"move:127.0.0.1:anon"
    _RATE[key] = (RATE_LIMIT_PER_MINUTE, 0)
    # Also seed alternate import path module if already imported in larger test runs
    try:  # pragma: no cover - defensive cross-import synchronization
        import local_server as ls  # type: ignore

        if getattr(ls, "_RATE", None) is not _RATE:
            ls._RATE[key] = (RATE_LIMIT_PER_MINUTE, 0)  # type: ignore
    except Exception:
        pass
    resp = client.patch(
        "/api/admin/appointments/apt1/move", json={"status": "IN_PROGRESS", "position": 1}
    )
    data = resp.get_json()
    assert resp.status_code == 429
    assert "error" in data
    err = data["error"]
    assert err["code"] == "rate_limited"
    assert "rate limit" in err["message"].lower()
