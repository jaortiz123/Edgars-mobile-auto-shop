# Development Environment Setup - P5 IAM + SigV4 Proxy

## Overview
Sprint 3 P5 enables IAM authentication on the Lambda Function URL and provides a local SigV4 proxy for development.

## What Changed
- ✅ **IAM Auth Enabled**: Lambda Function URL now requires AWS IAM authentication
- ✅ **SigV4 Proxy**: Local development proxy handles signing automatically
- ✅ **CORS Headers**: Proxy adds proper CORS for frontend development

## Usage

### Start Development Proxy
```bash
# Start proxy on default port 8080
./dev-proxy/start-proxy.sh

# Or specify custom port
./dev-proxy/start-proxy.sh 3001
```

### Test API Through Proxy
```bash
# Dashboard stats
curl "http://localhost:8080/api/admin/dashboard/stats"

# Board data
curl "http://localhost:8080/api/admin/appointments/board?from=2025-09-21&to=2025-09-21"

# All endpoints work the same, just use localhost:8080 instead of Lambda URL
```

### Frontend Development
Update your frontend API base URL to use the proxy:

```javascript
// Before (direct Lambda URL - now requires IAM)
const API_BASE = 'https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws'

// After (development proxy)
const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8080'
  : 'https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws'
```

## Architecture

```
Frontend (localhost:3000)
    ↓ API calls
SigV4 Proxy (localhost:8080)
    ↓ AWS SigV4 signed requests
Lambda Function URL (IAM protected)
    ↓ Response
Backend Flask App
```

## Security Benefits
- **Production Security**: API now requires proper AWS IAM authentication
- **Development Ease**: Proxy handles AWS signing automatically
- **Credential Isolation**: Uses local AWS credentials for development

## Requirements
- AWS credentials configured (`aws configure` or IAM roles)
- Python 3.7+ with `boto3` and `requests` packages

## Troubleshooting

### Proxy Won't Start
```bash
# Check AWS credentials
aws sts get-caller-identity

# Install dependencies
pip3 install boto3 requests
```

### 403 Forbidden
- Direct Lambda URL calls now require IAM auth
- Use the proxy for development: `http://localhost:8080`
- For production, implement proper IAM authentication in client

## Files Added
- `dev-proxy/sigv4_proxy.py` - SigV4 signing proxy server
- `dev-proxy/start-proxy.sh` - Convenience start script
- `dev-proxy/README.md` - This documentation
