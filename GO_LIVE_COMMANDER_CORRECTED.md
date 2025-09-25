# GO-LIVE COMMANDER — CORRECTED ORDERS

**StatusBoardV2 Production Launch — ACCURATE COMMAND INTERFACES**

> **Verified Script Commands:** Based on actual automation scripts in repo root.

---

## 0) PREP — RUN NOW

```bash
cd /Users/jesusortiz/Edgars-mobile-auto-shop
export STAGING_URL=https://staging.edgarsautoshop.com
export PROD_URL=https://edgarsautoshop.com
export URL_LOCAL=http://localhost:8080

# Verify environment
git status
npm ci --prefix frontend
chmod +x *.sh
```

**Gate 0:** All dependencies ready, clean git status.

---

## 1) DEPLOY TO STAGING

```bash
./deploy-staging.sh
```

**Gate 1:** Exit code == 0, deployment artifacts created.

---

## 2) STAGING SMOKE TESTS

```bash
./staging-smoke-tests.sh
```

**Gate 2 (Critical):** ALL test suites must pass:
- Infrastructure Health ✅
- API Endpoints ✅
- Feature Detection ✅
- Performance Baselines ✅
- Security Headers ✅

**If ANY test FAILS → STOP LAUNCH**

---

## 3) PRODUCTION VALIDATION

```bash
./production-launch.sh validate
```

**Gate 3:** Production readiness verified.

---

## 4) PRODUCTION DEPLOY

```bash
./production-launch.sh deploy
```

**Gate 4:** Production artifacts deployed successfully.

---

## 5) CANARY ROLLOUT — COMMANDER CONTROLLED

### 5.1) Initialize Canary System

```bash
./canary-rollout.sh start
```

**Starts at 10% automatically. Monitor for 5 minutes:**

```bash
./performance-monitor.sh monitor &
MONITOR_PID=$!
sleep 300
kill $MONITOR_PID 2>/dev/null
./performance-monitor.sh stats 5
```

**Gate 5A (10% Canary):** SLO thresholds:
- Board p95 < 800ms
- Drawer p95 < 200ms
- Error rate < 0.5%

**Commander Decision:**
- ✅ Metrics GOOD → "Commander, 10% canary GREEN. Proceeding."
- ❌ Metrics BREACH → "Commander, emergency rollback."

```bash
# If metrics breach:
./rollback.sh emergency --reason "10% canary SLO violation"
```

### 5.2) Advance to 30%

**Only if Gate 5A passed:**

```bash
./canary-rollout.sh enable 30
```

**Monitor for 5 minutes:**
```bash
./performance-monitor.sh monitor &
MONITOR_PID=$!
sleep 300
kill $MONITOR_PID 2>/dev/null
./performance-monitor.sh stats 5
```

**Gate 5B:** Same SLO thresholds. Emergency rollback if breach.

### 5.3) Advance to 50%

**Only if Gate 5B passed:**

```bash
./canary-rollout.sh enable 50
```

**Monitor for 5 minutes:**
```bash
./performance-monitor.sh monitor &
MONITOR_PID=$!
sleep 300
kill $MONITOR_PID 2>/dev/null
./performance-monitor.sh stats 5
```

**Gate 5C:** Same SLO thresholds. Emergency rollback if breach.

### 5.4) Full Rollout — 100%

**Only if Gate 5C passed:**

```bash
./canary-rollout.sh enable 100
```

**Monitor for 10 minutes:**
```bash
./performance-monitor.sh monitor &
MONITOR_PID=$!
sleep 600
kill $MONITOR_PID 2>/dev/null
./performance-monitor.sh stats 10
```

**Gate 5D:** Same SLO thresholds over 10-minute window.

---

## 6) STABILIZATION WATCH

```bash
echo "Beginning 30-minute stabilization..."
./performance-monitor.sh monitor &
MONITOR_PID=$!
sleep 1800  # 30 minutes
kill $MONITOR_PID 2>/dev/null
./performance-monitor.sh violations
```

**Gate 6 (Final):** NO SLO violations in 30-minute window.

**If violations detected:**
```bash
./rollback.sh full --reason "Stabilization period violations"
```

---

## 7) FINALIZATION

**Only if Gate 6 passed:**

```bash
./production-launch.sh finalize
./execute-launch-playbook.sh report > launch_report_$(date +%Y%m%d_%H%M%S).txt
echo "✅ StatusBoardV2 LAUNCH COMPLETE"
```

---

## EMERGENCY PROCEDURES

### Instant Feature Kill (<30s)
```bash
./canary-rollout.sh disable
./canary-rollout.sh status  # Verify 0%
```

### Full System Rollback (<3min)
```bash
./rollback.sh full --reason "Critical system failure"
```

### Verify Rollback Success
```bash
./staging-smoke-tests.sh
./performance-monitor.sh test
```

---

## CALL-AND-RESPONSE PROTOCOL

1. **"Commander, prep phase initiated."** → Section 0
2. **"Commander, staging deployment."** → Section 1
3. **"Commander, staging validation."** → Section 2
4. **"Commander, production validation."** → Section 3
5. **"Commander, production deployment."** → Section 4
6. **"Commander, canary 10% initiated."** → Section 5.1
7. **"Commander, canary 30% initiated."** → Section 5.2 (only if 5.1 passed)
8. **"Commander, canary 50% initiated."** → Section 5.3 (only if 5.2 passed)
9. **"Commander, full rollout initiated."** → Section 5.4 (only if 5.3 passed)
10. **"Commander, stabilization watch."** → Section 6
11. **"Commander, finalizing launch."** → Section 7

### Emergency Protocol
- **"Commander, EMERGENCY ROLLBACK."** → Execute emergency procedures immediately

---

## SINGLE-SEQUENCE EXECUTION

**Copy-paste ready commands (validate each gate):**

```bash
# Phase 0-1: Preparation & Staging
cd /Users/jesusortiz/Edgars-mobile-auto-shop && npm ci --prefix frontend && ./deploy-staging.sh

# Phase 2: Validation
./staging-smoke-tests.sh

# Phase 3-4: Production Deploy
./production-launch.sh validate && ./production-launch.sh deploy

# Phase 5: Canary Rollout (check metrics between each step)
./canary-rollout.sh start && sleep 300 && ./performance-monitor.sh stats 5
# VALIDATE 10% METRICS BEFORE PROCEEDING
./canary-rollout.sh enable 30 && sleep 300 && ./performance-monitor.sh stats 5
# VALIDATE 30% METRICS BEFORE PROCEEDING
./canary-rollout.sh enable 50 && sleep 300 && ./performance-monitor.sh stats 5
# VALIDATE 50% METRICS BEFORE PROCEEDING
./canary-rollout.sh enable 100 && sleep 600 && ./performance-monitor.sh stats 10

# Phase 6: Stabilization
sleep 1800 && ./performance-monitor.sh violations

# Phase 7: Finalization
./production-launch.sh finalize
```

**⚠️ CRITICAL:** Stop and execute rollback if ANY SLO violation occurs during canary phases.

---

**COMMAND AUTHORITY: GO-LIVE COMMANDER**
**StatusBoardV2 Launch Control**
