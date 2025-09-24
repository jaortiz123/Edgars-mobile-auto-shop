# StatusBoardV2 — Go‑Live Run Sheet (Production)

> **Purpose:** Single-source, operator-ready checklist to deploy StatusBoardV2 to production with gates, monitoring, and instant rollback.

---

## 0) Quick Reference

**Core scripts:**
* `./execute-launch-playbook.sh` - Complete 14-step orchestration
* `./production-launch.sh` - Production deployment & monitoring
* `./canary-rollout.sh` - Feature flag gradual rollout
* `./performance-monitor.sh` - Real-time SLO monitoring
* `./staging-smoke-tests.sh` - Comprehensive validation suite
* `./uat-validation.sh` - Stakeholder approval workflow
* `./deploy-staging.sh` - Staging deployment automation
* `./rollback.sh` - Emergency & full rollback procedures

**SLO guards:**
* **Board load p95** < **800ms**
* **Drawer open avg** < **200ms**
* **API error rate** < **1%** (5m window)
* **OCC conflicts** < **30 per 5min**

**Rollback triggers (any true):**
* SLO breach for ≥10 minutes
* Error bursts >2% for 3 consecutive intervals
* Critical functional defect (P0/P1)
* User-reported blocking issues

---

## 1) Pre‑launch (T‑45 → T‑15)

### 1.1 Approvals & Freeze
* [ ] Product, Eng, QA sign‑off captured
* [ ] Change window confirmed & calendar invite sent
* [ ] Comms channel open (#launch-statusboard)
* [ ] On-call team notified and ready
* [ ] Rollback procedures reviewed

### 1.2 Environment Setup (operator shell)
```bash
export STAGING_URL=https://staging.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com
export S3_BUCKET=edgar-mobile-auto-shop
export CLOUDFRONT_DIST_ID=E1234567890123
```

### 1.3 Staging Validation & UAT
```bash
./deploy-staging.sh                         # Deploy latest to staging
./staging-smoke-tests.sh                    # Run full validation suite
./uat-validation.sh status                  # Verify UAT approval status
```

**Gate A (proceed only if PASS):**
* [ ] All smoke tests pass (infrastructure, API, features, performance, security)
* [ ] UAT status shows "approved" with required sign-offs
* [ ] No open P0/P1 issues in backlog

---

## 2) Go/No‑Go Huddle (T‑15 → T‑10)

* [ ] Review Gate A results with team
* [ ] Confirm rollback owner identified
* [ ] Assign comms DRI for updates
* [ ] Final **GO** decision recorded in run doc
* [ ] Backup communication plan confirmed

---

## 3) Production Prep (T‑10 → T‑5)

```bash
./production-launch.sh validate             # Check DNS, TLS, health, IAM, UAT approval
```

**Gate B:**
* [ ] Validation returns success (exit code 0)
* [ ] All monitoring alarms in **OK/INSUFFICIENT_DATA** state
* [ ] Production endpoints accessible
* [ ] AWS credentials and permissions verified

---

## 4) Deploy & Canary Rollout (T‑5 → T+30)

### 4.1 Production Deployment
```bash
./production-launch.sh deploy               # Build, upload to S3, create backup
```

### 4.2 Start Real-time Monitoring
```bash
./performance-monitor.sh start &            # Background SLO monitoring
```

### 4.3 Gradual Canary Rollout
```bash
./canary-rollout.sh start                   # Auto progression: 10→30→50→100%
```

**Monitor each rollout stage:**
```bash
./canary-rollout.sh monitor                 # Live canary dashboard
./performance-monitor.sh dashboard          # Real-time SLO compliance
```

**Gate C/D/E/F - At each stage (10%/30%/50%/100%) verify:**
* [ ] Board p95 < 800ms, Drawer avg < 200ms
* [ ] API error rate < 1%
* [ ] No critical functional incidents reported
* [ ] OCC conflict rate stable (< 30 per 5min)
* [ ] User feedback positive (no blocking issues)

**If any gate fails → Execute rollback immediately**

---

## 5) Stabilization & Validation (T+30 → T+60)

### 5.1 Extended Monitoring
```bash
./production-launch.sh monitor 1800         # 30-minute intensive monitoring
```

### 5.2 End-to-End Validation
* [ ] Sample user flows verified:
  * [ ] Board loads with current appointments
  * [ ] Drag & drop operations complete successfully
  * [ ] OCC conflicts handled gracefully with user feedback
  * [ ] Drawer opens with complete appointment data
  * [ ] Dashboard KPIs update correctly

### 5.3 System Health Check
* [ ] Review CloudWatch dashboards - all green
* [ ] Check application logs for error patterns
* [ ] Verify alert systems are quiet
* [ ] Confirm backup systems operational

**Gate G (Launch Success Criteria):**
* [ ] All SLOs green for continuous 30+ minutes
* [ ] Zero P0/P1 incidents reported
* [ ] User adoption metrics trending positive
* [ ] System stability confirmed across all metrics

---

## 6) Emergency Rollback Playbook

### 6.1 Instant Feature Flag Disable (<30 seconds)
```bash
./rollback.sh emergency --reason "SLO breach detected at $(date)"
```
**Use for:** Performance degradation, high error rates, SLO violations

### 6.2 Full Deployment Rollback (2-3 minutes)
```bash
./rollback.sh full --reason "Critical functionality bug - incident #XXXX"
```
**Use for:** Critical bugs, data integrity issues, complete system problems

### 6.3 Post-Rollback Validation
```bash
./rollback.sh validate                      # Verify rollback success
./production-launch.sh status               # Check system health
./performance-monitor.sh monitor 600        # 10-minute post-rollback monitoring
```

### 6.4 Rollback Communication
* [ ] Immediately announce rollback in #launch-statusboard
* [ ] Notify stakeholders of current status
* [ ] Create incident ticket with run sheet attached
* [ ] Schedule post-mortem meeting

---

## 7) Troubleshooting Quick Fixes

### Build & Deploy Issues
**Symptom:** Frontend build fails with package-lock.json errors
```bash
cd frontend && rm -rf node_modules package-lock.json && npm install && cd ..
./production-launch.sh build
```

**Symptom:** S3 upload failures or 403 errors
```bash
aws sts get-caller-identity                 # Verify AWS credentials
aws s3 ls s3://$S3_BUCKET                  # Test S3 access
```

### Performance Issues
**Symptom:** High p95 latency but low request volume
**Investigation:**
```bash
./performance-monitor.sh dashboard          # Check current metrics
curl -w "%{time_total}" $PROD_URL/api/admin/appointments/board
```
**Common fixes:** Check Lambda cold starts, verify memory allocation (512MB optimal), review backend scaling

### Feature Flag Issues
**Symptom:** StatusBoardV2 not appearing for users
```bash
./canary-rollout.sh status                  # Check current rollout percentage
curl -s "$PROD_URL/api/admin/feature-flags" | jq .
```

### API & CORS Issues
**Symptom:** 403s on production API calls
**Fix:** Verify SigV4 proxy configuration, check IAM permissions, confirm `VITE_API_BASE_URL` setting

**Symptom:** CORS errors in browser console
**Fix:** Check `Access-Control-*` headers on API responses, verify origin configuration

---

## 8) Communication Matrix

### Primary Contacts
| Role | Responsibility | Channel |
|------|---------------|---------|
| **Release Commander** | Overall launch coordination | #launch-statusboard |
| **Backend On-call** | API health, database issues | #eng-ops |
| **Frontend On-call** | UI issues, build problems | #eng-ops |
| **Product Owner** | Go/no-go decisions, user impact | #launch-statusboard |
| **Support Lead** | User communication, issue triage | #customer-support |
| **SRE/DevOps** | Infrastructure, monitoring, alerts | #infrastructure |

### Communication Channels
* **Primary Updates:** `#launch-statusboard` (live commentary)
* **Technical Issues:** `#eng-ops` (alerts and debugging)
* **Stakeholder Updates:** `#product-announcements`
* **Emergency Escalation:** Incident bridge + `#incident-response`

### Update Cadence
* **T-30 to T+0:** Every 10 minutes
* **T+0 to T+30:** Every 5 minutes during rollout
* **T+30 to T+60:** Every 15 minutes during stabilization
* **Post-launch:** Daily updates for first week

---

## 9) Post‑Launch Documentation

### 9.1 Generate Launch Reports
```bash
./uat-validation.sh report                  # UAT validation summary
./production-launch.sh report              # Production deployment metrics
./execute-launch-playbook.sh report        # Complete launch summary
```

### 9.2 Launch Summary Template
```markdown
## StatusBoardV2 Production Launch Summary

**Launch Date:** $(date)
**Duration:** ______ minutes (planned) vs ______ minutes (actual)
**Result:** [SUCCESS / PARTIAL / ROLLBACK]

### Key Metrics
- Board Response Time P95: ______ms (target <800ms)
- Drawer Response Time Avg: ______ms (target <200ms)
- Error Rate: ______% (target <1%)
- User Adoption: ______ operations in first hour

### Timeline
- T-45: Staging validation complete
- T-10: Production prep complete
- T+0: Deployment started
- T+30: Rollout complete at 100%
- T+60: Stabilization verified

### Issues Encountered
- [List any issues, resolutions, and lessons learned]

### Artifacts
- Build ID: ______
- Git Tag: ______
- Deployment Logs: ______
- Monitoring Dashboards: ______
```

### 9.3 Cleanup & Follow-up
* [ ] Archive deployment artifacts and logs
* [ ] Update runbook based on lessons learned
* [ ] Schedule 1-week and 1-month health reviews
* [ ] Document any process improvements identified

---

## 10) Reference Documentation

### Core Documentation
* **Detailed Operator Guide:** `OPERATOR_GUIDE.md`
* **Streamlined Guide:** `OPERATOR_GUIDE_V2.md`
* **Complete Playbook:** `execute-launch-playbook.sh interactive`
* **Architecture Overview:** `HEXAGONAL_ARCHITECTURE.md`

### Configuration References
* **Environment Config:** `frontend/.env` (staging), `frontend/.env.production`
* **Feature Flags:** StatusBoardV2 configuration and rollout controls
* **API Endpoints:** Staging vs Production URL mappings
* **Monitoring:** CloudWatch dashboards and SLO definitions

### Previous Sprint Documentation
* **Sprint 4:** OCC handling and conflict resolution
* **Sprint 5:** Performance optimization and SLO establishment
* **Sprint 6:** Feature flag implementation and rollout automation

---

**🚀 This run sheet provides step-by-step launch execution with safety gates and emergency procedures. Print it out and execute each checkpoint during your StatusBoardV2 production launch!**
