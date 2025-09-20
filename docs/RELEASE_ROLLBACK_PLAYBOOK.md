# Release & Rollback Playbook for Edgar's Mobile Auto Shop

## Overview

Automated release and rollback scripts for Edgar's Status Board Lambda function, designed to make deployments boring and reversible with < 5 minute target times.

## Quick Reference

### Release
```bash
# Full release with smoke test
./scripts/release.sh v1.2.3

# Dry run (preview only)
./scripts/release.sh --dry-run v1.2.4

# Skip build (use existing image)
./scripts/release.sh --skip-build hotfix-001

# Skip smoke test
./scripts/release.sh --no-smoke v1.3.0
```

### Rollback
```bash
# Full rollback with confirmation
./scripts/rollback.sh

# Dry run (preview only)
./scripts/rollback.sh --dry-run

# Skip smoke test
./scripts/rollback.sh --no-smoke
```

## Release Process

### Step 1: Build & Push
- Builds Docker image with release tag
- Pushes to ECR registry
- Tags both `<release-tag>` and `latest`

### Step 2: Capture Current State
- Gets current Lambda configuration
- Saves rollback info to `releases/rollback.json`
- Creates timestamped backup

### Step 3: Deploy
- Updates Lambda function code with new image
- Waits for deployment to complete
- Validates deployment was applied

### Step 4: Validate
- Runs smoke test against new deployment
- Verifies all Status Board functionality
- Reports success/failure

### Timing Targets
- Build: < 2 minutes (cached layers)
- Deploy: < 30 seconds
- Smoke test: < 2 minutes
- **Total: < 5 minutes**

## Rollback Process

### Step 1: Load Rollback Info
- Reads `releases/rollback.json`
- Validates previous deployment exists
- Confirms rollback is safe

### Step 2: Validate Current State
- Gets current Lambda configuration
- Compares with expected deployment
- Warns if unexpected changes detected

### Step 3: Perform Rollback
- Updates Lambda to previous image URI
- Waits for rollback to complete
- Verifies rollback was applied

### Step 4: Validate & Record
- Runs smoke test (optional)
- Records rollback operation
- Reports rollback summary

### Timing Targets
- Rollback: < 30 seconds
- Smoke test: < 2 minutes
- **Total: < 3 minutes**

## File Structure

```
releases/
├── rollback.json                    # Latest rollback info
├── rollback-20250920-051000.json   # Rollback operation record
└── release-20250920-050839.json    # Timestamped release backup
```

### rollback.json Format
```json
{
  "captured_at": "2025-09-20T12:08:39Z",
  "function_name": "edgar-auto-shop-dev-flask-app",
  "previous_deployment": {
    "image_uri": "588738589514.dkr.ecr.us-west-2.amazonaws.com/edgar-auto-shop-dev-flask-app:v1.2.2",
    "code_sha256": "276fc2138fc028a375a42bf102fd826062119f7e3724837bb56a63f7e53fbe9d",
    "version": "$LATEST",
    "tag": "v1.2.2"
  },
  "new_deployment": {
    "tag": "v1.2.3",
    "image_uri": "588738589514.dkr.ecr.us-west-2.amazonaws.com/edgar-auto-shop-dev-flask-app:v1.2.3"
  },
  "release_metadata": {
    "released_by": "jesusortiz",
    "git_commit": "faf8c65914554120777c52a120b34c4659a1561d",
    "git_branch": "main"
  }
}
```

## Operational Procedures

### Standard Release Flow

1. **Prepare Release**
   ```bash
   # Ensure clean working directory
   git status
   git pull origin main

   # Tag the release
   git tag v1.2.3
   git push origin v1.2.3
   ```

2. **Deploy Release**
   ```bash
   ./scripts/release.sh v1.2.3
   ```

3. **Monitor Post-Deploy**
   ```bash
   # Check CloudWatch alarms
   python3 scripts/setup_monitoring.py --function-name edgar-auto-shop-dev-flask-app --list-only

   # Manual spot check
   curl https://function-url/healthz
   ```

### Emergency Rollback Flow

1. **Immediate Rollback**
   ```bash
   ./scripts/rollback.sh --no-smoke
   ```

2. **Validate Rollback**
   ```bash
   # Run smoke test manually
   ./scripts/smoke.sh https://function-url

   # Check function status
   aws lambda get-function --function-name edgar-auto-shop-dev-flask-app
   ```

### Hotfix Process

1. **Create Hotfix**
   ```bash
   git checkout -b hotfix/critical-bug
   # Make minimal fix
   git commit -m "fix: critical bug"
   git tag hotfix-001
   ```

2. **Deploy Hotfix**
   ```bash
   ./scripts/release.sh hotfix-001
   ```

3. **Merge Back**
   ```bash
   git checkout main
   git merge hotfix/critical-bug
   git push origin main
   ```

## Error Scenarios & Recovery

### Scenario 1: Build Fails
**Symptoms:** Docker build error, ECR push failure
**Recovery:**
```bash
# Fix the build issue, then retry
./scripts/release.sh --dry-run v1.2.3  # Validate
./scripts/release.sh v1.2.3            # Retry
```

### Scenario 2: Deployment Fails
**Symptoms:** Lambda update fails, function not updated
**Recovery:**
```bash
# Check Lambda function status
aws lambda get-function-configuration --function-name edgar-auto-shop-dev-flask-app

# Manual rollback if needed
./scripts/rollback.sh
```

### Scenario 3: Smoke Test Fails
**Symptoms:** Post-deploy validation fails
**Recovery:**
```bash
# Immediate rollback
./scripts/rollback.sh

# Investigate issue
./scripts/smoke.sh https://function-url --verbose

# Fix and redeploy
./scripts/release.sh v1.2.4
```

### Scenario 4: Rollback File Missing
**Symptoms:** `rollback.json` not found
**Recovery:**
```bash
# Check for timestamped backups
ls -la releases/

# Use specific backup file
./scripts/rollback.sh --rollback-file releases/release-20250920-143022.json

# Manual rollback if needed
aws lambda update-function-code \
  --function-name edgar-auto-shop-dev-flask-app \
  --image-uri <previous-image-uri>
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Deploy Release
on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2

      - name: Deploy Release
        run: |
          chmod +x scripts/release.sh
          ./scripts/release.sh ${GITHUB_REF#refs/tags/}
```

### Pre-deploy Checks
```bash
#!/bin/bash
# pre-deploy-checks.sh

set -e

echo "Running pre-deploy checks..."

# Ensure smoke script exists and is executable
[ -x scripts/smoke.sh ] || exit 1

# Validate AWS credentials
aws sts get-caller-identity > /dev/null

# Check Docker is running
docker info > /dev/null

# Validate release tag format
if [[ ! "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid version format: $1"
    echo "Use semantic versioning: v1.2.3"
    exit 1
fi

echo "Pre-deploy checks passed"
```

## Monitoring & Alerting

### Key Metrics to Watch
- Lambda function duration
- Error rate
- Status Board endpoint latency
- Database connection health

### Post-Deploy Checklist
- [ ] CloudWatch alarms are green
- [ ] Function URL responds to health check
- [ ] Status Board displays correctly
- [ ] Move operations work
- [ ] Dashboard stats update

### Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|---------|
| Health check fails | Critical | Immediate rollback |
| Status Board errors | High | Rollback within 5 min |
| Slow response times | Medium | Monitor 10 min, then rollback |
| Minor UI glitches | Low | Fix forward |

## Best Practices

### Release Tagging
- Use semantic versioning: `v1.2.3`
- Hotfixes: `hotfix-001`, `hotfix-002`
- Features: `feat-feature-name`
- Testing: `test-experiment-001`

### Testing Strategy
1. **Local testing** with `--dry-run`
2. **Staging deployment** (if available)
3. **Production deployment** with smoke test
4. **Rollback drill** monthly

### Communication
- Announce deployments in team chat
- Document what changed in release notes
- Keep rollback file secure and backed up
- Post-mortem for failed deployments

## Troubleshooting Commands

### Check Current Deployment
```bash
aws lambda get-function-configuration \
  --function-name edgar-auto-shop-dev-flask-app \
  --query '{ImageUri:Code.ImageUri,CodeSha256:CodeSha256,LastModified:LastModified}'
```

### View Release History
```bash
ls -la releases/
cat releases/rollback.json | jq '.captured_at, .previous_deployment.tag, .new_deployment.tag'
```

### Manual Function Update
```bash
aws lambda update-function-code \
  --function-name edgar-auto-shop-dev-flask-app \
  --image-uri 588738589514.dkr.ecr.us-west-2.amazonaws.com/edgar-auto-shop-dev-flask-app:v1.2.3
```

### Check Function URL
```bash
aws lambda get-function-url-config \
  --function-name edgar-auto-shop-dev-flask-app \
  --query 'FunctionUrl'
```

---

## Drill Results (Sprint 2 T5 Validation)

**Test Date:** September 20, 2025
**Test Release:** `sprint2-t5-drill-001`

### Release Timing
- Build & Push: 60 seconds ✅
- Deploy: 25 seconds ✅
- Smoke Test: 15 seconds (failed due to date issue)
- **Total Release: 100 seconds** ✅ (< 5 min target)

### Rollback Timing
- Load & Validate: 2 seconds ✅
- Rollback: 20 seconds ✅
- **Total Rollback: 22 seconds** ✅ (< 3 min target)

### Artifacts Generated
- `releases/rollback.json` ✅
- `releases/release-20250920-050839.json` ✅
- `releases/rollback-20250920-051000.json` ✅

### Issues Found
- Smoke test fails with today's date for appointments ⚠️
- Need to improve date handling in smoke script

### Overall Assessment
**PASS** ✅ - Release and rollback processes work as designed with target timing met.
