terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.1"

  name = "${var.project}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.101.0/24", "10.0.102.0/24"]
  enable_nat_gateway = true
}

module "ecs_cluster" {
  source  = "terraform-aws-modules/ecs/aws"
  version = "5.0.0"

  cluster_name = "${var.project}-cluster"
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project}/backend"
  retention_in_days = 14
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json
}

data "aws_iam_policy_document" "ecs_task_execution_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service"; identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service"; identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([
    {
      name  = "backend"
      image = var.backend_image
      portMappings = [{
        containerPort = 3001
        protocol      = "tcp"
      }]
      environment = [{
        name  = "DATABASE_URL"
        value = aws_db_instance.app_db.address
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_security_group" "alb" {
  name   = "${var.project}-alb-sg"
  vpc_id = module.vpc.vpc_id
  ingress = [{ protocol = "tcp", from_port = 80, to_port = 80, cidr_blocks = ["0.0.0.0/0"] }]
  egress  = [{ protocol = "-1", from_port = 0, to_port = 0, cidr_blocks = ["0.0.0.0/0"] }]
}

resource "aws_security_group" "ecs_service" {
  name   = "${var.project}-ecs-sg"
  vpc_id = module.vpc.vpc_id
  ingress = [{ protocol = "tcp", from_port = 3001, to_port = 3001, security_groups = [aws_security_group.alb.id] }]
  egress  = [{ protocol = "-1", from_port = 0, to_port = 0, cidr_blocks = ["0.0.0.0/0"] }]
}

resource "aws_security_group" "db" {
  name   = "${var.project}-db-sg"
  vpc_id = module.vpc.vpc_id
  ingress = [{ protocol = "tcp", from_port = 5432, to_port = 5432, security_groups = [aws_security_group.ecs_service.id] }]
  egress  = [{ protocol = "-1", from_port = 0, to_port = 0, cidr_blocks = ["0.0.0.0/0"] }]
}

resource "aws_lb" "app" {
  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-tg"
  port        = 3001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = module.vpc.vpc_id
  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project}-backend"
  cluster         = module.ecs_cluster.cluster_id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3001
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

resource "aws_appautoscaling_target" "ecs" {
  service_namespace  = "ecs"
  resource_id        = "service/${module.ecs_cluster.cluster_name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 1
  max_capacity       = 4
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.project}-cpu"
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = 50
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_db_parameter_group" "app_db" {
  name   = "${var.project}-pg"
  family = "postgres15"
  parameter {
    name  = "max_connections"
    value = "100"
  }
}

resource "aws_db_subnet_group" "app_db" {
  name       = "${var.project}-dbsubnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_db_instance" "app_db" {
  identifier            = "${var.project}-db"
  engine                = "postgres"
  engine_version        = "15"
  instance_class        = "db.t3.micro"
  allocated_storage     = 20
  username              = var.db_username
  password              = var.db_password
  parameter_group_name  = aws_db_parameter_group.app_db.name
  db_subnet_group_name  = aws_db_subnet_group.app_db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  backup_retention_period = 7
  skip_final_snapshot   = false
  publicly_accessible   = false
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project}-frontend"
  acl    = "private"
  versioning {
    enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "s3-frontend"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 300
    max_ttl                = 86400
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project}-HighCPU"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 75
  dimensions = {
    ClusterName = module.ecs_cluster.cluster_id
    ServiceName = aws_ecs_service.backend.name
  }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project}-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric",
        x    = 0,
        y    = 0,
        width = 12,
        height = 6,
        properties = {
          metrics = [
            [ "AWS/ECS", "CPUUtilization", "ClusterName", module.ecs_cluster.cluster_id, "ServiceName", aws_ecs_service.backend.name ]
          ],
          period = 60,
          stat   = "Average",
          title  = "ECS Service CPU"
        }
      }
    ]
  })
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "rds_endpoint" {
  value = aws_db_instance.app_db.address
}
