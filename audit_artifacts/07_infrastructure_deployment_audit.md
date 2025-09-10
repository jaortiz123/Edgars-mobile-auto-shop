# 🏗️ Infrastructure & Deployment Audit

**Deliverable**: Save/export this document as `07-infrastructure-deployment-audit.md`

**Repo**: Edgar's Mobile Auto Shop
**Commit SHA**: `6175c82f35421cb1e8bf5124695ff36c314efce1`
**Auditor**: Platform Engineering Team (via GitHub Copilot)
**Date**: 2025‑09‑09

---

## 0) Objectives & Success Criteria
**Goal:** Ship safely, roll back instantly, and observe everything. Infra is reproducible (IaC), secure by default, and cost‑aware.

**Done means:**
- Environments are **immutable & reproducible** via IaC (no snowflakes).
- **Zero‑downtime** deploys with fast, verified rollbacks.
- **Runtime guardrails**: health checks, quotas, autoscaling, budgets, and alerts.
- **Supply chain** secured: SBOMs, signed images, dependency scanning.
- **Backups/DR** tested with real restores; RTO/RPO documented and met.

---

## 1) System Inventory & Discovery

### 1.1 Infra Surfaces (filled)
| Area | Tooling | Current State | Notes |
|---|---|---|---|
| IaC | Terraform / CDK / Pulumi | **Missing** | No infrastructure as code; manual shell scripts + GitHub Actions |
| Runtime | K8s / ECS / VM | **Hybrid: ECS + Gunicorn** | Local: docker-compose; Staging: AWS ECS; Production: Gunicorn 4 workers |
| Network | VPC, SGs, WAF | **CloudFront + Basic** | CloudFront CDN for staging; Docker networks; no VPC/WAF |
| Data | Postgres/RDS, S3, Redis | **AWS RDS + S3** | RDS with connection pooling; S3 for frontend; Redis containers |
| CI/CD | GitHub Actions/GitLab | **GitHub Actions** | Unified CI with ECS deployment; 6 workflows; auto staging deploy |
| Observability | OTEL, Prom, Loki, Sentry | **Health Checks Only** | Health endpoints + ECS checks; no structured observability |

Export `audit_artifacts/infra_inventory.csv`.

### 1.2 Code Searches (collect evidence)
```bash
mkdir -p audit_artifacts
# Deployment & config files
rg -n --hidden --no-ignore -S -g '!node_modules' \
  -e '\.(ya?ml)$|Dockerfile|docker-compose|Procfile|kubernetes|helm|terraform|.env' > audit_artifacts/config_file_index.txt

# Look for environment variables used in code
rg -n "process\.env\.|os\.environ\[|getenv\(" . > audit_artifacts/env_uses.txt

# GitHub Actions / CI pipelines
rg -n ".github/workflows/|.gitlab-ci.yml|azure-pipelines.yml" . > audit_artifacts/ci_pipelines.txt
```

---

## 2) Configuration & Secrets Hygiene

### 2.1 Environment Config Analysis (COMPLETED)
- **12‑Factor Compliance**: **PARTIAL** - Configuration separated from code via env vars, but significant drift detected
- **Config vs Code Separation**: **GOOD** - 227 environment variable accesses found across codebase
- **Default Values**: **MIXED** - Some safe defaults provided, but production script generates random secrets as fallbacks
- **Environment Samples**: **INCOMPLETE** - .env.example files exist but show significant drift from actual usage

**Critical Findings:**
- **16 variables in .env vs 5 in .env.example** - Major configuration drift
- **12 configuration inconsistencies** detected across environments
- **Multiple .env files** without centralized management (root, backend, frontend)

### 2.2 Secrets Management Analysis (COMPLETED)
- **Production Secrets**: **UNSAFE** - Manual deployment script with generated fallback secrets
- **Staging Secrets**: **SECURE** - GitHub Actions secrets with AWS IAM integration
- **Repository Scan**: **CLEAN** - No hardcoded secrets found in codebase
- **Secret Rotation**: **NONE** - No rotation procedures or key versioning

**Secrets Inventory:**
- **GitHub Actions**: 11 secrets (AWS credentials, ECS configuration, endpoints)
- **Environment Files**: 3 potential secrets detected (JWT_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD_HASH)
- **Production Deployment**: Dynamic secret generation with `openssl rand -hex 16`

**CRITICAL SECURITY GAP:**
```bash
# Production script generates random secrets on each deployment
export JWT_SECRET=${JWT_SECRET:-"production_jwt_secret_$(date +%s)_$(openssl rand -hex 16)"}
export FLASK_SECRET_KEY=${FLASK_SECRET_KEY:-"production_flask_secret_$(date +%s)_$(openssl rand -hex 16)"}
```
**Risk**: Secrets change on every deployment, breaking session continuity and causing authentication failures.

### 2.3 Environment Parity Issues (CRITICAL)
**Helper Script**: `scripts/audit/env_parity.py` created and executed
**Detailed Analysis**: `audit_artifacts/env_parity_analysis.json` generated

**Configuration Drift Summary:**
- **Root Environment**: 11 missing variables from example, 2 extra variables
- **Backend Environment**: 7 extra variables in example files vs actual
- **Frontend Environment**: 2 missing variables from example
- **CI Environment**: 8 variables not documented in examples

**Consistency Issues:**
1. **Different variable names** for same purpose across environments
2. **Missing documentation** for critical production variables
3. **Inconsistent secret handling** between manual and automated deployments
4. **No validation** of environment completeness in CI pipeline

---

## 3) Containers & Images

### 3.1 Dockerfile Standards
- Use **distroless** or slim base images; pin **digest** (`@sha256:…`).
- Multi‑stage builds; drop root; set `USER app`.
- Set `HEALTHCHECK`; minimal layers; cache deps.

### 3.2 Scanning & SBOM
```bash
# Lint Dockerfile
hadolint Dockerfile -f json > audit_artifacts/hadolint.json || true
# SBOM + vuln scan
syft packages dir:./ -o json > audit_artifacts/sbom.json || true
grype dir:./ -o json > audit_artifacts/grype.json || true
# Sign images (supply chain)
# cosign sign --key $KEY_REF $IMAGE_DIGEST
```

### 3.3 Runtime Policies
- Read‑only root FS; drop Linux caps; seccomp/apparmor profiles.
- Resource **requests/limits** set to support autoscaling and prevent noisy neighbors.

---

## 4) Orchestration (K8s/ECS)

### 4.1 Health & Probes
- **liveness**/**readiness**/**startup** probes defined with sensible thresholds.
- **Graceful shutdown** hooks; SIGTERM handling; drain connections.

### 4.2 Deployment Strategy
- **Blue/Green** or **Canary** (Argo Rollouts/Flagger).
- **Progressive delivery** gated by metrics (error rate, latency) and **automatic rollback**.

### 4.3 Policy & Safety Nets
- **PodDisruptionBudget**, **HPA/VPA**, **NetworkPolicies** (deny‑all + allow lists).
- **PodSecurity** (restricted); no hostPath; no privileged.
- **OPA/Gatekeeper** to enforce invariants (labels, limits, probes required).

### 4.4 Cluster & Node
- Multi‑AZ node groups; max surge/Unavailable tuned.
- Upgrade runbook; **surge upgrades** with conformance tests.

**K8s linters (attach reports):**
```bash
kube-score score -o ci ./k8s > audit_artifacts/kube_score.txt || true
kubescape scan framework nsa --format json --output audit_artifacts/kubescape.json || true
```

---

## 5) CI/CD Pipeline Reliability

### 5.1 Stages & Gates (baseline)
1) **Lint & build** → 2) **Unit/Integration** → 3) **Security scans** (SCA + SAST + image) → 4) **Package/SBOM/sign** → 5) **Deploy to preview** → 6) **Smoke & health** → 7) **Manual/auto approval** → 8) **Prod canary** → 9) **Full rollout** → 10) **Post‑deploy checks**.

### 5.2 Required Protections
- **Branch protection**: code owners, required checks, linear history.
- **Environment protection**: manual approval + 2‑person rule for prod.
- **Secrets**: OIDC‑to‑cloud (no long‑lived deploy keys).
- **Concurrency**: cancel superseded runs; environment locks.
- **Drift detection**: `terraform plan` on schedule; alert on exit code 2.

### 5.3 CI Artifacts & Observability
- Upload **coverage**, **SBOM**, **scan reports**, **Playwright traces**, **k6 summaries**.
- Promote **same artifact** from staging → prod (immutability).
- Capture **deploy metadata** (git SHA, build ID, image digest) in app `/healthz`.

---

## 6) Database Migrations & Data Safety

### 6.1 Zero‑Downtime Patterns
- **Expand‑contract**: add nullable columns → backfill → dual‑write/read → cutover → drop old.
- **Concurrent indexes** (Postgres) to avoid locks.
- Avoid destructive migrations during peak hours; feature‑flag new reads.

### 6.2 Migration Runbook
- Pre‑checks (disk, replication lag, locks).
- Backup snapshot/PITR point set.
- Rollback plan defined (including dual‑writes off).
- Post‑deploy verification queries.

---

## 7) Networking & Edge
- Private subnets for data planes; **NAT/Egress** controls; deny default egress.
- **TLS 1.2+** everywhere; ACME/ACM certificate rotation.
- CDN/Edge caching for static & APIs where safe; **WAF** + bot controls.
- **Service mesh** (optional): mTLS, retries, timeouts, circuit breakers.

---

## 8) Monitoring, Logging, Tracing
- **Metrics**: RED + USE dashboards by service; SLOs with burn rates.
- **Logs**: structured; PII redacted; centralized (Loki/ELK/CloudWatch).
- **Tracing**: OTEL SDK; W3C trace context propagated end‑to‑end.
- **Alerting**: pages on **SLO burn** and **p95 latency/error rate**; tickets on chronic warnings.

**Smoke after deploy**: synthetic checks per region/tenant; verify canary before full rollout.

---

## 9) Backups, DR & Restore Drills

### 9.1 Policy
- Define **RTO** (e.g., 30m) & **RPO** (e.g., 5m) per system.
- Automated **daily snapshots** + **WAL/PITR** for Postgres; versioned S3 with lifecycle rules.
- Cross‑region replication for critical data.

### 9.2 Verification
- **Restore drills** quarterly: restore to isolated env; run integrity checks & smoke tests.
- Record **restore time** vs RTO; adjust runbooks.

---

## 10) IAM & Least Privilege
- Bound **permissions** with IAM roles & permission boundaries; **no wildcards** in prod.
- Separate **deploy** role from **runtime** role.
- Rotate keys; enable **MFA** for humans; SSO enforced.

---

## 11) FinOps & Cost Controls
- Tag everything (`env`, `tenant`, `service`, `owner`, `cost_center`).
- **Budgets & alerts** per env; anomaly detection.
- Rightsize instances; enable **auto‑stop** for dev; consider **Savings Plans/RIs** for steady workloads.
- Surface **cost per request/tenant** in dashboards.

**Helper (Terraform tag policy):** OPA/Conftest rule requiring tags on all resources.

---

## 12) Compliance & Supply Chain
- **Dependency scanning**: Dependabot/Renovate with monthly patch windows.
- **SAST**: Semgrep/CodeQL; **DAST** for staging.
- **SBOM** (Syft) published; **image signing** (cosign); **provenance** (SLSA level 2+).
- **Release notes** include CVE deltas and remediation status.

---

## 13) Helper Scripts & Policies

### 13.1 Terraform
```bash
# Validate & lint
terraform fmt -check && terraform init -backend=false
terraform validate
# tflint + tfsec + checkov
tflint --format json > audit_artifacts/tflint.json || true
tfsec --format json --out audit_artifacts/tfsec.json || true
checkov -d infra/ -o json > audit_artifacts/checkov.json || true
# Graph
terraform graph | dot -Tpng > audit_artifacts/terraform_graph.png
```

### 13.2 Kubernetes Policies (Gatekeeper example)
```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredProbes
metadata: { name: require-probes }
spec:
  match: { kinds: [{ apiGroups: [""], kinds: ["Deployment"] }] }
  parameters:
    probes: ["readinessProbe", "livenessProbe"]
```

### 13.3 CI: Deployment Smoke
```bash
# After deploy, hit /healthz and a read/write probe; fail job on error
curl -fsS $BASE_URL/healthz
curl -fsS -X POST $BASE_URL/api/_smoke-write -H "Authorization: Bearer $SMOKE_TOKEN"
```

### 13.4 Env Var Linter
Scan code for `process.env/GETENV` keys and ensure they exist in `.env.example` and CI secrets.

---

## 14) Tests to Add (minimum set)
- **Pipeline e2e**: build → deploy to ephemeral preview → run smoke → destroy.
- **Rollback e2e**: canary fails → rollout auto‑reverted; alarms triggered.
- **Migration e2e**: expand‑contract happy path with dual‑write/read toggles.
- **Backup restore**: nightly sandbox restore with checksum + smoke.

---

## 15) Risk Scoring & Prioritization
- **Critical:** No tested rollback path; single‑AZ DB; missing backups or untested restores; public S3 buckets; unsigned images.
- **High:** No HPA/PDB; no resource limits; permissive NetworkPolicies; long‑lived CI creds.
- **Medium:** Missing tags/budgets; no drift detection; noisy logs with PII.
- **Low:** Inconsistent naming, minor IaC lint errors.

---

## 16) Remediation Plan (example)
- **Day 1–2:** Lock secrets (SSM/Secrets Manager), enable OIDC for CI, add SBOM + image scan/sign.
- **Day 3–4:** Introduce canary/blue‑green with auto‑rollback and smoke checks; add probes/limits; Gatekeeper policies.
- **Day 5:** Set up PITR + quarterly restore drills; define RTO/RPO; add budgets + anomaly alerts.
- **Day 6:** Terraform lint/sec in CI; drift detection cron; tag enforcement.

---

## 17) CI Enforcement
- Pipelines **must** publish SBOM, scan reports, and deploy metadata; failing sev ≥ High blocks.
- **The same image** (digest) promoted across environments.
- Post‑deploy smoke required; no manual overrides without incident ticket.

---

## 18) Reviewer Checklist (PR Gate)
- ☐ IaC complete; no manual steps.
- ☐ Health checks, probes, limits, and HPA defined.
- ☐ Canary/blue‑green strategy described with rollback.
- ☐ Secrets sourced from manager; no plaintext in code.
- ☐ Monitoring/alerts updated; cost tags present.

---

## 19) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top issues & owners:
1) `<INFRA‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<INFRA‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 20) Sign‑off
- SRE: `<name>`
- Security: `<name>`
- Platform Lead: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*` and this markdown in the PR or release package.
