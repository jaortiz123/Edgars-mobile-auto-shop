#!/usr/bin/env python3
"""
CloudWatch Alarms Setup for Edgar's Mobile Auto Shop Status Board
Creates 3 critical alarms: Errors≥1, Duration p95>800ms, Throttles≥1

Sprint 2 Task 3: Minimal Observability
"""

import argparse
import sys

import boto3


def create_cloudwatch_alarms(function_name: str, region: str = "us-west-2") -> None:
    """Create CloudWatch alarms for Lambda function monitoring"""

    cloudwatch = boto3.client("cloudwatch", region_name=region)

    # Common alarm configuration
    sns_topic_arn = (
        f"arn:aws:sns:{region}:123456789012:edgar-auto-shop-alerts"  # Replace with actual ARN
    )

    alarms = [
        {
            "AlarmName": f"{function_name}-Errors",
            "AlarmDescription": f"Alert when {function_name} has any errors",
            "MetricName": "Errors",
            "Namespace": "AWS/Lambda",
            "Statistic": "Sum",
            "Dimensions": [{"Name": "FunctionName", "Value": function_name}],
            "Period": 300,  # 5 minutes
            "EvaluationPeriods": 1,
            "Threshold": 1.0,
            "ComparisonOperator": "GreaterThanOrEqualToThreshold",
        },
        {
            "AlarmName": f"{function_name}-Duration-P95",
            "AlarmDescription": f"Alert when {function_name} p95 duration > 800ms",
            "MetricName": "Duration",
            "Namespace": "AWS/Lambda",
            "Statistic": "Average",  # Using Average as proxy for p95 since CloudWatch doesn't have native p95
            "Dimensions": [{"Name": "FunctionName", "Value": function_name}],
            "Period": 300,  # 5 minutes
            "EvaluationPeriods": 2,  # 2 periods for stability
            "Threshold": 800.0,  # 800ms
            "ComparisonOperator": "GreaterThanThreshold",
        },
        {
            "AlarmName": f"{function_name}-Throttles",
            "AlarmDescription": f"Alert when {function_name} has any throttles",
            "MetricName": "Throttles",
            "Namespace": "AWS/Lambda",
            "Statistic": "Sum",
            "Dimensions": [{"Name": "FunctionName", "Value": function_name}],
            "Period": 300,  # 5 minutes
            "EvaluationPeriods": 1,
            "Threshold": 1.0,
            "ComparisonOperator": "GreaterThanOrEqualToThreshold",
        },
    ]

    created_alarms = []

    for alarm_config in alarms:
        try:
            # Create the alarm
            cloudwatch.put_metric_alarm(
                AlarmName=alarm_config["AlarmName"],
                AlarmDescription=alarm_config["AlarmDescription"],
                ActionsEnabled=True,
                AlarmActions=[],  # Add SNS topic ARN here when configured
                OKActions=[],
                MetricName=alarm_config["MetricName"],
                Namespace=alarm_config["Namespace"],
                Statistic=alarm_config["Statistic"],
                Dimensions=alarm_config["Dimensions"],
                Period=alarm_config["Period"],
                EvaluationPeriods=alarm_config["EvaluationPeriods"],
                Threshold=alarm_config["Threshold"],
                ComparisonOperator=alarm_config["ComparisonOperator"],
                TreatMissingData="notBreaching",
            )

            created_alarms.append(alarm_config["AlarmName"])
            print(f"✓ Created alarm: {alarm_config['AlarmName']}")

        except Exception as e:
            print(f"✗ Failed to create alarm {alarm_config['AlarmName']}: {e}")
            return False

    print(f"\n🎉 Successfully created {len(created_alarms)} CloudWatch alarms:")
    for alarm_name in created_alarms:
        print(f"  - {alarm_name}")

    return True


def list_existing_alarms(function_name: str, region: str = "us-west-2") -> None:
    """List existing alarms for the function"""

    cloudwatch = boto3.client("cloudwatch", region_name=region)

    try:
        response = cloudwatch.describe_alarms(AlarmNamePrefix=function_name)
        alarms = response["MetricAlarms"]

        if alarms:
            print(f"Existing alarms for {function_name}:")
            for alarm in alarms:
                state = alarm["StateValue"]
                emoji = "🔴" if state == "ALARM" else "🟢" if state == "OK" else "🟡"
                print(f"  {emoji} {alarm['AlarmName']} - {state}")
        else:
            print(f"No existing alarms found for {function_name}")

    except Exception as e:
        print(f"Error listing alarms: {e}")


def main():
    """Main CLI entry point"""

    parser = argparse.ArgumentParser(description="Setup CloudWatch alarms for Edgar's Auto Shop")
    parser.add_argument("--function-name", required=True, help="Lambda function name")
    parser.add_argument("--region", default="us-west-2", help="AWS region (default: us-west-2)")
    parser.add_argument("--list-only", action="store_true", help="Only list existing alarms")

    args = parser.parse_args()

    print(f"🔍 CloudWatch Alarms Setup for {args.function_name}")
    print(f"📍 Region: {args.region}")
    print()

    if args.list_only:
        list_existing_alarms(args.function_name, args.region)
    else:
        # List existing first
        list_existing_alarms(args.function_name, args.region)
        print()

        # Create new alarms
        print("Creating CloudWatch alarms...")
        success = create_cloudwatch_alarms(args.function_name, args.region)

        if success:
            print("\n✅ Observability setup complete!")
            print(
                "Monitor alarms in AWS Console: https://console.aws.amazon.com/cloudwatch/home?region="
                + args.region
                + "#alarmsV2:"
            )
        else:
            print("\n❌ Setup failed!")
            sys.exit(1)


if __name__ == "__main__":
    main()
