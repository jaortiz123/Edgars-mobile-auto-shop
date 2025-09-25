# IAM Authentication Toggle for Edgar's Mobile Auto Shop

## Overview

The Status Board Lambda Function URL supports toggleable IAM authentication for enhanced security. By default, authentication is **DISABLED** (AuthType: NONE) for development convenience, but can be enabled for production security.

## Quick Start

```bash
# Check current status
python3 scripts/auth_toggle.py --function-name edgar-auto-shop-dev-flask-app status

# Enable IAM authentication with feature flags
python3 scripts/auth_toggle.py --function-name edgar-auto-shop-dev-flask-app enable-iam --with-flags

# Disable IAM authentication
python3 scripts/auth_toggle.py --function-name edgar-auto-shop-dev-flask-app disable-iam --with-flags

# Test authenticated requests
python3 scripts/test_iam_auth.py
```

## Authentication Modes

### 1. Open Access (AuthType: NONE)
- **Default state**: Wide open, no authentication required
- **Use case**: Development, testing, demo environments
- **Security**: ⚠️ Anyone with the URL can access
- **Feature flags**: `FEATURE_IAM_AUTH_ENABLED=false`

```bash
# Access directly with curl
curl https://function-url/healthz
```

### 2. IAM-Secured (AuthType: AWS_IAM)
- **Secured state**: Requires AWS SigV4 authentication
- **Use case**: Production, staging, controlled environments
- **Security**: ✅ Only authorized AWS identities can access
- **Feature flags**: `FEATURE_IAM_AUTH_ENABLED=true`

```bash
# Access requires AWS credentials and SigV4 signing
python3 scripts/test_iam_auth.py
```

## Feature Flags

The system uses environment variables for runtime behavior:

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `FEATURE_IAM_AUTH_ENABLED` | `true`/`false` | `false` | Controls IAM auth behavior in app code |
| `FEATURE_RATE_LIMITING_ENABLED` | `true`/`false` | `false` | Rate limiting (enabled with IAM) |
| `FEATURE_REQUEST_LOGGING_ENABLED` | `true`/`false` | `true` | Structured request logging |

## IAM Permissions

When IAM authentication is enabled, clients need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunctionUrl"
      ],
      "Resource": "arn:aws:lambda:us-west-2:*:function:edgar-auto-shop-dev-flask-app",
      "Condition": {
        "StringEquals": {
          "lambda:FunctionUrlAuthType": "AWS_IAM"
        }
      }
    }
  ]
}
```

## Client Integration

### Frontend Authentication

When IAM is enabled, frontend applications must:

1. **Use AWS SDK**: Configure with valid AWS credentials
2. **SigV4 signing**: Sign requests using AWS Signature Version 4
3. **Request headers**: Include proper `Authorization` header

Example JavaScript integration:

```javascript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";

const signer = new SignatureV4({
  service: "lambda",
  region: "us-west-2",
  credentials: awsCredentials,
  sha256: Sha256
});

const signedRequest = await signer.sign({
  method: "GET",
  protocol: "https",
  hostname: "function-url-id.lambda-url.us-west-2.on.aws",
  path: "/api/admin/appointments/board",
  headers: {
    "Content-Type": "application/json"
  }
});

fetch(signedRequest.url, {
  headers: signedRequest.headers
});
```

### Backend/Server Integration

Python example using boto3:

```python
import boto3
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

session = boto3.Session()
credentials = session.get_credentials()

request = AWSRequest(method="GET", url="https://function-url/healthz")
SigV4Auth(credentials, "lambda", "us-west-2").add_auth(request)

response = requests.get(request.url, headers=dict(request.headers))
```

## Security Considerations

### When to Enable IAM

- ✅ **Production environments**
- ✅ **Staging with real data**
- ✅ **Compliance requirements**
- ✅ **Multi-tenant scenarios**

### When Open Access is OK

- ✅ **Local development**
- ✅ **Demo environments**
- ✅ **Public APIs (with other auth)**
- ✅ **Testing/smoke tests**

### Best Practices

1. **Default Secure**: Enable IAM for production by default
2. **Feature Flags**: Use flags for gradual rollout
3. **Monitoring**: Watch CloudWatch alarms for auth failures
4. **Access Logs**: Monitor who's accessing the function
5. **Least Privilege**: Grant minimal IAM permissions needed

## Troubleshooting

### Common Issues

#### 403 Forbidden
```bash
curl https://function-url/healthz
{"Message":"Forbidden"}
```
- **Cause**: IAM authentication is enabled
- **Solution**: Use authenticated requests or disable IAM

#### SignatureDoesNotMatch
```
The request signature we calculated does not match the signature you provided
```
- **Cause**: Incorrect SigV4 signing
- **Solution**: Check credentials, region, service name

#### Propagation Delays
- **Issue**: Auth changes take 5-30 seconds to propagate
- **Solution**: Wait briefly after toggling authentication

### Verification Commands

```bash
# Check auth status
aws lambda get-function-url-config --function-name edgar-auto-shop-dev-flask-app

# Test unauthenticated (should fail if IAM enabled)
curl -w "HTTP:%{http_code}" https://function-url/healthz

# Test authenticated
python3 scripts/test_iam_auth.py

# Check CloudWatch logs for auth events
aws logs filter-log-events --log-group-name /aws/lambda/edgar-auto-shop-dev-flask-app --filter-pattern "Forbidden"
```

## Deployment Integration

### CI/CD Pipeline

```yaml
# Enable IAM for production
- name: Enable IAM Authentication
  if: env.ENVIRONMENT == 'production'
  run: |
    python3 scripts/auth_toggle.py \
      --function-name ${{ env.FUNCTION_NAME }} \
      enable-iam --with-flags

# Keep open for development
- name: Disable IAM Authentication
  if: env.ENVIRONMENT == 'development'
  run: |
    python3 scripts/auth_toggle.py \
      --function-name ${{ env.FUNCTION_NAME }} \
      disable-iam --with-flags
```

### Terraform Integration

```hcl
resource "aws_lambda_function_url" "flask_app_url" {
  function_name      = aws_lambda_function.flask_app.function_name
  authorization_type = var.enable_iam_auth ? "AWS_IAM" : "NONE"

  cors {
    allow_credentials = false
    allow_headers     = ["date", "keep-alive", "authorization"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    expose_headers    = ["date", "keep-alive"]
    max_age          = 86400
  }
}
```

## Monitoring & Alerting

### CloudWatch Metrics

- `AWS/Lambda/Invocations`: Total function calls
- `AWS/Lambda/Errors`: Authentication failures
- Custom metric: `AuthFailures` for 403 responses

### Recommended Alarms

```bash
# Monitor auth failures
aws cloudwatch put-metric-alarm \
  --alarm-name "StatusBoard-AuthFailures" \
  --alarm-description "High authentication failure rate" \
  --metric-name AuthFailures \
  --namespace Edgar/AutoShop \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## Summary

The IAM authentication toggle provides flexible security for Edgar's Status Board:

- **Default Open**: Development-friendly for rapid iteration
- **IAM Secured**: Production-ready with AWS native authentication
- **Feature Flags**: Runtime behavior control
- **Easy Toggle**: One-command enable/disable
- **Monitoring**: CloudWatch integration for visibility

This approach balances security needs with development velocity, enabling teams to work efficiently while maintaining production security standards.
