from datetime import date
import pytest
import json

def test_get_stats_happy_path(client, fake_db):
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    
    # Legacy fields for backward compatibility
    assert j["jobsToday"] == 4
    assert j["carsOnPremises"] == 2
    assert j["scheduled"] == 3
    assert j["inProgress"] == 2
    assert j["ready"] == 1
    assert j["completed"] == 5
    assert j["noShow"] == 0
    assert j["unpaidTotal"] == 1234.56
    
    # NEW: v2 enhanced totals
    assert "totals" in j
    totals = j["totals"]
    assert "today_completed" in totals
    assert "today_booked" in totals
    assert "avg_cycle" in totals
    assert "avg_cycle_formatted" in totals
    
    # Verify structure
    assert isinstance(totals["today_completed"], int)
    assert isinstance(totals["today_booked"], int)
    assert totals["avg_cycle_formatted"] is not None

def test_get_stats_with_new_metrics(client, fake_db):
    """Test the new v2 metrics specifically"""
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    
    totals = j["totals"]
    
    # today_booked should equal jobsToday
    assert totals["today_booked"] == j["jobsToday"]
    
    # today_completed should be >= 0
    assert totals["today_completed"] >= 0
    
    # avg_cycle can be None or a float
    if totals["avg_cycle"] is not None:
        assert isinstance(totals["avg_cycle"], (int, float))
        assert totals["avg_cycle"] >= 0
    
    # avg_cycle_formatted should always be a string
    assert isinstance(totals["avg_cycle_formatted"], str)

def test_stats_returns_500_envelope_on_db_down(client, monkeypatch):
    import backend.local_server as srv
    monkeypatch.setattr(srv, "db_conn", lambda: None)
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 500
    j = r.get_json()
    assert j["errors"][0]["code"] == "INTERNAL"
    assert "request_id" in j["meta"]

def test_stats_redis_cache_fallback(client, fake_db, monkeypatch):
    """Test that stats work even when Redis is unavailable"""
    import backend.local_server as srv
    
    # Mock Redis to be unavailable
    monkeypatch.setattr(srv, "_REDIS_CLIENT", None)
    
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    
    # Should still return all expected fields
    assert "jobsToday" in j
    assert "totals" in j
    assert "today_completed" in j["totals"]

def test_unpaid_total_calculation(client, fake_db):
    """Test that unpaid_total is calculated correctly"""
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    
    # Should be rounded to 2 decimal places
    assert isinstance(j["unpaidTotal"], (int, float))
    unpaid_str = str(j["unpaidTotal"])
    if '.' in unpaid_str:
        decimal_places = len(unpaid_str.split('.')[1])
        assert decimal_places <= 2

def test_avg_cycle_time_metric(client, fake_db):
    """Test average cycle time calculation and formatting"""
    r = client.get("/api/admin/dashboard/stats")
    assert r.status_code == 200
    j = r.get_json()
    
    totals = j["totals"]
    
    # Test formatted duration
    formatted = totals["avg_cycle_formatted"]
    assert isinstance(formatted, str)
    
    # Should be either "N/A" for no data, or contain time units
    if formatted != "N/A":
        # Should contain time units like 'h', 'm', or 'd'
        assert any(unit in formatted for unit in ['h', 'm', 'd'])

def test_format_duration_hours():
    """Test the duration formatting helper function"""
    from backend.local_server import format_duration_hours
    
    # Test various hour values
    assert format_duration_hours(None) == "N/A"
    assert format_duration_hours(-1) == "N/A"
    assert format_duration_hours(0.5) == "30m"
    assert format_duration_hours(1.5) == "1.5h"
    assert format_duration_hours(25.5) == "1d 1.5h"
    assert format_duration_hours(48) == "2d"