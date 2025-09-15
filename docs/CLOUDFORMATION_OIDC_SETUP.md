# CloudFormation Template for AWS OIDC Setup

This CloudFormation template provides a complete, production-ready setup for AWS OIDC integration with GitHub Actions, based on Amazon Q's best practices.

## Template Features

✅ **OIDC Provider**: Automatically creates GitHub OIDC identity provider
✅ **IAM Role**: Creates properly configured role with least privilege
✅ **Security Controls**: Branch and environment restrictions
✅ **Permissions Policy**: ECS, ECR, and CloudWatch access for deployments
✅ **Monitoring**: CloudTrail integration for audit logging

## CloudFormation Template

Save this as `github-oidc-setup.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AWS OIDC setup for GitHub Actions - Edgar''s Auto Shop'

Parameters:
  GitHubOrg:
    Type: String
    Default: 'jaortiz123'
    Description: 'GitHub organization or username'

  GitHubRepo:
    Type: String
    Default: 'Edgars-mobile-auto-shop'
    Description: 'GitHub repository name'

  EnvironmentName:
    Type: String
    Default: 'production'
    AllowedValues: ['production', 'staging', 'development']
    Description: 'Environment name for role scoping'

Resources:
  # OIDC Identity Provider
  GitHubOIDCProvider:
    Type: AWS::IAM::OIDCProvider
    Properties:
      Url: 'https://token.actions.githubusercontent.com'
      ClientIdList:
        - 'sts.amazonaws.com'
      ThumbprintList:
        - '6938fd4d98bab03faadb97b34396831e3780aea1'
      Tags:
        - Key: 'Purpose'
          Value: 'GitHub Actions OIDC Authentication'
        - Key: 'Repository'
          Value: !Sub '${GitHubOrg}/${GitHubRepo}'

  # IAM Role for GitHub Actions
  GitHubActionsRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'GitHubActions-${GitHubRepo}-${EnvironmentName}'
      Description: !Sub 'OIDC role for ${GitHubOrg}/${GitHubRepo} ${EnvironmentName} deployments'
      MaxSessionDuration: 3600  # 1 hour maximum
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: 'Allow'
            Principal:
              Federated: !Ref GitHubOIDCProvider
            Action: 'sts:AssumeRoleWithWebIdentity'
            Condition:
              StringEquals:
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
              StringLike:
                'token.actions.githubusercontent.com:sub':
                  - !Sub 'repo:${GitHubOrg}/${GitHubRepo}:ref:refs/heads/main'
                  - !Sub 'repo:${GitHubOrg}/${GitHubRepo}:environment:${EnvironmentName}'
      Tags:
        - Key: 'Purpose'
          Value: 'GitHub Actions Deployment'
        - Key: 'Repository'
          Value: !Sub '${GitHubOrg}/${GitHubRepo}'
        - Key: 'Environment'
          Value: !Ref EnvironmentName

  # Deployment Permissions Policy
  GitHubActionsDeploymentPolicy:
    Type: AWS::IAM::Policy
    Properties:
      PolicyName: !Sub 'GitHubActions-${GitHubRepo}-DeploymentPolicy'
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          # ECR Permissions
          - Effect: 'Allow'
            Action:
              - 'ecr:GetAuthorizationToken'
              - 'ecr:BatchCheckLayerAvailability'
              - 'ecr:GetDownloadUrlForLayer'
              - 'ecr:BatchGetImage'
              - 'ecr:InitiateLayerUpload'
              - 'ecr:UploadLayerPart'
              - 'ecr:CompleteLayerUpload'
              - 'ecr:PutImage'
            Resource: '*'

          # ECS Permissions
          - Effect: 'Allow'
            Action:
              - 'ecs:UpdateService'
              - 'ecs:DescribeServices'
              - 'ecs:DescribeTasks'
              - 'ecs:DescribeTaskDefinition'
              - 'ecs:RegisterTaskDefinition'
              - 'ecs:ListTasks'
            Resource: '*'

          # CloudWatch Logs
          - Effect: 'Allow'
            Action:
              - 'logs:CreateLogGroup'
              - 'logs:CreateLogStream'
              - 'logs:PutLogEvents'
              - 'logs:DescribeLogGroups'
              - 'logs:DescribeLogStreams'
            Resource: '*'

          # Pass Role for ECS Tasks
          - Effect: 'Allow'
            Action:
              - 'iam:PassRole'
            Resource:
              - !Sub 'arn:aws:iam::${AWS::AccountId}:role/ecsTaskExecutionRole'
              - !Sub 'arn:aws:iam::${AWS::AccountId}:role/*ECS*'
            Condition:
              StringEquals:
                'iam:PassedToService': 'ecs-tasks.amazonaws.com'
      Roles:
        - !Ref GitHubActionsRole

  # CloudWatch Log Group for Deployment Monitoring
  DeploymentLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/github-actions/${GitHubRepo}'
      RetentionInDays: 30
      Tags:
        - Key: 'Purpose'
          Value: 'GitHub Actions Deployment Logs'

Outputs:
  OIDCProviderArn:
    Description: 'ARN of the GitHub OIDC provider'
    Value: !Ref GitHubOIDCProvider
    Export:
      Name: !Sub '${AWS::StackName}-OIDCProvider'

  GitHubActionsRoleArn:
    Description: 'ARN of the GitHub Actions IAM role'
    Value: !GetAtt GitHubActionsRole.Arn
    Export:
      Name: !Sub '${AWS::StackName}-GitHubActionsRole'

  RoleName:
    Description: 'Name of the GitHub Actions IAM role'
    Value: !Ref GitHubActionsRole

  LogGroupName:
    Description: 'CloudWatch Log Group for deployment monitoring'
    Value: !Ref DeploymentLogGroup
```

## Deployment Instructions

### 1. Deploy with AWS CLI

```bash
# Deploy the CloudFormation stack
aws cloudformation deploy \
  --template-file github-oidc-setup.yaml \
  --stack-name edgars-auto-shop-github-oidc \
  --parameter-overrides \
    GitHubOrg=jaortiz123 \
    GitHubRepo=Edgars-mobile-auto-shop \
    EnvironmentName=production \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags \
    Project=EdgarsAutoShop \
    Environment=Production \
    ManagedBy=CloudFormation

# Get the role ARN for GitHub secrets
aws cloudformation describe-stacks \
  --stack-name edgars-auto-shop-github-oidc \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
  --output text
```

### 2. Deploy with AWS Console

1. Go to **CloudFormation** → **Create stack** → **With new resources**
2. Upload the `github-oidc-setup.yaml` template
3. Set parameters:
   - **GitHubOrg**: `jaortiz123`
   - **GitHubRepo**: `Edgars-mobile-auto-shop`
   - **EnvironmentName**: `production`
4. Check **"I acknowledge that AWS CloudFormation might create IAM resources with custom names"**
5. Click **Create stack**

### 3. Verify Deployment

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name edgars-auto-shop-github-oidc \
  --query 'Stacks[0].StackStatus'

# List all outputs
aws cloudformation describe-stacks \
  --stack-name edgars-auto-shop-github-oidc \
  --query 'Stacks[0].Outputs'
```

## Security Best Practices Implemented

### 🔐 **Least Privilege Access**
- Specific ECS, ECR, and CloudWatch permissions only
- No broad `*` permissions except where required by AWS services
- Pass role restrictions to ECS services only

### 🎯 **Scope Restrictions**
- Repository-specific access controls
- Branch and environment limitations
- Maximum session duration of 1 hour

### 📊 **Monitoring & Auditing**
- CloudWatch log group for deployment tracking
- CloudTrail integration (via IAM role usage)
- Comprehensive resource tagging

### 🔄 **Environment Isolation**
- Environment-specific role names
- Deployment scoping by environment
- Separate stacks for different environments

## Multi-Environment Setup

Deploy separate stacks for each environment:

```bash
# Production
aws cloudformation deploy \
  --template-file github-oidc-setup.yaml \
  --stack-name edgars-auto-shop-github-oidc-prod \
  --parameter-overrides EnvironmentName=production

# Staging
aws cloudformation deploy \
  --template-file github-oidc-setup.yaml \
  --stack-name edgars-auto-shop-github-oidc-staging \
  --parameter-overrides EnvironmentName=staging
```

This provides complete isolation between environments while maintaining consistent security policies.

---

**Next Step**: Use the role ARN from the CloudFormation output to configure your GitHub repository secrets (`AWS_ROLE_ARN`).
