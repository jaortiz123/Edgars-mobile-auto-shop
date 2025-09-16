import json
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys

pytestmark = pytest.mark.integration
os.environ.setdefault("AWS_DEFAULT_REGION", "us-west-2")

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from notification_function import (
    lambda_handler,
    send_notification,
    format_confirmation_message,
    format_reminder_message,
    validate_and_format_phone,
    publish_to_topic,
)


class TestEnhancedNotificationFunction:

    def setup_method(self):
        """Setup test environment"""
        self.mock_sns_topic_arn = "arn:aws:sns:us-west-2:123456789012:test-topic"
        os.environ["SNS_TOPIC_ARN"] = self.mock_sns_topic_arn

    def teardown_method(self):
        """Clean up after test"""
        if "SNS_TOPIC_ARN" in os.environ:
            del os.environ["SNS_TOPIC_ARN"]

    def test_validate_and_format_phone_us_number(self):
        """Test phone number validation and formatting for US numbers"""
        # Test 10-digit US number
        assert validate_and_format_phone("1234567890") == "+11234567890"

        # Test formatted US number
        assert validate_and_format_phone("(123) 456-7890") == "+11234567890"

        # Test 11-digit US number with country code
        assert validate_and_format_phone("11234567890") == "+11234567890"

        # Test already formatted number
        assert validate_and_format_phone("+11234567890") == "+11234567890"

        # Test invalid numbers
        assert validate_and_format_phone("123456") is None
        assert validate_and_format_phone("invalid") is None
        assert validate_and_format_phone("") is None
        assert validate_and_format_phone(None) is None

    @patch("notification_function.sns")
    def test_send_notification_direct_sms(self, mock_sns):
        """Test sending notification as direct SMS"""
        mock_sns.publish.return_value = {"MessageId": "test-sms-id"}

        notification_data = {
            "type": "reminder_24h",
            "customer_name": "Jane Smith",
            "customer_phone": "(555) 123-4567",
            "appointment_time": "2025-07-22T14:30:00",
            "service": "Brake Inspection",
            "location_address": "123 Main St, City",
            "appointment_id": "apt-123",
        }

        response = send_notification(self.mock_sns_topic_arn, notification_data)

        # Verify direct SMS was sent
        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args[1]

        assert "PhoneNumber" in call_args
        assert call_args["PhoneNumber"] == "+15551234567"
        assert "Jane Smith" in call_args["Message"]
        assert "reminder" in call_args["Message"].lower()
        assert "123 Main St, City" in call_args["Message"]

        # Check SMS attributes
        assert "AWS.SNS.SMS.SenderID" in call_args["MessageAttributes"]
        assert call_args["MessageAttributes"]["AWS.SNS.SMS.SenderID"]["StringValue"] == "Edgar Auto"

    @patch("notification_function.sns")
    def test_send_notification_fallback_to_topic(self, mock_sns):
        """Test fallback to topic when direct SMS fails"""
        # Mock SMS failure, topic success
        mock_sns.publish.side_effect = [
            Exception("SMS failed"),  # First call (direct SMS) fails
            {"MessageId": "topic-message-id"},  # Second call (topic) succeeds
        ]

        notification_data = {
            "type": "appointment_confirmation",
            "customer_name": "John Doe",
            "customer_phone": "+1234567890",
            "appointment_time": "2025-07-22T10:00:00",
            "service": "Oil Change",
        }

        response = send_notification(self.mock_sns_topic_arn, notification_data)

        # Verify both calls were made
        assert mock_sns.publish.call_count == 2

        # First call should be direct SMS
        first_call = mock_sns.publish.call_args_list[0][1]
        assert "PhoneNumber" in first_call

        # Second call should be to topic
        second_call = mock_sns.publish.call_args_list[1][1]
        assert "TopicArn" in second_call
        assert second_call["TopicArn"] == self.mock_sns_topic_arn

    @patch("notification_function.sns")
    def test_send_notification_invalid_phone(self, mock_sns):
        """Test handling of invalid phone numbers"""
        mock_sns.publish.return_value = {"MessageId": "topic-message-id"}

        notification_data = {
            "type": "reminder_24h",
            "customer_name": "Test User",
            "customer_phone": "invalid-phone",
            "appointment_time": "2025-07-22T15:00:00",
            "service": "Tire Rotation",
        }

        response = send_notification(self.mock_sns_topic_arn, notification_data)

        # Should fallback to topic publishing
        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args[1]

        # Should be topic call, not direct SMS
        assert "TopicArn" in call_args
        assert call_args["TopicArn"] == self.mock_sns_topic_arn
        assert "PhoneNumber" not in call_args

    def test_format_reminder_message_with_location(self):
        """Test reminder message formatting with location"""
        message = format_reminder_message(
            "Alice Johnson",
            "2025-07-22T11:30:00",
            "Engine Diagnostic",
            "456 Oak Avenue, Springfield",
        )

        assert "Alice Johnson" in message
        assert "reminder" in message.lower()
        assert "tomorrow" in message.lower()
        assert "Engine Diagnostic" in message
        assert "456 Oak Avenue, Springfield" in message
        assert "Tuesday, July 22, 2025 at 11:30 AM" in message  # Fixed day

    def test_format_confirmation_message_with_location(self):
        """Test confirmation message formatting with location"""
        message = format_confirmation_message(
            "Bob Wilson", "2025-07-23T09:15:00", "Battery Replacement", "789 Pine Street, Downtown"
        )

        assert "Bob Wilson" in message
        assert "confirmed" in message.lower()
        assert "Battery Replacement" in message
        assert "789 Pine Street, Downtown" in message
        assert "Wednesday, July 23, 2025 at 09:15 AM" in message  # Fixed day

    @patch("notification_function.sns")
    def test_lambda_handler_with_records(self, mock_sns):
        """Test lambda handler with Records event structure"""
        mock_sns.publish.return_value = {"MessageId": "test-id"}

        # Test SQS-style event
        event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "type": "reminder_24h",
                            "customer_name": "Test Customer",
                            "customer_phone": "+15551234567",
                            "appointment_time": "2025-07-22T14:00:00",
                            "service": "Oil Change",
                        }
                    )
                }
            ]
        }

        response = lambda_handler(event, {})

        assert response["statusCode"] == 200
        mock_sns.publish.assert_called_once()

    @patch("notification_function.sns")
    def test_lambda_handler_with_sns_records(self, mock_sns):
        """Test lambda handler with SNS Records event structure"""
        mock_sns.publish.return_value = {"MessageId": "test-id"}

        # Test SNS-style event
        event = {
            "Records": [
                {
                    "Sns": {
                        "Message": json.dumps(
                            {
                                "type": "appointment_confirmation",
                                "customer_name": "SNS Test Customer",
                                "customer_phone": "+15559876543",
                                "appointment_time": "2025-07-22T16:00:00",
                                "service": "Brake Service",
                            }
                        )
                    }
                }
            ]
        }

        response = lambda_handler(event, {})

        assert response["statusCode"] == 200
        mock_sns.publish.assert_called_once()

    @patch("notification_function.sns")
    def test_publish_to_topic_with_metadata(self, mock_sns):
        """Test publishing to topic with message attributes"""
        mock_sns.publish.return_value = {"MessageId": "topic-id"}

        message = "Test notification message"
        notification_data = {
            "customer_phone": "+15551234567",
            "appointment_id": "apt-456",
            "type": "reminder_24h",
        }

        response = publish_to_topic(self.mock_sns_topic_arn, message, notification_data)

        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args[1]

        assert call_args["TopicArn"] == self.mock_sns_topic_arn
        assert call_args["Message"] == message
        assert call_args["Subject"] == "Edgar Auto Shop - Reminder 24H"  # Fixed capitalization

        # Check message attributes
        attrs = call_args["MessageAttributes"]
        assert attrs["customer_phone"]["StringValue"] == "+15551234567"
        assert attrs["appointment_id"]["StringValue"] == "apt-456"

    def test_error_handling_missing_sns_topic(self):
        """Test error handling when SNS_TOPIC_ARN is missing"""
        if "SNS_TOPIC_ARN" in os.environ:
            del os.environ["SNS_TOPIC_ARN"]

        event = {"type": "test"}
        response = lambda_handler(event, {})

        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert "SNS_TOPIC_ARN" in body["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
