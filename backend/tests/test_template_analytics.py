import pytest
from http import HTTPStatus
from datetime import datetime, timedelta, timezone
import uuid

# Assumes template_usage_events + message_templates seeded by prior migrations.


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


@pytest.fixture
def now_utc():
    return datetime.now(timezone.utc).replace(microsecond=0)


@pytest.fixture
def clear_usage_events(db_connection):  # type: ignore
    """Ensure template_usage_events table is empty before a test that asserts specific counts.
    This isolates tests from analytics seed data inserted by other tests.
    """
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("DELETE FROM template_usage_events")
    yield


def test_empty_range_returns_zeroes(client, db_connection, now_utc, clear_usage_events):
    # Use flush=1 to clear any cached prior analytics response that contained events
    r = client.get("/api/admin/analytics/templates?range=7d&flush=1")
    assert r.status_code == HTTPStatus.OK
    body = r.get_json()
    assert body
    assert body["totals"]["events"] == 0
    assert body["trend"]  # 7 or 8 buckets (inclusive logic) but all zero
    assert all(b["count"] == 0 for b in body["trend"])


def seed_event(cur, template_slug, sent_at, channel=None, user_id=None):
    """Insert a usage event with an explicit sent_at for deterministic tests."""
    cur.execute("SELECT id, channel FROM message_templates WHERE slug=%s", (template_slug,))
    tpl = cur.fetchone()
    assert tpl, template_slug
    chan = channel or tpl["channel"]
    cur.execute(
        """
        INSERT INTO template_usage_events (template_id, template_slug, channel, user_id, sent_at)
        VALUES (%s,%s,%s,%s,%s)
    """,
        (tpl["id"], template_slug, chan, user_id, sent_at),
    )


def test_basic_aggregation(client, db_connection, clear_usage_events):
    # Seed some events across days and channels
    # Freeze a reference 'now' to align with server-side now (allow small delta)
    base_now = datetime.now(timezone.utc).replace(microsecond=0)
    day = timedelta(days=1)
    ev_times = [
        base_now - day,  # vehicle_ready day-1
        base_now - day,  # vehicle_ready day-1 second user
        base_now,  # vehicle_ready today
        base_now,  # thanks email today
        base_now - day * 5,  # thanks email 5 days prior
    ]
    users = [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "11111111-1111-1111-1111-111111111111",
        "33333333-3333-3333-3333-333333333333",
        "44444444-4444-4444-4444-444444444444",
    ]
    templates = [
        "vehicle_ready_sms",
        "vehicle_ready_sms",
        "vehicle_ready_sms",
        "thanks_followup_email",
        "thanks_followup_email",
    ]
    with db_connection:  # type: ignore
        with db_connection.cursor() as cur:
            for tpl, ts, uid in zip(templates, ev_times, users):
                seed_event(cur, tpl, ts, user_id=uid)
    # Verify inserts persisted
    with db_connection.cursor() as cur2:
        cur2.execute("SELECT COUNT(*) FROM template_usage_events")
        total_inserted = cur2.fetchone()[0]
        assert total_inserted == 5, f"Expected 5 inserted events, found {total_inserted}"
    # Use flush=1 to bypass any cached empty response from earlier tests in same process
    r = client.get("/api/admin/analytics/templates?range=7d&flush=1")
    assert r.status_code == HTTPStatus.OK
    body = r.get_json()
    assert body
    assert body["totals"]["events"] == 5
    # vehicle_ready_sms should appear
    vready = next((t for t in body["templates"] if t["templateId"]), None)
    assert vready
    assert "trend" in body
    assert any(b["count"] > 0 for b in body["trend"])


def test_channel_filter(client, db_connection):
    # Only sms events counted
    r = client.get("/api/admin/analytics/templates?range=30d&channel=sms")
    assert r.status_code == HTTPStatus.OK
    body = r.get_json()
    assert body
    # All byChannel entries should only contain sms key if any
    assert set(body["totals"]["byChannel"].keys()) <= {"sms"}


def test_cache_behavior(client, db_connection):
    # Two consecutive requests should return identical meta.cache.hit progression: first False then True
    r1 = client.get("/api/admin/analytics/templates?range=7d&limit=5")
    assert r1.status_code == HTTPStatus.OK
    body1 = r1.get_json()
    assert body1
    assert body1["meta"]["cache"]["hit"] is False
    r2 = client.get("/api/admin/analytics/templates?range=7d&limit=5")
    assert r2.status_code == HTTPStatus.OK
    body2 = r2.get_json()
    assert body2
    assert body2["meta"]["cache"]["hit"] is True
