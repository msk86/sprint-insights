output "api_gateway_url" {
  description = "API Gateway URL"
  value       = "${aws_api_gateway_deployment.sprint_insights_api.invoke_url}/api"
}

output "s3_bucket_name" {
  description = "S3 bucket name for data storage"
  value       = aws_s3_bucket.sprint_insights_data.bucket
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.sprint_insights_api.function_name
}
