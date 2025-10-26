# Production AWS provider configuration
# This configuration is used for AWS production deployment

provider "aws" {
  alias  = "production"
  region = var.aws_region
  
  # Production AWS configuration
  # Uses default AWS credentials (AWS CLI, IAM roles, etc.)
}
