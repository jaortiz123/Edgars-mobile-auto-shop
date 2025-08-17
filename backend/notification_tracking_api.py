"""
Notification Tracking API
Provides endpoints for querying SMS notification status from DynamoDB
"""

import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict

import boto3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB setup
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
TABLE_NAME = "sms-notification-tracking"


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for DynamoDB Decimal types."""

    def default(self, obj):  # type: ignore[override]
        """Convert Decimals to float for JSON serialization."""
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_notifications(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Get SMS notification tracking records
    Query params:
    - appointment_id: filter by specific appointment
    - status: filter by status (sent, failed, pending)
    - hours: limit to last N hours (default 24)
    """
    try:
        # Parse query parameters
        query_params = event.get("queryStringParameters") or {}
        appointment_id = query_params.get("appointment_id")
        status_filter = query_params.get("status")
        hours = int(query_params.get("hours", 24))

        # Calculate time filter
        since_time = datetime.utcnow() - timedelta(hours=hours)
        since_timestamp = since_time.isoformat()

        table = dynamodb.Table(TABLE_NAME)

        # Build query
        if appointment_id:
            # Query specific appointment
            response = table.query(
                KeyConditionExpression="appointment_id = :aid",
                ExpressionAttributeValues={":aid": appointment_id},
            )
        else:
            # Scan all recent records
            filter_expression = "#ts >= :since"
            expression_values = {":since": since_timestamp}
            expression_names = {"#ts": "timestamp"}

            if status_filter and status_filter != "all":
                filter_expression += " AND #st = :status"
                expression_values[":status"] = status_filter
                expression_names["#st"] = "status"

            response = table.scan(
                FilterExpression=filter_expression,
                ExpressionAttributeValues=expression_values,
                ExpressionAttributeNames=expression_names,
            )

        notifications = response.get("Items", [])

        # Sort by timestamp descending
        notifications.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        # Enhance with customer data if possible
        enhanced_notifications = []
        for notification in notifications:
            enhanced = dict(notification)
            # You could add customer lookup here if needed
            enhanced_notifications.append(enhanced)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            },
            "body": json.dumps(
                {
                    "notifications": enhanced_notifications,
                    "count": len(enhanced_notifications),
                    "filtered_by": {
                        "appointment_id": appointment_id,
                        "status": status_filter,
                        "hours": hours,
                    },
                },
                cls=DecimalEncoder,
            ),
        }

    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to fetch notifications", "message": str(e)}),
        }


def retry_notification(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Retry a failed notification by triggering the reminder function
    """
    try:
        # Parse path parameters
        path_params = event.get("pathParameters") or {}
        appointment_id = path_params.get("appointment_id")

        if not appointment_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing appointment_id"}),
            }

        # Trigger the reminder function
        lambda_client = boto3.client("lambda", region_name="us-east-1")

        payload = {"test_mode": True, "specific_appointment": appointment_id, "retry_failed": True}

        lambda_client.invoke(
            FunctionName="reminder-function",
            InvocationType="Event",  # Async,
            Payload=json.dumps(payload),
        )

        logger.info(f"Triggered retry for appointment {appointment_id}")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {
                    "message": f"Retry triggered for appointment {appointment_id}",
                    "appointment_id": appointment_id,
                }
            ),
        }

    except Exception as e:
        logger.error(f"Error retrying notification: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to retry notification", "message": str(e)}),
        }


def get_notification_stats(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Get aggregated notification statistics
    """
    try:
        # Parse query parameters
        query_params = event.get("queryStringParameters") or {}
        hours = int(query_params.get("hours", 24))

        # Calculate time filter
        since_time = datetime.utcnow() - timedelta(hours=hours)
        since_timestamp = since_time.isoformat()

        table = dynamodb.Table(TABLE_NAME)

        # Scan recent records
        response = table.scan(
            FilterExpression="#ts >= :since",
            ExpressionAttributeValues={":since": since_timestamp},
            ExpressionAttributeNames={"#ts": "timestamp"},
        )

        notifications = response.get("Items", [])

        # Calculate statistics
        stats = {
            "total": len(notifications),
            "sent": 0,
            "failed": 0,
            "pending": 0,
            "success_rate": 0,
            "by_type": {},
            "recent_failures": [],
        }

        for notification in notifications:
            status = notification.get("status", "unknown")
            notification_type = notification.get("notification_type", "unknown")

            # Count by status
            if status in stats:
                stats[status] += 1

            # Count by type
            if notification_type not in stats["by_type"]:
                stats["by_type"][notification_type] = {"total": 0, "sent": 0, "failed": 0}

            stats["by_type"][notification_type]["total"] += 1
            if status in ["sent", "failed"]:
                stats["by_type"][notification_type][status] += 1

            # Collect recent failures
            if status == "failed":
                stats["recent_failures"].append(
                    {
                        "appointment_id": notification.get("appointment_id"),
                        "notification_type": notification_type,
                        "timestamp": notification.get("timestamp"),
                        "error_message": notification.get("error_message", "Unknown error")[:100],
                    }
                )

        # Calculate success rate
        total_completed = stats["sent"] + stats["failed"]
        if total_completed > 0:
            stats["success_rate"] = round((stats["sent"] / total_completed) * 100, 2)

        # Sort recent failures by timestamp
        stats["recent_failures"].sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        stats["recent_failures"] = stats["recent_failures"][:10]  # Limit to 10 most recent

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {
                    "stats": stats,
                    "period_hours": hours,
                    "generated_at": datetime.utcnow().isoformat(),
                },
                cls=DecimalEncoder,
            ),
        }

    except Exception as e:
        logger.error(f"Error getting notification stats: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to get notification stats", "message": str(e)}),
        }


# CORS preflight handler
def options_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle CORS preflight requests"""
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Max-Age": "86400",
        },
        "body": "",
    }
