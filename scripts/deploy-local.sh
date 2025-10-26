#!/bin/bash

# Deploy Sprint Insights infrastructure to LocalStack using Terraform

echo "🚀 Starting LocalStack Terraform deployment..."

# Check if LocalStack is running
if ! curl -s http://localhost:4566/_localstack/health > /dev/null; then
    echo "❌ LocalStack is not running. Please run './scripts/setup-localstack.sh' first."
    exit 1
fi

# Set environment variables for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export TF_VAR_use_localstack=true

# Navigate to terraform directory
cd terraform

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init

# Plan the deployment
echo "📋 Planning Terraform deployment..."
terraform plan

# Apply the configuration
echo "🔧 Applying Terraform configuration..."
terraform apply -auto-approve

echo "✅ LocalStack Terraform deployment complete!"
echo ""
echo "📊 Deployment Results:"
echo "API Gateway URL: $(terraform output -raw api_gateway_url)"
echo "S3 Bucket: $(terraform output -raw s3_bucket_name)"
echo ""
echo "🎯 Next steps:"
echo "1. Run 'npm run dev' to start development servers"
echo "2. Access the application at http://localhost:3000"
echo "3. Configure your team settings in the Teams page"
