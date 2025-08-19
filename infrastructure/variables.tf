variable "lambda_image_tag" {
  description = "Tag for all Lambda container images"
  type        = string
  default     = "latest"
}

variable "notify_ecr_repo_uri" {
  description = "ECR repo URI for the notification Lambda (without tag)"
  type        = string
}

variable "notify_image_tag" {
  description = "Tag for the notification Lambda container image"
  type        = string
}

variable "env" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
  default     = "dev"
}

variable "profile_lambda_image_tag" {
  description = "Image tag for ProfileFunction Lambda in ECR"
  type        = string
  default     = "latest"
}
