# Sprint 6 Launch Automation – Operator Guide

A hands‑on, copy‑pasteable guide for deploying **StatusBoardV2** to **staging** and **production** using the new automation suite. Includes smoke tests, canary rollout, monitoring, and rollback.

---

## 0) Prerequisites

* **CLI Tools**: `aws`, `jq`, `curl`, `bash`, `npm` (for frontend builds)
* **AWS Profile**: authenticated to staging + prod accounts
* **Environment Variables** (set once per shell):

```bash
export AWS_PROFILE=default
export AWS_REGION=us-west-2
export STAGING_URL=https://staging.edgarsautoshop.com
export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export S3_BUCKET=edgar-mobile-auto-shop
export CLOUDFRONT_DIST_ID=E1234567890123
```

* **Repository Root**: `/Users/jesusortiz/Edgars-mobile-auto-shop`

---

## 1) Staging Deploy

**Goal:** Publish the latest build to staging with environment config.

```bash
# Full staging deployment (builds, uploads, invalidates CF)
./deploy-staging.sh

# Quick health validation
./staging-smoke-tests.sh quick
```

**Expected:** All checks ✅; board < 800ms p95; drawer < 200ms avg.

### Troubleshooting

* **403/404 after deploy** → Check S3 bucket permissions and CloudFront distribution
* **npm ci failure** → Run `npm install` first to generate package-lock.json
* **Wrong API base URL** → Verify environment variables are set correctly

**Fix package-lock.json issue:**
```bash
cd frontend && npm install && cd ..
./deploy-staging.sh
```

---

## 2) Staging Validation Suite

**Quick validation (essential checks only):**
```bash
./staging-smoke-tests.sh quick
```

**Full validation (runs all test suites):**
```bash
./staging-smoke-tests.sh full
```

**Test suites included:**

* **Infrastructure**: S3/CloudFront accessibility, headers, caching
* **API Endpoints**: board, stats, appointment details, move operations
* **Feature Detection**: StatusBoardV2 feature flag, drag & drop flow
* **Performance**: Board/drawer SLO compliance (<800ms/<200ms)
* **Error Handling**: OCC 409 conflict handling, network resilience
* **Security**: CORS headers, no secrets in HTML, IAM proxy validation

**Artifacts:** Test logs and reports saved to workspace root with timestamps

---

## 3) UAT – Stakeholder Sign‑off

**Initialize UAT framework:**
```bash
./uat-validation.sh init      # Creates checklist + approval tracking
```

**Check UAT status:**
```bash
./uat-validation.sh status    # Shows progress + pending approvals
```

**Run individual tests:**
```bash
./uat-validation.sh test func_001    # Interactive test execution
```

**Add stakeholder approvals:**
```bash
./uat-validation.sh approve qa_lead "Jane Smith" approved "All critical tests pass"
./uat-validation.sh approve admin_user "Bob Wilson" approved "UX validation complete"
```

**Generate UAT report:**
```bash
./uat-validation.sh report
```

**Exit Criteria:**
- All critical functionality tests PASS
- Minimum 2 stakeholder approvals received
- No P0/P1 blockers remaining

---

## 4) Feature Flag Canary System

**Initialize canary rollout:**
```bash
./canary-rollout.sh init      # Setup canary infrastructure
```

**Start gradual rollout:**
```bash
./canary-rollout.sh start     # Begins 10→30→50→100% progression
```

**Manual stage promotion:**
```bash
./canary-rollout.sh promote 30    # Advance to next stage
./canary-rollout.sh promote 50
./canary-rollout.sh promote 100
```

**Monitor canary health:**
```bash
./canary-rollout.sh monitor   # Real-time health dashboard
```

**Safety Gates:**
* Error rate < 1%
* Board p95 < 800ms | Drawer avg < 200ms
* OCC conflicts steady (no spike > 2%/5min)
* Automatic rollback on threshold breach

---

## 5) Production Launch

**Two deployment strategies available:**

### A) Feature Flag Rollout (Recommended - Fast & Safe)

**Validate prerequisites:**
```bash
./production-launch.sh validate    # Check UAT approval, AWS access, etc.
```

**Execute gradual production rollout:**
```bash
./production-launch.sh rollout     # 5% → 15% → 25% → 50% → 75% → 100%
```

### B) Full Artifact Deploy (If UI Bundle Changed)

**Complete production deployment:**
```bash
./production-launch.sh full-launch    # validate→build→deploy→rollout→report
```

**Individual steps:**
```bash
./production-launch.sh build      # Build production artifacts
./production-launch.sh deploy     # Deploy to production S3
./production-launch.sh rollout    # Execute gradual rollout
```

**Success Criteria:** All gates green for 30+ minutes after reaching 100%

---

## 6) Real-time Monitoring

**Start performance monitoring (run in separate terminal):**
```bash
./performance-monitor.sh start    # Real-time SLO dashboard
```

**Monitor specific duration:**
```bash
./performance-monitor.sh monitor 600    # Monitor for 10 minutes
```

**Performance dashboard:**
```bash
./performance-monitor.sh dashboard      # Live metrics display
```

**Default SLO Thresholds:**
* Board response time p95 < **800ms**
* Drawer open average < **200ms**
* API error rate < **1%**
* OCC conflict rate < **30 conflicts/5min**

---

## 7) Rollback Procedures

**Emergency rollback (instant - disables feature flag):**
```bash
./rollback.sh emergency --reason "SLO breach: board p95>800ms"
```

**Full deployment rollback (restores previous artifacts):**
```bash
./rollback.sh full --reason "Critical bug in StatusBoardV2"
```

**Validate rollback (verify system health):**
```bash
./rollback.sh validate
```

**Post-rollback verification:**
```bash
./staging-smoke-tests.sh quick
./production-launch.sh status
```

---

## 8) Complete Playbook Execution

**Interactive full launch (recommended):**
```bash
./execute-launch-playbook.sh interactive
```

**Automated launch (minimal interaction):**
```bash
AUTO_CONFIRM=true ./execute-launch-playbook.sh auto
```

**Validate all scripts are ready:**
```bash
./execute-launch-playbook.sh validate
```

**The complete 14-step process includes:**
1. Pre-flight Checklist
2. Deploy to Staging
3. Staging Smoke Tests
4. UAT Initialization
5. UAT Execution (manual interaction required)
6. Canary Rollout Setup
7. Performance Monitoring
8. Production Validation
9. Production Build & Deploy
10. Gradual Production Rollout
11. SLO Validation
12. Rollback Testing
13. Final Validation
14. Launch Complete!

---

## 9) CI/CD Integration

**Example GitHub Actions workflow:**

```yaml
- name: Staging Deploy
  run: ./deploy-staging.sh

- name: Staging Smoke Tests
  run: ./staging-smoke-tests.sh full

- name: UAT Validation
  run: ./uat-validation.sh init

- name: Production Deployment Gate
  run: ./production-launch.sh validate

- name: Production Launch
  run: ./production-launch.sh full-launch
  if: github.ref == 'refs/heads/main'
```

---

## 10) Operator Checklists

### Pre-Deploy Checklist
- [ ] Feature branch merged to main
- [ ] UAT test scenarios documented
- [ ] Feature flags configured (default OFF in prod)
- [ ] Environment variables set correctly
- [ ] AWS credentials validated
- [ ] Rollback procedure confirmed

### During Deploy Checklist
- [ ] Monitor real-time logs and SLO dashboards
- [ ] Pause at each canary step to review metrics
- [ ] Validate no error rate spikes during rollout
- [ ] Confirm StatusBoardV2 functionality at each stage
- [ ] Keep rollback command ready

### Post-Deploy Checklist
- [ ] 30+ minutes of stable green metrics
- [ ] UAT sign-offs collected and documented
- [ ] Performance baselines updated
- [ ] Release notes published
- [ ] Team notification sent
- [ ] Monitor alerts configured for ongoing health

---

## 11) Command Quick Reference

```bash
# Staging Deployment
./deploy-staging.sh                    # Full staging deploy
./staging-smoke-tests.sh full         # Complete validation

# UAT Management
./uat-validation.sh init              # Initialize UAT framework
./uat-validation.sh status            # Check UAT progress
./uat-validation.sh report            # Generate UAT report

# Production Launch
./production-launch.sh validate       # Pre-flight checks
./production-launch.sh full-launch    # Complete prod deployment
./production-launch.sh monitor 600    # Monitor for 10 minutes

# Monitoring & Health
./performance-monitor.sh start        # Real-time monitoring
./canary-rollout.sh monitor          # Canary health dashboard

# Emergency Procedures
./rollback.sh emergency              # Instant rollback
./rollback.sh full                   # Complete rollback

# Complete Automation
./execute-launch-playbook.sh interactive  # Full 14-step process
```

---

## 12) Troubleshooting Guide

### Common Issues and Solutions

**Deploy fails with npm ci error:**
```bash
cd frontend && npm install && cd .. && ./deploy-staging.sh
```

**Staging site returns 404:**
```bash
# Check S3 bucket and CloudFront distribution
aws s3 ls s3://$S3_BUCKET
aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID
```

**SLO violations during rollout:**
```bash
# Automatic rollback should trigger, or manual:
./rollback.sh emergency --reason "Performance degradation"
```

**UAT approval workflow stuck:**
```bash
./uat-validation.sh status          # Check pending approvals
./uat-validation.sh checklist       # Review test status
```

**Canary rollout stalled:**
```bash
./canary-rollout.sh status          # Check current stage
./canary-rollout.sh monitor         # Review health metrics
```

---

## 13) Support Contacts

* **Release Owner**: Jesus Ortiz
* **On-call Engineer**: [To be filled]
* **Product Owner**: [To be filled]
* **QA Lead**: [To be filled]
* **Slack Channels**: `#releases`, `#alerts`, `#statusboard`

---

## 14) Release Documentation Template

```markdown
## StatusBoardV2 Production Release

**Release ID**: Sprint-6-StatusBoardV2
**Date/Time (UTC)**: ____-____-____ __:__:__
**Release Owner**: ________________
**Duration**: ____ minutes

### Features Deployed
- ✅ StatusBoardV2 with drag & drop functionality
- ✅ Optimistic UI updates with OCC conflict handling
- ✅ Real-time board refresh (30s interval)
- ✅ Enhanced appointment drawer with services view

### Validation Results
- ✅ Staging smoke tests: ALL PASS
- ✅ UAT approvals: QA ✅, Admin ✅, Product ✅
- ✅ Performance SLOs: Board 385ms p95, Drawer 142ms avg
- ✅ Security scan: No vulnerabilities detected

### Rollout Timeline
- 10:15 UTC - Staging deployment complete
- 10:30 UTC - UAT validation passed
- 11:00 UTC - Production rollout started (5%)
- 11:15 UTC - Promoted to 25%
- 11:30 UTC - Promoted to 50%
- 11:45 UTC - Promoted to 100%
- 12:15 UTC - 30min stable monitoring complete ✅

### Metrics & Health
- Error Rate: 0.02% (well below 1% threshold)
- Board Response Time P95: 427ms (target <800ms) ✅
- Drawer Response Time Avg: 156ms (target <200ms) ✅
- User Adoption: 347 drag operations in first hour
- Zero rollbacks required

### Rollback Preparedness
- ✅ Emergency flag disable tested (< 30s recovery)
- ✅ Full artifact rollback verified
- ✅ Monitoring dashboards active
- ✅ On-call rotation notified

**Status: 🎉 SUCCESSFUL DEPLOYMENT**
```

---

**This guide + automation scripts = push-button, safe StatusBoardV2 deployment.**

Follow the checklists, monitor the dashboards, and keep emergency rollback commands ready. The automation handles the complexity while you maintain control! 🚀
