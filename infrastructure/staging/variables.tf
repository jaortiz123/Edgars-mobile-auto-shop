variable "aws_region" {
  description = "AWS region to deploy staging infrastructure"
  type        = string
  default     = "us-west-2"
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

# Auto Scaling Configuration Variables
variable "min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 10
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto scaling"
  type        = number
  default     = 80
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts (optional)"
  type        = string
  default     = ""
}

variable "enable_pre_traffic_validation" {
  description = "Enable pre-traffic validation Lambda hook for Blue/Green deployments"
  type        = bool
  default     = true
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

variable "domain_name" {
  description = "Primary domain name to look up ACM certificate for the ALB HTTPS listener"
  type        = string
}
