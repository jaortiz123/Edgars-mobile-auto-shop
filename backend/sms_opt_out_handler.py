import json
import logging
import os
from datetime import datetime

import boto3
import pg8000.native

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """
    Handle SMS opt-out requests (STOP messages)
    Triggered by SNS when customers reply STOP to SMS messages
    """
    try:
        logger.info(f"SMS opt-out event received: {json.dumps(event)}")

        # Parse SNS message
        if "Records" in event:
            for record in event["Records"]:
                if "Sns" in record:
                    sns_message = json.loads(record["Sns"]["Message"])
                    handle_sms_reply(sns_message)
        else:
            # Direct invocation for testing
            handle_sms_reply(event)

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "SMS opt-out processed successfully"}),
        }

    except Exception as e:
        logger.error(f"Error processing SMS opt-out: {str(e)}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def handle_sms_reply(message_data):
    """
    Process SMS reply and handle STOP requests
    """
    # Extract relevant data from SNS message
    phone_number = message_data.get("originationNumber", "")
    message_body = message_data.get("messageBody", "").upper().strip()
    timestamp = message_data.get("timestamp", datetime.utcnow().isoformat())

    logger.info(f"Processing SMS reply from {phone_number}: '{message_body}'")

    # Check if this is a STOP request
    stop_keywords = ["STOP", "UNSUBSCRIBE", "QUIT", "END", "CANCEL", "REMOVE"]
    is_stop_request = any(keyword in message_body for keyword in stop_keywords)

    if is_stop_request:
        process_opt_out(phone_number, "STOP", timestamp)
    elif "START" in message_body or "YES" in message_body:
        process_opt_in(phone_number, timestamp)
    else:
        logger.info(f"SMS from {phone_number} is not an opt-in/opt-out request")


def process_opt_out(phone_number, method, timestamp):
    """
    Process SMS opt-out request
    """
    try:
        # Format phone number to match database format
        formatted_phone = format_phone_number(phone_number)
        if not formatted_phone:
            logger.warning(f"Could not format phone number: {phone_number}")
            return

        # Connect to database
        conn = get_db_connection()

        # Update customer opt-out status
        result = conn.run(
            """
            UPDATE customers
            SET sms_opt_out = TRUE,
                sms_opt_out_date = :timestamp,
                sms_opt_out_method = :method
            WHERE phone = :phone
            RETURNING id, name
        """,
            phone=formatted_phone,
            timestamp=timestamp,
            method=method,
        )

        if result:
            customer_id, customer_name = result[0][0], result[0][1]
            logger.info(f"Processed opt-out for customer {customer_id} ({customer_name})")

            # Send confirmation response (if allowed by carrier)
            send_opt_out_confirmation(formatted_phone, customer_name)

            # Track the opt-out in DynamoDB
            track_opt_out_event(customer_id, formatted_phone, method, timestamp)
        else:
            logger.warning(f"No customer found with phone number: {formatted_phone}")

        conn.close()

    except Exception as e:
        logger.error(f"Error processing opt-out: {str(e)}")
        raise


def process_opt_in(phone_number, timestamp):
    """
    Process SMS opt-in request (START/YES responses)
    """
    try:
        formatted_phone = format_phone_number(phone_number)
        if not formatted_phone:
            return

        conn = get_db_connection()

        result = conn.run(
            """
            UPDATE customers
            SET sms_consent = TRUE,
                sms_consent_date = :timestamp,
                sms_opt_out = FALSE,
                sms_opt_out_date = NULL,
                sms_opt_out_method = NULL
            WHERE phone = :phone
            RETURNING id, name
        """,
            phone=formatted_phone,
            timestamp=timestamp,
        )

        if result:
            customer_id, customer_name = result[0][0], result[0][1]
            logger.info(f"Processed opt-in for customer {customer_id} ({customer_name})")

            # Send welcome message
            send_opt_in_confirmation(formatted_phone, customer_name)

        conn.close()

    except Exception as e:
        logger.error(f"Error processing opt-in: {str(e)}")


def format_phone_number(phone):
    """
    Format phone number to E.164 format for database matching
    """
    import re

    if not phone:
        return None

    # Remove all non-digit characters
    digits_only = re.sub(r"\D", "", phone)

    # Handle different formats
    if len(digits_only) == 10:
        # US number without country code
        return f"+1{digits_only}"
    elif len(digits_only) == 11 and digits_only.startswith("1"):
        # US number with country code
        return f"+{digits_only}"
    elif len(digits_only) > 11:
        # International number
        return f"+{digits_only}"
    else:
        return None


def send_opt_out_confirmation(phone_number, customer_name):
    """
    Send opt-out confirmation message
    """
    try:
        sns = boto3.client("sns")

        message = f"Hello {customer_name or 'Customer'}, you have been unsubscribed from SMS notifications from Edgar's Mobile Auto Shop. You will no longer receive text messages from us. Reply START to re-subscribe."

        response = sns.publish(
            PhoneNumber=phone_number,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "Edgar Auto"},
                "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
            },
        )

        logger.info(f"Opt-out confirmation sent to {phone_number}: {response['MessageId']}")

    except Exception as e:
        logger.error(f"Failed to send opt-out confirmation: {str(e)}")


def send_opt_in_confirmation(phone_number, customer_name):
    """
    Send opt-in confirmation message
    """
    try:
        sns = boto3.client("sns")

        message = f"Welcome back {customer_name or 'Customer'}! You are now subscribed to SMS notifications from Edgar's Mobile Auto Shop. We'll send you appointment confirmations and reminders. Reply STOP to unsubscribe."

        response = sns.publish(
            PhoneNumber=phone_number,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "Edgar Auto"},
                "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
            },
        )

        logger.info(f"Opt-in confirmation sent to {phone_number}: {response['MessageId']}")

    except Exception as e:
        logger.error(f"Failed to send opt-in confirmation: {str(e)}")


def track_opt_out_event(customer_id, phone_number, method, timestamp):
    """
    Track opt-out event in DynamoDB for audit purposes
    """
    try:
        dynamodb = boto3.resource("dynamodb")
        table_name = os.environ.get("NOTIFICATION_TRACKING_TABLE")

        if not table_name:
            logger.warning("No NOTIFICATION_TRACKING_TABLE configured")
            return

        table = dynamodb.Table(table_name)

        item = {
            "appointment_id": f"customer_{customer_id}",
            "notification_type": "sms_opt_out",
            "status": "processed",
            "timestamp": timestamp,
            "phone_number": phone_number,
            "method": method,
            "ttl": int((datetime.utcnow().timestamp()) + (365 * 24 * 60 * 60)),  # Keep for 1 year
        }

        table.put_item(Item=item)
        logger.info(f"Tracked opt-out event for customer {customer_id}")

    except Exception as e:
        logger.error(f"Failed to track opt-out event: {str(e)}")


def get_db_connection():
    """Get database connection using secrets manager"""
    try:
        secrets_client = boto3.client("secretsmanager")
        secret_arn = os.environ.get("DB_SECRET_ARN")

        if not secret_arn:
            raise ValueError("DB_SECRET_ARN environment variable not set")

        secret_value = secrets_client.get_secret_value(SecretId=secret_arn)
        secret = json.loads(secret_value["SecretString"])

        conn = pg8000.native.Connection(
            user=secret["username"],
            password=secret["password"],
            host=secret["host"],
            port=secret["port"],
            database=secret["dbname"],
            ssl_context=True,
        )

        logger.info("Database connection established for SMS opt-out handler")
        return conn

    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise
