import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import reminder_function


class TestReminderFunction:

    def setup_method(self):
        """Setup test environment"""
        os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:us-west-2:123456789012:test-topic"
        os.environ["DB_SECRET_ARN"] = "arn:aws:secretsmanager:us-west-2:123456789012:secret:test"
        os.environ["NOTIFICATION_TRACKING_TABLE"] = "test-notification-tracking"

    def teardown_method(self):
        """Clean up after test"""
        env_vars = ["SNS_TOPIC_ARN", "DB_SECRET_ARN", "NOTIFICATION_TRACKING_TABLE"]
        for var in env_vars:
            if var in os.environ:
                del os.environ[var]

    @patch("reminder_function.boto3")
    def test_get_db_connection(self, mock_boto3):
        """Test database connection establishment"""
        # Mock secrets manager response
        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": json.dumps(
                {
                    "host": "test-host",
                    "port": 5432,
                    "dbname": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                }
            )
        }
        mock_boto3.client.return_value = mock_secrets_client

        # Mock pg8000.native.Connection
        with patch("reminder_function.pg8000.native.Connection") as mock_pg8000_connection_class:
            mock_conn = Mock()
            mock_pg8000_connection_class.return_value = mock_conn

            conn = reminder_function.get_db_connection("test-secret-arn")

            # Verify connection was established with correct parameters
            mock_pg8000_connection_class.assert_called_once_with(
                user="testuser",
                password="testpass",
                host="test-host",
                port=5432,
                database="testdb",
                ssl_context=True,
            )

    @patch("reminder_function.datetime")
    def test_query_upcoming_appointments(self, mock_datetime):
        """Test querying appointments in next 24-26 hours"""
        # Mock current time
        mock_now = datetime(2025, 7, 21, 10, 0, 0)
        mock_datetime.utcnow.return_value = mock_now
        mock_datetime.combine = datetime.combine

        # Mock database connection
        mock_conn = Mock()
        mock_conn.run.side_effect = [
            [(10,)],  # For total_appointments
            [(5,)],  # For date_appointments
            [(3,)],  # For sms_appointments
            [
                {
                    "id": 1,
                    "scheduled_date": mock_now.date() + timedelta(days=1),
                    "scheduled_time": (mock_now + timedelta(hours=25)).time(),
                    "location_address": "123 Test St",
                    "notes": "Test appointment",
                    "customer_name": "John Doe",
                    "customer_phone": "+15551234567",
                    "customer_email": "john@example.com",
                    "sms_consent": True,
                    "sms_opt_out": False,
                    "service_name": "Oil Change",
                    "service_description": "Standard oil change",
                }
            ],
        ]

        appointments = reminder_function.query_upcoming_appointments(mock_conn)

        assert len(appointments) == 1
        assert appointments[0]["id"] == 1
        assert appointments[0]["customer_name"] == "John Doe"
        assert "appointment_datetime" in appointments[0]

    def test_is_reminder_already_sent_not_sent(self):
        """Test checking if reminder was already sent - not sent case"""
        mock_table = Mock()
        mock_table.get_item.return_value = {}  # No item found

        result = reminder_function.is_reminder_already_sent(mock_table, "123")

        assert result is False
        mock_table.get_item.assert_called_once_with(
            Key={"appointment_id": "123", "notification_type": "reminder_24h"}
        )

    def test_is_reminder_already_sent_already_sent(self):
        """Test checking if reminder was already sent - already sent case"""
        mock_table = Mock()
        mock_table.get_item.return_value = {"Item": {"status": "sent"}}

        result = reminder_function.is_reminder_already_sent(mock_table, "456")

        assert result is True

    def test_is_reminder_already_sent_failed_status(self):
        """Test checking if reminder was already sent - failed status case"""
        mock_table = Mock()
        mock_table.get_item.return_value = {"Item": {"status": "failed"}}

        result = reminder_function.is_reminder_already_sent(mock_table, "789")

        assert result is False  # Should return False for failed status

    @patch("reminder_function.sns")
    def test_send_appointment_reminder(self, mock_sns):
        """Test sending appointment reminder"""
        mock_sns.publish.return_value = {"MessageId": "test-message-id"}

        appointment = {
            "id": 1,
            "customer_name": "Jane Smith",
            "customer_phone": "+15559876543",
            "appointment_datetime": "2025-07-22T14:30:00",
            "service_name": "Brake Inspection",
            "service_description": "Complete brake system check",
            "location_address": "456 Oak St",
            "notes": "Please have keys ready",
        }

        response = reminder_function.send_appointment_reminder("test-topic-arn", appointment)

        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args

        assert call_args.kwargs["TopicArn"] == "test-topic-arn"
        assert call_args.kwargs["Subject"] == "Edgar Auto Shop - 24h Reminder"

        # Verify message content
        message_data = json.loads(call_args.kwargs["Message"])
        assert message_data["type"] == "reminder_24h"
        assert message_data["appointment_id"] == 1
        assert message_data["customer_name"] == "Jane Smith"
        assert message_data["customer_phone"] == "+15559876543"

    @patch("reminder_function.datetime")
    def test_track_notification(self, mock_datetime):
        """Test tracking notification in DynamoDB"""
        mock_now = datetime(2025, 7, 21, 12, 0, 0)
        mock_datetime.utcnow.return_value = mock_now

        mock_table = Mock()

        reminder_function.track_notification(mock_table, "123", "reminder_24h", "sent")

        mock_table.put_item.assert_called_once()
        call_args = mock_table.put_item.call_args[1]

        item = call_args["Item"]
        assert item["appointment_id"] == "123"
        assert item["notification_type"] == "reminder_24h"
        assert item["status"] == "sent"
        assert item["timestamp"] == mock_now.isoformat()
        assert "ttl" in item

    def test_track_notification_with_error(self):
        """Test tracking notification with error message"""
        mock_table = Mock()

        reminder_function.track_notification(
            mock_table, "456", "reminder_24h", "failed", "Test error message"
        )

        call_args = mock_table.put_item.call_args[1]
        item = call_args["Item"]

        assert item["status"] == "failed"
        assert item["error_message"] == "Test error message"

    @patch("reminder_function.dynamodb")
    @patch("reminder_function.get_db_connection")
    @patch("reminder_function.query_upcoming_appointments")
    @patch("reminder_function.is_reminder_already_sent")
    @patch("reminder_function.send_appointment_reminder")
    @patch("reminder_function.track_notification")
    def test_lambda_handler_success(
        self, mock_track, mock_send, mock_is_sent, mock_query, mock_get_conn, mock_dynamodb
    ):
        """Test successful lambda handler execution"""
        # Mock database connection
        mock_conn = Mock()
        mock_get_conn.return_value = mock_conn

        # Mock DynamoDB table
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        # Mock upcoming appointments
        mock_appointments = [
            {
                "id": 1,
                "customer_name": "Test Customer 1",
                "customer_phone": "+1234567890",
                "appointment_datetime": "2025-07-22T10:00:00",
                "service_name": "Oil Change",
                "service_description": "Standard oil change",
                "location_address": "123 Main St",
                "notes": "Some notes",
            },
            {
                "id": 2,
                "customer_name": "Test Customer 2",
                "customer_phone": "+1234567891",
                "appointment_datetime": "2025-07-22T11:00:00",
                "service_name": "Tire Rotation",
                "service_description": "Rotate tires",
                "location_address": "456 Oak Ave",
                "notes": "Other notes",
            },
        ]
        mock_query.return_value = mock_appointments

        # Mock reminder not already sent
        mock_is_sent.return_value = False

        # Mock successful reminder sending
        mock_send.return_value = {"MessageId": "test-id"}

        response = reminder_function.lambda_handler({}, {})

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["appointments_found"] == 2
        assert body["reminders_sent"] == 2

        # Verify reminders were sent and tracked
        assert mock_send.call_count == 2
        assert mock_track.call_count == 2

    @patch("reminder_function.dynamodb")
    @patch("reminder_function.get_db_connection")
    @patch("reminder_function.query_upcoming_appointments")
    @patch("reminder_function.is_reminder_already_sent")
    def test_lambda_handler_already_sent(
        self, mock_is_sent, mock_query, mock_get_conn, mock_dynamodb
    ):
        """Test lambda handler when reminders already sent"""
        # Mock database connection
        mock_conn = Mock()
        mock_get_conn.return_value = mock_conn

        # Mock DynamoDB table
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        # Mock upcoming appointments
        mock_query.return_value = [
            {
                "id": 1,
                "customer_name": "Test Customer",
                "customer_phone": "+15551234567",
                "appointment_datetime": "2025-07-22T10:00:00",
                "service_name": "Oil Change",
                "service_description": "Standard oil change",
                "location_address": "123 Main St",
                "notes": "Some notes",
            }
        ]

        # Mock reminder already sent
        mock_is_sent.return_value = True

        response = reminder_function.lambda_handler({}, {})

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["appointments_found"] == 1
        assert body["reminders_sent"] == 0

    def test_lambda_handler_missing_environment_variables(self):
        """Test lambda handler with missing environment variables"""
        # Remove required environment variable
        del os.environ["SNS_TOPIC_ARN"]

        response = reminder_function.lambda_handler({}, {})

        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert "SNS_TOPIC_ARN" in body["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
