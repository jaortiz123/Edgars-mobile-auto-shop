# Lambda Flask LWA Module - Container-based Lambda with Web Adapter
# Single Lambda serving entire Flask app via Lambda Web Adapter

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.name_prefix}-lambda-role"
  }
}

# Lambda VPC execution policy
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Policy for Secrets Manager access
resource "aws_iam_role_policy" "secrets_manager_policy" {
  name = "${var.name_prefix}-secrets-manager-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_manager_arn
      }
    ]
  })
}

# CloudWatch Logs group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.name_prefix}-flask-app"
  retention_in_days = 14 # Cost optimization

  tags = {
    Name = "${var.name_prefix}-lambda-logs"
  }
}

# Lambda Function
resource "aws_lambda_function" "flask_app" {
  function_name = "${var.name_prefix}-flask-app"
  role          = aws_iam_role.lambda_role.arn

  # Container image configuration
  package_type = "Image"
  image_uri    = var.image_uri

  timeout     = var.timeout
  memory_size = var.memory_size

  # VPC configuration for RDS access
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  # Environment variables
  environment {
    variables = merge({
      FLASK_ENV            = "production"
      PYTHONPATH           = "/var/task"  # Native Lambda path
      SECRETS_MANAGER_NAME = var.secrets_manager_name
    }, var.environment_variables)
  }

  # X-Ray tracing
  tracing_config {
    mode = "Active"
  }

  # Logging configuration
  logging_config {
    log_format = "JSON"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy.secrets_manager_policy,
    aws_cloudwatch_log_group.lambda_logs,
  ]

  tags = {
    Name        = "${var.name_prefix}-flask-app"
    Environment = "production"
  }
}

# Lambda Function URL (alternative to API Gateway for cost savings)
resource "aws_lambda_function_url" "flask_app_url" {
  function_name      = aws_lambda_function.flask_app.function_name
  authorization_type = "NONE" # Can be changed to AWS_IAM for security

  cors {
    allow_credentials = false
    allow_headers     = ["date", "keep-alive"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  alarm_name          = "${var.name_prefix}-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors lambda error rate"

  dimensions = {
    FunctionName = aws_lambda_function.flask_app.function_name
  }

  tags = {
    Name = "${var.name_prefix}-lambda-error-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${var.name_prefix}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "25000" # 25 seconds
  alarm_description   = "This metric monitors lambda duration"

  dimensions = {
    FunctionName = aws_lambda_function.flask_app.function_name
  }

  tags = {
    Name = "${var.name_prefix}-lambda-duration-alarm"
  }
}
