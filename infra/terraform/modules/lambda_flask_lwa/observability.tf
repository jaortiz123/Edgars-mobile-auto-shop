# Cost Management and Observability Configuration
# Additional Terraform resources for monitoring and cost control

# CloudWatch Dashboard for cost and performance monitoring
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-dashboard"

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
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.flask_app.function_name],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."],
            [".", "ConcurrentExecutions", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-west-2"
          title   = "Lambda Performance Metrics"
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
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", var.cluster_identifier],
            [".", "ACUUtilization", ".", "."],
            [".", "ServerlessDatabaseCapacity", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-west-2"
          title   = "Aurora Serverless Metrics"
          period  = 300
        }
      }
    ]
  })
}

# Budget alert for cost control
resource "aws_budgets_budget" "cost_budget" {
  name         = "${var.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["AWS Lambda", "Amazon Relational Database Service"]
  }



  tags = {
    Name = "${var.name_prefix}-budget"
  }
}

# Lambda insights for enhanced monitoring (commented out for initial deployment)
# resource "aws_lambda_layer_version" "lambda_insights" {
#   filename            = "lambda-insights-extension.zip"
#   layer_name          = "${var.name_prefix}-lambda-insights"
#   compatible_runtimes = ["python3.11"]
#
#   # Note: In production, download the Lambda Insights extension
#   # from AWS and include it in the deployment
#   lifecycle {
#     ignore_changes = [filename]
#   }
# }

# Custom metric filters for business metrics
resource "aws_cloudwatch_log_metric_filter" "api_latency" {
  name           = "${var.name_prefix}-api-latency"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, level=\"INFO\", logger, message=\"API Request\", correlation_id, method, path, status_code, response_time]"

  metric_transformation {
    name      = "APILatency"
    namespace = "Edgar/AutoShop"
    value     = "$response_time"
  }
}

resource "aws_cloudwatch_log_metric_filter" "error_rate" {
  name           = "${var.name_prefix}-error-rate"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ErrorRate"
    namespace = "Edgar/AutoShop"
    value     = "1"
  }
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"

  tags = {
    Name = "${var.name_prefix}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Enhanced CloudWatch alarms
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.name_prefix}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "Edgar/AutoShop"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High error rate detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.name_prefix}-high-error-rate"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.name_prefix}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "APILatency"
  namespace           = "Edgar/AutoShop"
  period              = "300"
  statistic           = "Average"
  threshold           = "500" # 500ms
  alarm_description   = "High API latency detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.name_prefix}-high-latency"
  }
}
