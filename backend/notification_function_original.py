import json
import os
from datetime import datetime

import boto3

# Initialize SNS client
sns = boto3.client("sns")


def lambda_handler(event, context):
    """
    Lambda function to send SMS notifications for appointments
    Can be triggered by API calls or EventBridge rules
    """

    try:
        # Get SNS topic ARN from environment
        topic_arn = os.environ.get("SNS_TOPIC_ARN")
        if not topic_arn:
            raise ValueError("SNS_TOPIC_ARN environment variable not set")

        # Parse the event
        if "Records" in event:
            # Handle EventBridge/CloudWatch Events
            for record in event["Records"]:
                body = json.loads(record["body"]) if "body" in record else record
                send_notification(topic_arn, body)
        else:
            # Handle direct invocation
            send_notification(topic_arn, event)

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Notification sent successfully",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
        }

    except Exception as e:
        print(f"Error sending notification: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Failed to send notification", "message": str(e)}),
        }


def send_notification(topic_arn, notification_data):
    """
    Send notification via SNS
    """

    # Extract notification details
    notification_type = notification_data.get("type", "appointment_confirmation")
    customer_name = notification_data.get("customer_name", "Customer")
    customer_phone = notification_data.get("customer_phone")
    appointment_time = notification_data.get("appointment_time")
    service = notification_data.get("service", "Auto Service")

    # Format the message based on type
    if notification_type == "appointment_confirmation":
        message = format_confirmation_message(customer_name, appointment_time, service)
    elif notification_type == "reminder_24h":
        message = format_reminder_message(customer_name, appointment_time, service)
    elif notification_type == "appointment_cancelled":
        message = format_cancellation_message(customer_name, appointment_time)
    else:
        message = f"Hello {customer_name}, you have an update regarding your appointment with Edgar's Auto Shop."

    # Prepare SNS message attributes for SMS
    message_attributes = {}
    if customer_phone:
        # If phone number provided, send SMS to specific number
        # For now, we'll use the topic and let subscribers receive it
        # In production, you might want to use SNS.publish() with PhoneNumber parameter
        message_attributes["customer_phone"] = {"DataType": "String", "StringValue": customer_phone}

    # Publish to SNS topic
    response = sns.publish(
        TopicArn=topic_arn,
        Message=message,
        MessageAttributes=message_attributes,
        Subject=f'Edgar Auto Shop - {notification_type.replace("_", " ").title()}',
    )

    print(f"SNS message sent. MessageId: {response['MessageId']}")
    return response


def format_confirmation_message(customer_name, appointment_time, service):
    """Format appointment confirmation message"""
    formatted_time = format_appointment_time(appointment_time)
    return f"""Hello {customer_name}!

Your appointment with Edgar's Mobile Auto Shop has been confirmed:

🔧 Service: {service}
📅 Date & Time: {formatted_time}
📍 Location: We'll come to you!

We'll send a reminder 24 hours before your appointment. If you need to reschedule, please call us.

Thank you for choosing Edgar's Auto Shop!"""


def format_reminder_message(customer_name, appointment_time, service):
    """Format 24-hour reminder message"""
    formatted_time = format_appointment_time(appointment_time)
    return f"""Hi {customer_name}!

This is a friendly reminder about your appointment tomorrow:

🔧 Service: {service}
📅 Time: {formatted_time}
📍 We'll come to your location

Please ensure someone is available and the vehicle is accessible.

See you tomorrow!
Edgar's Mobile Auto Shop"""


def format_cancellation_message(customer_name, appointment_time):
    """Format cancellation message"""
    formatted_time = format_appointment_time(appointment_time)
    return f"""Hello {customer_name},

Your appointment scheduled for {formatted_time} has been cancelled as requested.

To reschedule, please visit our website or call us directly.

Thank you,
Edgar's Mobile Auto Shop"""


def format_appointment_time(appointment_time):
    """Format appointment time for display"""
    if not appointment_time:
        return "TBD"

    try:
        # Parse ISO format datetime
        if isinstance(appointment_time, str):
            dt = datetime.fromisoformat(appointment_time.replace("Z", "+00:00"))
        else:
            dt = appointment_time

        # Format as readable string
        return dt.strftime("%A, %B %d, %Y at %I:%M %p")
    except Exception:
        return str(appointment_time)
