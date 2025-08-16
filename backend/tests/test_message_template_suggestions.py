#!/usr/bin/env python3
"""Tests for message template suggestion heuristic via appointment_status param."""
import jwt
import pytest
import json

try:
    from backend import local_server
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
    def make(role="Owner", sub="suggest-test"):
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

# Helper factory for a template row (DB row style)

def _tpl(id_suffix: str, slug: str, label: str, channel: str = 'sms', active: bool = True):
    return {
        'id': f'00000000-0000-0000-0000-{id_suffix:0>12}',
        'slug': slug,
        'label': label,
        'channel': channel,
        'category': None,
        'body': f'Body for {label}',
        'variables': [],
        'is_active': active,
        'created_at': None,
        'updated_at': None,
    }

class TestTemplateSuggestions:
    def test_with_status_returns_suggested(self, client, auth_headers, mock_db):
        # DB returns both needed suggestion + extra
        rows = [
            _tpl('000000000001', 'quote_approval_request', 'Quote Approval Request'),
            _tpl('000000000002', 'vehicle_ready_for_pickup', 'Vehicle Ready'),
            _tpl('000000000003', 'other_template', 'Other')
        ]
        mock_db.fetchall.return_value = rows
        resp = client.get('/api/admin/message-templates?appointment_status=Work Complete', headers=auth_headers())
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert payload['data']['suggested'][0]['slug'] == 'vehicle_ready_for_pickup'
        assert payload['data']['suggested'][0]['reason'].startswith('status_match:')
        # Ensure full list still present
        slugs = [t['slug'] for t in payload['data']['message_templates']]
        assert 'vehicle_ready_for_pickup' in slugs

    def test_unknown_status_has_empty_suggested(self, client, auth_headers, mock_db):
        rows = [ _tpl('000000000001', 'quote_approval_request', 'Quote Approval Request') ]
        mock_db.fetchall.return_value = rows
        resp = client.get('/api/admin/message-templates?appointment_status=Unmapped_Status', headers=auth_headers())
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        # suggested should exist but be empty list
        assert 'suggested' in payload['data']
        assert payload['data']['suggested'] == []

    def test_no_status_param_no_suggested_key(self, client, auth_headers, mock_db):
        rows = [ _tpl('000000000001', 'quote_approval_request', 'Quote Approval Request') ]
        mock_db.fetchall.return_value = rows
        resp = client.get('/api/admin/message-templates', headers=auth_headers())
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert 'suggested' not in payload['data']
