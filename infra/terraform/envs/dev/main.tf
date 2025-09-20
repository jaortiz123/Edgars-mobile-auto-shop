# Development Environment Configuration
# Cost-optimized AWS deployment for Edgar's Auto Shop

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }

# Backend configuration is in backend.tf
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "dev"
      Project     = "edgar-auto-shop"
      ManagedBy   = "terraform"
      Owner       = "jesus"
    }
  }
}

locals {
  name_prefix = "edgar-auto-shop-dev"
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc_min"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  enable_nat_gateway = var.enable_nat_gateway
}

# RDS Module
module "rds" {
  source = "../../modules/rds_serverless"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.vpc.rds_security_group_id]

  database_name      = var.database_name
  master_username    = var.master_username
  min_acu            = var.min_acu
  max_acu            = var.max_acu
  auto_pause         = var.auto_pause
  auto_pause_seconds = var.auto_pause_seconds
}

# ECR Repository for Lambda container
resource "aws_ecr_repository" "flask_app" {
  name                 = "${local.name_prefix}-flask-app"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Allow deletion for dev

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.name_prefix}-flask-app-ecr"
  }
}

# Lambda Module (only deploy if container image exists)
module "lambda" {
  source = "../../modules/lambda_flask_lwa"

  # Only create if ECR image is available
  count = var.deploy_lambda ? 1 : 0

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.vpc.lambda_security_group_id]

  secrets_manager_arn  = module.rds.secrets_manager_arn
  secrets_manager_name = module.rds.secrets_manager_name
  image_uri            = var.lambda_image_uri

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  environment_variables = {
    FLASK_ENV = "production"
    LOG_LEVEL = "INFO"
    JWT_SECRET = "JT9W__KyFcV14B_VlQV-4wNnTYDpER-AHsbEhNa2Yb0"
    FLASK_SECRET_KEY = "x1afvE5BUitn7-R_DQ5IQ42UIAeppyem-YZ7QO75tuk"
  }

  # Pass RDS cluster identifier for dashboard
  cluster_identifier = module.rds.cluster_identifier
}

# API Gateway Module (optional - can use Lambda Function URL instead)
module "api_gateway" {
  source = "../../modules/api_gateway_http"

  # Only create if Lambda is deployed and API Gateway is enabled
  count = var.deploy_lambda && var.use_api_gateway ? 1 : 0

  name_prefix          = local.name_prefix
  lambda_function_name = module.lambda[0].function_name
  lambda_invoke_arn    = module.lambda[0].invoke_arn

  stage_name = "dev"
}

# S3 Bucket for Terraform state (must be created manually first)
# This is just for documentation - the backend configuration above uses it
# aws s3 mb s3://edgar-auto-shop-terraform-state --region us-west-2
# aws dynamodb create-table --table-name edgar-auto-shop-terraform-locks \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
#   --region us-west-2
