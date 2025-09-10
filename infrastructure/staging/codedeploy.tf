# Blue/Green Deployment Configuration for Production Reliability
# This file configures AWS CodeDeploy for zero-downtime ECS deployments

# CodeDeploy Application
resource "aws_codedeploy_app" "ecs_app" {
  compute_platform = "ECS"
  name             = "${local.name_prefix}-codedeploy-app"
}

# CodeDeploy Service Role
resource "aws_iam_role" "codedeploy_service_role" {
  name = "${local.name_prefix}-codedeploy-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })
}

# Attach the CodeDeploy ECS service role policy
resource "aws_iam_role_policy_attachment" "codedeploy_service_role_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
  role       = aws_iam_role.codedeploy_service_role.name
}

# Additional permissions for ECS and ALB
resource "aws_iam_role_policy" "codedeploy_additional_permissions" {
  name = "${local.name_prefix}-codedeploy-additional"
  role = aws_iam_role.codedeploy_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:CreateTaskSet",
          "ecs:DeleteTaskSet",
          "ecs:DescribeServices",
          "ecs:UpdateServicePrimaryTaskSet",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:ModifyRule",
          "lambda:InvokeFunction",
          "cloudwatch:DescribeAlarms",
          "sns:Publish",
          "s3:GetObject"
        ]
        Resource = "*"
      }
    ]
  })
}

# Blue/Green Target Group (for Blue/Green deployments)
resource "aws_lb_target_group" "blue_green" {
  name        = "${local.name_prefix}-bg-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    matcher             = "200-399"
  }

  tags = {
    Name = "${local.name_prefix}-blue-green-target-group"
  }
}

# Test listener for Blue/Green deployments (port 8080)
resource "aws_lb_listener" "test" {
  load_balancer_arn = aws_lb.this.arn
  port              = "8080"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue_green.arn
  }
}

# CodeDeploy Deployment Group
resource "aws_codedeploy_deployment_group" "ecs_deployment_group" {
  app_name               = aws_codedeploy_app.ecs_app.name
  deployment_group_name  = "${local.name_prefix}-deployment-group"
  service_role_arn       = aws_iam_role.codedeploy_service_role.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnceBlueGreen"

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                         = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.this.name
    service_name = aws_ecs_service.backend.name
  }

  load_balancer_info {
    target_group_info {
      name = aws_lb_target_group.this.name
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms  = [
      aws_cloudwatch_metric_alarm.deployment_failed.name,
      aws_cloudwatch_metric_alarm.ecs_cpu_high.name,
      aws_cloudwatch_metric_alarm.ecs_memory_high.name
    ]
  }
}

# CloudWatch Alarm for Deployment Failures
resource "aws_cloudwatch_metric_alarm" "deployment_failed" {
  alarm_name          = "${local.name_prefix}-deployment-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DeploymentFailed"
  namespace           = "AWS/CodeDeploy"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors CodeDeploy deployment failures"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApplicationName     = aws_codedeploy_app.ecs_app.name
    DeploymentGroupName = aws_codedeploy_deployment_group.ecs_deployment_group.deployment_group_name
  }
}

# Pre-Traffic Hook Lambda Function (optional validation)
resource "aws_lambda_function" "pre_traffic_hook" {
  count         = var.enable_pre_traffic_validation ? 1 : 0
  filename      = "pre_traffic_hook.zip"
  function_name = "${local.name_prefix}-pre-traffic-hook"
  role          = aws_iam_role.lambda_execution_role[0].arn
  handler       = "index.handler"
  runtime       = "python3.9"
  timeout       = 60

  source_code_hash = data.archive_file.pre_traffic_hook[0].output_base64sha256
}

# Lambda execution role for pre-traffic hook
resource "aws_iam_role" "lambda_execution_role" {
  count = var.enable_pre_traffic_validation ? 1 : 0
  name  = "${local.name_prefix}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count      = var.enable_pre_traffic_validation ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role[0].name
}

# Lambda function code for pre-traffic validation
data "archive_file" "pre_traffic_hook" {
  count       = var.enable_pre_traffic_validation ? 1 : 0
  type        = "zip"
  output_path = "pre_traffic_hook.zip"

  source {
    content = <<EOF
import json
import boto3
import urllib3

def handler(event, context):
    """
    Pre-traffic hook for Blue/Green deployment validation.
    Validates the new deployment before traffic is shifted.
    """
    codedeploy = boto3.client('codedeploy')

    try:
        # Get deployment info
        deployment_id = event['DeploymentId']
        lifecycle_event_hook_execution_id = event['LifecycleEventHookExecutionId']

        # Perform health check on new deployment
        # This is where you would add custom validation logic

        # For now, we'll do a simple HTTP health check
        http = urllib3.PoolManager()

        # You would get the actual endpoint from deployment info
        # This is a simplified example
        health_url = "http://example.com/health"

        try:
            response = http.request('GET', health_url, timeout=10)
            if response.status == 200:
                # Health check passed
                status = 'Succeeded'
            else:
                status = 'Failed'
        except Exception as e:
            print(f"Health check failed: {str(e)}")
            status = 'Failed'

        # Report status back to CodeDeploy
        codedeploy.put_lifecycle_event_hook_execution_status(
            deploymentId=deployment_id,
            lifecycleEventHookExecutionId=lifecycle_event_hook_execution_id,
            status=status
        )

        return {
            'statusCode': 200,
            'body': json.dumps(f'Pre-traffic validation {status}')
        }

    except Exception as e:
        print(f"Error in pre-traffic hook: {str(e)}")
        # Fail the deployment on error
        codedeploy.put_lifecycle_event_hook_execution_status(
            deploymentId=deployment_id,
            lifecycleEventHookExecutionId=lifecycle_event_hook_execution_id,
            status='Failed'
        )
        raise e
EOF
    filename = "index.py"
  }
}

# Output important resources for CI/CD pipeline
output "codedeploy_app_name" {
  description = "CodeDeploy application name for CI/CD pipeline"
  value       = aws_codedeploy_app.ecs_app.name
}

output "codedeploy_deployment_group_name" {
  description = "CodeDeploy deployment group name for CI/CD pipeline"
  value       = aws_codedeploy_deployment_group.ecs_deployment_group.deployment_group_name
}

output "blue_green_target_group_arn" {
  description = "Blue/Green target group ARN for deployments"
  value       = aws_lb_target_group.blue_green.arn
}

output "test_listener_arn" {
  description = "Test listener ARN for Blue/Green deployments"
  value       = aws_lb_listener.test.arn
}
