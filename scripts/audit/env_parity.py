#!/usr/bin/env python3
"""
Environment Parity Checker for Edgar's Mobile Auto Shop
Detects configuration drift between .env files and CI secrets.
Part of Infrastructure & Deployment Audit #7 - Phase 2
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set


@dataclass
class EnvAnalysis:
    """Analysis results for environment configuration."""

    file_path: str
    variables: Set[str]
    secrets: Set[str]
    missing_from_example: Set[str]
    extra_in_example: Set[str]


class EnvironmentParityChecker:
    """Checks environment variable parity across different environments."""

    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.secret_patterns = {
            "PASSWORD",
            "SECRET",
            "KEY",
            "TOKEN",
            "PRIVATE",
            "HASH",
            "SALT",
            "CREDENTIAL",
            "AUTH",
        }

    def extract_env_vars(self, file_path: Path) -> Set[str]:
        """Extract environment variable names from a file."""
        if not file_path.exists():
            return set()

        variables = set()
        try:
            with open(file_path) as f:
                for line in f:
                    line = line.strip()
                    # Skip comments and empty lines
                    if line.startswith("#") or not line:
                        continue
                    # Extract variable name
                    if "=" in line:
                        var_name = line.split("=")[0].strip()
                        if var_name and var_name.isupper():
                            variables.add(var_name)
        except Exception as e:
            print(f"⚠️  Error reading {file_path}: {e}")

        return variables

    def extract_ci_secrets(self, workflow_file: Path) -> Set[str]:
        """Extract secret references from GitHub Actions workflow."""
        if not workflow_file.exists():
            return set()

        secrets = set()
        try:
            with open(workflow_file) as f:
                content = f.read()
                # Find all ${{ secrets.VAR_NAME }} patterns
                secret_matches = re.findall(r"\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}", content)
                secrets.update(secret_matches)

                # Also find environment variables that might be secrets
                env_matches = re.findall(r"([A-Z_]+):\s*\$\{\{\s*secrets\.", content)
                secrets.update(env_matches)

        except Exception as e:
            print(f"⚠️  Error reading {workflow_file}: {e}")

        return secrets

    def classify_as_secret(self, var_name: str) -> bool:
        """Determine if a variable name indicates it contains secret data."""
        return any(pattern in var_name.upper() for pattern in self.secret_patterns)

    def analyze_environment_files(self) -> Dict[str, EnvAnalysis]:
        """Analyze all environment files in the project."""
        env_files = {
            "root_example": self.project_root / ".env.example",
            "root_actual": self.project_root / ".env",
            "root_ci": self.project_root / ".env.ci",
            "backend_example": self.project_root / "backend" / ".env.example",
            "backend_actual": self.project_root / "backend" / ".env",
            "backend_dev": self.project_root / "backend" / ".env.dev",
            "frontend_example": self.project_root / "frontend" / ".env.example",
            "frontend_actual": self.project_root / "frontend" / ".env",
        }

        results = {}

        for name, file_path in env_files.items():
            if file_path.exists():
                variables = self.extract_env_vars(file_path)
                secrets = {var for var in variables if self.classify_as_secret(var)}

                # Compare with corresponding example file
                example_name = (
                    name.replace("_actual", "_example")
                    .replace("_dev", "_example")
                    .replace("_ci", "_example")
                )
                example_file = env_files.get(example_name)

                missing_from_example = set()
                extra_in_example = set()

                if example_file and example_file.exists() and name != example_name:
                    example_vars = self.extract_env_vars(example_file)
                    missing_from_example = variables - example_vars
                    extra_in_example = example_vars - variables

                results[name] = EnvAnalysis(
                    file_path=str(file_path),
                    variables=variables,
                    secrets=secrets,
                    missing_from_example=missing_from_example,
                    extra_in_example=extra_in_example,
                )

        return results

    def analyze_ci_secrets(self) -> Set[str]:
        """Analyze secrets used in CI/CD pipeline."""
        workflow_file = self.project_root / ".github" / "workflows" / "unified-ci.yml"
        return self.extract_ci_secrets(workflow_file)

    def check_12_factor_compliance(self, analysis: Dict[str, EnvAnalysis]) -> Dict[str, List[str]]:
        """Check 12-Factor App configuration compliance."""
        issues = {
            "hardcoded_config": [],
            "missing_separation": [],
            "secret_exposure": [],
            "drift_detected": [],
        }

        for name, result in analysis.items():
            # Check for configuration drift
            if result.missing_from_example:
                issues["drift_detected"].append(
                    f"{name}: Missing from example: {', '.join(sorted(result.missing_from_example))}"
                )

            if result.extra_in_example:
                issues["drift_detected"].append(
                    f"{name}: Extra in example: {', '.join(sorted(result.extra_in_example))}"
                )

            # Check for potential secret exposure
            if result.secrets:
                issues["secret_exposure"].append(
                    f"{name}: Contains potential secrets: {', '.join(sorted(result.secrets))}"
                )

        return issues

    def generate_report(self) -> None:
        """Generate comprehensive environment parity report."""
        print("🔍 Environment Parity Analysis Report")
        print("=" * 50)

        # Analyze environment files
        env_analysis = self.analyze_environment_files()

        # Analyze CI secrets
        ci_secrets = self.analyze_ci_secrets()

        # Check 12-factor compliance
        compliance_issues = self.check_12_factor_compliance(env_analysis)

        # Environment Files Summary
        print("\n📋 Environment Files Summary:")
        for name, analysis in env_analysis.items():
            if analysis.variables:
                secret_count = len(analysis.secrets)
                total_count = len(analysis.variables)
                print(f"  {name}: {total_count} vars ({secret_count} secrets)")

        # CI/CD Secrets Summary
        print(f"\n🔐 CI/CD Secrets: {len(ci_secrets)} secrets configured")
        if ci_secrets:
            print(f"  Secrets: {', '.join(sorted(ci_secrets))}")

        # Configuration Drift Analysis
        print("\n⚠️  Configuration Drift Issues:")
        for category, issues in compliance_issues.items():
            if issues:
                print(f"\n  {category.replace('_', ' ').title()}:")
                for issue in issues:
                    print(f"    • {issue}")

        # Critical Findings
        print("\n🚨 Critical Security Findings:")

        # Production vs Staging Secrets Management
        print("  • Production: Manual secret generation in start_production.sh")
        print("  • Staging: GitHub Actions secrets with AWS IAM")
        print("  • Risk: Inconsistent secret management between environments")

        # Environment Variable Exposure
        all_secrets = set()
        for analysis in env_analysis.values():
            all_secrets.update(analysis.secrets)

        if all_secrets:
            print(f"  • {len(all_secrets)} potential secrets detected across environments")

        # Configuration Completeness
        drift_count = len([issue for issues in compliance_issues.values() for issue in issues])
        if drift_count > 0:
            print(f"  • {drift_count} configuration drift issues detected")

        # Recommendations
        print("\n💡 Recommendations:")
        print("  1. Implement AWS Secrets Manager/SSM Parameter Store")
        print("  2. Standardize secret management across all environments")
        print("  3. Remove hardcoded fallback secrets from production script")
        print("  4. Add .env.example validation to CI pipeline")
        print("  5. Implement secret rotation procedures")

        # Save detailed analysis
        output_file = self.project_root / "audit_artifacts" / "env_parity_analysis.json"
        output_file.parent.mkdir(exist_ok=True)

        output_data = {
            "env_files": {
                name: {
                    "file_path": analysis.file_path,
                    "variable_count": len(analysis.variables),
                    "secret_count": len(analysis.secrets),
                    "variables": sorted(analysis.variables),
                    "secrets": sorted(analysis.secrets),
                    "missing_from_example": sorted(analysis.missing_from_example),
                    "extra_in_example": sorted(analysis.extra_in_example),
                }
                for name, analysis in env_analysis.items()
            },
            "ci_secrets": sorted(ci_secrets),
            "compliance_issues": compliance_issues,
            "summary": {
                "total_env_files": len(env_analysis),
                "total_ci_secrets": len(ci_secrets),
                "total_drift_issues": drift_count,
            },
        }

        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)

        print(f"\n📄 Detailed analysis saved to: {output_file}")


if __name__ == "__main__":
    checker = EnvironmentParityChecker()
    checker.generate_report()
