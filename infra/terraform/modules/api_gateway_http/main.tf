# API Gateway HTTP Module - Cost-optimized HTTP API
# HTTP API is cheaper than REST API and sufficient for most use cases

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name to integrate with"
  type        = string
}

variable "lambda_invoke_arn" {
  description = "Lambda function invoke ARN"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "cors_configuration" {
  description = "CORS configuration"
  type = object({
    allow_credentials = bool
    allow_headers     = list(string)
    allow_methods     = list(string)
    allow_origins     = list(string)
    expose_headers    = list(string)
    max_age           = number
  })
  default = {
    allow_credentials = false
    allow_headers     = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token", "x-tenant-id", "x-correlation-id"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    expose_headers    = ["x-correlation-id"]
    max_age           = 86400
  }
}

# HTTP API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.name_prefix}-api"
  description   = "Edgar's Auto Shop API Gateway"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = var.cors_configuration.allow_credentials
    allow_headers     = var.cors_configuration.allow_headers
    allow_methods     = var.cors_configuration.allow_methods
    allow_origins     = var.cors_configuration.allow_origins
    expose_headers    = var.cors_configuration.expose_headers
    max_age           = var.cors_configuration.max_age
  }

  tags = {
    Name = "${var.name_prefix}-api-gateway"
  }
}

# Lambda Integration
resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.main.id

  integration_uri    = var.lambda_invoke_arn
  integration_type   = "AWS_PROXY"
  integration_method = "POST"

  # Timeout configuration (max 30 seconds for HTTP API)
  timeout_milliseconds = 30000
}

# Default route (catch-all)
resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.main.id

  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id = aws_apigatewayv2_api.main.id

  name        = var.stage_name
  auto_deploy = true

  # Access logging
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      error          = "$context.error.message"
      responseLength = "$context.responseLength"
      responseTime   = "$context.responseTime"
      correlationId  = "$context.requestHeader.x-correlation-id"
    })
  }

  # Default route settings
  default_route_settings {
    detailed_metrics_enabled = false # Cost optimization
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 2000
  }

  tags = {
    Name = "${var.name_prefix}-api-stage"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.name_prefix}-api"
  retention_in_days = 14 # Cost optimization

  tags = {
    Name = "${var.name_prefix}-api-logs"
  }
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx_error_rate" {
  alarm_name          = "${var.name_prefix}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "20"
  alarm_description   = "This metric monitors API Gateway 4xx error rate"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
  }

  tags = {
    Name = "${var.name_prefix}-api-4xx-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_error_rate" {
  alarm_name          = "${var.name_prefix}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors API Gateway 5xx error rate"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
  }

  tags = {
    Name = "${var.name_prefix}-api-5xx-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_latency" {
  alarm_name          = "${var.name_prefix}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Average"
  threshold           = "500" # 500ms
  alarm_description   = "This metric monitors API Gateway integration latency"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
  }

  tags = {
    Name = "${var.name_prefix}-api-latency-alarm"
  }
}
