## Branch protection and CI baseline

This document tracks the default branch, existing CI workflows, candidate required checks, and the protection plan for `main`.

### Discovery summary

- **Default branch (GitHub)**: main
- **Remote HEAD**: main
- **Local current branch at discovery**: main (now working on `chore/branch-protection-docs`)

### Existing workflows and jobs

- **Workflow**: CI/CD Pipeline (`.github/workflows/ci.yml`)
  - Jobs: `frontend-lint`, `backend-lint`, `backend-tests`, `no-db-smoke-tests`, `docs-curl`, `frontend-tests`, `accessibility-tests`, `cross-browser-smoke` (matrix), `e2e-tests`, `build-and-scan`, `coverage-summary`, `docker-deploy`, `db-migration`, `backend-integration-tests`, `performance-smoke-tests`, `aggregate-retry-reports`

- **Workflow**: CI/CD Pipeline (`.github/workflows/ci-cd.yml`)
  - Jobs: `terraform` (Terraform Lint & Plan), `deploy_and_smoke` (Deploy & Smoke Tests)

- **Workflow**: Deploy Frontend (`.github/workflows/deploy-frontend.yml`)
  - Jobs: `build-deploy`

- **Workflow**: Accessibility Tests (`.github/workflows/accessibility.yml`)
  - Jobs: `accessibility`

### Candidate required checks (to be verified by CI)

Only include checks that exist in this repo and are appropriate as gating signals:

- Lint: `CI/CD Pipeline / frontend-lint`, `CI/CD Pipeline / backend-lint`
- Unit/coverage: `CI/CD Pipeline / backend-tests`, `CI/CD Pipeline / frontend-tests`
- API smoke: `CI/CD Pipeline / no-db-smoke-tests`, `CI/CD Pipeline / docs-curl`
- Build/security: `CI/CD Pipeline / build-and-scan`

Note: Matrix jobs like `cross-browser-smoke` are intentionally not required due to per-matrix naming variance. Long-running deploy jobs (e.g., `docker-deploy`, `deploy_and_smoke`) are excluded from required contexts.

### CODEOWNERS

- No `CODEOWNERS` file found. Add one later if desired (not included in this PR).

### Branching and PR conventions

- Create a feature branch from `main`.
- Open a PR targeting `main`.
- Use squash merges only.
- Enable “Automatically delete head branches” in Settings → General → Pull Requests.

### Protection plan (dry-run)

Pending CI verification of passing checks, plan for `main`:

```json
{
  "require_pull_request_reviews": { "required_approving_review_count": 1 },
  "require_status_checks": true,
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI/CD Pipeline / frontend-lint",
      "CI/CD Pipeline / backend-lint",
      "CI/CD Pipeline / backend-tests",
      "CI/CD Pipeline / frontend-tests",
      "CI/CD Pipeline / no-db-smoke-tests",
      "CI/CD Pipeline / docs-curl",
      "CI/CD Pipeline / build-and-scan"
    ]
  },
  "enforce_admins": true,
  "required_linear_history": true,
  "dismiss_stale_reviews": true,
  "require_conversation_resolution": true
}
```

Final enforced contexts will match those that are actually passing on `main` and on this PR.

### Local defaults

- Ensure remote HEAD is set to `main` using: `git remote set-head origin -a`.

### FAQ

- What if a check starts failing?
  - Fix the failure; if the check is flaky or deprecated, update the protection rule to remove it after team agreement.

- How to add a new required check?
  - Land the workflow on `main`, ensure it passes reliably across a few runs, then add it to the required contexts list in branch protection settings.


