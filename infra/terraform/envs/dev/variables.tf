# AWS Region
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway for outbound internet access (adds ~$32/month cost)"
  type        = bool
  default     = false
}

# Database Configuration
variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "edgar_auto_shop"
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "edgar_admin"
}

variable "min_acu" {
  description = "Minimum Aurora Capacity Units (ACU) - cost optimization"
  type        = number
  default     = 0.5
}

variable "max_acu" {
  description = "Maximum Aurora Capacity Units (ACU) - cost optimization"
  type        = number
  default     = 1.0
}

variable "auto_pause" {
  description = "Enable auto-pause for Aurora Serverless (cost optimization)"
  type        = bool
  default     = true
}

variable "auto_pause_seconds" {
  description = "Time in seconds before Aurora auto-pauses"
  type        = number
  default     = 300 # 5 minutes
}

# Lambda Configuration
variable "deploy_lambda" {
  description = "Whether to deploy Lambda function (set to false initially)"
  type        = bool
  default     = false
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

# API Gateway Configuration
variable "use_api_gateway" {
  description = "Use API Gateway instead of Lambda Function URL (adds cost)"
  type        = bool
  default     = false # Start with Lambda Function URL for cost savings
}

# AWS Account Configuration
variable "account_id" {
  description = "AWS Account ID"
  type        = string
}

variable "lambda_image_uri" {
  description = "URI of the Lambda container image in ECR"
  type        = string
}
