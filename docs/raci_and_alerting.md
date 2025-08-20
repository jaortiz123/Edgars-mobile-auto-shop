# Performance & Observability RACI Matrix and Alert Routing

Last updated: 2025-08-20

## Purpose
Provide unambiguous ownership, escalation, and communication structure for the performance + observability stack (telemetry pipeline, quota guards, redaction, size preflight, dashboards, and alerting). Ensures fast triage, clear accountability, and consistent stakeholder awareness.

## Scope

Covers:

- Frontend telemetry client (event batching, size guard, PII redaction)
- Backend ingestion & quota logic (soft/hard quotas, drop counters)
- Performance dashboards (latency, error ratios, throughput, cache / 304 efficiency, queue depth)
- Alert rules & routing (Slack / PagerDuty)
- Operational runbooks (referenced; not redefined here)

Excludes: Security incident response (see SECURITY.md), DR procedures (see DR_PLAN.md), product analytics ownership (separate growth instrumentation).

## Roles / Abbreviations

- FE Lead: Frontend Engineering Lead
- BE Lead: Backend Engineering Lead
- SRE: Site Reliability / Infra Ops engineer (primary on-call steward)
- PM: Product Manager
- QA: Quality Engineering / Test Automation
- Data: Data/Analytics engineer
- EM: Engineering Manager

RACI Keys:

- R = Responsible (executes the work / first responder)
- A = Accountable (ultimate decision / answerable)
- C = Consulted (two-way input prior to decisions)
- I = Informed (kept up-to-date, one-way comms)

## RACI Matrix (Performance & Observability Activities)

| Activity / Decision | FE Lead | BE Lead | SRE | PM | QA | Data | EM |
|---------------------|:-------:|:------:|:---:|:--:|:--:|:----:|:--:|
| Define new performance SLOs | C | C | R | A | C | C | A |
| Adjust existing alert thresholds | C | C | R | I | C | C | A |
| Create / modify backend ingestion quota rules | I | R | C | I | C | I | A |
| Update frontend telemetry batching / client logic | R | I | C | I | C | I | A |
| Implement PII redaction policy changes | R | C | C | I | C | I | A |
| Add / modify dashboards (Grafana/Looker) | C | C | R | C | C | R | A |
| Incident triage (perf regression) | C | R | R | I | C | C | A |
| Own latency p95 objective | C | R | C | I | C | C | A |
| Own error rate objective | C | R | R | I | C | C | A |
| Maintain runbooks & playbooks | C | R | R | I | C | I | A |
| Backfill / reprocess telemetry | C | R | R | I | I | C | A |
| Capacity planning & scaling | I | C | R | C | I | C | A |
| Tooling upgrades (agents/libs) | R | C | R | I | C | C | A |
| Cross-service performance review (quarterly) | C | C | R | I | C | C | A |

Notes:

- Dual "R" (BE Lead + SRE) on incident triage indicates collaborative first response; SRE chairs bridge, BE Lead provides service depth.
- EM is Accountable for sustained SLO health but delegates day-to-day execution.

## Escalation Path (Performance Incidents)

1. Detection: Alert fires (PagerDuty) OR automated anomaly detection (latency p95 spike > SLO + 20% for 10m) OR manual report via #cust-support.
2. Primary On-Call: SRE (PagerDuty service: `perf-core`). Acknowledges within 5 minutes.
3. If backend-specific (ingestion lag, quota misfire, elevated 5XX): BE Lead pulled in within 10 minutes (Slack mention + PD add as responder).
4. If frontend-only (client batching stall, drop spike, redaction failures): FE Lead consulted.
5. If unresolved at 30 minutes or customer impact high (sev ≥ 2): EM engaged; PM informed.
6. If approaching 60 minutes without mitigation OR potential SLA breach forecast: Initiate formal incident channel `#inc-perf-<date>` and start timeline doc.
7. Post-incident: Draft summary within 24h (SRE Responsible, EM Accountable), circulate in `#eng-leads` (PM, Data Informed).

Severity quick map:

- Sev1: Widespread outage / SLO hard breach imminent (Eng leadership + EM + PM immediately).
- Sev2: Degraded performance (latency/error budget burn > 5% hourly); customer friction.
- Sev3: Minor regression / localized; handled within squad.

## Alert Routing Overview

| Alert Name | Condition (simplified) | Primary Channel | PagerDuty Service | Auto-Escalation (mins) |
|------------|------------------------|-----------------|-------------------|------------------------|
| Latency p95 Breach | p95 > SLO +20% for 10m | #perf-alerts | perf-core | 15 -> EM |
| Error Rate Spike | error_rate > 2x baseline for 5m & > 1% | #perf-alerts | perf-core | 20 -> EM |
| Ingestion Queue Backlog | queue_lag_seconds > 120 | #infra-ops | perf-core | 15 -> BE Lead |
| Event Drop Rate High | drop_rate > 3% for 10m | #perf-alerts | perf-core | 20 -> FE Lead |
| Redaction Failures | redaction_fail_count > 0 (any) | #security-observe | perf-core | 30 -> EM |
| 304 Efficiency Regression | cache_304_ratio < target-10% for 30m | #perf-alerts | perf-core | 30 -> PM |
| Quota Hard Drops Surge | hard_quota_drops > threshold (burst) | #perf-alerts | perf-core | 10 -> BE Lead |
| Telemetry Batch Flush Failures | flush_fail_rate > 5% 10m | #perf-alerts | perf-core | 20 -> FE Lead |

(Threshold specifics live in alert definitions; table conveys routing + escalation intent.)

## Key Dashboards & Ownership

| Dashboard / Panel | Metric(s) | Owner (Role) | Alert Channel | Review Cadence |
|-------------------|-----------|--------------|---------------|----------------|
| API Latency Core | p50/p95/p99 latency, error rate | BE Lead | #perf-alerts | Weekly + on incident |
| Telemetry Client Health | drop %, queue length, flush success %, redaction hits | FE Lead | #perf-alerts | Weekly |
| Ingestion Pipeline | process lag, batch size, retry counts | BE Lead | #infra-ops | Weekly |
| Quota & Drops | soft vs hard drops, oversize drops, quota utilization % | BE Lead | #perf-alerts | Bi-weekly |
| Cache / 304 Efficiency | 304 ratio, conditional hit rate | BE Lead | #perf-alerts | Monthly |
| Error Budget Burn | burn down by service & window | SRE | #perf-alerts | Weekly |
| Capacity & Throughput | RPS, CPU, memory, queue depth | SRE | #infra-ops | Monthly |
| Redaction Integrity | redaction_fail_count, pattern distribution | FE Lead | #security-observe | Monthly |
| SLA / SLO Summary | composite latency + availability | EM | #eng-leads | Monthly |

## Metric Ownership & Alert Mapping

| Metric | Definition (short) | Owner | Escalate To | Alert? |
|--------|--------------------|-------|-------------|--------|
| latency_p95 | 95th percentile request latency (core APIs) | BE Lead | SRE -> EM | Yes |
| error_rate | 5XX + explicit failure ratio | BE Lead | SRE -> EM | Yes |
| drop_rate | client events dropped / sent | FE Lead | SRE -> EM | Yes |
| oversize_drop_count | events dropped by preflight hard limit | FE Lead | FE Lead -> SRE | Yes (surge) |
| redaction_fail_count | failures in redact pass (should be zero) | FE Lead | Security (if non-zero) | Yes |
| queue_lag_seconds | ingestion processing delay | BE Lead | SRE -> EM | Yes |
| cache_304_ratio | percent of eligible requests served 304 | BE Lead | PM -> EM | Yes |
| quota_soft_utilization | % of soft quota consumed | BE Lead | SRE | Advisory |
| quota_hard_drops | count of hard quota rejections | BE Lead | EM | Yes |
| flush_fail_rate | failed batch flush attempts % | FE Lead | SRE | Yes |
| retry_attempts_avg | avg retry cycles per batch | SRE | BE Lead | No (dashboard) |
| error_budget_burn_rate | fraction of remaining error budget per day | SRE | EM | Yes |

## Communication Protocols

- Slack Alert Format: `[ALERT] <name> severity=<Sev#> current=<value> threshold=<value> link:<runbook>`
- Silence Rules: SRE may silence noisy alert for ≤2h with Jira ticket reference; >2h requires EM approval.
- Post-Incident Metrics Freeze: Changes to alert thresholds blocked for 24h post-Sev1 unless EM approves.

## Runbook References

| Area | Runbook File |
|------|--------------|
| Latency / Errors | `docs/PERFORMANCE.md` |
| Telemetry Client | (Add section in PERFORMANCE.md if missing) |
| Quota & Drops | `docs/PERFORMANCE.md#quota-guards` |
| Redaction Issues | Addendum pending (deferred) |
| Cache Efficiency | `docs/PERFORMANCE.md#cache` |
| Ingestion Pipeline | `docs/ARCHITECTURE.md#telemetry-ingestion` |

## Review & Maintenance

- Monthly ownership validation during Ops Review (SRE facilitates).
- Any ownership change requires PR updating this file + notifying `#eng-leads`.
- Metrics without active owner for 30 days are candidates for deprecation (flag in Ops Review).

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-08-20 | Initial creation | Automation Agent |

---
This document finalizes Phase C ownership & alerting structure. Future enhancements: integrate mixed-content redaction test (deferred), add redaction runbook addendum.
