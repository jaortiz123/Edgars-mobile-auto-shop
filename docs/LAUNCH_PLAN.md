# Launch Cutover Procedure

This document outlines the production cutover steps for Edgar's Mobile Auto Shop.

## 1. Pre-Launch Verification
- **Load Test**: Run `npm run load-test` or use Artillery to simulate typical traffic.
- **Security Scan**: Execute OWASP ZAP against the staging endpoint.
- **UAT Sign-Off**: Have the UAT user account confirm major workflows.

## 2. DNS Cutover
- Update Route53 records so the public domain points to CloudFront and the Application Load Balancer.
- Propagate DNS changes and verify the new endpoints resolve correctly.

## 3. Monitoring
- Review CloudWatch dashboards for error spikes or latency issues.
- Enable alarm notifications for 5xx errors, high latency, and elevated database CPU usage.

## 4. Deployment
- Trigger the GitHub Actions workflows to build and deploy the backend and frontend.
- After deployment, verify `/health` returns `OK` for the API and that the frontend loads.

## 5. Post-Launch
- Record initial TTFB and Lighthouse scores for performance benchmarks.
- Gather user feedback and track cost metrics in the AWS billing dashboard.
