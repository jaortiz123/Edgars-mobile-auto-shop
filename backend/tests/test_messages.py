#!/usr/bin/env python3
"""
Test suite for T-021 messaging endpoints

Tests the messaging functionality for appointments including:
- GET /api/appointments/:id/messages
- POST /api/appointments/:id/messages
- PATCH /api/appointments/:id/messages/:message_id
- DELETE /api/appointments/:id/messages/:message_id

Tests include role-based access control, envelope responses, and error handling.
"""

import pytest
import json
import jwt
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import tempfile
import sqlite3
import os

# Import the Flask app for testing
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
try:
    from local_server import app, JWT_SECRET, JWT_ALG
except ImportError:
    # Try the backend.local_server import pattern
    from backend import local_server

    app = local_server.app
    JWT_SECRET = local_server.JWT_SECRET
    JWT_ALG = local_server.JWT_ALG


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def auth_headers():
    """Generate JWT tokens for different user roles."""

    def make_token(role="Owner", user_id="test-user"):
        payload = {"sub": user_id, "role": role}
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
        return {"Authorization": f"Bearer {token}"}

    return make_token


@pytest.fixture
def mock_db():
    """Mock database connection for testing."""
    with patch("local_server.db_conn") as mock_conn:
        mock_connection = MagicMock()
        mock_cursor = MagicMock()
        mock_connection.__enter__.return_value = mock_connection
        mock_connection.__exit__.return_value = None
        mock_connection.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connection.cursor.return_value.__exit__.return_value = None
        mock_conn.return_value = mock_connection
        yield mock_cursor


class TestMessagingEndpoints:
    """Test messaging endpoints for T-021."""

    def test_get_messages_success(self, client, auth_headers, mock_db):
        """Test GET /api/appointments/:id/messages - successful response."""
        mock_db.fetchone.side_effect = [
            {"id": "123"},
        ]
        mock_db.fetchall.return_value = [
            {
                "id": "msg-1",
                "appointment_id": "123",
                "channel": "sms",
                "direction": "out",
                "body": "Your appointment is confirmed",
                "status": "delivered",
                "sent_at": datetime(2025, 7, 29, 10, 0, 0, tzinfo=timezone.utc),
            },
            {
                "id": "msg-2",
                "appointment_id": "123",
                "channel": "sms",
                "direction": "in",
                "body": "Thank you",
                "status": "delivered",
                "sent_at": datetime(2025, 7, 29, 10, 5, 0, tzinfo=timezone.utc),
            },
        ]
        response = client.get("/api/appointments/123/messages", headers=auth_headers("Owner"))
        assert response.status_code == 200
        payload = json.loads(response.data)
        assert "data" in payload and "meta" in payload and "errors" not in payload
        messages = payload["data"]["messages"]
        assert len(messages) == 2
        assert messages[0]["id"] == "msg-1"
        assert messages[0]["channel"] == "sms"
        assert messages[0]["direction"] == "out"
        assert messages[0]["body"] == "Your appointment is confirmed"
        assert messages[0]["status"] == "delivered"

    def test_get_messages_appointment_not_found(self, client, auth_headers, mock_db):
        """Test GET /api/appointments/:id/messages - appointment not found."""
        # Mock appointment doesn't exist
        mock_db.fetchone.return_value = None
        response = client.get("/api/appointments/999/messages", headers=auth_headers("Owner"))
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data["error"]["code"] == "not_found"

    def test_get_messages_no_auth(self, client, mock_db):
        """Test GET /api/appointments/:id/messages - no authentication."""
        response = client.get("/api/appointments/123/messages")
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error"]["code"] in ("auth_required", "forbidden")

    def test_create_message_success(self, client, auth_headers, mock_db):
        """Test POST /api/appointments/:id/messages - successful creation."""
        # Mock appointment exists check
        mock_db.fetchone.side_effect = [
            {"id": "123"},  # Appointment exists
            {"id": "new-msg-id"},  # Message created
        ]

        message_data = {"channel": "sms", "body": "Your vehicle is ready for pickup"}

        response = client.post(
            "/api/appointments/123/messages", headers=auth_headers("Owner"), json=message_data
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert "data" in data and "meta" in data and "errors" not in data
        assert data["data"]["id"] == "new-msg-id"
        assert data["data"]["status"] == "sending"

    def test_create_message_invalid_channel(self, client, auth_headers, mock_db):
        """Test POST /api/appointments/:id/messages - invalid channel."""
        message_data = {"channel": "invalid", "body": "Test message"}

        response = client.post(
            "/api/appointments/123/messages", headers=auth_headers("Owner"), json=message_data
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"]["code"] in ("validation_failed", "bad_request")
        assert "Channel" in data["error"]["message"]

    def test_create_message_empty_body(self, client, auth_headers, mock_db):
        """Test POST /api/appointments/:id/messages - empty message body."""
        message_data = {"channel": "sms", "body": ""}

        response = client.post(
            "/api/appointments/123/messages", headers=auth_headers("Owner"), json=message_data
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"]["code"] in ("validation_failed", "bad_request")
        assert "Message body" in data["error"]["message"]

    def test_create_message_tech_role_forbidden(self, client, auth_headers, mock_db):
        """Test POST /api/appointments/:id/messages - Tech role cannot create messages."""
        message_data = {"channel": "sms", "body": "Test message"}

        response = client.post(
            "/api/appointments/123/messages", headers=auth_headers("Tech"), json=message_data
        )
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error"]["code"] in ("rbac_forbidden", "forbidden")

    def test_update_message_status_success(self, client, auth_headers, mock_db):
        """Test PATCH /api/appointments/:id/messages/:message_id - successful update."""
        # Mock successful update
        mock_db.fetchone.return_value = {"id": "msg-1"}

        update_data = {"status": "delivered"}

        response = client.patch(
            "/api/appointments/123/messages/msg-1", headers=auth_headers("Owner"), json=update_data
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "data" in data and "meta" in data and "errors" not in data
        assert data["data"]["id"] == "msg-1"

    def test_update_message_invalid_status(self, client, auth_headers, mock_db):
        """Test PATCH /api/appointments/:id/messages/:message_id - invalid status."""
        update_data = {"status": "invalid"}

        response = client.patch(
            "/api/appointments/123/messages/msg-1", headers=auth_headers("Owner"), json=update_data
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"]["code"] in ("validation_failed", "bad_request")
        assert "Status" in data["error"]["message"]

    def test_update_message_not_found(self, client, auth_headers, mock_db):
        """Test PATCH /api/appointments/:id/messages/:message_id - message not found."""
        # Mock message not found
        mock_db.fetchone.return_value = None

        update_data = {"status": "delivered"}

        response = client.patch(
            "/api/appointments/123/messages/999", headers=auth_headers("Owner"), json=update_data
        )
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data["error"]["code"] == "not_found"

    def test_delete_message_success(self, client, auth_headers, mock_db):
        """Test DELETE /api/appointments/:id/messages/:message_id - successful deletion."""
        # Mock successful deletion
        mock_db.fetchone.return_value = {"id": "msg-1"}

        response = client.delete(
            "/api/appointments/123/messages/msg-1", headers=auth_headers("Owner")
        )

        assert response.status_code == 204
        assert response.data == b""

    def test_delete_message_not_found(self, client, auth_headers, mock_db):
        """Test DELETE /api/appointments/:id/messages/:message_id - message not found."""
        # Mock message not found
        mock_db.fetchone.return_value = None

        response = client.delete(
            "/api/appointments/123/messages/999", headers=auth_headers("Owner")
        )
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data["error"]["code"] == "not_found"

    def test_delete_message_tech_role_forbidden(self, client, auth_headers, mock_db):
        """Test DELETE /api/appointments/:id/messages/:message_id - Tech role cannot delete."""
        response = client.delete(
            "/api/appointments/123/messages/msg-1", headers=auth_headers("Tech")
        )
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error"]["code"] in ("rbac_forbidden", "forbidden")

    def test_role_based_access_advisor_can_write(self, client, auth_headers, mock_db):
        """Test that Advisor role can create and update messages."""
        # Mock appointment exists
        mock_db.fetchone.side_effect = [
            {"id": "123"},  # Appointment exists
            {"id": "new-msg-id"},  # Message created
        ]

        message_data = {"channel": "sms", "body": "Test message from advisor"}

        response = client.post(
            "/api/appointments/123/messages", headers=auth_headers("Advisor"), json=message_data
        )

        assert response.status_code == 201

    def test_role_based_access_tech_can_read(self, client, auth_headers, mock_db):
        """Test that Tech role can read messages."""
        # Mock appointment exists check
        mock_db.fetchone.side_effect = [
            {"id": "123"},  # Appointment exists
        ]

        # Mock messages query result
        mock_db.fetchall.return_value = []

        response = client.get("/api/appointments/123/messages", headers=auth_headers("Tech"))

        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
