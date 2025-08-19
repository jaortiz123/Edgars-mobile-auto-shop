import pytest


def test_404_returns_json_envelope(client):
    # Request an undefined route
    r = client.get("/undefined-route")
    assert r.status_code == 404
    j = r.get_json()
    # JSON envelope structure
    assert j.get("data") is None
    assert isinstance(j.get("errors"), list)
    assert j["errors"][0]["code"] == "NOT_FOUND"
    assert "request_id" in j.get("meta", {})


def test_method_not_allowed_returns_json_envelope(client):
    # POST to a GET-only endpoint
    r = client.post("/api/admin/appointments/board")
    assert r.status_code == 405
    j = r.get_json()
    assert j.get("data") is None
    assert isinstance(j.get("errors"), list)
    assert j["errors"][0]["code"] == "METHOD_NOT_ALLOWED"
    assert "request_id" in j.get("meta", {})
