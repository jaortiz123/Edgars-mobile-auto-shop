import json
import logging
import os
from datetime import datetime

import boto3

# Initialize SNS client
sns = boto3.client("sns")

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


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

        logger.info(f"Processing notification event: {json.dumps(event)}")

        # Parse the event
        if "Records" in event:
            # Handle EventBridge/CloudWatch Events or SQS
            for record in event["Records"]:
                if "body" in record:
                    # SQS record
                    notification_data = json.loads(record["body"])
                elif "Sns" in record:
                    # SNS record
                    notification_data = json.loads(record["Sns"]["Message"])
                else:
                    # Direct record
                    notification_data = record

                send_notification(topic_arn, notification_data)
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
        logger.error(f"Error sending notification: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "timestamp": datetime.utcnow().isoformat()}),
        }


def send_notification(topic_arn, notification_data):
    """
    Send notification via SNS with enhanced SMS capabilities
    """

    # Extract notification details
    notification_type = notification_data.get("type", "appointment_confirmation")
    customer_name = notification_data.get("customer_name", "Customer")
    customer_phone = notification_data.get("customer_phone")
    appointment_time = notification_data.get("appointment_time")
    service = notification_data.get("service", "Auto Service")
    location_address = notification_data.get("location_address", "")
    appointment_id = notification_data.get("appointment_id")

    logger.info(
        f"Sending {notification_type} notification to {customer_phone} for appointment {appointment_id}"
    )

    # Format the message based on type
    if notification_type == "appointment_confirmation":
        message = format_confirmation_message(
            customer_name, appointment_time, service, location_address
        )
    elif notification_type == "reminder_24h":
        message = format_reminder_message(
            customer_name, appointment_time, service, location_address
        )
    elif notification_type == "appointment_cancelled":
        message = format_cancellation_message(customer_name, appointment_time)
    else:
        message = f"Hello {customer_name}, you have an update regarding your appointment with Edgar's Auto Shop."

    # Validate and format phone number
    if customer_phone:
        formatted_phone = validate_and_format_phone(customer_phone)
        if formatted_phone:
            try:
                # Send direct SMS to the phone number
                response = sns.publish(
                    PhoneNumber=formatted_phone,
                    Message=message,
                    MessageAttributes={
                        "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "Edgar Auto"},
                        "AWS.SNS.SMS.SMSType": {
                            "DataType": "String",
                            "StringValue": "Transactional",
                        },
                    },
                )
                logger.info(
                    f"SMS sent successfully to {formatted_phone}. MessageId: {response['MessageId']}"
                )
                return response

            except Exception as e:
                logger.error(f"Failed to send SMS to {formatted_phone}: {str(e)}")
                # Fallback to topic publishing
                return publish_to_topic(topic_arn, message, notification_data)
        else:
            logger.warning(f"Invalid phone number format: {customer_phone}")
            # Fallback to topic publishing
            return publish_to_topic(topic_arn, message, notification_data)
    else:
        logger.warning("No phone number provided, publishing to topic only")
        return publish_to_topic(topic_arn, message, notification_data)


def publish_to_topic(topic_arn, message, notification_data):
    """Fallback method to publish to SNS topic"""
    try:
        message_attributes = {}

        # Add metadata as message attributes
        if notification_data.get("customer_phone"):
            message_attributes["customer_phone"] = {
                "DataType": "String",
                "StringValue": notification_data["customer_phone"],
            }

        if notification_data.get("appointment_id"):
            message_attributes["appointment_id"] = {
                "DataType": "String",
                "StringValue": str(notification_data["appointment_id"]),
            }

        notification_type = notification_data.get("type", "notification")

        response = sns.publish(
            TopicArn=topic_arn,
            Message=message,
            MessageAttributes=message_attributes,
            Subject=f'Edgar Auto Shop - {notification_type.replace("_", " ").title()}',
        )

        logger.info(f"Message published to topic. MessageId: {response['MessageId']}")
        return response

    except Exception as e:
        logger.error(f"Failed to publish to topic: {str(e)}")
        raise


def validate_and_format_phone(raw: str) -> str:
    # Normalize and validate phone; return None for invalid
    if not raw:
        return None

    digits = "".join(ch for ch in raw if ch.isdigit())
    # E.164 with + prefix
    if raw.strip().startswith("+"):
        if len(digits) >= 10:
            return "+" + digits
        return None

    # Handle 1XXXXXXXXXX
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    # Handle 10-digit US number
    if len(digits) == 10:
        return "+1" + digits

    return None


def format_confirmation_message(customer_name, appointment_time, service, location_address=""):
    """Format appointment confirmation message"""
    formatted_time = format_appointment_time(appointment_time)
    location_text = (
        f"\n📍 Location: {location_address}"
        if location_address
        else "\n📍 Location: We'll come to you!"
    )

    return f"""Hello {customer_name}!

Your appointment with Edgar's Mobile Auto Shop has been confirmed:

🔧 Service: {service}
📅 Date & Time: {formatted_time}{location_text}

We'll send a reminder 24 hours before your appointment. If you need to reschedule, please call us.

Thank you for choosing Edgar's Auto Shop!

Reply STOP to opt out of SMS notifications."""


def format_reminder_message(customer_name, appointment_time, service, location_address=""):
    """Format 24-hour reminder message"""
    formatted_time = format_appointment_time(appointment_time)
    location_text = (
        f"\n📍 Address: {location_address}"
        if location_address
        else "\n📍 We'll come to your location"
    )

    return f"""Hi {customer_name}!

This is a friendly reminder about your appointment tomorrow:

🔧 Service: {service}
📅 Time: {formatted_time}{location_text}

Please ensure someone is available and the vehicle is accessible.

See you tomorrow!
Edgar's Mobile Auto Shop

Reply STOP to opt out."""


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
