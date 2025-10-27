terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Default AWS provider - configured based on use_localstack variable
# Provider configuration is in provider.tf

# S3 Bucket for data storage
resource "aws_s3_bucket" "sprint_insights_data" {
  bucket = var.s3_bucket_name

  tags = {
    Name        = "Sprint Insights Data"
    Environment = var.environment
  }
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

# Lambda function for API (only created when skip_lambda = false)
resource "aws_lambda_function" "sprint_insights_api" {
  count = var.skip_lambda ? 0 : 1

  filename      = "../api/dist/index.js"
  function_name = "sprint-insights-api"
  role          = aws_iam_role.lambda_role[0].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      BEDROCK_REGION   = var.bedrock_region
      BEDROCK_MODEL_ID = var.bedrock_model_id
      S3_BUCKET_NAME   = aws_s3_bucket.sprint_insights_data.bucket
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_policy]
}

# IAM role for Lambda (only created when skip_lambda = false)
resource "aws_iam_role" "lambda_role" {
  count = var.skip_lambda ? 0 : 1

  name = "sprint-insights-lambda-role"

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
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.sprint_insights_data.arn}/*"
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
