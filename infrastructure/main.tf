# /infrastructure/main.tf

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# Data source for current AWS region
data "aws_region" "current" {}

# --- NETWORK FOUNDATION (VPC) ---
resource "aws_vpc" "edgar_vpc" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "edgar-vpc"
  }
}

# We need at least two private subnets in different Availability Zones for RDS
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.edgar_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-west-2a" # Change to your region's AZs
  tags = {
    Name = "edgar-private-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.edgar_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-west-2b" # Change to your region's AZs
  tags = {
    Name = "edgar-private-b"
  }
}

# --- SECURITY GROUPS ---
# Security group for our Lambda functions placed inside the VPC
resource "aws_security_group" "lambda_sg" {
  name        = "edgar-lambda-sg"
  description = "Allow outbound traffic for Lambda functions"
  vpc_id      = aws_vpc.edgar_vpc.id

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # Allow all outbound traffic
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "edgar-lambda-sg"
  }
}

# Security group for the RDS Database
resource "aws_security_group" "db_sg" {
  name        = "edgar-db-sg"
  description = "Allow inbound traffic from Lambda"
  vpc_id      = aws_vpc.edgar_vpc.id

  # Allow inbound PostgreSQL traffic ONLY from the Lambda's security group
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda_sg.id]
  }

  tags = {
    Name = "edgar-db-sg"
  }
}

# --- DATABASE SECRET (from Day 11) ---
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "edgar/rds/master-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials_version" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.edgar_db.username,
    password = aws_db_instance.edgar_db.password,
    engine   = aws_db_instance.edgar_db.engine,
    host     = aws_db_instance.edgar_db.address,
    port     = aws_db_instance.edgar_db.port,
    dbname   = aws_db_instance.edgar_db.db_name
  })
}

# --- RDS DATABASE INSTANCE ---
resource "aws_db_subnet_group" "edgar_db_subnets" {
  name       = "edgar-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  tags = {
    Name = "Edgar DB Subnet Group"
  }
}

resource "aws_db_instance" "edgar_db" {
  identifier            = "edgar-auto-shop-db"
  allocated_storage     = 20
  engine                = "postgres"
  engine_version        = "15"
  instance_class        = "db.t3.micro"
  db_name               = "edgarautoshop"
  username              = "edgaradmin" # Define the username directly here.
  password              = "a-very-secure-password-that-you-will-change" # Define the password directly here.
  db_subnet_group_name  = aws_db_subnet_group.edgar_db_subnets.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot   = true
}

# Creates the DynamoDB table for storing quote requests and history.
# We use a simple primary key (RequestID) for now.
# PAY_PER_REQUEST billing mode is chosen for cost-efficiency at low traffic.
resource "aws_dynamodb_table" "QuotesTable" {
  name           = "EdgarQuotes"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "RequestID"

  attribute {
    name = "RequestID"
    type = "S"
  }

  tags = {
    Project     = "AutoRepairHub"
    Environment = "Dev"
  }
}

# --- SNS TOPIC FOR NOTIFICATIONS ---
resource "aws_sns_topic" "appointment_notifications" {
  name = "edgar-appointment-notifications"
  
  tags = {
    Project     = "AutoRepairHub"
    Environment = "Dev"
  }
}

resource "aws_sns_topic_policy" "appointment_notifications_policy" {
  arn = aws_sns_topic.appointment_notifications.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "SNS:GetTopicAttributes",
          "SNS:SetTopicAttributes",
          "SNS:AddPermission",
          "SNS:RemovePermission",
          "SNS:DeleteTopic",
          "SNS:Subscribe",
          "SNS:ListSubscriptionsByTopic",
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.appointment_notifications.arn
        Condition = {
          StringEquals = {
            "AWS:SourceOwner" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# IAM policy for Lambda to publish to SNS
resource "aws_iam_policy" "lambda_sns_policy" {
  name        = "LambdaSNSPolicy"
  description = "Allows Lambda functions to publish to SNS topics"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:GetTopicAttributes"
        ]
        Resource = aws_sns_topic.appointment_notifications.arn
      }
    ]
  })
}

# IAM Role for the Quote Function Lambda
resource "aws_iam_role" "LambdaExecRole" {
  name = "AutoRepairLambdaRole"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    Project = "AutoRepairHub"
  }
}

# Attach AWS-managed policy for basic Lambda execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "LambdaBasicLogs" {
  role       = aws_iam_role.LambdaExecRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Inline policy to grant Lambda permission to write to DynamoDB
resource "aws_iam_role_policy" "LambdaDynamoPolicy" {
  name   = "LambdaDynamoPolicy"
  role   = aws_iam_role.LambdaExecRole.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["dynamodb:PutItem","dynamodb:GetItem"],
      Resource = aws_dynamodb_table.QuotesTable.arn
    }]
  })
}

# Lambda Function Resource
resource "aws_lambda_function" "QuoteFunction" {
  function_name = "EdgarAutoQuoteFunction"
  role          = aws_iam_role.LambdaExecRole.arn
  handler       = "quote_function.lambda_handler"
  runtime       = "python3.9"

  filename         = "${path.module}/lambda_packages/quote_function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_packages/quote_function.zip")

  environment {
    variables = {
      QUOTES_TABLE = aws_dynamodb_table.QuotesTable.name
    }
  }

  tags = {
    Project = "AutoRepairHub"
  }
}

# Creates the HTTP API Gateway
resource "aws_apigatewayv2_api" "QuoteAPI" {
  name          = "AutoQuote API"
  protocol_type = "HTTP"

  # --- FORGED: CORS Configuration for Frontend Access ---
  cors_configuration {
    allow_origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"] # Frontend development server origins
    allow_methods = ["POST", "GET", "OPTIONS"] # OPTIONS is crucial for preflight requests
    allow_headers = ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"] # Standard headers
    max_age       = 300 # How long preflight request results can be cached (in seconds)
  }
}

# Creates the integration between API Gateway and the Lambda function.
resource "aws_apigatewayv2_integration" "QuoteAPIIntegration" {
  api_id                 = aws_apigatewayv2_api.QuoteAPI.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.QuoteFunction.invoke_arn
  payload_format_version = "2.0"
}

# Defines the route for POST /quote
resource "aws_apigatewayv2_route" "QuoteAPIRoute" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "POST /quote"
  target    = "integrations/${aws_apigatewayv2_integration.QuoteAPIIntegration.id}"
}

# Creates the default stage with auto-deploy
resource "aws_apigatewayv2_stage" "QuoteAPIStage" {
  api_id      = aws_apigatewayv2_api.QuoteAPI.id
  name        = "$default"
  auto_deploy = true
}

# Allow API Gateway to invoke the Lambda function
resource "aws_lambda_permission" "AllowAPIGatewayInvoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.QuoteFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.QuoteAPI.execution_arn}/*/*"
}

# --- IAM FOR BOOKING LAMBDA ---
resource "aws_iam_role" "BookingLambdaRole" {
  name = "BookingLambdaRole"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "BookingVPCAccess" {
  role       = aws_iam_role.BookingLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "BookingBasicLogs" {
  role       = aws_iam_role.BookingLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "BookingSecretsPolicy" {
  name        = "BookingSecretsPolicy"
  description = "Allows Lambda to fetch RDS credentials from Secrets Manager"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "secretsmanager:GetSecretValue",
        Resource = aws_secretsmanager_secret.db_credentials.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "BookingSecretsAttachment" {
  role       = aws_iam_role.BookingLambdaRole.name
  policy_arn = aws_iam_policy.BookingSecretsPolicy.arn
}

resource "aws_iam_role_policy_attachment" "BookingSNSAttachment" {
  role       = aws_iam_role.BookingLambdaRole.name
  policy_arn = aws_iam_policy.lambda_sns_policy.arn
}

# --- ECR REPOSITORY FOR OUR LAMBDA IMAGE ---
resource "aws_ecr_repository" "booking_function_repo" {
  name                 = "edgar-auto-booking-function"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = "AutoRepairHub"
  }
}

# --- BOOKING LAMBDA FUNCTION (CONTAINER DEPLOYMENT) ---
resource "aws_lambda_function" "BookingFunction" {
  function_name = "EdgarAutoBookingFunction"
  role          = aws_iam_role.BookingLambdaRole.arn
  package_type  = "Image"
  timeout       = 30
  memory_size   = 512

  image_uri     = "588738589514.dkr.ecr.us-west-2.amazonaws.com/edgar-auto-booking-function:${var.lambda_image_tag}"

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      FORCE_REDEPLOY = timestamp() # Force redeploy on every apply
      NOTIFY_TOPIC_ARN = aws_sns_topic.appointment_notifications.arn
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  depends_on = [
    aws_db_instance.edgar_db,
    aws_ecr_repository.booking_function_repo
  ]
}

# --- API Gateway Route for Booking ---
resource "aws_apigatewayv2_integration" "BookingAPIIntegration" {
  api_id                 = aws_apigatewayv2_api.QuoteAPI.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.BookingFunction.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "BookingAPIRoute_POST" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "POST /appointments"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
}

resource "aws_apigatewayv2_route" "BookingAPIRoute_GET" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "GET /appointments"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
}

resource "aws_apigatewayv2_route" "BookingAPIRoute_GET_AVAILABILITY" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "GET /availability"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
}

resource "aws_apigatewayv2_route" "BookingAPIRoute_GET_ADMIN_TODAY" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "GET /admin/appointments/today"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
}

resource "aws_apigatewayv2_route" "BookingAPIRoute_PUT_ADMIN_APPT" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "PUT /admin/appointments/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
}

# NOTE: init-db route removed for production security
# Use a one-time migration script or manual DB setup instead

resource "aws_lambda_permission" "AllowAPIGatewayInvokeBooking" {
  statement_id  = "AllowExecutionFromAPIGatewayBooking"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.BookingFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.QuoteAPI.execution_arn}/*/*"
}

# --- VPC ENDPOINT FOR SECRETS MANAGER ---
resource "aws_vpc_endpoint" "secrets_manager_endpoint" {
  vpc_id            = aws_vpc.edgar_vpc.id
  service_name      = "com.amazonaws.us-west-2.secretsmanager"
  vpc_endpoint_type = "Interface"
  subnet_ids        = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_group_ids = [aws_security_group.lambda_sg.id]
  private_dns_enabled = true
}

# --- VPC ENDPOINT FOR SNS ---
resource "aws_vpc_endpoint" "sns_endpoint" {
  vpc_id            = aws_vpc.edgar_vpc.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.sns"
  vpc_endpoint_type = "Interface"
  
  subnet_ids        = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id,
  ]
  
  security_group_ids = [
    aws_security_group.lambda_sg.id,
  ]
  
  private_dns_enabled = true
  
  tags = {
    Name = "edgar-sns-endpoint"
    Project = "AutoRepairHub"
  }
}

# --- REMINDER LAMBDA FUNCTION ---
resource "aws_lambda_function" "ReminderFunction" {
  function_name = "EdgarAutoReminderFunction"
  role          = aws_iam_role.BookingLambdaRole.arn
  handler       = "reminder_function.lambda_handler"
  runtime       = "python3.9"
  filename      = "${path.module}/lambda_packages/reminder_function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_packages/reminder_function.zip")

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.appointment_notifications.arn
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  tags = {
    Project = "AutoRepairHub"
  }
}

resource "aws_cloudwatch_event_rule" "Reminder24hRule" {
  name                = "Edgar24hReminderRule"
  schedule_expression = "cron(0 12 * * ? *)" # Every day at noon UTC
  description         = "Trigger 24h appointment reminders"
}

resource "aws_cloudwatch_event_target" "ReminderTarget" {
  rule      = aws_cloudwatch_event_rule.Reminder24hRule.name
  arn       = aws_lambda_function.ReminderFunction.arn
}

resource "aws_lambda_permission" "AllowEventBridgeInvokeReminder" {
  statement_id  = "AllowExecutionFromEventBridgeReminder"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ReminderFunction.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.Reminder24hRule.arn
}

# --- COGNITO USER POOL FOR ADMIN ---
resource "aws_cognito_user_pool" "admin_pool" {
  name = "edgar-admin-user-pool"
  auto_verified_attributes = ["email"]
  mfa_configuration = "OFF"
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
}

resource "aws_cognito_user_pool_client" "admin_client" {
  name         = "edgar-admin-client"
  user_pool_id = aws_cognito_user_pool.admin_pool.id
  generate_secret = false
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

resource "aws_apigatewayv2_authorizer" "AdminJWTAuthorizer" {
  api_id = aws_apigatewayv2_api.QuoteAPI.id
  authorizer_type = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name = "EdgarAdminJWTAuthorizer"
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.admin_client.id]
    issuer   = "https://cognito-idp.us-west-2.amazonaws.com/${aws_cognito_user_pool.admin_pool.id}"
  }
}

# Output the API endpoint URL
output "api_endpoint" {
  description = "The invoke URL for the API Gateway"
  value       = aws_apigatewayv2_api.QuoteAPI.api_endpoint
}

resource "aws_apigatewayv2_route" "AdminAppointmentsToday" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "GET /admin/appointments/today"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
  authorizer_id = aws_apigatewayv2_authorizer.AdminJWTAuthorizer.id
}

resource "aws_apigatewayv2_route" "AdminAppointmentsUpdate" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "PUT /admin/appointments/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.BookingAPIIntegration.id}"
  authorizer_id = aws_apigatewayv2_authorizer.AdminJWTAuthorizer.id
}

# --- NOTIFICATION LAMBDA FUNCTION ---
resource "aws_ecr_repository" "NotifyRepo" {
  name = "edgar-notify-function"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Project = "AutoRepairHub"
  }
}

resource "aws_iam_role" "NotifyLambdaRole" {
  name = "NotifyLambdaRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "NotifyVPCAccess" {
  role       = aws_iam_role.NotifyLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "NotifyBasicLogs" {
  role       = aws_iam_role.NotifyLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "NotifySNSAttachment" {
  role       = aws_iam_role.NotifyLambdaRole.name
  policy_arn = aws_iam_policy.lambda_sns_policy.arn
}

resource "aws_lambda_function" "NotificationFunction" {
  function_name = "EdgarNotificationFunction"
  package_type  = "Image"
  image_uri     = "${var.notify_ecr_repo_uri}:${var.notify_image_tag}"
  role          = aws_iam_role.NotifyLambdaRole.arn
  timeout       = 15
  memory_size   = 256
  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.appointment_notifications.arn
    }
  }
  # Temporarily removed VPC config for testing
  # vpc_config {
  #   subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  #   security_group_ids = [aws_security_group.lambda_sg.id]
  # }
  depends_on = [aws_ecr_repository.NotifyRepo]
}

resource "aws_lambda_permission" "AllowSNSInvokeNotification" {
  statement_id  = "AllowExecutionFromSNSNotification"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.NotificationFunction.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.appointment_notifications.arn
}