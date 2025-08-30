variable "aws_region" {
  description = "AWS region to deploy staging infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project/application name"
  type        = string
  default     = "mobile-auto-shop"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "staging"
}

variable "container_port" {
  description = "Container port exposed by the backend service"
  type        = number
  default     = 3001
}

variable "desired_count" {
  description = "Number of tasks to run in ECS service"
  type        = number
  default     = 1
}

variable "ecr_repository_name" {
  description = "ECR repository name for backend image"
  type        = string
  default     = null
}

locals {
  name_prefix        = "${var.project_name}-${var.environment}"
  ecr_repo_name      = coalesce(var.ecr_repository_name, "${local.name_prefix}-backend")
  s3_bucket_base     = replace(lower(local.name_prefix), "_", "-")
}
