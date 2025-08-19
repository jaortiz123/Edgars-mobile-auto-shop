import importlib
import time
import uuid
import logging
from http import HTTPStatus

import pytest

from backend import local_server

REQUEST_ID_HEADER = local_server.REQUEST_ID_HEADER
REQUEST_ID_REGEX = local_server.REQUEST_ID_REGEX


@pytest.mark.usefixtures("db_connection")
def test_request_id_lowercase_uuidv4_enforced(client):
    importlib.reload(local_server)
    inbound = str(uuid.uuid4()).upper()  # uppercase form
    resp = client.get("/api/admin/customers/999998/profile", headers={REQUEST_ID_HEADER: inbound})
    # Response should echo lowercase variant
    echoed = resp.headers[REQUEST_ID_HEADER]
    assert echoed == inbound.lower()
    assert REQUEST_ID_REGEX.match(echoed)
    body = resp.get_json()
    assert body["meta"]["request_id"] == echoed


@pytest.mark.usefixtures("db_connection")
def test_logging_circuit_breaker_trips_and_recovers(client, monkeypatch, caplog):
    # Force small threshold for faster test by monkeypatching class constants before reload
    monkeypatch.setenv("LOG_CIRCUIT_FAIL_THRESHOLD", "3")
    monkeypatch.setenv("LOG_CIRCUIT_COOLDOWN_SECONDS", "0.05")
    importlib.reload(local_server)
    # Seed minimal data
    with local_server.db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(5201,'Breaker User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(6201,5201)")
            cur.execute(
                """
                INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts)
                VALUES(7201,5201,6201,'COMPLETED',1.00,1.00,NOW())
                """
            )

    worker = local_server._async_log
    # Directly trip breaker (white-box testing internal method for deterministic behavior)
    worker._trip_breaker()  # type: ignore[attr-defined]
    stats = worker.stats()
    assert stats["breaker_trip_count"] >= 1
    assert stats["breaker_open"] is True
    # Wait for cooldown to elapse and verify automatic close
    time.sleep(worker.COOLDOWN_SEC + 0.05)
    # Access stats again (breaker should auto-close on next stats read if time passed)
    stats2 = worker.stats()
    assert stats2["breaker_open"] is False, stats2
