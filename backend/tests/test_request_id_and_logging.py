import re
import json
import uuid
import time
from http import HTTPStatus

import pytest

from backend import local_server
import importlib
import logging

REQUEST_ID_HEADER = local_server.REQUEST_ID_HEADER
REQUEST_ID_REGEX = local_server.REQUEST_ID_REGEX


@pytest.mark.usefixtures("db_connection")
@pytest.mark.integration
def test_request_id_echo_with_inbound_header(client):
    importlib.reload(local_server)
    inbound_id = str(uuid.uuid4())
    # Use a simple endpoint that will 404 but still exercise middleware
    resp = client.get(
        "/api/admin/customers/999999/profile", headers={REQUEST_ID_HEADER: inbound_id}
    )
    assert REQUEST_ID_HEADER in resp.headers
    assert resp.headers[REQUEST_ID_HEADER] == inbound_id
    body = resp.get_json()
    assert body["meta"]["request_id"] == inbound_id


@pytest.mark.usefixtures("db_connection")
@pytest.mark.integration
def test_request_id_generated_when_missing(client):
    importlib.reload(local_server)
    resp = client.get("/api/admin/customers/999998/profile")
    assert REQUEST_ID_HEADER in resp.headers
    rid = resp.headers[REQUEST_ID_HEADER]
    assert REQUEST_ID_REGEX.match(rid)
    body = resp.get_json()
    assert body["meta"]["request_id"] == rid


@pytest.mark.usefixtures("db_connection")
@pytest.mark.integration
def test_api_request_log_contains_correlated_request_id(client, caplog):
    importlib.reload(local_server)
    with local_server.db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(5001,'Req Test')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(6001,5001)")
            cur.execute(
                """
                INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts)
                VALUES(7001,5001,6001,'COMPLETED',10.00,10.00,NOW())
            """
            )
    inbound_rid = str(uuid.uuid4())
    with caplog.at_level(logging.INFO, logger="edgar.api"):
        resp = client.get(
            "/api/admin/customers/5001/profile", headers={REQUEST_ID_HEADER: inbound_rid}
        )
        assert resp.status_code == HTTPStatus.OK
        # allow async worker log flush
        time.sleep(0.05)
    rid = resp.headers[REQUEST_ID_HEADER]
    assert rid == inbound_rid
    # Look for a log with both api.request and the request id
    found = False
    for rec in caplog.records:
        msg = rec.message
        if "api.request" in msg and rid in msg:
            found = True
            break
    assert (
        found
    ), f"No api.request log containing request_id {rid} captured. Logs: {[r.message for r in caplog.records]}"


@pytest.mark.usefixtures("db_connection")
@pytest.mark.integration
def test_logging_failure_does_not_break_request(client, monkeypatch):
    importlib.reload(local_server)

    # Force emit to raise
    def boom(level, payload):  # noqa: D401
        raise RuntimeError("simulated log failure")

    monkeypatch.setattr(local_server._async_log, "emit", boom)

    # Seed minimal data
    with local_server.db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(5101,'Fail Log User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(6101,5101)")
            cur.execute(
                """
                INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts)
                VALUES(7101,5101,6101,'COMPLETED',5.00,5.00,NOW())
            """
            )
    resp = client.get("/api/admin/customers/5101/profile")
    # Even with logging failure, request should succeed (200 or 304 depending on caching logic; accept 200 family)
    assert resp.status_code == HTTPStatus.OK
    assert REQUEST_ID_HEADER in resp.headers
    rid = resp.headers[REQUEST_ID_HEADER]
    assert REQUEST_ID_REGEX.match(rid)
