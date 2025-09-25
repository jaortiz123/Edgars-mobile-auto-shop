# GO-LIVE COMMANDER — SINGLE-VOICE ORDERS

**StatusBoardV2 Production Launch — Do Exactly This**

> **Assumption:** Frontend on Vite, backend behind SigV4 proxy, automation scripts exist at repo root. You have AWS creds loaded.

---

## 0) PREP — RUN NOW (no deviations)

```bash
cd /Users/jesusortiz/Edgars-mobile-auto-shop
export STAGING_URL=https://staging.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com
export S3_BUCKET=edgar-mobile-auto-shop
export CLOUDFRONT_DIST_ID=E1234567890123

# Verify all scripts present
ls -la *.sh | grep -E "(deploy-staging|staging-smoke-tests|canary-rollout|performance-monitor|production-launch|rollback)"

# Initialize environment
git status
```

**Expected:** All scripts found, clean git status. If errors: fix dependencies first.

**Fix common issues:**
```bash
# If npm issues
cd frontend && npm install && cd ..
# If script permissions
chmod +x *.sh
```

---

## 1) DEPLOY TO STAGING — NOW

```bash
./deploy-staging.sh
```

**Expected:** Exit code == 0, staging deployment success message.
**If fails:** Check logs, fix issues, re-run until success.

---

## 2) STAGING SMOKE — RUN ALL

```bash
./staging-smoke-tests.sh
```

**Gate A (Staging Validation):** PASS only if all test suites green.

**Pass criteria:**
- Infrastructure tests: ✅
- API endpoint tests: ✅
- Feature detection: ✅
- Performance baselines: ✅
- Security validation: ✅

**If ANY red ⇒ STOP and fix before proceeding.**

---

## 3) UAT VALIDATION — CONFIRM APPROVALS

```bash
./uat-validation.sh status
```

**Gate A2 (UAT Approval):** PASS only if status shows "approved" with required sign-offs.

**If not approved:**
```bash
./uat-validation.sh init    # Initialize if needed
# Get required approvals before proceeding
```

---

## 4) PROD VALIDATION — DRY RUN

```bash
./production-launch.sh validate
```

**Gate B (Production Readiness):** PASS only if validate returns success.

**Pass criteria:**
- UAT approval confirmed: ✅
- AWS credentials valid: ✅
- Production health endpoints: ✅
- S3 bucket access: ✅
- Monitoring systems ready: ✅

**If NOT OK ⇒ STOP and investigate infrastructure.**

---

## 5) PROD DEPLOY — DO IT

```bash
./production-launch.sh deploy
```

**Expected:** Build success, S3 upload complete, backup created.
**Proceed only on complete success.**

---

## 6) FEATURE FLAG CANARY — I WILL CALL PERCENTAGES

**Run EXACTLY as ordered—no manual changes.**

### 6.1) Start Canary System

```bash
./canary-rollout.sh start
./performance-monitor.sh start &
```

### 6.2) Monitor 10% Rollout (Auto-started)

```bash
./canary-rollout.sh monitor
```

**Gate C (10% Canary):** Monitor for 5-10 minutes. PASS if:
- Board p95 < 800ms
- Drawer avg < 200ms
- Error rate < 1%
- No critical user reports

**If FAIL ⇒**
```bash
./rollback.sh emergency --reason "Canary 10% SLO breach"
```
**Then STOP.**

### 6.3) Advance to 30%

**ONLY proceed if Gate C passed.**

```bash
./canary-rollout.sh promote 30
```

Monitor for 10 minutes. Same thresholds as Gate C.

**Gate D (30% Canary):** Same criteria.
**If FAIL ⇒ Emergency rollback and STOP.**

### 6.4) Advance to 50%

**ONLY proceed if Gate D passed.**

```bash
./canary-rollout.sh promote 50
```

Monitor for 10 minutes. Same thresholds.

**Gate E (50% Canary):** Same criteria.
**If FAIL ⇒ Emergency rollback and STOP.**

### 6.5) Advance to 100%

**ONLY proceed if Gate E passed.**

```bash
./canary-rollout.sh promote 100
```

Monitor for 15 minutes. Same thresholds plus user adoption metrics.

**Gate F (100% Rollout):** Same criteria over 15 minutes.
**If FAIL ⇒ Emergency rollback and STOP.**

---

## 7) STABILIZATION — HOLD 30 MINUTES

```bash
./production-launch.sh monitor 1800
```

**Gate G (Stabilization):** PASS if green metrics for entire 30-minute window.

**Monitoring checklist:**
- Performance trends stable
- Error rates consistent <1%
- No alarm escalations
- User feedback positive
- Dashboard KPIs updating correctly

**If any red spike persists >5 minutes ⇒**
```bash
./rollback.sh full --reason "Stabilization breach detected"
```

---

## 8) POST-LAUNCH — LOCK IN & REPORT

```bash
# Generate comprehensive reports
./production-launch.sh report
./uat-validation.sh report
./execute-launch-playbook.sh report

# Archive launch artifacts
mkdir -p launch-artifacts-$(date +%Y%m%d_%H%M%S)
mv *-report-*.json launch-artifacts-*/
mv *-log-*.log launch-artifacts-*/
```

**Final validation:**
- All SLOs maintained for 30+ minutes: ✅
- Zero P0/P1 incidents: ✅
- Stakeholder approval documented: ✅
- Launch artifacts archived: ✅

---

## EMERGENCY ORDERS — USE IMMEDIATELY WITHOUT ASKING

### Instant Kill (Feature Flag Off)
```bash
./rollback.sh emergency --reason "Performance degradation detected"
```

### Full System Rollback
```bash
./rollback.sh full --reason "Critical functionality defect"
```

### Post-Rollback Verification
```bash
./rollback.sh validate
./production-launch.sh status
./staging-smoke-tests.sh    # Verify system health
```

### Rollback Decision Matrix
| Issue | Severity | Command |
|-------|----------|---------|
| SLO breach >5min | High | `./rollback.sh emergency` |
| Critical bug | Critical | `./rollback.sh full` |
| User blocking issue | High | `./rollback.sh emergency` |
| Data integrity concern | Critical | `./rollback.sh full` |

---

## CALL-AND-RESPONSE PROTOCOL

**You announce each section, then execute. Report results immediately.**

### Phase 1: Preparation
**"Commander, beginning prep."** → Execute section 0
- **Report:** "Prep complete" or "Prep failed: [issue]"

### Phase 2: Staging Validation
**"Commander, staging deploy."** → Execute section 1
- **Report:** "Staging deployed" or "Staging failed: [issue]"

**"Commander, staging smoke tests."** → Execute section 2
- **Report:** "Gate A PASSED - All tests green" or "Gate A FAILED: [details]"

**"Commander, UAT validation."** → Execute section 3
- **Report:** "UAT approved" or "UAT pending: [missing approvals]"

### Phase 3: Production Deployment
**"Commander, production validation."** → Execute section 4
- **Report:** "Gate B PASSED - Prod ready" or "Gate B FAILED: [issue]"

**"Commander, production deploy."** → Execute section 5
- **Report:** "Production deployed" or "Deploy failed: [issue]"

### Phase 4: Canary Rollout
**"Commander, canary rollout sequence."** → Execute section 6.1-6.5
- **Report after each stage:** "Gate [C/D/E/F] PASSED - [X]% stable" or "Gate [X] FAILED - rolling back"

### Phase 5: Stabilization
**"Commander, stabilization hold."** → Execute section 7
- **Report:** "Gate G PASSED - 30min stable" or "Stabilization failed - rolling back"

### Phase 6: Completion
**"Commander, post-launch finalization."** → Execute section 8
- **Report:** "Launch complete - all artifacts archived"

---

## COMMANDER DECISION POINTS

**At each gate, you MUST make explicit go/no-go decision:**

- **Gate A:** Staging validation → "PROCEED" or "HALT"
- **Gate B:** Production readiness → "DEPLOY" or "HALT"
- **Gates C-F:** Each canary stage → "ADVANCE" or "ROLLBACK"
- **Gate G:** Stabilization → "SUCCESS" or "ROLLBACK"

**No implicit decisions. Every gate requires explicit commander authorization.**

---

## SINGLE COMMAND SEQUENCE (For Copy-Paste Execution)

```bash
# === PHASE 1: PREP ===
cd /Users/jesusortiz/Edgars-mobile-auto-shop && export STAGING_URL=https://staging.edgarsautoshop.com && export PROD_URL=https://edgarsautoshop.com && export STAGING_API_BASE_URL=https://staging-api.edgarsautoshop.com && git status

# === PHASE 2: STAGING ===
./deploy-staging.sh && ./staging-smoke-tests.sh && ./uat-validation.sh status

# === PHASE 3: PRODUCTION ===
./production-launch.sh validate && ./production-launch.sh deploy

# === PHASE 4: CANARY ===
./canary-rollout.sh start && ./performance-monitor.sh start &

# === PHASE 5: MONITOR ===
./production-launch.sh monitor 1800

# === PHASE 6: FINALIZE ===
./production-launch.sh report && ./uat-validation.sh report
```

---

**🎯 COMMANDER: Stay on script. Report each gate result clearly. Execute orders exactly as written. Your automation handles the complexity - you provide the leadership and decision-making. LAUNCH WHEN READY! 🚀**
