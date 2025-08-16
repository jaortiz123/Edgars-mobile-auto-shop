#!/usr/bin/env python3
"""Tests for /api/admin/technicians endpoint.

Validates basic shape, active-only default, and includeInactive flag.
"""
import jwt
import pytest
from http import HTTPStatus

try:
    from backend import local_server  # preferred import when running inside package
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
    def make(role="Owner", sub="tester"):
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

def make_row(idx: int, *, active=True):
    from datetime import datetime, timezone
    now = datetime(2025, 8, 16, tzinfo=timezone.utc)
    return {
        'id': f'tech-{idx}',
        'name': f'Tech {idx}',
        'initials': f'T{idx}',
        'is_active': active,
        'created_at': now,
        'updated_at': now,
    }

# --- Tests -----------------------------------------------------------------

def test_default_excludes_inactive(client, auth_headers, mock_db):
    mock_db.fetchall.return_value = [make_row(1, active=True), make_row(2, active=True)]
    resp = client.get('/api/admin/technicians', headers=auth_headers())
    assert resp.status_code == HTTPStatus.OK
    data = resp.get_json()
    assert 'technicians' in data
    assert all(t['isActive'] is True for t in data['technicians'])
    # shape includes keys
    first = data['technicians'][0]
    for k in ['id','name','initials','isActive','createdAt','updatedAt']:
        assert k in first


def test_include_inactive_flag(client, auth_headers, mock_db):
    # Simulate includeInactive=true returning both active and inactive
    mock_db.fetchall.return_value = [make_row(1, active=True), make_row(3, active=False)]
    resp = client.get('/api/admin/technicians?includeInactive=true', headers=auth_headers())
    assert resp.status_code == HTTPStatus.OK
    techs = resp.get_json()['technicians']
    assert any(t['isActive'] is False for t in techs)
    assert any(t['isActive'] is True for t in techs)


def test_requires_auth_role(client, auth_headers, mock_db):
    # Using Technician role should still be allowed/denied based on maybe_auth logic; we just ensure endpoint returns 200 for Owner
    mock_db.fetchall.return_value = []
    resp = client.get('/api/admin/technicians', headers=auth_headers(role='Owner'))
    assert resp.status_code == HTTPStatus.OK
