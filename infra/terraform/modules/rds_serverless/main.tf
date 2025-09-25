# Aurora Serverless v2 Module - Cost-Optimized PostgreSQL
# Minimal ACUs with pause/resume for cost control

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where RDS will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for RDS"
  type        = list(string)
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "edgar_auto_shop"
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "edgar_admin"
}

variable "min_acu" {
  description = "Minimum Aurora Capacity Units (ACU)"
  type        = number
  default     = 0.5
}

variable "max_acu" {
  description = "Maximum Aurora Capacity Units (ACU)"
  type        = number
  default     = 1
}

variable "auto_pause" {
  description = "Enable auto-pause for Aurora Serverless"
  type        = bool
  default     = true
}

variable "auto_pause_seconds" {
  description = "Time in seconds before Aurora auto-pauses"
  type        = number
  default     = 300 # 5 minutes
}

# Random password for master user
resource "random_password" "master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.name_prefix}-db-credentials"
  description = "Database credentials for Edgar's Auto Shop"

  tags = {
    Name = "${var.name_prefix}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username            = var.master_username
    password            = random_password.master_password.result
    engine              = "postgres"
    host                = aws_rds_cluster.aurora_serverless.endpoint
    port                = aws_rds_cluster.aurora_serverless.port
    dbname              = var.database_name
    dbClusterIdentifier = aws_rds_cluster.aurora_serverless.cluster_identifier
  })

  depends_on = [aws_rds_cluster.aurora_serverless]
}

# DB Subnet Group
resource "aws_db_subnet_group" "aurora" {
  name       = "${var.name_prefix}-aurora-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.name_prefix}-aurora-subnet-group"
  }
}

# Aurora Serverless v2 Cluster
resource "aws_rds_cluster" "aurora_serverless" {
  cluster_identifier = "${var.name_prefix}-aurora-cluster"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "15.4"
  database_name      = var.database_name
  master_username    = var.master_username
  master_password    = random_password.master_password.result

  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = var.security_group_ids

  # Cost optimization settings
  backup_retention_period      = 7
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Serverless v2 scaling configuration
  serverlessv2_scaling_configuration {
    max_capacity = var.max_acu
    min_capacity = var.min_acu
  }

  # Skip final snapshot for dev environments
  skip_final_snapshot = true
  deletion_protection = false

  # Enable encryption at rest
  storage_encrypted = true

  tags = {
    Name        = "${var.name_prefix}-aurora-cluster"
    Environment = "dev"
  }
}

# Aurora Serverless v2 Instance
resource "aws_rds_cluster_instance" "aurora_serverless" {
  identifier         = "${var.name_prefix}-aurora-instance-1"
  cluster_identifier = aws_rds_cluster.aurora_serverless.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora_serverless.engine
  engine_version     = aws_rds_cluster.aurora_serverless.engine_version

  performance_insights_enabled = false # Save cost

  tags = {
    Name = "${var.name_prefix}-aurora-instance"
  }
}

# Data source to get the secret ARN for Lambda permissions
data "aws_secretsmanager_secret" "db_credentials" {
  arn = aws_secretsmanager_secret.db_credentials.arn
}
