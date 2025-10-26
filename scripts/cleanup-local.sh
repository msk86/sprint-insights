#!/bin/bash

# Clean up LocalStack resources

echo "🧹 Cleaning up LocalStack resources..."

# Check if LocalStack is running
if ! curl -s http://localhost:4566/_localstack/health > /dev/null; then
    echo "❌ LocalStack is not running. Nothing to clean up."
    exit 1
fi

# Set environment variables for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Navigate to terraform directory
cd terraform

# Destroy Terraform resources
echo "🗑️ Destroying Terraform resources..."
terraform destroy -auto-approve

echo "✅ LocalStack cleanup complete!"
echo ""
echo "💡 To restart LocalStack:"
echo "1. Run './scripts/setup-localstack.sh'"
echo "2. Run './scripts/deploy-local.sh'"
