# GitHub Secrets Configuration Guide

This document outlines the required GitHub repository secrets and environment variables needed for the AWS OIDC production deployment pipeline.

## Repository Secrets Setup

Navigate to your GitHub repository → Settings → Secrets and variables → Actions → Repository secrets

### Required Secrets

#### AWS Configuration
```
AWS_ROLE_ARN
Value: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole
Description: IAM role ARN for OIDC authentication
```

```
AWS_REGION
Value: us-east-1
Description: AWS region for deployments (adjust as needed)
```

#### ECS Configuration
```
ECS_CLUSTER_NAME
Value: edgars-auto-shop-cluster
Description: ECS cluster name for container deployments
```

```
ECS_SERVICE_BACKEND
Value: edgars-auto-shop-backend-service
Description: ECS service name for backend application
```

```
ECS_SERVICE_FRONTEND
Value: edgars-auto-shop-frontend-service
Description: ECS service name for frontend application
```

```
ECS_TASK_DEFINITION_BACKEND
Value: edgars-auto-shop-backend-task
Description: ECS task definition family name for backend
```

```
ECS_TASK_DEFINITION_FRONTEND
Value: edgars-auto-shop-frontend-task
Description: ECS task definition family name for frontend
```

#### Application URLs
```
BACKEND_URL
Value: https://api.edgars-auto-shop.com
Description: Production backend URL for health checks
```

```
FRONTEND_URL
Value: https://edgars-auto-shop.com
Description: Production frontend URL for health checks
```

## Environment Configuration

### Production Environment Setup

1. **Navigate to Repository Settings**
   - Go to Settings → Environments
   - Click "New environment"
   - Name: `production`

2. **Configure Environment Protection Rules**
   ```yaml
   Protection Rules:
   ✅ Required reviewers: 1-2 people
   ✅ Wait timer: 0 minutes (or as needed)
   ✅ Deployment branches: Selected branches only → main
   ```

3. **Environment Variables**

   Environment variables can override repository secrets for environment-specific values:

   ```
   AWS_REGION=us-east-1
   ECR_REPOSITORY_BACKEND=edgars-auto-shop-backend
   ECR_REPOSITORY_FRONTEND=edgars-auto-shop-frontend
   ```

## Quick Setup Script

Here's a bash script to help set up the required secrets via GitHub CLI:

```bash
#!/bin/bash

# Set your repository and values
REPO="your-org/edgars-mobile-auto-shop"
AWS_ACCOUNT_ID="123456789012"  # Replace with your AWS account ID

# Set repository secrets
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsRole" --repo $REPO
gh secret set AWS_REGION --body "us-east-1" --repo $REPO
gh secret set ECS_CLUSTER_NAME --body "edgars-auto-shop-cluster" --repo $REPO
gh secret set ECS_SERVICE_BACKEND --body "edgars-auto-shop-backend-service" --repo $REPO
gh secret set ECS_SERVICE_FRONTEND --body "edgars-auto-shop-frontend-service" --repo $REPO
gh secret set ECS_TASK_DEFINITION_BACKEND --body "edgars-auto-shop-backend-task" --repo $REPO
gh secret set ECS_TASK_DEFINITION_FRONTEND --body "edgars-auto-shop-frontend-task" --repo $REPO
gh secret set BACKEND_URL --body "https://api.edgars-auto-shop.com" --repo $REPO
gh secret set FRONTEND_URL --body "https://edgars-auto-shop.com" --repo $REPO

echo "✅ All secrets configured successfully!"
```

## Validation

After setting up secrets, you can test the configuration by:

1. **Running the OIDC test workflow**:
   ```bash
   gh workflow run test-aws-oidc.yml --repo your-org/edgars-mobile-auto-shop
   ```

2. **Checking secret availability**:
   ```bash
   gh secret list --repo your-org/edgars-mobile-auto-shop
   ```

3. **Verifying environment setup**:
   ```bash
   gh api repos/your-org/edgars-mobile-auto-shop/environments
   ```

## Security Best Practices

### Secret Management
- ✅ Use specific, least-privilege IAM roles
- ✅ Rotate secrets regularly
- ✅ Use environment-specific secrets when needed
- ✅ Monitor secret access in AWS CloudTrail

### Environment Protection
- ✅ Require manual approval for production deployments
- ✅ Limit deployment branches to `main` only
- ✅ Set up proper reviewer permissions
- ✅ Consider deployment time windows for production

### Monitoring
- ✅ Set up CloudWatch alarms for deployment failures
- ✅ Monitor ECS service health metrics
- ✅ Track deployment frequency and success rates
- ✅ Set up notifications for critical deployment events

## Troubleshooting

### Common Issues

1. **"Context access might be invalid" warnings**
   - These are lint warnings about undefined secrets
   - They're expected until secrets are configured in GitHub
   - The workflow will work once secrets are properly set

2. **OIDC authentication failures**
   - Verify AWS_ROLE_ARN is correct and exists
   - Check IAM role trust policy includes GitHub OIDC provider
   - Ensure role has necessary permissions for ECS, ECR, CloudWatch

3. **ECS deployment failures**
   - Verify ECS cluster and service names are correct
   - Check task definition exists and is active
   - Ensure ECR repositories exist and have the required images

4. **Health check failures**
   - Verify application URLs are accessible
   - Check security groups allow inbound traffic
   - Ensure load balancer is properly configured

---

**Next Steps**: After configuring these secrets, run the test workflow to validate the complete OIDC setup before attempting production deployments.
