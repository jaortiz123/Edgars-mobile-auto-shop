# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

# Database Outputs
output "database_endpoint" {
  description = "Aurora cluster endpoint"
  value       = module.rds.cluster_endpoint
}

output "database_port" {
  description = "Aurora cluster port"
  value       = module.rds.cluster_port
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = module.rds.secrets_manager_arn
}

output "secrets_manager_name" {
  description = "Name of the Secrets Manager secret"
  value       = module.rds.secrets_manager_name
}

# ECR Repository
output "ecr_repository_url" {
  description = "ECR repository URL for container images"
  value       = aws_ecr_repository.flask_app.repository_url
}

# Lambda Outputs (conditional)
output "lambda_function_name" {
  description = "Lambda function name"
  value       = var.deploy_lambda ? module.lambda[0].function_name : null
}

output "lambda_function_url" {
  description = "Lambda function URL"
  value       = var.deploy_lambda ? module.lambda[0].function_url : null
}

# API Gateway Outputs (conditional)
output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = var.deploy_lambda && var.use_api_gateway ? module.api_gateway[0].api_endpoint : null
}

# Primary Application Endpoint
output "application_url" {
  description = "Primary application URL (Lambda Function URL or API Gateway)"
  value = var.deploy_lambda ? (
    var.use_api_gateway ?
    module.api_gateway[0].api_endpoint :
    module.lambda[0].function_url
  ) : null
}

# Cost Estimation
output "estimated_monthly_cost_usd" {
  description = "Estimated monthly cost breakdown"
  value = {
    aurora_serverless_v2_min = "~$43.80" # 0.5 ACU * 24h * 30d * $0.12
    lambda_free_tier         = "1M requests + 400K GB-seconds free"
    lambda_additional        = "$0.20 per 1M requests + $0.0000166667 per GB-second"
    cloudwatch_logs          = "~$0.50 (first 5GB free)"
    nat_gateway              = var.enable_nat_gateway ? "~$32.40" : "$0.00"
    api_gateway              = var.use_api_gateway ? "$1.00 per million requests" : "$0.00 (using Function URL)"
    secrets_manager          = "$0.40 per secret per month"
    total_estimated_min      = var.enable_nat_gateway ? "~$77" : "~$45"
  }
}
