output "api_gateway_url" {
  description = "API Gateway URL (only available when skip_lambda=false)"
  value       = var.skip_lambda ? "N/A - Use local dev server" : "${aws_api_gateway_stage.sprint_insights_api[0].invoke_url}/api"
}

output "s3_bucket_name" {
  description = "S3 bucket name for data storage"
  value       = aws_s3_bucket.sprint_insights_data.bucket
}

output "lambda_function_name" {
  description = "Lambda function name (only available when skip_lambda=false)"
  value       = var.skip_lambda ? "N/A - Use local dev server" : aws_lambda_function.sprint_insights_api[0].function_name
}
