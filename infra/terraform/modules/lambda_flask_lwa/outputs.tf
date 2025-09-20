output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.flask_app.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.flask_app.arn
}

output "invoke_arn" {
  description = "Lambda function invoke ARN"
  value       = aws_lambda_function.flask_app.invoke_arn
}

output "function_url" {
  description = "Lambda function URL"
  value       = aws_lambda_function_url.flask_app_url.function_url
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}
