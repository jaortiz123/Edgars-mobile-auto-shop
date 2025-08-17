import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns = boto3.client("sns")
TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]


def lambda_handler(event, _):
    """
    Receives appointment details and publishes a notification to SNS.
    event example:
    {
      "appointment_id": 42,
      "customer_name": "Jane Doe",
      "customer_phone": "+15551234567",
      "service": "Oil Change",
      "scheduled_at": "2025-07-15T10:00:00-07:00"
    }
    """
    logger.info("Payload received: %s", json.dumps(event))
    msg = json.dumps(
        {
            "appointment_id": event["appointment_id"],
            "customer_name": event.get("customer_name"),
            "customer_phone": event["customer_phone"],
            "service": event["service"],
            "scheduled_at": event["scheduled_at"],
        }
    )
    sns.publish(TopicArn=TOPIC_ARN, Message=msg)
    logger.info("Published to SNS")
    return {"status": "ok"}
