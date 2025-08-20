import pytest


def test_404_returns_json_envelope(client):
    # Request an undefined route
    r = client.get("/undefined-route")
    assert r.status_code == 404
    j = r.get_json()
    # JSON envelope structure
    assert j.get("data") is None
    assert "error" in j and j["error"]["code"] == "not_found"
    assert "request_id" in j.get("meta", {})


def test_method_not_allowed_returns_json_envelope(client):
    # POST to a GET-only endpoint
    r = client.post("/api/admin/appointments/board")
    assert r.status_code == 405
    j = r.get_json()
    assert j.get("data") is None
    assert "error" in j and j["error"]["code"] == "method_not_allowed"
    assert "request_id" in j.get("meta", {})
