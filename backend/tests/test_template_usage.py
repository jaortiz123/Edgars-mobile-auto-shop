#!/usr/bin/env python3
"""Telemetry endpoint tests for /api/admin/template-usage.

Validates:
- 201 Created on first event
- 200 OK + idempotent true on duplicate idempotency key
"""
import json
import jwt
import pytest
from datetime import datetime
import hashlib

try:
    from backend import local_server  # preferred import path
except ImportError:  # pragma: no cover
    import local_server  # type: ignore

app = local_server.app
JWT_SECRET = local_server.JWT_SECRET
JWT_ALG = local_server.JWT_ALG


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def auth_headers():
    def make(role="Owner", sub="telemetry-tester"):
        token = jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm=JWT_ALG)
        return {"Authorization": f"Bearer {token}"}
    return make


@pytest.fixture
def mock_db(mocker):
    mock_connection = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.cursor.return_value.__enter__.return_value = mock_cursor
    mocker.patch('backend.local_server.db_conn', return_value=mock_connection)
    return mock_cursor


def test_template_usage_idempotent(client, auth_headers, mock_db):
    """First POST creates event; second POST with same key returns idempotent=true."""
    template_row = {"id": "11111111-1111-1111-1111-111111111111", "slug": "reminder", "channel": "sms"}
    payload = {
        "template_id": template_row["id"],
        "channel": "sms",
        "appointment_id": 123,
        "delivery_ms": 450,
        "idempotency_key": "same-key",
    }
    expected_hash = hashlib.sha256((template_row["id"] + "|same-key|sms").encode("utf-8")).hexdigest()
    inserted_row = {
        "id": "22222222-2222-2222-2222-222222222222",
        "template_id": template_row["id"],
        "template_slug": template_row["slug"],
        "channel": template_row["channel"],
        "appointment_id": 123,
        "user_id": "telemetry-tester",
        "sent_at": datetime.utcnow(),
        "delivery_ms": 450,
        "was_automated": False,
        "hash": expected_hash,
    }
    existing_row = dict(inserted_row)
    # fetchone sequence: resolve template, hash check (None), insert returning row, resolve template (2nd), hash check (existing)
    mock_db.fetchone.side_effect = [template_row, None, inserted_row, template_row, existing_row]

    # First request -> create
    r1 = client.post('/api/admin/template-usage', headers=auth_headers(), json=payload)
    assert r1.status_code == 201, r1.data
    evt1 = json.loads(r1.data)["data"]["template_usage_event"]
    assert evt1["idempotent"] is False
    assert evt1["template_slug"] == "reminder"
    assert evt1["hash"] == expected_hash

    # Second request -> idempotent
    r2 = client.post('/api/admin/template-usage', headers=auth_headers(), json=payload)
    assert r2.status_code == 200, r2.data
    evt2 = json.loads(r2.data)["data"]["template_usage_event"]
    assert evt2["idempotent"] is True
    assert evt2["hash"] == expected_hash
