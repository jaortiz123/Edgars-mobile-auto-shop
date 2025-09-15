# AWS OIDC Setup for GitHub Actions

This guide sets up secure, short-lived AWS credentials for GitHub Actions deployments using OpenID Connect (OIDC), eliminating the need for long-lived AWS access keys.

## Prerequisites

- AWS CLI configured with admin permissions
- Your AWS Account ID
- Repository: `jaortiz123/Edgars-mobile-auto-shop`

## Step 1: Create OIDC Identity Provider

First, create an OpenID Connect identity provider in AWS IAM that trusts GitHub's OIDC issuer.

### Using AWS CLI (Recommended)

```bash
# Create the OIDC provider - this enables GitHub Actions to authenticate with AWS
aws iam create-open-id-connect-provider
  --url https://token.actions.githubusercontent.com
  --client-id-list sts.amazonaws.com
```

**Note**: The thumbprint is automatically managed by AWS, so you don't need to specify it manually.

### Using AWS Console

1. Navigate to **IAM** → **Identity providers** → **Add provider**
2. Select **OpenID Connect**
3. **Provider URL**: `https://token.actions.githubusercontent.com`
4. **Audience**: `sts.amazonaws.com`
5. Click **Add provider**

### Verification

Verify the provider was created successfully:

```bash
aws iam list-open-id-connect-providers
```

## 2. Create IAM Role with Enhanced Security

Create `GitHubActionsRole` with proper trust policy and security controls.

### Basic Trust Policy

Create `trust-policy.json` for general repository access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:jaortiz123/Edgars-mobile-auto-shop:*"
        }
      }
    }
  ]
}
```

### Production Trust Policy (Recommended)

For enhanced security, restrict to specific branches and environments:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:jaortiz123/Edgars-mobile-auto-shop:ref:refs/heads/main",
            "repo:jaortiz123/Edgars-mobile-auto-shop:environment:production"
          ]
        }
      }
    }
  ]
}
```

### Create the role with AWS CLI:

```bash
# Save trust policy to file
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": [
          "repo:jaortiz123/Edgars-mobile-auto-shop:ref:refs/heads/main",
          "repo:jaortiz123/Edgars-mobile-auto-shop:ref:refs/heads/*",
          "repo:jaortiz123/Edgars-mobile-auto-shop:ref:refs/tags/*"
        ]
      }
    }
  }]
}
EOF

# Replace YOUR_ACCOUNT_ID with actual account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i.bak "s/<YOUR_ACCOUNT_ID>/$ACCOUNT_ID/g" trust-policy.json

# Create the role
aws iam create-role \
  --role-name GitHubDeployRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for GitHub Actions OIDC deployment"
```

## 3. Attach Required Policies

Based on your infrastructure needs:

```bash
# For ECS deployments
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

# For ECR (container registry)
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# For CloudWatch monitoring
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess

# For RDS (if needed for database operations)
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSReadOnlyAccess
```

## 4. Get Role ARN

```bash
# Get the role ARN for GitHub environment secrets
aws iam get-role --role-name GitHubDeployRole --query Role.Arn --output text
```

## 5. GitHub Workflow Integration

Add to your workflow file:

```yaml
permissions:
  id-token: write   # Required for OIDC
  contents: read

jobs:
  deploy:
    environment: production     # Use env protections
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/GitHubDeployRole
          aws-region: us-east-1

      # Smoke test
      - name: Verify AWS credentials
        run: aws sts get-caller-identity

      # Your deployment steps here
      - name: Deploy to ECS
        run: |
          echo "Deploy to production ECS..."
          # Add your deployment commands
```

## 6. GitHub Environment Setup

1. Go to repo **Settings** → **Environments**
2. Click **production** environment
3. Add **Environment secrets**:
   - `AWS_ROLE_ARN`: The ARN from step 4
   - `AWS_REGION`: `us-east-1` (or your preferred region)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401/403 from AWS | Trust policy `sub` filter too strict or wrong `aud` |
| "No credentials" error | Missing `permissions: id-token: write` |
| Branch protection blocking | Required context name ≠ job name/ID |
| AssumeRoleWithWebIdentity failed | Check trust policy conditions |

## Security Notes

- ✅ **Short-lived tokens**: Credentials expire automatically
- ✅ **Least privilege**: Only attach required policies
- ✅ **Branch restrictions**: Limited to specific branches/tags
- ✅ **Audit trail**: All actions logged in CloudTrail
- ✅ **No long-lived credentials**: No access keys to rotate

## Testing

Once configured, test with:

```bash
# In GitHub Actions
aws sts get-caller-identity
aws ecs list-clusters
```

This should return your AWS account details and ECS clusters without any credential configuration in your workflow.
