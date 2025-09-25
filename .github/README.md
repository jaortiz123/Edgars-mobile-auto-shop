# GitHub Actions Configuration - P7 CI/CD Gates

## Required Secrets

Configure these secrets in your GitHub repository settings:

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - AWS access key for deployment
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for deployment

### Security Scanning (Optional)
- `SNYK_TOKEN` - Snyk token for vulnerability scanning (optional)

## Workflow Overview

The CI/CD pipeline consists of 4 main jobs:

### 1. Fast Test Suite (<10min)
- **Triggers**: Push to main/develop, PRs to main
- **Timeout**: 10 minutes maximum
- **Tests**:
  - Python linting (flake8)
  - Python formatting (black)
  - Frontend linting (ESLint)
  - TypeScript type checking
  - Python unit tests (pytest)
  - Frontend unit tests (vitest)
  - Frontend build verification

### 2. Security Scanning
- **Dependencies**: Requires fast-tests to pass
- **Scans**:
  - Snyk vulnerability scanning (Python)
  - npm audit (Node.js)
  - TruffleHog secret detection

### 3. Staging Deployment
- **Triggers**: Push to develop branch only
- **Dependencies**: fast-tests + security-scan must pass
- **Actions**:
  - Build and push Docker image to ECR
  - Deploy to staging Lambda function
  - Run basic smoke tests

### 4. Production Deployment
- **Triggers**: Push to main branch only
- **Dependencies**: fast-tests + security-scan must pass
- **Protection**: Requires manual approval (GitHub Environment)
- **Actions**:
  - Build and push production Docker image
  - Deploy to production Lambda function
  - Create GitHub release with deployment details

## Configuration Files

### Workflow Definition
- `.github/workflows/ci-cd.yml` - Main CI/CD pipeline

### Test Configuration
- `backend/tests/test_fast_suite.py` - Fast backend tests
- `frontend/package.json` - Added `type-check` script

## Setup Instructions

### 1. Configure AWS Credentials
```bash
# Create IAM user with deployment permissions
aws iam create-user --user-name github-actions-deploy

# Attach required policies (ECR, Lambda, etc.)
aws iam attach-user-policy --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# Create access keys
aws iam create-access-key --user-name github-actions-deploy
```

### 2. Add GitHub Secrets
1. Go to repository Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `SNYK_TOKEN` (optional)

### 3. Configure Production Environment
1. Go to Settings → Environments
2. Create environment named "production"
3. Add protection rules:
   - Required reviewers
   - Wait timer (optional)
   - Deployment branches (main only)

## Branch Strategy

### Main Branch (Production)
- Protected branch requiring PR reviews
- Automatic deployment to production (with approval gate)
- Creates versioned releases

### Develop Branch (Staging)
- Automatic deployment to staging environment
- Integration testing environment
- No manual approval required

### Feature Branches
- Run fast tests + security scans only
- No deployment until merged

## Quality Gates

### Test Requirements
- All linting must pass (zero warnings in CI mode)
- All unit tests must pass
- TypeScript compilation must succeed
- Build process must complete successfully

### Security Requirements
- No high-severity vulnerabilities (Snyk)
- No high-risk npm audit findings
- No hardcoded secrets detected

### Performance Requirements
- Test suite must complete within 10 minutes
- Build process should be optimized for CI

## Monitoring

The workflow provides:
- Real-time test results in GitHub PR checks
- Deployment status notifications
- Release notes with commit details
- ECR image tagging with commit SHA

## Troubleshooting

### Common Issues

**Tests timeout**: Reduce test scope or optimize slow tests
**AWS permissions**: Verify IAM user has required policies
**ECR push fails**: Check repository exists and permissions
**Lambda deploy fails**: Verify function name and region

### Debug Commands
```bash
# Test workflow locally with act
act -j fast-tests

# Check AWS permissions
aws sts get-caller-identity

# Verify ECR access
aws ecr describe-repositories
```

## Files Added
- `.github/workflows/ci-cd.yml` - CI/CD pipeline
- `backend/tests/test_fast_suite.py` - Fast test suite
- `.github/README.md` - This documentation

## Next Steps (P8)
After P7 is complete:
1. Test the workflow with a sample PR
2. Verify staging deployment works
3. Test production deployment gate
4. Document release process
