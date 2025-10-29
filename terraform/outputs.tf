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

output "app_bucket_name" {
  description = "S3 bucket name for static website hosting"
  value       = aws_s3_bucket.sprint_insights_app.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the app"
  value       = aws_cloudfront_distribution.sprint_insights_app.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name for accessing the app"
  value       = aws_cloudfront_distribution.sprint_insights_app.domain_name
}

output "website_url" {
  description = "Website URL (via CloudFront)"
  value       = "https://${aws_cloudfront_distribution.sprint_insights_app.domain_name}"
}

output "ip_whitelist_enabled" {
  description = "Whether IP whitelisting is enabled for API Gateway"
  value       = var.enable_ip_whitelist
  sensitive   = false
}

output "ip_whitelist_count" {
  description = "Number of IP ranges whitelisted"
  value       = length(local.base_allowed_ips)
  sensitive   = false
}

output "ip_whitelist_statements" {
  description = "Number of policy statements (splits at 32 IPs per statement)"
  value       = length(local.ip_chunks)
  sensitive   = false
}
