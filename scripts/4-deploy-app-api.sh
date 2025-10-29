#!/bin/bash

# Deploy Application and API Code Only
# This script deploys application code without changing infrastructure

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Application Code (API + Frontend)...${NC}"
echo ""

# AWS Profile
if [ ! -z "$AWS_PROFILE" ]; then
    AWS_PROFILE_ARG="--profile $AWS_PROFILE"
    echo -e "${GREEN}✓ Using AWS Profile: $AWS_PROFILE${NC}"
else
    AWS_PROFILE_ARG=""
fi

# Check AWS
if ! aws sts get-caller-identity $AWS_PROFILE_ARG > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity $AWS_PROFILE_ARG --query Account --output text)

# Get region
cd "$ROOT_DIR/terraform"
if [ -f "production.tfvars" ]; then
    REGION=$(grep "^aws_region" production.tfvars | cut -d'"' -f2 || echo "us-east-1")
else
    REGION=${AWS_REGION:-us-east-1}
fi
cd "$ROOT_DIR"

AWS_CMD="aws $AWS_PROFILE_ARG"

echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ AWS Region: $REGION${NC}"
echo ""

PRODUCTION_STATE_FILE="production.tfstate"

# Get outputs
cd "$ROOT_DIR/terraform"
API_GATEWAY_URL=$(terraform output -state=$PRODUCTION_STATE_FILE -raw api_gateway_url)
APP_BUCKET_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw app_bucket_name)
CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -state=$PRODUCTION_STATE_FILE -raw cloudfront_distribution_id)
WEBSITE_URL=$(terraform output -state=$PRODUCTION_STATE_FILE -raw website_url)
LAMBDA_FUNCTION_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw lambda_function_name 2>/dev/null || echo "sprint-insights-api")
S3_BUCKET_NAME=$(terraform output -state=$PRODUCTION_STATE_FILE -raw s3_bucket_name)
cd "$ROOT_DIR"

# ========================================
# STEP 1: Build and Deploy API
# ========================================
echo -e "${BLUE}🔧 Step 1: Building and Deploying API...${NC}"
cd "$ROOT_DIR/api"

echo "  ➜ Installing API dependencies..."
npm install --production=false > /dev/null

echo "  ➜ Building and bundling API for Lambda..."
npm run build:lambda

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ API build failed${NC}"
    exit 1
fi

# Package Lambda with dependencies
echo "  ➜ Creating Lambda deployment package..."
"$ROOT_DIR/scripts/package-lambda.sh"

echo "  ➜ Updating Lambda function code..."
$AWS_CMD lambda update-function-code \
    --function-name $LAMBDA_FUNCTION_NAME \
    --zip-file fileb://lambda-deployment.zip \
    --region $REGION \
    --publish > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda code updated!${NC}"
else
    echo -e "${RED}❌ Failed to update Lambda${NC}"
    exit 1
fi

# Update env vars
echo "  ➜ Updating Lambda environment variables..."
cd "$ROOT_DIR/terraform"
JIRA_BASE_URL=$(terraform console -state=$PRODUCTION_STATE_FILE <<< "var.jira_base_url" 2>/dev/null | tr -d '"' || echo "https://www.atlassian.net")
BUILDKITE_ORG_SLUG=$(terraform console -state=$PRODUCTION_STATE_FILE <<< "var.buildkite_org_slug" 2>/dev/null | tr -d '"' || echo "org")
ENCRYPTION_KEY=$(terraform console -state=$PRODUCTION_STATE_FILE <<< "var.encryption_key" 2>/dev/null | tr -d '"' || echo "default-key")
BEDROCK_MODEL_ID=$(terraform console -state=$PRODUCTION_STATE_FILE <<< "var.bedrock_model_id" 2>/dev/null | tr -d '"' || echo "anthropic.claude-3-5-sonnet-20241022")
BEDROCK_REGION=$(terraform console -state=$PRODUCTION_STATE_FILE <<< "var.bedrock_region" 2>/dev/null | tr -d '"' || echo "us-east-1")
cd "$ROOT_DIR"

$AWS_CMD lambda update-function-configuration \
    --function-name $LAMBDA_FUNCTION_NAME \
    --environment "Variables={
        NODE_ENV=production,
        BEDROCK_REGION=$BEDROCK_REGION,
        BEDROCK_MODEL_ID=$BEDROCK_MODEL_ID,
        S3_BUCKET_NAME=$S3_BUCKET_NAME,
        ENCRYPTION_KEY=$ENCRYPTION_KEY,
        FRONTEND_URL=$WEBSITE_URL,
        JIRA_BASE_URL=$JIRA_BASE_URL,
        BUILDKITE_ORG_SLUG=$BUILDKITE_ORG_SLUG
    }" \
    --region $REGION > /dev/null

echo ""

# ========================================
# STEP 2: Build and Deploy Frontend
# ========================================
echo -e "${BLUE}🎨 Step 2: Building and Deploying Frontend...${NC}"
cd "$ROOT_DIR/app"

echo "  ➜ Installing app dependencies..."
npm install > /dev/null

echo "  ➜ Building app..."
export VITE_API_URL=$API_GATEWAY_URL
npm run build

echo "  ➜ Uploading to S3..."
aws s3 sync dist/ s3://$APP_BUCKET_NAME/ --delete --cache-control "max-age=31536000,public" --exclude "index.html" $AWS_PROFILE_ARG > /dev/null
aws s3 cp dist/index.html s3://$APP_BUCKET_NAME/index.html --cache-control "max-age=0,no-cache,no-store,must-revalidate" $AWS_PROFILE_ARG > /dev/null

echo "  ➜ Invalidating CloudFront..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text \
    $AWS_PROFILE_ARG)

echo -e "${GREEN}✅ Frontend deployed! (invalidation: $INVALIDATION_ID)${NC}"
echo ""

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Lambda:    $LAMBDA_FUNCTION_NAME (updated)"
echo "  • API URL:   $API_GATEWAY_URL"
echo "  • Frontend:  $APP_BUCKET_NAME (synced)"
echo "  • Website:   $WEBSITE_URL"
echo ""
echo -e "${BLUE}✨ Your application is live!${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
