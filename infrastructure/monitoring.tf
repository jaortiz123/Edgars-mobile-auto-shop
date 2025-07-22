# CloudWatch Dashboard Configuration for Edgar's Mobile Auto Shop

resource "aws_cloudwatch_dashboard" "edgars_auto_shop" {
  dashboard_name = "EdgarsAutoShop-SMS-Reminders"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.reminder_function.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."],
            [".", "Throttles", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Reminder Function Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/SNS", "NumberOfMessagesSent", "TopicName", aws_sns_topic.appointment_reminders.name],
            [".", "NumberOfMessagesPublished", ".", "."],
            [".", "NumberOfNotificationsFailed", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "SMS Delivery Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.notification_tracking.name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ThrottledRequests", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Notification Tracking Table Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/${aws_lambda_function.reminder_function.function_name}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
          region  = var.aws_region
          title   = "Recent Errors"
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "reminder_function_errors" {
  alarm_name          = "reminder-function-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "This metric monitors reminder function errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.reminder_function.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "sms_delivery_failures" {
  alarm_name          = "sms-delivery-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfNotificationsFailed"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors SMS delivery failures"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TopicName = aws_sns_topic.appointment_reminders.name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_reminder_duration" {
  alarm_name          = "reminder-function-high-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "30000"  # 30 seconds
  alarm_description   = "This metric monitors reminder function execution time"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.reminder_function.function_name
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "edgars-auto-shop-alerts"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Custom Metrics for SMS Compliance
resource "aws_cloudwatch_log_metric_filter" "sms_consent_rate" {
  name           = "sms-consent-rate"
  log_group_name = aws_cloudwatch_log_group.booking_function.name
  pattern        = "[timestamp, request_id, \"SMS_CONSENT\", consent_status]"

  metric_transformation {
    name      = "SMSConsentRate"
    namespace = "EdgarsAutoShop/SMS"
    value     = "1"
    
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "reminder_sent" {
  name           = "reminders-sent"
  log_group_name = aws_cloudwatch_log_group.reminder_function.name
  pattern        = "[timestamp, request_id, \"Sent reminder for appointment\"]"

  metric_transformation {
    name      = "RemindersSent"
    namespace = "EdgarsAutoShop/Reminders"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "stop_messages" {
  name           = "stop-messages-received"
  log_group_name = aws_cloudwatch_log_group.sms_opt_out.name
  pattern        = "[timestamp, request_id, \"STOP message processed\"]"

  metric_transformation {
    name      = "StopMessagesReceived"
    namespace = "EdgarsAutoShop/SMS"
    value     = "1"
  }
}
