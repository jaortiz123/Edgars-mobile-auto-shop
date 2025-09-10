# Blue/Green Deployment Checklist

## Pre-Deployment Configuration

### GitHub Secrets Configuration ⚠️ REQUIRED
Add the following secrets to your GitHub repository settings:

1. Navigate to: `Settings > Secrets and variables > Actions`
2. Add new repository secrets:
   ```
   STAGING_CODEDEPLOY_APP = "mobile-auto-shop-staging-codedeploy-app"
   STAGING_CODEDEPLOY_GROUP = "mobile-auto-shop-staging-deployment-group"
   ```

### Terraform Infrastructure Deployment
```bash
cd infrastructure/staging
terraform init
terraform plan
terraform apply
```

### Verify Infrastructure
```bash
# Check CodeDeploy application
aws deploy list-applications

# Check deployment group
aws deploy list-deployment-groups --application-name mobile-auto-shop-staging-codedeploy-app

# Verify ECS service auto-scaling
aws application-autoscaling describe-scaling-policies
```

## Deployment Testing

### 1. Health Endpoint Verification
```bash
# Test all health endpoints
curl -f https://api.edgarsmobile.com/health
curl -f https://api.edgarsmobile.com/ready
curl -f https://api.edgarsmobile.com/health/live
```

### 2. Blue/Green Deployment Test
```bash
# Trigger deployment via GitHub Actions
git push origin main

# Monitor deployment
aws deploy list-deployments --application-name mobile-auto-shop-staging-codedeploy-app
```

### 3. Auto-Scaling Test
```bash
# Generate load to trigger scaling
# Monitor ECS service scaling in AWS Console
```

## Post-Deployment Validation

### ✅ Checklist
- [ ] GitHub secrets configured
- [ ] Terraform infrastructure deployed
- [ ] Health endpoints responding
- [ ] Blue/Green deployment successful
- [ ] Auto-scaling policies active
- [ ] CloudWatch alarms configured
- [ ] SNS notifications working

## Rollback Procedures

### Automatic Rollback Triggers
- Deployment failures
- Health check failures
- CloudWatch alarm breaches

### Manual Rollback
```bash
aws deploy stop-deployment --deployment-id <deployment-id> --auto-rollback-enabled
```

**Status**: Ready for production deployment ✅
