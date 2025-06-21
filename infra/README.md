# Infrastructure Overview

Terraform in `infra/terraform` provisions the AWS resources used in production:

- VPC with public and private subnets
- ECS cluster with a Fargate service for the backend
- Application Load Balancer exposing the API
- RDS PostgreSQL database with automated backups
- S3 bucket and CloudFront distribution for the React frontend
- CloudWatch log groups, alarms and dashboards
- Auto-scaling policies for the ECS service

## Usage

```bash
cd infra/terraform
terraform init
terraform plan -var="backend_image=<ECR image URI>" \
               -var="db_username=<username>" \
               -var="db_password=<password>"
terraform apply
```

Running `terraform apply` creates the infrastructure and outputs the ALB and CloudFront endpoints.
