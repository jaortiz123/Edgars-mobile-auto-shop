# Disaster Recovery Plan

This document outlines steps to recover the production environment.

1. **RDS Recovery**
   - Automated snapshots are retained for seven days.
   - Restore the most recent snapshot and update the `DATABASE_URL` secret.

2. **ECS Service**
   - Task definitions are stored in the cluster.
   - Redeploy the latest task definition and scale the service as required.

3. **S3 and CloudFront**
   - Static assets in S3 are versioned.
   - Replicate or restore the bucket if needed and invalidate CloudFront caches.

4. **DNS and Failover**
   - CloudFront distributions are globally available. If a new distribution is created, update DNS records.

5. **Verification**
   - After recovery, check the `/health` endpoint and monitor CloudWatch dashboards.
