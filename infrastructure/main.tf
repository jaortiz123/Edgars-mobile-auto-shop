# /infrastructure/main.tf

// Declare environment local
locals {
  env = var.env
}

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
      Action    = "sts:AssumeRole"
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

# Task: Provision AWS Cognito User Pool and User Pool Client
resource "aws_cognito_user_pool" "EdgarCustomersUserPool" {
  name                     = "EdgarCustomers-${local.env}"
  auto_verified_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  verification_message_template {
    email_subject = "Verify your Edgar Auto Shop account"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  lambda_config {
    pre_sign_up = local.env == "dev" ? aws_lambda_function.auto_confirm.arn : null
  }

  tags = {
    Project = "AutoRepairHub"
  }
}

resource "aws_cognito_user_pool_client" "EdgarCustomerAppClient" {
  name               = "EdgarCustomerAppClient"
  user_pool_id       = aws_cognito_user_pool.EdgarCustomersUserPool.id
  generate_secret    = false
  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
  read_attributes               = ["email", "email_verified"]
  write_attributes              = ["email"]
  supported_identity_providers  = ["COGNITO"]
  callback_urls  = ["http://localhost:5173"]
  logout_urls    = ["http://localhost:5173"]
}

output "cognito_user_pool_id" {
  description = "ID of the Cognito user pool for customer sign-up"
  value       = aws_cognito_user_pool.EdgarCustomersUserPool.id
}

output "cognito_app_client_id" {
  description = "App client ID for customer authentication"
  value       = aws_cognito_user_pool_client.EdgarCustomerAppClient.id
}

# Task: Provision IAM Role for new Authentication Lambda function
resource "aws_iam_role" "AuthLambdaRole" {
  name = "AuthLambdaRole"
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

resource "aws_iam_role_policy_attachment" "AuthLambdaBasicExecution" {
  role       = aws_iam_role.AuthLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "AuthCognitoAccessPolicy" {
  name        = "AuthCognitoAccessPolicy"
  description = "Policy granting Cognito actions for Auth Lambda"
  policy      = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "cognito-idp:SignUp",
        "cognito-idp:ConfirmSignUp",
        "cognito-idp:InitiateAuth",
        "cognito-idp:RespondToAuthChallenge"
      ],
      Resource = aws_cognito_user_pool.EdgarCustomersUserPool.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "AuthCognitoAccessAttachment" {
  role       = aws_iam_role.AuthLambdaRole.name
  policy_arn = aws_iam_policy.AuthCognitoAccessPolicy.arn
}

# Task: Provision Auth Lambda Function Resource
resource "aws_ecr_repository" "auth_function_repo" {
  name                 = "edgar-auth-function"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags = { Project = "AutoRepairHub" }
}

variable "auth_lambda_image_tag" {
  description = "Image tag for AuthFunction Lambda in ECR"
  type        = string
  default     = "latest"
}

resource "aws_lambda_function" "AuthFunction" {
  function_name = "EdgarAuthFunction"
  role          = aws_iam_role.AuthLambdaRole.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.auth_function_repo.repository_url}:${var.auth_lambda_image_tag}"
  timeout       = 30
  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.EdgarCustomersUserPool.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.EdgarCustomerAppClient.id
    }
  }
  tags = { Project = "AutoRepairHub" }
}

output "auth_function_name" {
  description = "Name of the Auth Lambda function"
  value       = aws_lambda_function.AuthFunction.function_name
}

output "auth_function_arn" {
  description = "ARN of the Auth Lambda function"
  value       = aws_lambda_function.AuthFunction.arn
}

# Task: Define API Gateway Routes for Authentication Endpoints
resource "aws_apigatewayv2_integration" "AuthAPIIntegration" {
  api_id                  = aws_apigatewayv2_api.QuoteAPI.id
  integration_type        = "AWS_PROXY"
  integration_uri         = aws_lambda_function.AuthFunction.invoke_arn
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_route" "AuthRoute_Register" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "POST /customers/register"
  target    = "integrations/${aws_apigatewayv2_integration.AuthAPIIntegration.id}"
}

resource "aws_apigatewayv2_route" "AuthRoute_Login" {
  api_id    = aws_apigatewayv2_api.QuoteAPI.id
  route_key = "POST /customers/login"
  target    = "integrations/${aws_apigatewayv2_integration.AuthAPIIntegration.id}"
}

resource "aws_lambda_permission" "AuthPermission_Register" {
  statement_id  = "AllowAPIGatewayInvokeRegister"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.AuthFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.QuoteAPI.id}/*/POST/customers/register"
}

resource "aws_lambda_permission" "AuthPermission_Login" {
  statement_id  = "AllowAPIGatewayInvokeLogin"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.AuthFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.QuoteAPI.id}/*/POST/customers/login"
}

# Pre-sign-up auto-confirm Lambda (dev only)
resource "aws_lambda_function" "auto_confirm" {
  function_name     = "EdgarAutoConfirm-${local.env}"
  package_type      = "Zip"
  filename          = "${path.module}/../backend/auto_confirm_function.zip"
  source_code_hash  = filebase64sha256("${path.module}/../backend/auto_confirm_function.zip")
  handler           = "auto_confirm_function.lambda_handler"
  runtime           = "python3.9"
  role              = aws_iam_role.auto_confirm_lambda_role.arn
  timeout           = 5
  memory_size       = 128
}
 
# Grant invocation permission from Cognito for pre-sign-up trigger
resource "aws_lambda_permission" "AllowCognitoPreSignupInvoke" {
  statement_id  = "AllowCognitoPreSignupInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auto_confirm.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.EdgarCustomersUserPool.arn
}

# IAM Role for auto-confirm Lambda (dev only)
resource "aws_iam_role" "auto_confirm_lambda_role" {
  name = "AutoConfirmLambdaRole-${local.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "auto_confirm_basic_execution" {
  role       = aws_iam_role.auto_confirm_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB table for customer profiles
resource "aws_dynamodb_table" "customers" {
  name         = "${var.env}-customers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  tags = {
    Environment = var.env
    Project     = "AutoRepairHub"
  }
}

# ECR repository for ProfileFunction
resource "aws_ecr_repository" "profile_function_repo" {
  name                 = "edgar-profile-function"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags = { Project = "AutoRepairHub" }
}

# IAM policy document for ProfileFunction DynamoDB access
data "aws_iam_policy_document" "profile_lambda" {
  statement {
    actions   = ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.customers.arn, "${aws_dynamodb_table.customers.arn}/*"]
  }
}

resource "aws_iam_policy" "profile_dynamo_policy" {
  name        = "ProfileDynamoPolicy-${var.env}"
  description = "DynamoDB access for ProfileFunction"
  policy      = data.aws_iam_policy_document.profile_lambda.json
}

# IAM role and attachments for ProfileFunction
resource "aws_iam_role" "ProfileLambdaRole" {
  name = "ProfileLambdaRole-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action   = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ProfileBasicExecution" {
  role       = aws_iam_role.ProfileLambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "ProfileDynamoPolicyAttachment" {
  role       = aws_iam_role.ProfileLambdaRole.name
  policy_arn = aws_iam_policy.profile_dynamo_policy.arn
}

# Lambda function for customer profile management
resource "aws_lambda_function" "ProfileFunction" {
  function_name = "EdgarProfileFunction"
  role          = aws_iam_role.ProfileLambdaRole.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.profile_function_repo.repository_url}:${var.profile_lambda_image_tag}"
  timeout       = 30
  environment {
    variables = {
      CUSTOMERS_TABLE = aws_dynamodb_table.customers.name
    }
  }
  tags = { Project = "AutoRepairHub" }
}

# API Gateway integration and routes for Profile endpoints
resource "aws_apigatewayv2_integration" "ProfileIntegration" {
  api_id                 = aws_apigatewayv2_api.QuoteAPI.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ProfileFunction.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "ProfileRoute_GET" {
  api_id       = aws_apigatewayv2_api.QuoteAPI.id
  route_key    = "GET /customers/profile"
  target       = "integrations/${aws_apigatewayv2_integration.ProfileIntegration.id}"
  authorizer_id = aws_apigatewayv2_authorizer.JWT.id
}

resource "aws_apigatewayv2_route" "ProfileRoute_PUT" {
  api_id       = aws_apigatewayv2_api.QuoteAPI.id
  route_key    = "PUT /customers/profile"
  target       = "integrations/${aws_apigatewayv2_integration.ProfileIntegration.id}"
  authorizer_id = aws_apigatewayv2_authorizer.JWT.id
}

resource "aws_lambda_permission" "AllowAPIGatewayInvokeProfile_GET" {
  statement_id  = "AllowAPIGatewayInvokeProfile_GET"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ProfileFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.QuoteAPI.id}/*/GET/customers/profile"
}

resource "aws_lambda_permission" "AllowAPIGatewayInvokeProfile_PUT" {
  statement_id  = "AllowAPIGatewayInvokeProfile_PUT"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ProfileFunction.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.QuoteAPI.id}/*/PUT/customers/profile"
}