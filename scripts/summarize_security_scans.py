#!/usr/bin/env python3
"""
Summarize security scan artifacts into a concise markdown report.
Reads JSON files from audit_artifacts/security and prints a summary.
"""

import json
from pathlib import Path

ART_DIR = Path("audit_artifacts/security")


def load_json(name: str):
    path = ART_DIR / name
    if not path.exists():
        return None
    try:
        raw = path.read_text()
        # Strip non-JSON prefixes (e.g., CLI banners) by finding first { or [
        start = None
        for ch in ("{", "["):
            idx = raw.find(ch)
            if idx != -1:
                start = idx if start is None else min(start, idx)
        if start is not None and start > 0:
            raw = raw[start:]
        return json.loads(raw)
    except Exception:
        return None


def summarize_bandit(data):
    if not data:
        return "- Bandit: no data"
    results = data.get("results", [])
    counts = {}
    for r in results:
        sev = (r.get("issue_severity") or "UNKNOWN").upper()
        counts[sev] = counts.get(sev, 0) + 1
    detail = ", ".join(f"{k}:{v}" for k, v in sorted(counts.items())) or "none"
    return f"- Bandit: {len(results)} findings ({detail})"


def summarize_safety(data):
    if not data:
        return "- Safety: no data"
    vulns = data.get("vulnerabilities")
    if vulns is None and isinstance(data, list):
        vulns = data
    count = len(vulns or [])
    pkgs = sorted({v.get("package_name") or v.get("package") for v in (vulns or []) if v})
    sample = ", ".join(pkgs[:5])
    more = "" if len(pkgs) <= 5 else f", +{len(pkgs)-5} more"
    return f"- Safety: {count} vulnerabilities in {len(pkgs)} packages ({sample}{more})"


def summarize_pip_audit(data):
    if not data:
        return "- pip-audit: no data"
    vulns = data if isinstance(data, list) else data.get("dependencies", [])
    # pip-audit JSON sometimes returns a list of {name,version,vulns:[...]}
    findings = 0
    pkgs = set()
    if isinstance(vulns, list):
        for dep in vulns:
            vs = dep.get("vulns") or []
            if vs:
                findings += len(vs)
                pkgs.add(dep.get("name"))
    return f"- pip-audit: {findings} advisories across {len(pkgs)} packages"


def summarize_npm_audit(data):
    if not data:
        return "- npm audit: no data"
    advisories_count = 0
    severity_counts = {}
    # modern npm audit has vulnerabilities dict with severity counts
    vulns = data.get("vulnerabilities") or {}
    for name, meta in vulns.items():
        advisories_count += 1
        sev = (meta.get("severity") or "unknown").lower()
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    detail = ", ".join(f"{k}:{v}" for k, v in sorted(severity_counts.items())) or "none"
    return f"- npm audit: {advisories_count} vulnerable packages ({detail})"


def summarize_gitleaks(data):
    if data is None:
        return "- gitleaks: no data"
    # gitleaks json report is a list with entries
    if isinstance(data, dict) and "leaks" in data:
        leaks = data.get("leaks", [])
    else:
        leaks = data if isinstance(data, list) else []
    return (
        "- gitleaks: no leaks found"
        if len(leaks) == 0
        else f"- gitleaks: {len(leaks)} potential secrets (needs triage)"
    )


def main():
    bandit = load_json("bandit.json")
    safety = load_json("safety.json")
    pip_audit = load_json("pip-audit.json")
    npm_audit = load_json("npm-audit.json")
    gitleaks = load_json("gitleaks.json")

    print("## Security Scan Summary\n")
    print(summarize_bandit(bandit))
    print(summarize_safety(safety))
    print(summarize_pip_audit(pip_audit))
    print(summarize_npm_audit(npm_audit))
    print(summarize_gitleaks(gitleaks))

    # Quick actionable hints
    notes = []
    # npm specific hint
    if npm_audit and npm_audit.get("vulnerabilities"):
        if any(
            meta.get("name") == "form-data" or "form-data" in name
            for name, meta in npm_audit["vulnerabilities"].items()
        ):
            notes.append("Update form-data to >=4.0.4 or remove transitive dependency path.")
    # pip-audit quick hints
    if pip_audit and isinstance(pip_audit, list):
        for dep in pip_audit:
            for v in dep.get("vulns", []) or []:
                fix = v.get("fix_versions") or []
                if fix:
                    notes.append(f"Python: {dep.get('name')} -> {fix[0]}")
    if notes:
        print("\n### Suggested next steps")
        for n in sorted(set(notes)):
            print(f"- {n}")


if __name__ == "__main__":
    main()
