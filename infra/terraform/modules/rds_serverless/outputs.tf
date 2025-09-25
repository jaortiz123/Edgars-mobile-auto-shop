output "cluster_endpoint" {
  description = "Aurora cluster writer endpoint"
  value       = aws_rds_cluster.aurora_serverless.endpoint
}

output "cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = aws_rds_cluster.aurora_serverless.reader_endpoint
}

output "cluster_port" {
  description = "Aurora cluster port"
  value       = aws_rds_cluster.aurora_serverless.port
}

output "cluster_identifier" {
  description = "Aurora cluster identifier"
  value       = aws_rds_cluster.aurora_serverless.cluster_identifier
}

output "database_name" {
  description = "Database name"
  value       = aws_rds_cluster.aurora_serverless.database_name
}

output "master_username" {
  description = "Database master username"
  value       = aws_rds_cluster.aurora_serverless.master_username
  sensitive   = true
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "secrets_manager_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}
