# Docs Index

This is the jumping-off point. **Read in this order.**
Legend: ✅ done · 🟡 WIP · 🔵 planned

## Read First
1. **PROJECT_OVERVIEW.md** — strategy, outcomes, 3-sprint summary · **Owner:** Jesus ✅
2. **PROJECT_PLAN.md** — sprint details, DoD, risks · Owner: Jesus ✅
3. **AGENTS.md** — command brief linking all specs · Owner: Jesus 🟡

## Architecture & Spec
- **ARCHITECTURE.md** — system + data flow, file tree · Owner: Jesus ✅
- **SCHEMA.md** — tables, enums, migrations, rollback · Owner: Jesus ✅
- **API.md** — endpoints, payloads, errors, RBAC matrix · Owner: Jesus ✅
- **FRONTEND.md** — admin implementation (Calendar · Board · Drawer) · Owner: Jesus ✅
- **FRONTEND_PLAYBOOK.md** — shared design system (tokens, patterns) · Owner: Jesus ✅

## Ops & Quality
- **SECURITY.md** — threats, controls, RBAC, rate limits · Owner: Jesus ✅
- **SECURITY_CHECKLIST.md** — OWASP pre-flight checklist · Owner: Jesus ✅
- **PERFORMANCE.md** — SLOs, k6 thresholds, tuning plan · Owner: Jesus ✅
- **PERFORMANCE_METRICS.md** — legacy notes (keep as appendix) 🔵
- **TESTING_QA.md** — unit/component/E2E matrix, CI gates · Owner: Jesus ✅
- **DR_PLAN.md** — backups, RPO/RTO, restore drill · Owner: Jesus ✅
- **DEPLOYMENT_CHECKLIST.md** — staging → prod steps · Owner: Jesus ✅
- **LAUNCH_PLAN.md** — pilot acceptance, go/no-go · Owner: Jesus ✅
- **APPOINTMENT_REMINDERS.md** — comms templates & timing · Owner: Jesus ✅

## Governance
- **RISK_REGISTER.md** — live risks, owners, dates · Owner: Jesus 🟡
- **decision-log.md** — ADR timeline (why we chose X) · Owner: Jesus ✅
- **CHANGELOG.md** — versioned changes (optional) 🔵

---

**Tokens:** source of truth in `tailwind.config.ts`.
**Timezone:** **America/Los_Angeles** (store **UTC**, display local).
**Feature flags:** `ff.messaging`, `ff.payments`, `ff.inspections`, `ff.command_palette`, `ff.brand_theming`.
