# Automated Scans Triage Summary (Section 2)

Date: 2025-09-07
Scope: Local re-run of Bandit and Safety (JSON artifacts untracked per policy).

## Safety (2 vulnerabilities)

- Package: urllib3
  - CVE-2025-50181: Redirect control could be effectively disabled pre-2.5.0 in some PoolManager configurations, weakening SSRF/open-redirect mitigations.
    - Impact: Relevant only if relying on PoolManager-level redirect disabling; mitigated by pinning urllib3>=2.5.0 in `backend/requirements.txt`.
  - CVE-2025-50182: In Pyodide/JS runtimes, urllib3 redirect controls are ignored between 2.2.0 and <2.5.0.
    - Impact: Not applicable to our server-side backend; also mitigated by urllib3>=2.5.0.

Note: Local venv showed urllib3 1.26.20 during scan; upgrade local env to align with the repo pin for clean runs.

## Bandit (MEDIUM findings)

Bandit MEDIUM total: 54

- B608 hardcoded_sql_expressions (40)
  - Risk: Low. Runtime paths use strict column whitelists plus bound parameters; remaining generators build text-only seed SQL and do not execute it.
- B102 exec_used (5)
  - Risk: Low. Occurs in vendored/utility code (e.g., six.py) not fed with untrusted input and not on request paths.
- B104 hardcoded_bind_all_interfaces (3)
  - Risk: Low. Dev/test server binds; production uses managed ingress. Documented as dev-only.
- B108 hardcoded_tmp_directory (3)
  - Risk: Low. Local utilities; no adversarial local users. Optional improvement: prefer tempfile APIs consistently.
- B113 request_without_timeout (3)
  - Risk: Low. Mostly tests/validation scripts; availability concern, not a security flaw. Optional: add explicit timeouts.

Conclusion: All critical/high items addressed earlier; remaining MEDIUM items are low risk in this application context with mitigations and justifications documented.
