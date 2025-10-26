#!/bin/bash

# Deploy Sprint Insights infrastructure to AWS production using Terraform

echo "🚀 Starting AWS production Terraform deployment..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Navigate to terraform directory
cd terraform

# Set environment variables for production
export TF_VAR_use_localstack=false

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init

# Plan the deployment
echo "📋 Planning Terraform deployment..."
terraform plan

# Apply the configuration
echo "🔧 Applying Terraform configuration..."
terraform apply -auto-approve

echo "✅ AWS production Terraform deployment complete!"
echo ""
echo "📊 Deployment Results:"
echo "API Gateway URL: $(terraform output -raw api_gateway_url)"
echo "S3 Bucket: $(terraform output -raw s3_bucket_name)"
echo ""
echo "🎯 Next steps:"
echo "1. Deploy the API: cd ../api && npm run deploy"
echo "2. Deploy the frontend: cd ../app && npm run build"
echo "3. Configure your team settings in the Teams page"
