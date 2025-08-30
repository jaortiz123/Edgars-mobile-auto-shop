data "aws_caller_identity" "current" {}

# ECS task execution role (pull from ECR, write logs)
resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-task-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_trust.json
}

data "aws_iam_policy_document" "ecs_task_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_exec_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Application task role (least-privilege; extend as needed)
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_trust.json
}

# GitHub OIDC Provider (for keyless CI deployments)
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# Role assumed by GitHub Actions to deploy to staging
data "aws_iam_policy_document" "gha_assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restrict to this repository
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:jaortiz123/Edgars-mobile-auto-shop:*"]
    }
  }
}

resource "aws_iam_role" "gha_staging_deployer" {
  name               = "${local.name_prefix}-gha-staging-deployer"
  assume_role_policy = data.aws_iam_policy_document.gha_assume.json
}

# Inline policy permitting ECR push, ECS register/update, S3 sync, CloudFront invalidation, and iam:PassRole for task exec role
data "aws_iam_policy_document" "gha_permissions" {
  statement {
    sid     = "EcrAuth"
    effect  = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:BatchGetImage",
      "ecr:DescribeRepositories",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "EcsRegisterUpdate"
    effect  = "Allow"
    actions = [
      "ecs:Describe*",
      "ecs:RegisterTaskDefinition",
      "ecs:UpdateService"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "IamPassRole"
    effect  = "Allow"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.ecs_task_execution.arn,
      aws_iam_role.ecs_task.arn
    ]
  }

  statement {
    sid     = "S3Sync"
    effect  = "Allow"
    actions = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
    resources = [
      aws_s3_bucket.frontend.arn,
      "${aws_s3_bucket.frontend.arn}/*"
    ]
  }

  statement {
    sid     = "CloudFrontInvalidate"
    effect  = "Allow"
    actions = ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution", "cloudfront:GetInvalidation"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "gha_policy" {
  name   = "${local.name_prefix}-gha-staging-deploy"
  policy = data.aws_iam_policy_document.gha_permissions.json
}

resource "aws_iam_role_policy_attachment" "gha_attach" {
  role       = aws_iam_role.gha_staging_deployer.name
  policy_arn = aws_iam_policy.gha_policy.arn
}

output "gha_deployer_role_arn" {
  description = "IAM role ARN to be assumed by GitHub Actions via OIDC"
  value       = aws_iam_role.gha_staging_deployer.arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}
