# Go‑Live Commander — Live Run Orchestration

This is the **single, operator-ready script** to lead the StatusBoardV2 launch. Follow top‑to‑bottom. All commands match your automation suite.

---

## 0) Pre‑Flight Setup (5 min)

### Communication & Team Setup
* [ ] Open comms bridge (Slack #launch-statusboard, Zoom/Meet ready)
* [ ] Assign roles: **Driver** (you), **Scribe**, **Approver**, **Observer**
* [ ] Confirm emergency contacts available and responsive
* [ ] Share this run sheet with all participants

### Environment Configuration
Export these variables (edit hostnames if different):

```bash
export STAGING_URL=https://staging.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com
export S3_BUCKET=edgar-mobile-auto-shop
export CLOUDFRONT_DIST_ID=E1234567890123
```

### Script Validation
Verify all automation scripts are present & executable:

```bash
ls -la *.sh | grep -E "(deploy-staging|staging-smoke-tests|uat-validation|canary-rollout|performance-monitor|production-launch|rollback|execute-launch-playbook)"
```

### Final Pre-Flight Check
* [ ] All required scripts found and executable
* [ ] Team roles assigned and confirmed
* [ ] Communication channels active
* [ ] **Green light from Approver to proceed**

**Go / No‑Go Gate →** *All checks passed? Announce "PROCEEDING TO GATE A" and continue.*

---

## Gate A — Staging Validation (10–15 min)

### Objective
Confirm staging build, APIs, features, and performance baselines.

### Execute Commands
```bash
# Deploy latest build to staging
./deploy-staging.sh

# Run comprehensive validation suite
./staging-smoke-tests.sh

# Verify UAT approval status
./uat-validation.sh init && ./uat-validation.sh status
```

### Pass Criteria (ALL must be true)
* [ ] Smoke tests: All suites PASS (infrastructure, API, features, performance, security)
* [ ] Performance KPIs within SLO: Board p95 <800ms, Drawer avg <200ms
* [ ] UAT status shows "approved" with required sign-offs
* [ ] No critical errors in logs or console output
* [ ] Staging site accessible and functional

### If Gate A FAILS
* [ ] **STOP** - Do not proceed to production
* [ ] Capture complete error logs and screenshots
* [ ] Identify root cause and fix staging issues
* [ ] Re-run validation suite until all checks pass
* [ ] Get Approver sign-off before proceeding

### Communication Template
**Success:** `"Gate A PASSED - Staging validation complete. Board: XXXms, Drawer: XXXms, All tests green. Proceeding to Gate B."`

**Failure:** `"Gate A FAILED - [specific issue]. Halting launch for investigation. ETA for retry: [time]"`

**Gate A Decision:** ✅ PASS → **Announce success, proceed to Gate B**  |  ❌ FAIL → **Stop, fix, retry**

---

## Gate B — Production Preparation (5–10 min)

### Objective
Validate production environment readiness, IAM permissions, and backup procedures.

### Execute Commands
```bash
# Validate production environment and prerequisites
./production-launch.sh validate

# Run complete playbook validation
./execute-launch-playbook.sh validate
```

### Pass Criteria (ALL must be true)
* [ ] Production health endpoints return 200
* [ ] AWS IAM permissions validated and working
* [ ] All monitoring alarms in OK/INSUFFICIENT_DATA state (no ALARM)
* [ ] UAT approval confirmed in production validation
* [ ] Rollback artifacts and procedures verified
* [ ] CloudFront distribution accessible

### If Gate B FAILS
* [ ] **STOP** - Investigate production environment issues
* [ ] Check AWS credentials: `aws sts get-caller-identity`
* [ ] Verify S3 bucket access: `aws s3 ls s3://$S3_BUCKET`
* [ ] Confirm production endpoints are healthy
* [ ] Get infrastructure team support if needed

### Communication Template
**Success:** `"Gate B PASSED - Production environment ready. All systems green. Proceeding to deployment."`

**Failure:** `"Gate B FAILED - Production environment issue: [details]. Investigating with infra team."`

**Gate B Decision:** ✅ PASS → **Announce readiness, proceed to Gates C-F**  |  ❌ FAIL → **Investigate infrastructure**

---

## Gates C–F — Canary Rollout (30–60 min)

### Objective
Execute gradual production rollout with automated health monitoring and rollback triggers.

### Start Production Deployment
```bash
# Deploy production artifacts with backup creation
./production-launch.sh deploy

# Start gradual canary rollout (10→30→50→100%)
./canary-rollout.sh start

# Begin real-time performance monitoring (background)
./performance-monitor.sh start &
```

### Monitor Each Rollout Stage

**At each canary step (10%, 30%, 50%, 100%) verify:**
* [ ] **Error Rate:** <0.5% (target <1%)
* [ ] **Board Response:** p95 <800ms (critical SLO)
* [ ] **Drawer Response:** avg <200ms (critical SLO)
* [ ] **System Health:** Alarms quiet, logs clean
* [ ] **User Feedback:** No critical issues reported

### Real-Time Monitoring Commands
```bash
# Check canary progress and health
./canary-rollout.sh monitor

# View live performance dashboard
./performance-monitor.sh dashboard

# Check production system status
./production-launch.sh status
```

### If ANY Canary Stage FAILS
```bash
# Execute immediate emergency rollback
./rollback.sh emergency --reason "SLO breach at [X]% rollout - [specific metrics]"
```

**Post-Rollback Actions:**
* [ ] Announce rollback completion in all channels
* [ ] Collect artifacts and error logs for analysis
* [ ] Schedule root cause analysis meeting
* [ ] Determine timeline for retry attempt

### Communication Templates
**Stage Success:** `"Canary [X]% PASSED - Error: 0.X%, Board: XXXms, Drawer: XXXms. Advancing to [Y]%."`

**Stage Failure:** `"Canary [X]% FAILED - [metric] breach detected. Executing emergency rollback immediately."`

**Rollback Complete:** `"Emergency rollback COMPLETE. System restored to previous state. Health verified. Incident investigation initiated."`

### Gate C-F Decision Points
* **Gate C (10%):** ✅ PASS → Continue to 30%  |  ❌ FAIL → Emergency rollback
* **Gate D (30%):** ✅ PASS → Continue to 50%  |  ❌ FAIL → Emergency rollback
* **Gate E (50%):** ✅ PASS → Continue to 100%  |  ❌ FAIL → Emergency rollback
* **Gate F (100%):** ✅ PASS → **Proceed to Gate G**  |  ❌ FAIL → Emergency rollback

---

## Gate G — Stabilization & Validation (30 min)

### Objective
Maintain 100% rollout with continuous monitoring to ensure system stability.

### Execute Extended Monitoring
```bash
# Monitor production health for 30 minutes
./production-launch.sh monitor 1800
```

### Continuous Validation (Every 10 minutes for 30 minutes)
* [ ] **Performance Trends:** No degradation in response times
* [ ] **Error Rates:** Maintaining <0.5% consistently
* [ ] **System Alarms:** All monitoring alerts remain OK
* [ ] **User Experience:** Sample end-to-end flows working correctly
* [ ] **Dashboard KPIs:** Appointment board metrics updating correctly

### End-to-End Validation Checklist
* [ ] Board loads with current appointments
* [ ] Drag & drop operations complete successfully
* [ ] OCC conflicts display appropriate user feedback
* [ ] Appointment drawer opens with complete data
* [ ] Status changes reflect correctly in real-time
* [ ] Dashboard statistics update properly

### If Gate G FAILS (Instability Detected)
```bash
# Execute full system rollback
./rollback.sh full --reason "Post-launch instability - [specific issues]"
```

### Communication Template
**Success:** `"Gate G PASSED - 30min stability confirmed. All SLOs green. StatusBoardV2 launch SUCCESSFUL!"`

**Failure:** `"Gate G FAILED - Post-launch instability detected. Executing full rollback to ensure system stability."`

**Gate G Decision:** ✅ PASS → **Launch SUCCESS - Proceed to Post-Launch**  |  ❌ FAIL → **Full rollback required**

---

## Communication Protocols & Cadence

### Update Schedule
* **T-15:** Kickoff announcement and team readiness
* **T-0:** Begin Gate A - staging validation
* **T+10:** Gate B results - production readiness
* **T+20:** Deployment complete, canary starting
* **Every 10-15 min:** Canary stage updates (10%→30%→50%→100%)
* **T+60:** Stabilization results and final status
* **T+90:** Post-launch summary and next steps

### Stakeholder Approvals
* **Approver confirms:** Gate A passage, Gate B readiness, Full rollout authorization, Final launch sign-off
* **Driver provides:** Technical status, metrics, recommendations
* **Scribe documents:** All decisions, timings, issues, and resolutions

### Communication Templates
**Kickoff:** `"🚀 StatusBoardV2 GO-LIVE initiated. Target SLOs: Board <800ms, Drawer <200ms. Team ready. Beginning Gate A validation."`

**Stage Update:** `"📊 Canary at [X]% - Error: 0.X%, Board: XXXms, Drawer: XXXms, Users: positive. Proceeding to [Y]%."`

**Incident Alert:** `"🚨 SLO breach detected at [X]% rollout. Metrics: [details]. Executing emergency rollback immediately."`

**Success:** `"🎉 StatusBoardV2 launch COMPLETE! 100% rollout stable for 30min. All SLOs green. Monitoring continues."`

---

## Emergency Procedures & Troubleshooting

### Common Issues & Quick Fixes

**npm/package-lock issues:**
```bash
cd frontend && rm -rf node_modules package-lock.json && npm install && cd ..
```

**AWS credential problems:**
```bash
aws sts get-caller-identity    # Verify identity
aws configure list             # Check config
```

**CORS/API connectivity:**
* Verify `.env` configuration matches environment
* Check SigV4 proxy health: `curl $STAGING_API_BASE_URL/health`
* Confirm API endpoints are accessible

**Performance degradation:**
```bash
# Check current metrics
./performance-monitor.sh dashboard

# Investigate specific endpoints
curl -w "%{time_total}" $PROD_URL/api/admin/appointments/board
```

### Rollback Decision Matrix

| Trigger | Action | Command |
|---------|--------|---------|
| SLO breach (>800ms) | Emergency rollback | `./rollback.sh emergency` |
| Error rate >1% | Emergency rollback | `./rollback.sh emergency` |
| Critical bug | Full rollback | `./rollback.sh full` |
| User complaints | Evaluate, possible rollback | Monitor and decide |

### Post-Rollback Verification
```bash
# Verify rollback success
./rollback.sh validate

# Confirm system health
./production-launch.sh status

# Run quick smoke test
./staging-smoke-tests.sh
```

---

## Post‑Launch Activities (10–20 min)

### Generate Documentation & Reports
```bash
# Create comprehensive launch report
./production-launch.sh report

# Generate UAT summary
./uat-validation.sh report

# Create complete playbook execution summary
./execute-launch-playbook.sh report
```

### Capture Launch Artifacts
* [ ] Screenshot final performance dashboards
* [ ] Archive all log files with timestamps
* [ ] Document any issues encountered and resolutions
* [ ] Record final metrics and SLO compliance data
* [ ] Save communication logs and decision points

### Follow-up Actions
* [ ] Schedule 24-hour health check review
* [ ] Plan 1-week performance analysis
* [ ] Document lessons learned and process improvements
* [ ] Update runbooks based on experience
* [ ] Communicate final status to all stakeholders

---

## "Start Now" — Live Command Sequence

**Copy, paste, and execute line‑by‑line during live launch:**

```bash
# === GATE A: Staging Validation ===
./deploy-staging.sh && ./staging-smoke-tests.sh && ./uat-validation.sh init && ./uat-validation.sh status

# === GATE B: Production Preparation ===
./production-launch.sh validate && ./execute-launch-playbook.sh validate

# === GATES C-F: Deploy & Canary Rollout ===
./production-launch.sh deploy && ./canary-rollout.sh start && ./performance-monitor.sh start &

# === GATE G: Stabilization (30 minutes) ===
./production-launch.sh monitor 1800

# === POST-LAUNCH: Documentation ===
./production-launch.sh report
```

---

## Launch Sign‑offs & Authorization

### Pre-Launch Authorization
* **Technical Readiness:** Driver: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
* **Business Approval:** Approver: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
* **Documentation:** Scribe: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### Post-Launch Confirmation
* **Launch Success:** Driver: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
* **Stakeholder Approval:** Approver: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
* **Final Documentation:** Scribe: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Date/Time: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**🎯 You are the Launch Commander. This document is your script. When ready to begin, announce "StatusBoardV2 GO-LIVE initiated" and start with Gate A. Lead with confidence - your automation has your back! 🚀**
