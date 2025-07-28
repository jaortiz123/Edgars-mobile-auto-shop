import pytest

# Use shared client and fake_db fixtures from conftest

def test_get_admin_appointments_returns_empty_list_if_no_db(client, monkeypatch):
    # Simulate DB unavailable
    import backend.local_server as srv
    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    r = client.get("/api/admin/appointments")
    assert r.status_code == 200
    j = r.get_json()
    # Envelope response shape
    assert j.get("data") is not None
    assert j["data"]["appointments"] == []
    assert j["data"]["nextCursor"] is None
    assert j.get("errors") is None
    assert "request_id" in j.get("meta", {})

# You would add more comprehensive tests here once you have a database setup
# and can insert test data.
