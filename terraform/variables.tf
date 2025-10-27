variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
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
  description = "AWS Bedrock region"
  type        = string
  default     = "us-east-1"
}

variable "bedrock_model_id" {
  description = "AWS Bedrock model ID"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022"
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
