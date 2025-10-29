variable "aws_region" {
  description = "AWS region for infrastructure (Lambda, API Gateway, S3, CloudFront)"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "sprint-insights"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "use_localstack" {
  description = "Whether to use LocalStack for local development"
  type        = bool
  default     = true
}

variable "s3_bucket_name" {
  description = "S3 bucket name for data storage"
  type        = string
  default     = "sprint-insights-data"
}

variable "bedrock_region" {
  description = "AWS Bedrock region (can be different from aws_region for better model availability)"
  type        = string
  default     = "us-east-1"
}

variable "bedrock_model_id" {
  description = "AWS Bedrock model ID"
  type        = string
  default     = "us.anthropic.claude-sonnet-4-20250514-v1:0"
}

variable "api_gateway_stage" {
  description = "API Gateway stage name"
  type        = string
  default     = "dev"
}

variable "skip_lambda" {
  description = "Skip Lambda and API Gateway creation (for local dev with direct Node.js execution)"
  type        = bool
  default     = true
}

# IP Whitelist Configuration
variable "allowed_ip_ranges" {
  description = "List of IP CIDR blocks allowed to access the API Gateway"
  type        = list(string)
  default     = [] # Default to empty, should be provided via tfvars file
}

variable "app_bucket_name" {
  description = "S3 bucket name for static website hosting"
  type        = string
  default     = "sprint-insights-app"
}

variable "enable_ip_whitelist" {
  description = "Enable IP whitelisting for API Gateway"
  type        = bool
  default     = true
}

variable "jira_base_url" {
  description = "Jira base URL for API integration"
  type        = string
  default     = "https://www.atlassian.net"
}

variable "buildkite_org_slug" {
  description = "Buildkite organization slug"
  type        = string
  default     = "org"
}

variable "encryption_key" {
  description = "Encryption key for sensitive data (change in production)"
  type        = string
  sensitive   = true
  default     = "default-key-change-in-production"
}
