# Go-Live Run Sheet — StatusBoardV2 (Sprint 6 → Prod)

**Owner:** You (Release Captain)
**Date/Window:** \_\_\_\_\_\_\_\_\_\_\_\_ / \_\_\_\_\_\_\_\_\_\_\_\_ (local time)
**Target:** Roll out StatusBoardV2 behind feature flag to 100% with SLO guardrails
**Rollback:** `./rollback.sh emergency|full`

---

## 0) Fast Preconditions (10 min)

* [ ] ✅ **Code frozen** on the release branch/tag
* [ ] ✅ **Staging green**: `./staging-smoke-tests.sh`
* [ ] ✅ **UAT sign‑off recorded**: `./uat-validation.sh status`
* [ ] ✅ **Metrics visible** (CloudWatch + perf monitor): `./performance-monitor.sh start`
* [ ] ✅ **Feature flags default OFF** in prod: `VITE_FEATURE_STATUS_BOARD_V2=false`

> **🚨 STOP Rule:** If any box is ❌, stop and fix. Otherwise proceed.

---

## 1) Staging Final Validation (T‑45 → T‑30)

```bash
./deploy-staging.sh
./staging-smoke-tests.sh
./uat-validation.sh status
```

**Gate A** (all must pass):

* [ ] Board load p95 < **800ms**
* [ ] Drawer open avg < **200ms**
* [ ] Error rate < **1%**
* [ ] OCC conflict handling observed and safe
* [ ] No critical UAT blockers remaining

**Fail any → Fix or reschedule.**

---

## 2) Prod Preflight (T‑30 → T‑20)

```bash
./production-launch.sh validate    # IAM, URLs, health, artifacts
./production-launch.sh build       # Build production artifacts
```

**Gate B**:

* [ ] Health endpoints return 200
* [ ] AWS credentials validated
* [ ] Build artifacts generated successfully
* [ ] UAT approval status confirmed

---

## 3) Production Deploy & Canary Rollout (T‑20 → T+20)

**Deploy to Production:**
```bash
./production-launch.sh deploy      # Upload to S3, backup previous
```

**Start Canary Rollout:**
```bash
./canary-rollout.sh start          # Auto progression: 10 → 30 → 50 → 100%
./performance-monitor.sh start &   # Background monitoring
```

**Auto-advance gates at each step (10% → 30% → 50% → 100%)**

* [ ] Board p95 < 800ms, Drawer avg < 200ms
* [ ] Error rate < 1%
* [ ] No spike in OCC conflicts (< 30 per 5min)
* [ ] Stage duration 10min minimum per step

**Monitor in real-time:**
```bash
./canary-rollout.sh monitor        # Live canary dashboard
./performance-monitor.sh dashboard # SLO compliance view
```

**If any gate fails:**
```bash
./rollback.sh emergency --reason "SLO breach during canary at X%"
```

---

## 4) Full Production Rollout (T+20 → T+30)

**When canary reaches 100% successfully:**

```bash
# Verify 100% rollout completion
./canary-rollout.sh status

# Final production validation
./production-launch.sh monitor 300  # 5-minute intensive monitoring
```

**Gate C**:

* [ ] Real user traffic stable (15+ min)
* [ ] SLOs maintain compliance
* [ ] No error bursts or anomalies
* [ ] Dashboard metrics all green

---

## 5) Post‑Launch Verification (T+30 → T+60)

```bash
# Extended monitoring period
./performance-monitor.sh monitor 1800  # 30-minute stability check
```

**Verification checklist:**

* [ ] Dashboards clean, alarms quiet
* [ ] No error bursts in logs
* [ ] Sample end‑to‑end flows verified:
  * [ ] Board loads with appointments
  * [ ] Drag & drop operations work
  * [ ] OCC conflicts handled gracefully
  * [ ] Drawer opens with correct data
* [ ] KPI dashboard updates correctly

**If instability detected:**
```bash
./rollback.sh full --reason "Post-launch instability detected"
```

---

## 6) Success Validation & Closeout (T+60)

**Generate launch reports:**
```bash
./uat-validation.sh report
./production-launch.sh report
./execute-launch-playbook.sh report
```

**Final checklist:**

* [ ] 30+ minutes stable green metrics
* [ ] Zero P0/P1 issues reported
* [ ] User adoption metrics positive
* [ ] Performance baselines met or exceeded

**Communications & Documentation:**

* [ ] Share release note in #releases + #product
* [ ] Update deployment documentation
* [ ] Archive launch artifacts and logs
* [ ] Capture metrics deltas in final report

---

## One‑Command Launch Paths

**Pre-launch validation only:**
```bash
./execute-launch-playbook.sh validate
```

**Complete guided launch (recommended):**
```bash
./execute-launch-playbook.sh interactive
```

**Automated launch (CI/CD pipeline):**
```bash
AUTO_CONFIRM=true SKIP_UAT_INTERACTIVE=true ./execute-launch-playbook.sh auto
```

---

## Rollback Quick Reference

### Emergency Procedures

**Instant feature flag disable (< 30 seconds):**
```bash
./rollback.sh emergency --reason "SLO breach detected"
```

**Full artifact rollback (2-3 minutes):**
```bash
./rollback.sh full --reason "Critical functionality bug"
```

**Validate rollback success:**
```bash
./rollback.sh validate                    # System health check
./production-launch.sh status             # Production status
./performance-monitor.sh monitor 600      # 10-min post-rollback monitoring
```

### Rollback Decision Matrix

| Issue | Severity | Action | Command |
|-------|----------|--------|---------|
| Performance degradation | High | Emergency rollback | `./rollback.sh emergency` |
| Functional bug | Critical | Full rollback | `./rollback.sh full` |
| Minor UI glitch | Low | Monitor, fix in next release | Continue monitoring |
| OCC conflict spike | Medium | Evaluate, emergency if persistent | `./rollback.sh emergency` if trend continues |

---

## Troubleshooting Cheats

**Common Issues & Quick Fixes:**

* **Build failures:** `cd frontend && npm install && cd .. && ./production-launch.sh build`
* **404s after deploy:** Check CloudFront invalidation, wait 5-10 minutes for propagation
* **High p95 during canary:** Pause rollout, check backend scaling, investigate bottlenecks
* **Feature flag not updating:** Verify feature flag service connectivity and cache invalidation
* **OCC 409 conflicts:** Expected behavior, verify user feedback mechanisms working
* **CORS errors:** Confirm API endpoint configuration and proxy settings

**Monitoring Commands:**
```bash
# Real-time system health
./performance-monitor.sh dashboard

# Check canary progress
./canary-rollout.sh status

# Production endpoint health
curl -f "$PROD_URL/api/health"

# Feature flag status
./production-launch.sh status | grep -i flag
```

---

## Contact Matrix & Escalation

### Primary Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|----------------|
| **Release Captain** | Jesus Ortiz | _______________ | Overall launch coordination |
| **Backend On‑call** | _______________ | _______________ | API health, database issues |
| **Frontend On‑call** | _______________ | _______________ | UI issues, build problems |
| **SRE / DevOps** | _______________ | _______________ | Infrastructure, monitoring |
| **Product Owner** | _______________ | _______________ | Go/no-go decisions |

### Communication Channels

* **Primary Updates:** `#releases` Slack channel
* **Technical Issues:** `#engineering` Slack channel
* **Alerts & Monitoring:** `#alerts` Slack channel
* **Emergency Escalation:** `#incident-response` Slack channel

### Escalation Triggers

**Level 1 (Auto-handled):** Performance SLO violations → Automatic rollback
**Level 2 (Manual):** Functional issues, user reports → Manual rollback decision
**Level 3 (Leadership):** Business impact, extended outage → Executive notification

---

## Pre-Launch Sign‑off

**Required approvals before T-30:**

* [ ] **Product Owner** ✅ - Feature ready for production users
* [ ] **Engineering Lead** ✅ - Technical implementation validated
* [ ] **QA Lead** ✅ - All test scenarios passed
* [ ] **SRE Lead** ✅ - Monitoring and rollback procedures ready
* [ ] **Support Lead** ✅ - Team briefed on new features and issues

**Final Go/No-Go Decision:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (Release Captain)
**Launch Authorization Time:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (UTC)

---

## Post-Launch Report Template

```markdown
# StatusBoardV2 Production Launch Report

**Launch Date:** ________________
**Launch Window:** ______________ (local) / ______________ (UTC)
**Release Captain:** ______________

## Summary
- ✅ Launch Status: [SUCCESS / PARTIAL / FAILED]
- ✅ Duration: ______ minutes (planned) / ______ minutes (actual)
- ✅ Rollbacks: ______ (count and reasons)

## Metrics
- Board Response Time P95: ______ms (target <800ms)
- Drawer Response Time Avg: ______ms (target <200ms)
- Error Rate: ______% (target <1%)
- User Adoption: ______ interactions in first hour

## Issues Encountered
- [List any issues and resolutions]

## Lessons Learned
- [Process improvements for future launches]

## Next Steps
- [Follow-up actions and monitoring]
```

---

**This run sheet provides step-by-step launch execution with safety gates and emergency procedures. Print it out and check off each box during your launch! 🚀**
