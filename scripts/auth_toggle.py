#!/usr/bin/env python3
"""
IAM Authentication Toggle for Edgar's Mobile Auto Shop Function URL
Enables/disables IAM authentication with feature flags

Sprint 2 Task 4: Auth Hardening
"""

import argparse
import json
import subprocess
import sys
from typing import Any, Dict

import boto3


def run_aws_cli(command: list, region: str) -> Dict[str, Any]:
    """Run AWS CLI command and return parsed JSON response"""
    try:
        full_command = ["aws"] + command + ["--region", region]
        result = subprocess.run(full_command, capture_output=True, text=True, check=True)
        return {"success": True, "data": json.loads(result.stdout) if result.stdout.strip() else {}}
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": f"AWS CLI error: {e.stderr.strip()}"}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"JSON decode error: {e}"}


def update_function_url_auth(
    function_name: str, enable_iam: bool, region: str = "us-west-2"
) -> Dict[str, Any]:
    """Update Lambda Function URL authentication type"""

    auth_type = "AWS_IAM" if enable_iam else "NONE"

    command = [
        "lambda",
        "update-function-url-config",
        "--function-name",
        function_name,
        "--auth-type",
        auth_type,
    ]

    result = run_aws_cli(command, region)

    if result["success"]:
        return {
            "success": True,
            "function_url": result["data"]["FunctionUrl"],
            "auth_type": result["data"]["AuthType"],
            "last_modified": result["data"]["LastModifiedTime"],
        }
    else:
        return result


def update_environment_variables(
    function_name: str, feature_flags: Dict[str, str], region: str = "us-west-2"
) -> bool:
    """Update Lambda environment variables with feature flags"""

    lambda_client = boto3.client("lambda", region_name=region)

    try:
        # Get current environment variables
        response = lambda_client.get_function_configuration(FunctionName=function_name)
        current_env = response.get("Environment", {}).get("Variables", {})

        # Update with feature flags
        updated_env = {**current_env, **feature_flags}

        # Update function configuration
        lambda_client.update_function_configuration(
            FunctionName=function_name, Environment={"Variables": updated_env}
        )

        return True

    except Exception as e:
        print(f"Error updating environment variables: {e}")
        return False


def get_current_configuration(function_name: str, region: str = "us-west-2") -> Dict[str, Any]:
    """Get current Function URL and environment configuration"""

    # Get function URL config using AWS CLI
    url_command = ["lambda", "get-function-url-config", "--function-name", function_name]
    url_result = run_aws_cli(url_command, region)

    if not url_result["success"]:
        return url_result

    # Get environment variables using boto3
    lambda_client = boto3.client("lambda", region_name=region)

    try:
        func_response = lambda_client.get_function_configuration(FunctionName=function_name)
        env_vars = func_response.get("Environment", {}).get("Variables", {})

        return {
            "success": True,
            "url_config": {
                "function_url": url_result["data"]["FunctionUrl"],
                "auth_type": url_result["data"]["AuthType"],
                "last_modified": str(url_result["data"]["LastModifiedTime"]),
            },
            "environment": env_vars,
            "feature_flags": {
                "iam_auth_enabled": env_vars.get("FEATURE_IAM_AUTH_ENABLED", "false"),
                "rate_limiting_enabled": env_vars.get("FEATURE_RATE_LIMITING_ENABLED", "false"),
                "request_logging_enabled": env_vars.get("FEATURE_REQUEST_LOGGING_ENABLED", "true"),
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    """Main CLI entry point"""

    parser = argparse.ArgumentParser(description="IAM Authentication Toggle for Edgar's Auto Shop")
    parser.add_argument("--function-name", required=True, help="Lambda function name")
    parser.add_argument("--region", default="us-west-2", help="AWS region (default: us-west-2)")

    subparsers = parser.add_subparsers(dest="action", help="Actions")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show current configuration")

    # Enable IAM command
    enable_parser = subparsers.add_parser("enable-iam", help="Enable IAM authentication")
    enable_parser.add_argument(
        "--with-flags", action="store_true", help="Also set feature flag environment variables"
    )

    # Disable IAM command
    disable_parser = subparsers.add_parser("disable-iam", help="Disable IAM authentication")
    disable_parser.add_argument(
        "--with-flags", action="store_true", help="Also update feature flag environment variables"
    )

    # Feature flags command
    flags_parser = subparsers.add_parser("set-flags", help="Update feature flags only")
    flags_parser.add_argument(
        "--iam-auth", choices=["true", "false"], help="Enable/disable IAM auth feature flag"
    )
    flags_parser.add_argument(
        "--rate-limiting",
        choices=["true", "false"],
        help="Enable/disable rate limiting feature flag",
    )
    flags_parser.add_argument(
        "--request-logging",
        choices=["true", "false"],
        help="Enable/disable request logging feature flag",
    )

    args = parser.parse_args()

    if not args.action:
        parser.print_help()
        sys.exit(1)

    print(f"🔐 IAM Authentication Toggle for {args.function_name}")
    print(f"📍 Region: {args.region}")
    print()

    if args.action == "status":
        config = get_current_configuration(args.function_name, args.region)

        if config["success"]:
            print("📊 Current Configuration:")
            print(f"  Function URL: {config['url_config']['function_url']}")
            print(f"  Auth Type: {config['url_config']['auth_type']}")
            print(f"  Last Modified: {config['url_config']['last_modified']}")
            print()
            print("🚩 Feature Flags:")
            for flag, value in config["feature_flags"].items():
                emoji = "✅" if value.lower() == "true" else "❌"
                print(f"  {emoji} {flag}: {value}")
        else:
            print(f"❌ Error getting configuration: {config['error']}")
            sys.exit(1)

    elif args.action == "enable-iam":
        print("🔒 Enabling IAM authentication...")

        # Update Function URL auth type
        result = update_function_url_auth(args.function_name, enable_iam=True, region=args.region)

        if result["success"]:
            print("✅ IAM authentication enabled")
            print(f"   Auth Type: {result['auth_type']}")
            print(f"   Function URL: {result['function_url']}")

            if args.with_flags:
                # Update feature flags
                flags = {
                    "FEATURE_IAM_AUTH_ENABLED": "true",
                    "FEATURE_RATE_LIMITING_ENABLED": "true",  # Enable rate limiting with IAM
                    "FEATURE_REQUEST_LOGGING_ENABLED": "true",
                }

                if update_environment_variables(args.function_name, flags, args.region):
                    print("✅ Feature flags updated")
                else:
                    print("⚠️ Warning: Failed to update feature flags")
        else:
            print(f"❌ Failed to enable IAM auth: {result['error']}")
            sys.exit(1)

    elif args.action == "disable-iam":
        print("🔓 Disabling IAM authentication...")

        # Update Function URL auth type
        result = update_function_url_auth(args.function_name, enable_iam=False, region=args.region)

        if result["success"]:
            print("✅ IAM authentication disabled")
            print(f"   Auth Type: {result['auth_type']}")
            print(f"   Function URL: {result['function_url']}")

            if args.with_flags:
                # Update feature flags
                flags = {
                    "FEATURE_IAM_AUTH_ENABLED": "false",
                    "FEATURE_RATE_LIMITING_ENABLED": "false",  # Disable rate limiting without IAM
                    "FEATURE_REQUEST_LOGGING_ENABLED": "true",  # Keep logging enabled
                }

                if update_environment_variables(args.function_name, flags, args.region):
                    print("✅ Feature flags updated")
                else:
                    print("⚠️ Warning: Failed to update feature flags")
        else:
            print(f"❌ Failed to disable IAM auth: {result['error']}")
            sys.exit(1)

    elif args.action == "set-flags":
        print("🚩 Updating feature flags...")

        flags = {}
        if args.iam_auth:
            flags["FEATURE_IAM_AUTH_ENABLED"] = args.iam_auth
        if args.rate_limiting:
            flags["FEATURE_RATE_LIMITING_ENABLED"] = args.rate_limiting
        if args.request_logging:
            flags["FEATURE_REQUEST_LOGGING_ENABLED"] = args.request_logging

        if flags:
            if update_environment_variables(args.function_name, flags, args.region):
                print("✅ Feature flags updated:")
                for key, value in flags.items():
                    emoji = "✅" if value == "true" else "❌"
                    print(f"   {emoji} {key}: {value}")
            else:
                print("❌ Failed to update feature flags")
                sys.exit(1)
        else:
            print("❌ No feature flags specified")
            sys.exit(1)

    print()
    print("💡 Next steps:")
    if args.action in ["enable-iam", "disable-iam"]:
        print(f"   - Test function URL: {result.get('function_url', 'N/A')}")
        print("   - Run smoke test to validate changes")
        if result["auth_type"] == "AWS_IAM":
            print("   - Configure IAM policies for client access")
            print("   - Update frontend to use AWS SigV4 authentication")
    elif args.action == "set-flags":
        print("   - Deploy updated Lambda function to apply feature flags")
        print("   - Test feature flag behavior in application")


if __name__ == "__main__":
    main()
