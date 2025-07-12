import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from notification_function import lambda_handler, send_notification, format_confirmation_message, format_reminder_message

class TestNotificationFunction:
    
    def setup_method(self):
        """Setup test environment"""
        self.mock_sns_topic_arn = "arn:aws:sns:us-west-2:123456789012:test-topic"
        os.environ['SNS_TOPIC_ARN'] = self.mock_sns_topic_arn
    
    def teardown_method(self):
        """Clean up after test"""
        if 'SNS_TOPIC_ARN' in os.environ:
            del os.environ['SNS_TOPIC_ARN']
    
    @patch('notification_function.sns')
    def test_lambda_handler_direct_invocation(self, mock_sns):
        """Test direct invocation of lambda handler"""
        # Mock SNS publish response
        mock_sns.publish.return_value = {'MessageId': 'test-message-id'}
        
        # Test event data
        event = {
            'type': 'appointment_confirmation',
            'customer_name': 'John Doe',
            'customer_phone': '+1234567890',
            'appointment_time': '2025-07-12T10:00:00',
            'service': 'Oil Change'
        }
        
        # Call lambda handler
        response = lambda_handler(event, {})
        
        # Assertions
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['message'] == 'Notification sent successfully'
        assert 'timestamp' in body
        
        # Verify SNS was called
        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args
        assert call_args[1]['TopicArn'] == self.mock_sns_topic_arn
        assert 'John Doe' in call_args[1]['Message']
        assert 'Oil Change' in call_args[1]['Message']
    
    @patch('notification_function.sns')
    def test_lambda_handler_eventbridge_records(self, mock_sns):
        """Test EventBridge/SQS record handling"""
        mock_sns.publish.return_value = {'MessageId': 'test-message-id'}
        
        # Test event with Records
        event = {
            'Records': [
                {
                    'body': json.dumps({
                        'type': 'reminder_24h',
                        'customer_name': 'Jane Smith',
                        'appointment_time': '2025-07-13T14:30:00',
                        'service': 'Brake Inspection'
                    })
                }
            ]
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 200
        mock_sns.publish.assert_called_once()
        call_args = mock_sns.publish.call_args
        assert 'Jane Smith' in call_args[1]['Message']
        assert 'reminder' in call_args[1]['Message'].lower()
    
    def test_lambda_handler_missing_sns_topic(self):
        """Test error handling when SNS topic ARN is missing"""
        # Remove SNS_TOPIC_ARN environment variable
        del os.environ['SNS_TOPIC_ARN']
        
        event = {'type': 'test'}
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'error' in body
        assert 'SNS_TOPIC_ARN' in body['message']
    
    @patch('notification_function.sns')
    def test_send_notification_confirmation(self, mock_sns):
        """Test sending confirmation notification"""
        mock_sns.publish.return_value = {'MessageId': 'test-id'}
        
        notification_data = {
            'type': 'appointment_confirmation',
            'customer_name': 'Bob Wilson',
            'customer_phone': '+1987654321',
            'appointment_time': '2025-07-14T09:00:00',
            'service': 'Tire Rotation'
        }
        
        response = send_notification(self.mock_sns_topic_arn, notification_data)
        
        assert response['MessageId'] == 'test-id'
        mock_sns.publish.assert_called_once()
        
        call_args = mock_sns.publish.call_args[1]
        assert call_args['TopicArn'] == self.mock_sns_topic_arn
        assert 'Bob Wilson' in call_args['Message']
        assert 'confirmed' in call_args['Message']
        assert 'Tire Rotation' in call_args['Message']
        assert call_args['MessageAttributes']['customer_phone']['StringValue'] == '+1987654321'
    
    @patch('notification_function.sns')
    def test_send_notification_reminder(self, mock_sns):
        """Test sending reminder notification"""
        mock_sns.publish.return_value = {'MessageId': 'reminder-id'}
        
        notification_data = {
            'type': 'reminder_24h',
            'customer_name': 'Alice Johnson',
            'appointment_time': '2025-07-15T11:30:00',
            'service': 'Engine Diagnostic'
        }
        
        send_notification(self.mock_sns_topic_arn, notification_data)
        
        call_args = mock_sns.publish.call_args[1]
        assert 'reminder' in call_args['Message'].lower()
        assert 'tomorrow' in call_args['Message'].lower()
        assert 'Alice Johnson' in call_args['Message']
    
    def test_format_confirmation_message(self):
        """Test confirmation message formatting"""
        message = format_confirmation_message(
            'Test Customer',
            '2025-07-12T15:30:00',
            'Oil Change'
        )
        
        assert 'Test Customer' in message
        assert 'Oil Change' in message
        assert 'confirmed' in message.lower()
        assert 'Edgar' in message
    
    def test_format_reminder_message(self):
        """Test reminder message formatting"""
        message = format_reminder_message(
            'Test Customer',
            '2025-07-13T10:00:00',
            'Brake Check'
        )
        
        assert 'Test Customer' in message
        assert 'Brake Check' in message
        assert 'reminder' in message.lower()
        assert 'tomorrow' in message.lower()
    
    @patch('notification_function.sns')
    def test_sns_error_handling(self, mock_sns):
        """Test SNS error handling"""
        # Mock SNS to raise an exception
        mock_sns.publish.side_effect = Exception("SNS service error")
        
        event = {
            'type': 'appointment_confirmation',
            'customer_name': 'Test User'
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'error' in body
        assert 'Failed to send notification' in body['error']

if __name__ == '__main__':
    pytest.main([__file__])
