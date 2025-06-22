# Security Review Checklist

Use this list to perform a quick OWASP-style review before deployment.

- [ ] Verify all dependencies are up to date (`npm audit`)
- [ ] Ensure HTTPS is enforced via ALB and CloudFront
- [ ] Confirm CORS and rate limiting are enabled in the API
- [ ] Review IAM roles for least privilege
- [ ] Scan with OWASP ZAP against the staging site

