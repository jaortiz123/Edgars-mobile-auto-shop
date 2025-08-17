#!/usr/bin/env python3
"""
Test script for the reminder system
Creates a test appointment and then tests the reminder function
"""

import json
import os
import sys

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from reminder_function import lambda_handler


def test_reminder_system():
    """Test the complete reminder system workflow"""

    print("🧪 Testing Reminder System")
    print("=" * 50)

    # Step 1: Create test appointment
    print("\n1️⃣ Creating test appointment...")
    test_event = {"test_mode": "create_appointment"}

    try:
        create_result = lambda_handler(test_event, {})
        print(f"✅ Test appointment creation result: {create_result['statusCode']}")

        if create_result["statusCode"] == 200:
            body = json.loads(create_result["body"])
            print(f"   📅 Appointment ID: {body.get('appointment_id')}")
            print(f"   👤 Customer ID: {body.get('customer_id')}")
            print(f"   🕐 Scheduled: {body.get('scheduled_time')}")
            print(f"   🔧 Service: {body.get('service')}")
        else:
            print(f"❌ Failed to create test appointment: {create_result}")
            return False

    except Exception as e:
        print(f"❌ Error creating test appointment: {str(e)}")
        return False

    # Step 2: Test reminder lookup (simulate normal run)
    print("\n2️⃣ Testing reminder lookup...")
    normal_event = {}  # Normal reminder run

    try:
        reminder_result = lambda_handler(normal_event, {})
        print(f"✅ Reminder lookup result: {reminder_result['statusCode']}")

        if reminder_result["statusCode"] == 200:
            body = json.loads(reminder_result["body"])
            print(f"   📋 Appointments found: {body.get('appointments_found', 0)}")
            print(f"   📱 Reminders sent: {body.get('reminders_sent', 0)}")

            if body.get("appointments_found", 0) > 0:
                print("✅ Test appointment found in query!")
            else:
                print(
                    "⚠️ No appointments found - this might be expected if appointment is not in 24-26 hour window"
                )
        else:
            print(f"❌ Reminder lookup failed: {reminder_result}")

    except Exception as e:
        print(f"❌ Error during reminder lookup: {str(e)}")
        return False

    print("\n🎉 Reminder system test completed!")
    return True


if __name__ == "__main__":
    # Set required environment variables for testing
    os.environ.setdefault("SNS_TOPIC_ARN", "arn:aws:sns:us-east-1:123456789012:test-topic")
    os.environ.setdefault(
        "DB_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret"
    )
    os.environ.setdefault("NOTIFICATION_TRACKING_TABLE", "test-notification-tracking")

    success = test_reminder_system()
    sys.exit(0 if success else 1)
