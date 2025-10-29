#!/bin/bash

# Deploy Infrastructure Only (Terraform)
# This script deploys AWS infrastructure:
# - S3 Buckets
# - Lambda Function (initial deployment)
# - API Gateway
# - CloudFront Distribution
# - IAM Roles and Policies

set -e  # Exit on error

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏗️  Deploying AWS Infrastructure...${NC}"
echo ""

# Set up AWS profile if specified
if [ ! -z "$AWS_PROFILE" ]; then
    AWS_PROFILE_ARG="--profile $AWS_PROFILE"
    echo -e "${GREEN}✓ Using AWS Profile: $AWS_PROFILE${NC}"
else
    AWS_PROFILE_ARG=""
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity $AWS_PROFILE_ARG > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    if [ ! -z "$AWS_PROFILE" ]; then
        echo -e "${RED}   Or check that profile '$AWS_PROFILE' exists.${NC}"
    fi
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity $AWS_PROFILE_ARG --query Account --output text)

# Get region from Terraform or use environment variable/default
cd "$ROOT_DIR/terraform"
if [ -f "production.tfvars" ]; then
    REGION=$(grep "^aws_region" production.tfvars | cut -d'"' -f2 || echo "us-east-1")
else
    REGION=${AWS_REGION:-us-east-1}
fi
cd "$ROOT_DIR"

# AWS CLI command with profile argument
AWS_CMD="aws $AWS_PROFILE_ARG"

echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ AWS Region: $REGION${NC}"
echo ""

# Production state file
PRODUCTION_STATE_FILE="production.tfstate"

# ========================================
# STEP 1: Build API (Required for Lambda ZIP)
# ========================================
echo -e "${BLUE}🔧 Step 1: Building API...${NC}"
cd "$ROOT_DIR/api"

echo "  ➜ Installing API dependencies..."
npm install --production=false

echo "  ➜ Building API..."
npm run build

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ API build failed - dist/index.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API build complete!${NC}"
echo ""

# ========================================
# STEP 2: Deploy Infrastructure (Terraform)
# ========================================
echo -e "${BLUE}🏗️  Step 2: Deploying Infrastructure with Terraform...${NC}"
cd "$ROOT_DIR/terraform"

echo "  ➜ Initializing Terraform..."
terraform init

# Check if production.tfvars exists
if [ ! -f "production.tfvars" ]; then
    echo -e "${YELLOW}⚠️  Warning: production.tfvars not found!${NC}"
    echo -e "${YELLOW}   This file should contain your IP whitelist configuration.${NC}"
    echo -e "${YELLOW}   Create it from production.tfvars.example if needed.${NC}"
    echo ""
fi

# Plan the deployment with production state file and tfvars
echo "  ➜ Planning Terraform deployment (using $PRODUCTION_STATE_FILE)..."
if [ -f "production.tfvars" ]; then
    terraform plan -state=$PRODUCTION_STATE_FILE -var-file=production.tfvars -out=tfplan
else
    terraform plan -state=$PRODUCTION_STATE_FILE -out=tfplan
fi

# Apply the configuration with production state file
echo "  ➜ Applying Terraform configuration..."
terraform apply -state=$PRODUCTION_STATE_FILE tfplan

# Get outputs from production state
API_GATEWAY_URL=$(terraform output -state=$PRODUCTION_STATE_FILE -raw api_gateway_url)
S3_BUCKET_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw s3_bucket_name)
APP_BUCKET_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw app_bucket_name)
CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -state=$PRODUCTION_STATE_FILE -raw cloudfront_distribution_id)
CLOUDFRONT_DOMAIN=$(terraform output -state=$PRODUCTION_STATE_FILE -raw cloudfront_domain_name)
WEBSITE_URL=$(terraform output -state=$PRODUCTION_STATE_FILE -raw website_url)
LAMBDA_FUNCTION_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw lambda_function_name)

echo -e "${GREEN}✅ Infrastructure deployment complete!${NC}"
echo ""

# ========================================
# Summary
# ========================================
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Infrastructure Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "  • AWS Region:        $REGION"
echo "  • Lambda Function:   $LAMBDA_FUNCTION_NAME"
echo "  • API Gateway:       $API_GATEWAY_URL"
echo "  • S3 Data Bucket:    $S3_BUCKET_NAME"
echo "  • S3 App Bucket:     $APP_BUCKET_NAME"
echo "  • CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "  • Website URL:       $WEBSITE_URL"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Deploy application code:"
echo "     ./scripts/deploy-app-api.sh"
echo ""
echo "  2. Or update just the API:"
echo "     ./scripts/deploy-api.sh"
echo ""
echo "  3. Or update just the frontend:"
echo "     ./scripts/deploy-app.sh"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

