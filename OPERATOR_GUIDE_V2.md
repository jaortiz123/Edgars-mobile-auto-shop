# Sprint 6 Launch Automation – Operator Guide

*Operator-focused, copy‑pasteable runbook for deploying **StatusBoardV2** to staging and production with feature‑flag canary, monitoring, and rollback.*

---

## 0) Prerequisites

* **CLI tools:** `aws`, `jq`, `curl`, `node >= 18`, `npm`, `bash`
* **AWS auth:** Valid credentials in your shell (e.g., `AWS_PROFILE` or env vars)
* **Network:** Access to staging/prod endpoints and CloudFront
* **Repo root:** Run commands from `Edgars-mobile-auto-shop/`

### Environment variables

Export these once per session (adjust to your env):

```bash
export STAGING_URL=https://staging.edgarsautoshop.com
export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export S3_BUCKET=edgar-mobile-auto-shop
export CLOUDFRONT_DIST_ID=E1234567890123
```

> **Common fix:** If you see `package-lock.json` issues, run: `cd frontend && npm install && cd ..`

---

## 1) Quick Start (Happy Path)

```bash
# Validate everything (smoke + infra + flags)
./execute-launch-playbook.sh validate

# Run the full 14‑step guided launch
./execute-launch-playbook.sh interactive

# Or run non‑interactive with auto‑proceed
AUTO_CONFIRM=true ./execute-launch-playbook.sh auto
```

Outputs are summarized at the end with PASS/FAIL gates and next actions.

---

## 2) Staging Deploy

### Build & push to staging (S3 + CloudFront)

```bash
./deploy-staging.sh
```

**What it does:**
* Builds frontend with staging environment config
* Uploads to S3 with proper cache headers
* Creates deployment manifest with timestamp
* Invalidates CloudFront distribution

**Verify deployment:**
```bash
curl -sSf "$STAGING_URL" && echo "✅ Staging accessible"
```

---

## 3) Staging Smoke Tests

```bash
# Quick validation (essential checks only)
./staging-smoke-tests.sh

# Alternative: if you added modes to the script
./staging-smoke-tests.sh full    # comprehensive test suite
```

**Test coverage:**
* **Infrastructure:** Site accessibility, asset loading, headers
* **API Endpoints:** Board data, stats, appointment details, move operations
* **Feature Detection:** StatusBoardV2 components, drag & drop flow
* **Performance:** Board < 800ms p95, Drawer < 200ms avg
* **Error Handling:** OCC conflicts, retry mechanisms, user feedback
* **Security:** CORS headers, no secrets exposed, proper authentication

**Artifacts:** Test results with timestamps in workspace root

---

## 4) Feature‑Flag Canary

### Initialize and start rollout

```bash
# Setup canary infrastructure
./canary-rollout.sh init

# Start auto progression: 10 → 30 → 50 → 100 with health checks
./canary-rollout.sh start
```

**Manual controls:**
```bash
./canary-rollout.sh monitor      # Real-time health dashboard
./canary-rollout.sh promote 50   # Manual stage advancement
./canary-rollout.sh rollback     # Emergency revert to 0%
```

**Safety gates:**
* Auto-rollback on error rate > 1%
* Auto-rollback on latency > 2000ms
* Health checks every 60 seconds
* Stage duration: 10 minutes per increment

---

## 5) Performance Monitoring

```bash
# Start real-time monitoring (separate terminal recommended)
./performance-monitor.sh start

# Monitor for specific duration
./performance-monitor.sh monitor 600    # 10 minutes

# Get current snapshot
./performance-monitor.sh dashboard      # Live metrics display
```

**Key metrics:**
* **Board Response Time:** p95 < 800ms (SLO)
* **Drawer Response Time:** avg < 200ms (SLO)
* **Error Rate:** < 1% (threshold)
* **OCC Conflicts:** < 30 per 5min (stability)

---

## 6) Rollback Procedures

### Instant rollback (recommended for emergencies)

```bash
# Disable StatusBoardV2 feature flag immediately
./rollback.sh emergency --reason "Performance degradation detected"
```

### Full deployment rollback

```bash
# Revert to previous S3 artifacts and CloudFront state
./rollback.sh full --reason "Critical bug in StatusBoardV2"
```

### Verify rollback success

```bash
./rollback.sh validate                  # Check system health post-rollback
./production-launch.sh status           # Verify production state
```

---

## 7) UAT Validation

```bash
# Initialize UAT framework with test checklist
./uat-validation.sh init

# Check current validation status
./uat-validation.sh status

# Run interactive test (example)
./uat-validation.sh test func_001

# Add stakeholder approval
./uat-validation.sh approve qa_lead "Jane Smith" approved "All tests pass"

# Generate final UAT report
./uat-validation.sh report
```

**UAT scope:**
* **Functional:** Board loading, drag & drop, drawer functionality
* **Performance:** Response time compliance, smooth interactions
* **Usability:** Intuitive interface, clear feedback, error recovery
* **Reliability:** Concurrent user handling, network error recovery
* **Integration:** Dashboard KPIs, legacy compatibility, feature flags

---

## 8) Production Launch

### Pre‑flight validation

```bash
# Check all prerequisites (UAT approval, AWS access, etc.)
./production-launch.sh validate
```

### Execute production deployment

```bash
# Complete production launch sequence
./production-launch.sh full-launch
```

**OR step-by-step:**
```bash
./production-launch.sh build       # Build production artifacts
./production-launch.sh deploy      # Deploy to production S3
./production-launch.sh rollout     # Gradual rollout: 5→15→25→50→75→100%
```

### Monitor production health

```bash
# Real-time production monitoring
./production-launch.sh monitor 600    # Monitor for 10 minutes
```

---

## 9) Complete Orchestrated Launch

### Execute the full 14‑step playbook

```bash
# Validate all scripts and prerequisites
./execute-launch-playbook.sh validate

# Interactive guided launch (recommended)
./execute-launch-playbook.sh interactive

# Automated pipeline mode (CI/CD)
AUTO_CONFIRM=true SKIP_UAT_INTERACTIVE=true ./execute-launch-playbook.sh auto
```

**The 14 steps include:**
1. Pre-flight checklist validation
2. Staging deployment
3. Staging smoke tests
4. UAT initialization
5. UAT execution (interactive)
6. Canary rollout setup
7. Performance monitoring activation
8. Production validation
9. Production build & deploy
10. Gradual production rollout
11. SLO validation
12. Rollback procedure testing
13. Final system validation
14. Launch completion & reporting

---

## 10) Troubleshooting

### Build / npm errors
```bash
# Fix package-lock.json issues
cd frontend && npm install && cd ..
./deploy-staging.sh
```

### 404s / stale assets after deploy
```bash
# Force CloudFront invalidation
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
```

### Production health check failures
```bash
# Check if production endpoints are accessible
curl -v "$PROD_URL"
curl -v "$PROD_URL/api/health"

# Verify AWS credentials and S3 access
aws s3 ls s3://$S3_BUCKET
```

### Performance SLO violations
```bash
# Check current metrics
./performance-monitor.sh dashboard

# If violations persist, rollback immediately
./rollback.sh emergency --reason "SLO breach detected"
```

### Feature flag issues
```bash
# Check current feature flag status
curl -s "$STAGING_URL/api/admin/feature-flags" | jq .

# Manual feature flag disable
./rollback.sh emergency
```

### UAT approval workflow stuck
```bash
# Check current UAT status
./uat-validation.sh status

# Review test checklist
./uat-validation.sh checklist

# Check sign-offs
./uat-validation.sh signoffs
```

---

## 11) Command Reference

### Core Deployment Commands
```bash
./deploy-staging.sh                        # Deploy to staging
./staging-smoke-tests.sh                   # Run validation tests
./uat-validation.sh init                   # Initialize UAT framework
./production-launch.sh full-launch         # Complete production deployment
```

### Monitoring Commands
```bash
./performance-monitor.sh start             # Real-time monitoring
./canary-rollout.sh monitor               # Canary health dashboard
./production-launch.sh monitor 300        # Production monitoring
```

### Emergency Commands
```bash
./rollback.sh emergency                   # Instant feature flag disable
./rollback.sh full                       # Complete rollback
./rollback.sh validate                   # Verify rollback success
```

### Orchestration Commands
```bash
./execute-launch-playbook.sh validate     # Check prerequisites
./execute-launch-playbook.sh interactive  # Guided full launch
./execute-launch-playbook.sh auto         # Automated launch
```

### Status & Reporting Commands
```bash
./uat-validation.sh status                # UAT progress
./production-launch.sh status             # Production health
./canary-rollout.sh status               # Canary rollout progress
./uat-validation.sh report               # Generate UAT report
./production-launch.sh report            # Production launch report
```

---

## 12) Acceptance Gates (Pass/Fail)

### Staging Gates
- [ ] **Deployment:** Staging site accessible, assets loading correctly
- [ ] **Smoke Tests:** All test suites PASS, no 5xx errors
- [ ] **Performance:** Board p95 < 800ms, Drawer avg < 200ms
- [ ] **Feature Detection:** StatusBoardV2 components render correctly

### UAT Gates
- [ ] **Functionality:** All critical user flows work as expected
- [ ] **Stakeholder Approval:** Minimum 2 approvals from required roles
- [ ] **Performance:** User-perceived performance meets expectations
- [ ] **Integration:** Dashboard KPIs update correctly

### Production Gates
- [ ] **Pre-flight:** All prerequisites validated, UAT approved
- [ ] **Deployment:** Production deployment successful, health checks pass
- [ ] **Rollout:** Gradual rollout completes without SLO violations
- [ ] **Stability:** 30+ minutes stable operation at 100% rollout

### Emergency Gates
- [ ] **Rollback Ready:** Emergency procedures tested and verified
- [ ] **Monitoring Active:** Real-time dashboards operational
- [ ] **On-call Prepared:** Team notified and ready to respond

---

## 13) Configuration Notes

### Feature Flags
* **Primary Flag:** `STATUS_BOARD_V2_ENABLED` (gradual rollout)
* **Component Flags:** Drag & drop, drawer, performance monitoring
* **Default State:** All flags OFF in production initially

### Environment Configuration
* **Staging:** Uses staging API endpoints, debug logging enabled
* **Production:** Production API, minimal logging, error tracking
* **Preview/Development:** Local SigV4 proxy on port 8080

### Performance Thresholds
* **Board Load Time:** p95 < 800ms (critical SLO)
* **Drawer Open Time:** average < 200ms (critical SLO)
* **Error Rate:** < 1% (rollback trigger)
* **OCC Conflict Rate:** < 30 per 5 minutes (stability indicator)

### Artifacts & Logging
* **Deployment Logs:** Timestamped in workspace root
* **Test Reports:** JSON + summary formats
* **UAT Data:** Stored in `uat-data/` directory
* **Performance Metrics:** Real-time dashboards + historical data

---

## 14) Emergency Contacts & Escalation

### Primary Contacts
* **Release Owner:** Jesus Ortiz
* **On-call Engineer:** [TBD]
* **QA Lead:** [TBD]
* **Product Owner:** [TBD]

### Communication Channels
* **Primary:** `#releases` Slack channel
* **Alerts:** `#alerts` Slack channel
* **Escalation:** `#statusboard-emergency` Slack channel

### Escalation Procedures
1. **Level 1:** Performance degradation → Auto-rollback triggers
2. **Level 2:** Manual rollback required → On-call engineer notified
3. **Level 3:** Complete system impact → Leadership escalation

---

**This guide provides battle-tested, copy-pasteable commands for safe StatusBoardV2 deployment. Keep it handy during launches! 🚀**
