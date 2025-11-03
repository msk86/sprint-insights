terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Default AWS provider - configured based on use_localstack variable
# Provider configuration is in provider.tf

# Common tags for all resources
locals {
  common_tags = {
    Name        = "${var.project}-${var.environment}"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Data sources for permissions boundary
data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# S3 Bucket for data storage
resource "aws_s3_bucket" "sprint_insights_data" {
  bucket = var.s3_bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-data-bucket"
    }
  )
}

resource "aws_s3_bucket_versioning" "sprint_insights_data" {
  bucket = aws_s3_bucket.sprint_insights_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sprint_insights_data" {
  bucket = aws_s3_bucket.sprint_insights_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Create ZIP archive of Lambda function with dependencies
# Note: This data source creates a simple ZIP of dist/ for initial Terraform deployment
# For production deploys, use scripts/package-lambda.sh which includes node_modules
data "archive_file" "lambda_zip" {
  count = var.skip_lambda ? 0 : 1

  type        = "zip"
  source_dir  = "../api/dist"
  output_path = "../api/lambda-deployment.zip"
  
  excludes = [
    "node_modules",
    "*.map"
  ]
}

# Lambda function for API (only created when skip_lambda = false)
resource "aws_lambda_function" "sprint_insights_api" {
  count = var.skip_lambda ? 0 : 1

  filename         = data.archive_file.lambda_zip[0].output_path
  source_code_hash = data.archive_file.lambda_zip[0].output_base64sha256
  function_name    = "sprint-insights-api"
  role             = aws_iam_role.lambda_role[0].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 30

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-api-lambda"
    }
  )

  environment {
    variables = {
      NODE_ENV           = "production"
      BEDROCK_REGION     = var.bedrock_region
      BEDROCK_MODEL_ID   = var.bedrock_model_id
      S3_BUCKET_NAME     = aws_s3_bucket.sprint_insights_data.bucket
      FRONTEND_URL       = "https://${aws_cloudfront_distribution.sprint_insights_app.domain_name}"
      JIRA_BASE_URL      = var.jira_base_url
      BUILDKITE_ORG_SLUG = var.buildkite_org_slug
      ENCRYPTION_KEY     = var.encryption_key
      API_VERSION        = var.api_version
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_policy]
}

# IAM role for Lambda (only created when skip_lambda = false)
resource "aws_iam_role" "lambda_role" {
  count = var.skip_lambda ? 0 : 1

  name                 = "sprint-insights-lambda-role"
  permissions_boundary = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/myob-reserved/workloads/workload-boundary-default"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-lambda-role"
    }
  )

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda (only created when skip_lambda = false)
resource "aws_iam_policy" "lambda_policy" {
  count = var.skip_lambda ? 0 : 1

  name        = "sprint-insights-lambda-policy"
  description = "Policy for Sprint Insights Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "${aws_s3_bucket.sprint_insights_data.arn}",
          "${aws_s3_bucket.sprint_insights_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  count = var.skip_lambda ? 0 : 1

  role       = aws_iam_role.lambda_role[0].name
  policy_arn = aws_iam_policy.lambda_policy[0].arn
}

# API Gateway (only created when skip_lambda = false)
resource "aws_api_gateway_rest_api" "sprint_insights_api" {
  count = var.skip_lambda ? 0 : 1

  name        = "sprint-insights-api"
  description = "Sprint Insights API Gateway"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-api-gateway"
    }
  )

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "proxy" {
  count = var.skip_lambda ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.sprint_insights_api[0].id
  parent_id   = aws_api_gateway_rest_api.sprint_insights_api[0].root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  count = var.skip_lambda ? 0 : 1

  rest_api_id   = aws_api_gateway_rest_api.sprint_insights_api[0].id
  resource_id   = aws_api_gateway_resource.proxy[0].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  count = var.skip_lambda ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.sprint_insights_api[0].id
  resource_id = aws_api_gateway_resource.proxy[0].id
  http_method = aws_api_gateway_method.proxy[0].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.sprint_insights_api[0].invoke_arn
}

resource "aws_api_gateway_deployment" "sprint_insights_api" {
  count = var.skip_lambda ? 0 : 1

  depends_on = [
    aws_api_gateway_integration.lambda,
  ]

  rest_api_id = aws_api_gateway_rest_api.sprint_insights_api[0].id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "sprint_insights_api" {
  count = var.skip_lambda ? 0 : 1

  deployment_id = aws_api_gateway_deployment.sprint_insights_api[0].id
  rest_api_id   = aws_api_gateway_rest_api.sprint_insights_api[0].id
  stage_name    = var.api_gateway_stage

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-api-stage-${var.api_gateway_stage}"
    }
  )
}

# Lambda permission for API Gateway (only created when skip_lambda = false)
resource "aws_lambda_permission" "api_gateway" {
  count = var.skip_lambda ? 0 : 1

  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sprint_insights_api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.sprint_insights_api[0].execution_arn}/*/*"
}

# API Gateway Resource Policy with IP Whitelist (only created when skip_lambda = false)
# Note: API Gateway resource policy supports max 32 IP ranges per statement
# If more than 32 IPs, split into multiple statements
locals {
  # Use provided IPs or allow all
  base_allowed_ips = var.enable_ip_whitelist && length(var.allowed_ip_ranges) > 0 ? var.allowed_ip_ranges : ["0.0.0.0/0"]

  # Split IPs into chunks of 32 (API Gateway limit per statement)
  ip_chunks = chunklist(local.base_allowed_ips, 32)
}

resource "aws_api_gateway_rest_api_policy" "ip_whitelist" {
  count = var.skip_lambda ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.sprint_insights_api[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Create multiple statements if IPs > 32
      for idx, ip_chunk in local.ip_chunks : {
        Sid       = "AllowFromWhitelistedIPs-${idx + 1}"
        Effect    = "Allow"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "${aws_api_gateway_rest_api.sprint_insights_api[0].execution_arn}/*"
        Condition = {
          IpAddress = {
            "aws:SourceIp" = ip_chunk
          }
        }
      }
    ]
  })
}

# S3 Bucket for Static Website Hosting
resource "aws_s3_bucket" "sprint_insights_app" {
  bucket = var.app_bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-app-bucket"
    }
  )
}

resource "aws_s3_bucket_website_configuration" "sprint_insights_app" {
  bucket = aws_s3_bucket.sprint_insights_app.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "sprint_insights_app" {
  bucket = aws_s3_bucket.sprint_insights_app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "sprint_insights_app" {
  comment = "Origin Access Identity for Sprint Insights App"
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "sprint_insights_app" {
  bucket = aws_s3_bucket.sprint_insights_app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.sprint_insights_app.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.sprint_insights_app.arn}/*"
      }
    ]
  })
}

# CloudFront Distribution for Static Website
resource "aws_cloudfront_distribution" "sprint_insights_app" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket.sprint_insights_app.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.sprint_insights_app.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.sprint_insights_app.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sprint_insights_app.id}"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Custom error response to handle SPA routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.environment}-cloudfront"
    }
  )
}
