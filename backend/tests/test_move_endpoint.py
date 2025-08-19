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
    assert data["data"] is None
    err = data["errors"][0]
    assert err["code"] == expected_code
    assert expected_msg in err["detail"]


def test_rate_limited(client):
    # Exceed rate limit by setting count beyond limit
    # We define RATE_LIMIT_PER_MINUTE small for test
    from backend.local_server import RATE_LIMIT_PER_MINUTE

    # Pre-fill rate limit
    key = f"move:127.0.0.1:anon"
    _RATE[key] = (RATE_LIMIT_PER_MINUTE, 0)
    resp = client.patch(
        "/api/admin/appointments/apt1/move", json={"status": "IN_PROGRESS", "position": 1}
    )
    data = resp.get_json()
    assert resp.status_code == 429
    assert data["data"] is None
    err = data["errors"][0]
    assert err["code"] == "RATE_LIMITED"
    assert "Rate limit exceeded" in err["detail"]
