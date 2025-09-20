# AWS Deployment Guide - Edgar's Mobile Auto Shop

## 🏗️ Architecture Overview

This deployment uses a cost-conscious, serverless architecture on AWS:

- **Compute**: AWS Lambda with Flask + Lambda Web Adapter (LWA)
- **Database**: Aurora Serverless v2 PostgreSQL (0.5-1 ACU)
- **Networking**: VPC with private subnets, minimal networking
- **API**: Lambda Function URL (cheaper than API Gateway)
- **Secrets**: AWS Secrets Manager for database credentials
- **Monitoring**: CloudWatch Logs, Metrics, Alarms
- **Cost Control**: Budget alerts, Aurora auto-pause

## 💰 Cost Breakdown

**Estimated Monthly Costs (Development)**:
- Aurora Serverless v2 (0.5 ACU): ~$43.80
- Lambda (Free Tier): 1M requests + 400K GB-seconds free
- Secrets Manager: $0.40/secret
- CloudWatch Logs: First 5GB free
- **Total Estimated**: ~$45-50/month

**Cost Optimizations**:
- No NAT Gateway (saves ~$32/month)
- Lambda Function URL vs API Gateway (saves ~$3.50/M requests)
- 14-day log retention
- Aurora auto-pause after 5 minutes idle

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Terraform** >= 1.0
3. **Docker** for container builds
4. **Git** for version control

### Initial Setup

1. **Clone and navigate to project**:
   ```bash
   git clone <repository-url>
   cd Edgars-mobile-auto-shop
   ```

2. **Deploy infrastructure**:
   ```bash
   # Plan the deployment (dry run)
   ./deploy.sh dev plan

   # Deploy to AWS
   ./deploy.sh dev apply
   ```

3. **Access your application**:
   ```bash
   cd infra/terraform/envs/dev
   terraform output application_url
   ```

### Manual Backend Setup (First Time Only)

If the Terraform backend doesn't exist:

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://edgar-auto-shop-terraform-state --region us-west-2
aws s3api put-bucket-versioning --bucket edgar-auto-shop-terraform-state --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name edgar-auto-shop-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-west-2
```

## 🏗️ Infrastructure Components

### Terraform Modules

Located in `infra/terraform/modules/`:

1. **vpc_min**: Minimal VPC with private subnets, security groups
2. **rds_serverless**: Aurora Serverless v2 with Secrets Manager
3. **lambda_flask_lwa**: Lambda function with Flask Web Adapter
4. **api_gateway_http** (optional): HTTP API Gateway

### Environment Configuration

Located in `infra/terraform/envs/dev/`:

- `main.tf`: Module composition and configuration
- `variables.tf`: Environment-specific variables
- `outputs.tf`: Infrastructure outputs
- `backend.tf`: Terraform state backend configuration

## 🔧 Configuration Options

### Key Variables (in `variables.tf`)

```hcl
# Cost optimization
enable_nat_gateway = false     # Save ~$32/month
use_api_gateway = false        # Use Lambda Function URL instead
min_acu = 0.5                 # Minimum Aurora capacity
auto_pause = true             # Auto-pause Aurora when idle

# Lambda settings
lambda_memory_size = 512      # MB
lambda_timeout = 30           # seconds
```

### Environment Variables

The Lambda function uses these environment variables:

- `SECRETS_MANAGER_NAME`: Name of the database credentials secret
- `FLASK_ENV`: Set to "production"
- `AWS_LAMBDA_EXEC_WRAPPER`: Lambda Web Adapter bootstrap path

## 🔒 Security Features

### Network Security

- Lambda in private subnets only
- RDS accessible only from Lambda security group
- No public subnets (unless NAT gateway enabled)
- VPC endpoints for AWS services (optional)

### IAM Permissions

Lambda function has minimal permissions:
- `secretsmanager:GetSecretValue` for database credentials
- VPC network interface management
- CloudWatch Logs write permissions

### Secrets Management

Database credentials stored in AWS Secrets Manager:
- Auto-generated secure passwords
- Automatic credential rotation (configurable)
- Retrieved at Lambda cold start and cached

## 📊 Monitoring & Observability

### CloudWatch Integration

- **Logs**: JSON structured logging with correlation IDs
- **Metrics**: Lambda duration, errors, invocations
- **Alarms**: Error rate and latency thresholds
- **Dashboard**: Application and database metrics

### Health Checks

- `/healthz` endpoint for load balancer health checks
- Database connectivity verification
- Application status reporting

### X-Ray Tracing

- End-to-end request tracing
- Performance analysis
- Dependency mapping

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

Located in `.github/workflows/deploy-aws.yml`:

1. **PR Workflow**:
   - Terraform format check
   - Terraform plan
   - Comment plan on PR

2. **Main Branch Deployment**:
   - Build Docker image
   - Push to ECR
   - Deploy infrastructure
   - Run smoke tests

### Required Secrets

Configure these in GitHub repository secrets:

- `AWS_ROLE_ARN`: IAM role for OIDC authentication

### OIDC Setup

Create an IAM role with trust policy for GitHub Actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:owner/repo:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

## 🛠️ Development Workflow

### Local Development

```bash
# Run locally for development
cd backend
python -m flask --app app:create_dev_app run --debug

# Run tests
pytest tests/

# Build container locally
docker build -t edgar-auto-shop .
docker run -p 8000:8000 edgar-auto-shop
```

### Database Migrations

```bash
# Run migrations against Aurora
cd backend
python run_sql_migrations.py --env production
```

### Updating Infrastructure

```bash
# Plan changes
./deploy.sh dev plan

# Apply changes
./deploy.sh dev apply

# Destroy (careful!)
cd infra/terraform/envs/dev
terraform destroy
```

## 🔍 Troubleshooting

### Common Issues

1. **Lambda timeout**: Increase `lambda_timeout` variable
2. **Memory issues**: Increase `lambda_memory_size`
3. **Cold starts**: Consider provisioned concurrency for production
4. **Database connections**: Check Aurora scaling configuration

### Debugging Commands

```bash
# Check Lambda logs
aws logs tail /aws/lambda/edgar-auto-shop-dev-flask-app --follow

# Check Aurora metrics
aws rds describe-db-clusters --db-cluster-identifier edgar-auto-shop-dev-aurora-cluster

# Test application
curl https://your-lambda-url.lambda-url.us-west-2.on.aws/healthz
```

### Cost Analysis

```bash
# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=2023-01-01,End=2023-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## 📈 Production Considerations

### Scaling Aurora Serverless

For production workloads:
- Increase `max_acu` to 4-8 ACUs
- Disable `auto_pause` for consistent performance
- Enable backup retention (7-35 days)

### Lambda Optimization

- Enable provisioned concurrency for consistent performance
- Increase memory for CPU-bound operations
- Consider Lambda@Edge for global distribution

### Security Hardening

- Enable VPC Flow Logs
- Add WAF for API Gateway (if used)
- Implement Cognito authentication
- Enable AWS Config for compliance
- Set up AWS GuardDuty for threat detection

## 📚 Additional Resources

- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Flask Production Deployment](https://flask.palletsprojects.com/en/2.3.x/deploying/)
