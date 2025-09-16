from http import HTTPStatus
import os
import pathlib

# This test verifies that the analytics seed script populates template_usage_events
# with at least one row when run after the base seed.


import pytest


@pytest.mark.integration
def test_analytics_seed_populates_events(db_connection):  # depends on pg_container base seed
    seed_path = (
        pathlib.Path(__file__).resolve().parent.parent / "seeds" / "seed_analytics_events.sql"
    )
    assert seed_path.exists(), f"Missing analytics seed file: {seed_path}"

    with open(seed_path, "r") as f:
        seed_sql = f.read()

    # Execute seed script inside a transaction (script has its own BEGIN/COMMIT; run raw)
    with db_connection:  # type: ignore
        with db_connection.cursor() as cur:
            cur.execute(seed_sql)
            cur.execute("SELECT COUNT(*) FROM template_usage_events")
            count = cur.fetchone()[0]

    assert count > 0, "Expected analytics seed to insert at least one usage event"


@pytest.mark.integration
def test_analytics_endpoint_after_seed(client, db_connection):
    # Ensure some events exist (idempotent re-run of seed acceptable)
    seed_path = (
        pathlib.Path(__file__).resolve().parent.parent / "seeds" / "seed_analytics_events.sql"
    )
    with open(seed_path, "r") as f:
        seed_sql = f.read()
    with db_connection:  # type: ignore
        with db_connection.cursor() as cur:
            cur.execute(seed_sql)

    # Call the analytics endpoint and assert totals.events > 0
    r = client.get("/api/admin/analytics/templates?range=7d&flush=1")
    assert r.status_code == HTTPStatus.OK
    body = r.get_json()
    assert body
    assert body["totals"]["events"] > 0, "Analytics endpoint should report > 0 events after seeding"
    # Ensure at least one template entry present
    assert len(body.get("templates", [])) >= 1
