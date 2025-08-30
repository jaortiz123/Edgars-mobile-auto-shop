Staging Infrastructure (Terraform)

This module provisions the minimal AWS resources required to support the Unified CI deploy-staging job:

- ECR repository for backend images
- ECS cluster, task definition (Fargate), and service fronted by an ALB
- S3 bucket configured for static website hosting (frontend artifacts)
- IAM roles: ECS task execution + app task role
- GitHub Actions OIDC role for keyless deployments (optional; can also use access keys)

Usage

1) Initialize and apply:

   - cd infrastructure/staging
   - terraform init
   - terraform apply -var="aws_region=us-east-1"

2) Outputs to capture as GitHub repository secrets (Task 17.4):

   - ecr_repository_name      -> STAGING_ECR_REPOSITORY
   - ecs_cluster_name         -> STAGING_ECS_CLUSTER
   - ecs_service_name         -> STAGING_ECS_SERVICE
   - ecs_task_family          -> STAGING_ECS_TASK_FAMILY
   - ecs_task_execution_role_arn (if needed for iam:PassRole)
   - alb_dns_name             -> Use to build STAGING_HEALTHCHECK_URL (http://<alb_dns_name>/health)
   - s3_bucket_name           -> STAGING_S3_BUCKET

3) Container port is set to 3001 by default to match the backend. Update variables.tf if needed.

Notes

- The ECS task runs a placeholder http-echo container listening on port 3001 returning HTTP 200. The CI deploy job will replace the image with the real backend.
- The ALB health check path is /health and the ELB DNS name is exposed as output for smoke tests.
- The S3 bucket is configured for static website hosting for simplicity; a CloudFront distribution can be added later.
- For GitHub OIDC: the trust policy is restricted to repo jaortiz123/Edgars-mobile-auto-shop. Adjust if the repository slug changes.
