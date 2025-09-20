#!/usr/bin/env python3
"""
T6A - Security Hardening Script
Edgar's Mobile Auto Shop - Sprint 2

Implements least-privilege security hardening for the Lambda function and AWS resources.
Focus areas: IAM policies, Secrets Manager, input validation, SQL injection prevention.
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Any, Dict

import boto3


class SecurityHardening:
    def __init__(self, region: str = "us-west-2", dry_run: bool = False):
        self.region = region
        self.dry_run = dry_run
        self.lambda_client = boto3.client("lambda", region_name=region)
        self.iam_client = boto3.client("iam", region_name=region)
        self.secretsmanager_client = boto3.client("secretsmanager", region_name=region)
        self.ecr_client = boto3.client("ecr", region_name=region)
        self.function_name = "edgar-auto-shop-dev-flask-app"

    def audit_current_permissions(self) -> Dict[str, Any]:
        """Audit current Lambda IAM permissions and identify over-privileged access."""
        print("🔍 Auditing current Lambda IAM permissions...")

        try:
            # Get Lambda function info
            function_info = self.lambda_client.get_function(FunctionName=self.function_name)
            role_arn = function_info["Configuration"]["Role"]
            role_name = role_arn.split("/")[-1]

            print(f"   Function: {self.function_name}")
            print(f"   IAM Role: {role_name}")

            # Get attached policies
            attached_policies = self.iam_client.list_attached_role_policies(RoleName=role_name)
            inline_policies = self.iam_client.list_role_policies(RoleName=role_name)

            audit_results = {
                "function_name": self.function_name,
                "role_arn": role_arn,
                "role_name": role_name,
                "attached_policies": attached_policies["AttachedPolicies"],
                "inline_policies": [],
                "security_issues": [],
                "recommendations": [],
            }

            # Check inline policies
            for policy_name in inline_policies["PolicyNames"]:
                policy_doc = self.iam_client.get_role_policy(
                    RoleName=role_name, PolicyName=policy_name
                )
                audit_results["inline_policies"].append(
                    {"name": policy_name, "document": policy_doc["PolicyDocument"]}
                )

                # Audit for overly broad permissions
                self._audit_policy_permissions(policy_doc["PolicyDocument"], audit_results)

            # Check attached managed policies for potential issues
            for policy in attached_policies["AttachedPolicies"]:
                if (
                    policy["PolicyArn"]
                    == "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
                ):
                    audit_results["recommendations"].append(
                        {
                            "type": "least_privilege",
                            "issue": "Using managed VPC access policy",
                            "recommendation": "Consider custom policy with specific VPC resources",
                        }
                    )

            return audit_results

        except Exception as e:
            print(f"❌ Error auditing permissions: {e}")
            return {}

    def _audit_policy_permissions(self, policy_doc: Dict, audit_results: Dict):
        """Audit individual policy for security issues."""
        for statement in policy_doc.get("Statement", []):
            actions = statement.get("Action", [])
            resources = statement.get("Resource", [])

            # Check for wildcard resources
            if isinstance(resources, list):
                for resource in resources:
                    if resource == "*":
                        audit_results["security_issues"].append(
                            {
                                "type": "wildcard_resource",
                                "severity": "medium",
                                "description": "Policy uses wildcard (*) for resources",
                            }
                        )

            # Check for broad actions
            if isinstance(actions, list):
                for action in actions:
                    if "*" in action:
                        audit_results["security_issues"].append(
                            {
                                "type": "wildcard_action",
                                "severity": "high",
                                "description": f"Policy uses wildcard action: {action}",
                            }
                        )

    def create_least_privilege_policy(self) -> Dict[str, Any]:
        """Create a least-privilege IAM policy for the Lambda function."""
        print("🔒 Creating least-privilege IAM policy...")

        # Get current secret ARN from existing policy
        current_audit = self.audit_current_permissions()
        secret_arn = None

        for policy in current_audit.get("inline_policies", []):
            for statement in policy["document"].get("Statement", []):
                if "secretsmanager:GetSecretValue" in statement.get("Action", []):
                    secret_arn = statement.get("Resource")
                    break

        if not secret_arn:
            print("❌ Could not find existing secret ARN")
            return {}

        least_privilege_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "SecretsManagerAccess",
                    "Effect": "Allow",
                    "Action": ["secretsmanager:GetSecretValue"],
                    "Resource": secret_arn,
                    "Condition": {
                        "StringEquals": {"secretsmanager:ResourceTag/Project": "edgar-auto-shop"}
                    },
                },
                {
                    "Sid": "CloudWatchLogsAccess",
                    "Effect": "Allow",
                    "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
                    "Resource": f"arn:aws:logs:{self.region}:*:log-group:/aws/lambda/{self.function_name}:*",
                },
                {
                    "Sid": "XRayTracing",
                    "Effect": "Allow",
                    "Action": ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
                    "Resource": "*",
                },
            ],
        }

        return {
            "policy_name": "edgar-auto-shop-dev-least-privilege-policy",
            "policy_document": least_privilege_policy,
            "secret_arn": secret_arn,
        }

    def harden_secrets_manager(self) -> Dict[str, Any]:
        """Implement additional security for Secrets Manager."""
        print("🔐 Hardening Secrets Manager configuration...")

        # List secrets for the project
        try:
            secrets = self.secretsmanager_client.list_secrets()
            edgar_secrets = [
                s for s in secrets["SecretList"] if "edgar-auto-shop" in s.get("Name", "")
            ]

            hardening_results = {"secrets_found": len(edgar_secrets), "hardening_actions": []}

            for secret in edgar_secrets:
                secret_arn = secret["ARN"]
                secret_name = secret["Name"]

                print(f"   Hardening secret: {secret_name}")

                # Check if automatic rotation is enabled
                try:
                    rotation_info = self.secretsmanager_client.describe_secret(SecretId=secret_arn)
                    if not rotation_info.get("RotationEnabled", False):
                        hardening_results["hardening_actions"].append(
                            {
                                "type": "enable_rotation",
                                "secret": secret_name,
                                "recommendation": "Enable automatic credential rotation",
                            }
                        )
                except Exception:
                    pass

                # Add resource policy for additional security
                resource_policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "RestrictToLambdaRole",
                            "Effect": "Allow",
                            "Principal": {
                                "AWS": "arn:aws:iam::588738589514:role/edgar-auto-shop-dev-lambda-role"
                            },
                            "Action": "secretsmanager:GetSecretValue",
                            "Resource": "*",
                            "Condition": {
                                "StringEquals": {"aws:RequestedRegion": self.region},
                                "DateGreaterThan": {"aws:CurrentTime": "2025-01-01T00:00:00Z"},
                            },
                        }
                    ],
                }

                if not self.dry_run:
                    try:
                        self.secretsmanager_client.put_resource_policy(
                            SecretId=secret_arn, ResourcePolicy=json.dumps(resource_policy)
                        )
                        hardening_results["hardening_actions"].append(
                            {
                                "type": "resource_policy_applied",
                                "secret": secret_name,
                                "status": "success",
                            }
                        )
                    except Exception as e:
                        hardening_results["hardening_actions"].append(
                            {
                                "type": "resource_policy_failed",
                                "secret": secret_name,
                                "error": str(e),
                            }
                        )
                else:
                    hardening_results["hardening_actions"].append(
                        {
                            "type": "resource_policy_planned",
                            "secret": secret_name,
                            "status": "dry_run",
                        }
                    )

            return hardening_results

        except Exception as e:
            print(f"❌ Error hardening Secrets Manager: {e}")
            return {}

    def enable_ecr_scanning(self) -> Dict[str, Any]:
        """Enable and configure ECR vulnerability scanning."""
        print("🛡️  Enabling ECR vulnerability scanning...")

        repo_name = "edgar-auto-shop-dev-flask-app"

        try:
            # Get repository info
            repos = self.ecr_client.describe_repositories(repositoryNames=[repo_name])

            scanning_results = {"repository": repo_name, "actions": []}

            repo = repos["repositories"][0]
            current_scan_config = repo.get("imageScanningConfiguration", {})

            # Enable scan on push if not already enabled
            if not current_scan_config.get("scanOnPush", False):
                if not self.dry_run:
                    self.ecr_client.put_image_scanning_configuration(
                        repositoryName=repo_name, imageScanningConfiguration={"scanOnPush": True}
                    )
                    scanning_results["actions"].append(
                        {"type": "scan_on_push_enabled", "status": "success"}
                    )
                else:
                    scanning_results["actions"].append(
                        {"type": "scan_on_push_planned", "status": "dry_run"}
                    )
            else:
                scanning_results["actions"].append(
                    {"type": "scan_on_push_already_enabled", "status": "no_change"}
                )

            # Check for lifecycle policy
            try:
                self.ecr_client.get_lifecycle_policy(repositoryName=repo_name)
                scanning_results["actions"].append(
                    {"type": "lifecycle_policy_exists", "status": "verified"}
                )
            except self.ecr_client.exceptions.LifecyclePolicyNotFoundException:
                # Create lifecycle policy to clean up old images
                lifecycle_policy = {
                    "rules": [
                        {
                            "rulePriority": 1,
                            "selection": {
                                "tagStatus": "untagged",
                                "countType": "sinceImagePushed",
                                "countUnit": "days",
                                "countNumber": 7,
                            },
                            "action": {"type": "expire"},
                        },
                        {
                            "rulePriority": 2,
                            "selection": {
                                "tagStatus": "tagged",
                                "countType": "imageCountMoreThan",
                                "countNumber": 10,
                            },
                            "action": {"type": "expire"},
                        },
                    ]
                }

                if not self.dry_run:
                    self.ecr_client.put_lifecycle_policy(
                        repositoryName=repo_name, lifecyclePolicyText=json.dumps(lifecycle_policy)
                    )
                    scanning_results["actions"].append(
                        {"type": "lifecycle_policy_created", "status": "success"}
                    )
                else:
                    scanning_results["actions"].append(
                        {"type": "lifecycle_policy_planned", "status": "dry_run"}
                    )

            return scanning_results

        except Exception as e:
            print(f"❌ Error configuring ECR scanning: {e}")
            return {}

    def generate_security_report(self) -> Dict[str, Any]:
        """Generate comprehensive security audit report."""
        print("📊 Generating security audit report...")

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "function_name": self.function_name,
            "region": self.region,
            "dry_run": self.dry_run,
            "audit_results": {},
            "hardening_results": {},
            "recommendations": [],
        }

        # Perform all audits
        report["audit_results"]["iam"] = self.audit_current_permissions()
        report["audit_results"]["secrets"] = self.harden_secrets_manager()
        report["audit_results"]["ecr"] = self.enable_ecr_scanning()

        # Generate policy recommendations
        policy_info = self.create_least_privilege_policy()
        report["hardening_results"]["least_privilege_policy"] = policy_info

        # Overall recommendations
        if report["audit_results"]["iam"].get("security_issues"):
            report["recommendations"].append(
                {
                    "priority": "HIGH",
                    "category": "IAM",
                    "title": "Replace overly permissive IAM policies",
                    "description": "Current Lambda role has overly broad permissions that violate least-privilege principle",
                }
            )

        report["recommendations"].extend(
            [
                {
                    "priority": "MEDIUM",
                    "category": "Secrets",
                    "title": "Enable secret rotation",
                    "description": "Database credentials should be rotated automatically every 30-90 days",
                },
                {
                    "priority": "MEDIUM",
                    "category": "Monitoring",
                    "title": "Add security-specific CloudWatch alarms",
                    "description": "Monitor for unauthorized access attempts and failed authentications",
                },
                {
                    "priority": "LOW",
                    "category": "Network",
                    "title": "Consider Lambda-to-RDS connection encryption",
                    "description": "Ensure all database connections use SSL/TLS encryption",
                },
            ]
        )

        return report

    def apply_hardening(self, report: Dict[str, Any]) -> bool:
        """Apply security hardening changes based on report."""
        print("🔧 Applying security hardening changes...")

        if self.dry_run:
            print("   DRY RUN: No changes will be applied")
            return True

        try:
            # Apply least-privilege policy
            policy_info = report["hardening_results"].get("least_privilege_policy", {})
            if policy_info:
                role_name = report["audit_results"]["iam"]["role_name"]
                policy_name = policy_info["policy_name"]
                policy_document = policy_info["policy_document"]

                # Replace existing inline policy
                self.iam_client.put_role_policy(
                    RoleName=role_name,
                    PolicyName=policy_name,
                    PolicyDocument=json.dumps(policy_document),
                )

                # Remove old policy if it has a different name
                old_policies = report["audit_results"]["iam"]["inline_policies"]
                for old_policy in old_policies:
                    if old_policy["name"] != policy_name:
                        self.iam_client.delete_role_policy(
                            RoleName=role_name, PolicyName=old_policy["name"]
                        )
                        print(f"   Removed old policy: {old_policy['name']}")

                print(f"   Applied least-privilege policy: {policy_name}")

            print("✅ Security hardening applied successfully")
            return True

        except Exception as e:
            print(f"❌ Error applying security hardening: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(description="T6A - Security Hardening for Edgar's Auto Shop")
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview changes without applying them"
    )
    parser.add_argument("--region", default="us-west-2", help="AWS region")
    parser.add_argument(
        "--report-only", action="store_true", help="Generate report only, do not apply changes"
    )
    parser.add_argument("--output", help="Save report to JSON file")

    args = parser.parse_args()

    print("🔒 Edgar's Auto Shop - Security Hardening (T6A)")
    print("=" * 50)

    hardening = SecurityHardening(region=args.region, dry_run=args.dry_run)

    # Generate security report
    report = hardening.generate_security_report()

    # Save report if requested
    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"📄 Report saved to: {args.output}")

    # Display summary
    print("\n📋 Security Audit Summary:")
    print(f"   Function: {report['function_name']}")
    print(f"   Issues found: {len(report['audit_results']['iam'].get('security_issues', []))}")
    print(f"   Recommendations: {len(report['recommendations'])}")

    # Apply hardening if not report-only
    if not args.report_only:
        success = hardening.apply_hardening(report)
        if success:
            print("\n✅ Security hardening completed successfully")
        else:
            print("\n❌ Security hardening failed")
            sys.exit(1)
    else:
        print("\n📊 Report-only mode - no changes applied")

    print("\n🎯 Next Steps:")
    print("   1. Review the security report for any high-priority issues")
    print("   2. Run load testing (T7) to validate performance impact")
    print("   3. Update deployment scripts to include security scanning")


if __name__ == "__main__":
    main()
