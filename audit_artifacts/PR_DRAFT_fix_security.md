# fix(security): Remediate Critical IaC and App Config Findings

Summary

- Container runs as root (frontend/Dockerfile): added non-root user and dropped privileges.
- Unsafe Flask dev settings in entrypoints: gated debug and 0.0.0.0 by APP_ENV; production defaults to 127.0.0.1 and debug=False.
- ALB TLS enforcement: added HTTPS listener (443) with modern TLS policy and 301 HTTP→HTTPS redirect.
- ECR tag mutability: set to IMMUTABLE.
- DynamoDB at-rest encryption: enabled SSE.
- RDS safety and observability: storage encryption, CloudWatch log exports, Performance Insights, and enhanced monitoring.

Changes

- frontend/Dockerfile
  - Create non-root user (app) and switch to USER app
  - Ensure /app owned by app user

- backend/app_factory.py, minimal_test_server.py, security_test_server.py, test_server.py
  - Gate debug/host by APP_ENV; only dev/local allows debug and 0.0.0.0

- infrastructure/staging/alb.tf
  - HTTP listener now redirects to HTTPS with HTTP_301
  - New HTTPS listener on 443 with ssl_policy=ELBSecurityPolicy-TLS13-1-2-2021-06
  - Uses data "aws_acm_certificate" to resolve certificate ARN by domain

- infrastructure/staging/variables.tf
  - New variable domain_name used to look up ACM certificate

- infrastructure/staging/ecr.tf
  - image_tag_mutability set to IMMUTABLE

- infrastructure/main.tf
  - DynamoDB tables: server_side_encryption { enabled = true }
  - RDS: storage_encrypted=true, enabled_cloudwatch_logs_exports, performance_insights_enabled=true, monitoring_interval=60

Notes

- Provide a valid domain via var.domain_name that matches an ISSUED ACM certificate in the account/region.
- APP_ENV should be set to production in deployed environments to enforce safe Flask behavior.

Risk/Impact

- Dockerfile change is low risk and improves container isolation.
- Flask entrypoint gating prevents accidental debug exposure in production.
- ALB changes enforce TLS and redirect; requires certificate provisioning.
- ECR immutability strengthens supply-chain integrity.
- DynamoDB/RDS changes improve data protection and observability; RDS settings may incur small cost for monitoring/PI.

Validation

- Dependency scans: pip-audit clean; Safety clean after urllib3>=2.5.0.
- Secrets scan: no leaks (Gitleaks).
- SAST: Bandit SQLi flags verified as false positives in core paths; documented.
