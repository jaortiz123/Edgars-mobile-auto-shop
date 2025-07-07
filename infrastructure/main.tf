# /infrastructure/main.tf

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

# Output the API endpoint URL
output "api_endpoint" {
  description = "The invoke URL for the API Gateway"
  value       = aws_apigatewayv2_api.QuoteAPI.api_endpoint
}