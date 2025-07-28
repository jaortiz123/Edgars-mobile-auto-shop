from datetime import date
import pytest

def test_get_stats_happy_path(client, fake_db):
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    assert j["jobsToday"] == 4
    assert j["carsOnPremises"] == 2
    assert j["scheduled"] == 3
    assert j["inProgress"] == 2
    assert j["ready"] == 1
    assert j["completed"] == 5
    assert j["noShow"] == 0
    assert j["unpaidTotal"] == 1234.56

def test_stats_returns_500_envelope_on_db_down(client, monkeypatch):
    import backend.local_server as srv
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 500
    j = r.get_json()
    assert j["errors"][0]["code"] == "INTERNAL"
    assert "request_id" in j["meta"]