import json
import boto3
import os
from datetime import datetime, timedelta

sns = boto3.client('sns')

def lambda_handler(event, context):
    """
    Lambda to send 24h appointment reminders via SNS
    Triggered by EventBridge scheduled rule
    """
    topic_arn = os.environ.get('SNS_TOPIC_ARN')
    if not topic_arn:
        raise Exception("SNS_TOPIC_ARN not set")
    # In production, query DB for appointments in next 24h
    # Here, send a test reminder
    reminder = {
        'type': 'reminder_24h',
        'customer_name': 'Test User',
        'customer_phone': '+1234567890',
        'appointment_time': (datetime.utcnow() + timedelta(days=1)).isoformat(),
        'service': 'Oil Change'
    }
    response = sns.publish(
        TopicArn=topic_arn,
        Message=json.dumps(reminder),
        Subject='Edgar Auto Shop - 24h Reminder'
    )
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Reminder sent', 'MessageId': response['MessageId']})
    }
