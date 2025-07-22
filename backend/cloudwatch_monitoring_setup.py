"""
CloudWatch Dashboard for Edgar's SMS Notification System
Creates monitoring dashboard with metrics, alarms, and logs
"""

import boto3
import json
from datetime import datetime, timedelta

def create_monitoring_dashboard():
    """Create comprehensive CloudWatch dashboard for SMS notification monitoring"""
    
    cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
    
    # Dashboard configuration
    dashboard_name = 'Edgar-SMS-Notification-Monitoring'
    
    dashboard_body = {
        "widgets": [
            {
                "type": "metric",
                "x": 0,
                "y": 0,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Invocations", "FunctionName", "reminder-function"],
                        [".", "Errors", ".", "."],
                        [".", "Duration", ".", "."],
                        [".", "Throttles", ".", "."]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "Lambda Function Metrics",
                    "period": 300,
                    "stat": "Sum",
                    "yAxis": {
                        "left": {
                            "min": 0
                        }
                    }
                }
            },
            {
                "type": "metric",
                "x": 12,
                "y": 0,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/SNS", "NumberOfMessagesSent", "TopicName", "edgar-sms-notifications"],
                        [".", "NumberOfNotificationsFailed", ".", "."],
                        [".", "NumberOfNotificationsDelivered", ".", "."]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "SMS Delivery Metrics",
                    "period": 300,
                    "stat": "Sum"
                }
            },
            {
                "type": "log",
                "x": 0,
                "y": 6,
                "width": 24,
                "height": 6,
                "properties": {
                    "query": "SOURCE '/aws/lambda/reminder-function'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 50",
                    "region": "us-east-1",
                    "title": "Recent Errors",
                    "view": "table"
                }
            },
            {
                "type": "metric",
                "x": 0,
                "y": 12,
                "width": 8,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "sms-notification-tracking"],
                        [".", "ConsumedWriteCapacityUnits", ".", "."]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "DynamoDB Capacity",
                    "period": 300,
                    "stat": "Sum"
                }
            },
            {
                "type": "metric",
                "x": 8,
                "y": 12,
                "width": 8,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/DynamoDB", "UserErrors", "TableName", "sms-notification-tracking"],
                        [".", "SystemErrors", ".", "."],
                        [".", "ThrottledRequests", ".", "."]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "DynamoDB Errors",
                    "period": 300,
                    "stat": "Sum"
                }
            },
            {
                "type": "metric",
                "x": 16,
                "y": 12,
                "width": 8,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["CustomMetric", "SMSConsent", "Status", "OptedIn"],
                        [".", ".", ".", "OptedOut"],
                        [".", "NotificationsSent", "Type", "24HourReminder"],
                        [".", ".", ".", "1HourReminder"]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "Custom Business Metrics",
                    "period": 300,
                    "stat": "Sum"
                }
            },
            {
                "type": "log",
                "x": 0,
                "y": 18,
                "width": 12,
                "height": 6,
                "properties": {
                    "query": "SOURCE '/aws/lambda/reminder-function'\n| fields @timestamp, @message\n| filter @message like /Successfully sent/\n| stats count() by bin(5m)\n| sort @timestamp desc",
                    "region": "us-east-1",
                    "title": "Successful SMS Sends (5-min intervals)",
                    "view": "table"
                }
            },
            {
                "type": "log",
                "x": 12,
                "y": 18,
                "width": 12,
                "height": 6,
                "properties": {
                    "query": "SOURCE '/aws/lambda/reminder-function'\n| fields @timestamp, @message\n| filter @message like /Failed to send SMS/\n| sort @timestamp desc\n| limit 20",
                    "region": "us-east-1",
                    "title": "Recent SMS Failures",
                    "view": "table"
                }
            }
        ]
    }
    
    try:
        # Create or update dashboard
        response = cloudwatch.put_dashboard(
            DashboardName=dashboard_name,
            DashboardBody=json.dumps(dashboard_body)
        )
        
        print(f"✅ Dashboard created successfully: {dashboard_name}")
        print(f"Dashboard URL: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name={dashboard_name}")
        
        return response
        
    except Exception as e:
        print(f"❌ Error creating dashboard: {str(e)}")
        return None

def create_cloudwatch_alarms():
    """Create CloudWatch alarms for monitoring SMS notification failures"""
    
    cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
    sns = boto3.client('sns', region_name='us-east-1')
    
    # Create SNS topic for alerts if it doesn't exist
    alert_topic_name = 'edgar-sms-alerts'
    try:
        topic_response = sns.create_topic(Name=alert_topic_name)
        alert_topic_arn = topic_response['TopicArn']
        print(f"✅ Alert topic ready: {alert_topic_arn}")
    except Exception as e:
        print(f"❌ Error creating alert topic: {str(e)}")
        return None
    
    alarms = [
        {
            'AlarmName': 'Edgar-SMS-High-Lambda-Errors',
            'AlarmDescription': 'Alert when Lambda function error rate is high',
            'ActionsEnabled': True,
            'AlarmActions': [alert_topic_arn],
            'MetricName': 'Errors',
            'Namespace': 'AWS/Lambda',
            'Statistic': 'Sum',
            'Dimensions': [
                {
                    'Name': 'FunctionName',
                    'Value': 'reminder-function'
                }
            ],
            'Period': 300,  # 5 minutes
            'EvaluationPeriods': 2,
            'Threshold': 3.0,
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData': 'notBreaching'
        },
        {
            'AlarmName': 'Edgar-SMS-Failed-Deliveries',
            'AlarmDescription': 'Alert when SMS delivery failure rate is high',
            'ActionsEnabled': True,
            'AlarmActions': [alert_topic_arn],
            'MetricName': 'NumberOfNotificationsFailed',
            'Namespace': 'AWS/SNS',
            'Statistic': 'Sum',
            'Dimensions': [
                {
                    'Name': 'TopicName',
                    'Value': 'edgar-sms-notifications'
                }
            ],
            'Period': 300,
            'EvaluationPeriods': 1,
            'Threshold': 5.0,
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData': 'notBreaching'
        },
        {
            'AlarmName': 'Edgar-SMS-Lambda-Duration',
            'AlarmDescription': 'Alert when Lambda execution time is too long',
            'ActionsEnabled': True,
            'AlarmActions': [alert_topic_arn],
            'MetricName': 'Duration',
            'Namespace': 'AWS/Lambda',
            'Statistic': 'Average',
            'Dimensions': [
                {
                    'Name': 'FunctionName',
                    'Value': 'reminder-function'
                }
            ],
            'Period': 300,
            'EvaluationPeriods': 2,
            'Threshold': 30000.0,  # 30 seconds
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData': 'notBreaching'
        },
        {
            'AlarmName': 'Edgar-SMS-DynamoDB-Errors',
            'AlarmDescription': 'Alert when DynamoDB errors occur',
            'ActionsEnabled': True,
            'AlarmActions': [alert_topic_arn],
            'MetricName': 'UserErrors',
            'Namespace': 'AWS/DynamoDB',
            'Statistic': 'Sum',
            'Dimensions': [
                {
                    'Name': 'TableName',
                    'Value': 'sms-notification-tracking'
                }
            ],
            'Period': 300,
            'EvaluationPeriods': 1,
            'Threshold': 1.0,
            'ComparisonOperator': 'GreaterThanOrEqualToThreshold',
            'TreatMissingData': 'notBreaching'
        }
    ]
    
    created_alarms = []
    for alarm_config in alarms:
        try:
            cloudwatch.put_metric_alarm(**alarm_config)
            created_alarms.append(alarm_config['AlarmName'])
            print(f"✅ Created alarm: {alarm_config['AlarmName']}")
        except Exception as e:
            print(f"❌ Error creating alarm {alarm_config['AlarmName']}: {str(e)}")
    
    return created_alarms

def create_custom_metrics_helper():
    """Helper function to publish custom business metrics"""
    
    cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
    
    def publish_sms_consent_metrics(opted_in_count: int, opted_out_count: int):
        """Publish SMS consent metrics"""
        try:
            cloudwatch.put_metric_data(
                Namespace='CustomMetric',
                MetricData=[
                    {
                        'MetricName': 'SMSConsent',
                        'Dimensions': [
                            {
                                'Name': 'Status',
                                'Value': 'OptedIn'
                            }
                        ],
                        'Value': opted_in_count,
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    },
                    {
                        'MetricName': 'SMSConsent',
                        'Dimensions': [
                            {
                                'Name': 'Status',
                                'Value': 'OptedOut'
                            }
                        ],
                        'Value': opted_out_count,
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    }
                ]
            )
        except Exception as e:
            print(f"Error publishing SMS consent metrics: {str(e)}")
    
    def publish_notification_metrics(reminder_type: str, count: int):
        """Publish notification sending metrics"""
        try:
            cloudwatch.put_metric_data(
                Namespace='CustomMetric',
                MetricData=[
                    {
                        'MetricName': 'NotificationsSent',
                        'Dimensions': [
                            {
                                'Name': 'Type',
                                'Value': reminder_type
                            }
                        ],
                        'Value': count,
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    }
                ]
            )
        except Exception as e:
            print(f"Error publishing notification metrics: {str(e)}")
    
    return {
        'publish_sms_consent_metrics': publish_sms_consent_metrics,
        'publish_notification_metrics': publish_notification_metrics
    }

if __name__ == '__main__':
    print("🔧 Setting up CloudWatch monitoring for Edgar's SMS system...")
    
    # Create dashboard
    print("\n1. Creating CloudWatch Dashboard...")
    dashboard_result = create_monitoring_dashboard()
    
    # Create alarms
    print("\n2. Creating CloudWatch Alarms...")
    alarms_result = create_cloudwatch_alarms()
    
    # Provide usage instructions
    print("\n3. Custom Metrics Helper Created")
    print("   Use the helper functions in your Lambda code to publish custom metrics")
    
    print(f"\n✅ Setup complete!")
    print(f"📊 Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:")
    print(f"🚨 Alarms created: {len(alarms_result) if alarms_result else 0}")
    print(f"💡 Don't forget to subscribe to the alert SNS topic for notifications!")
