#!/bin/bash

# Deploy Sprint Insights API to AWS production

echo "🚀 Deploying Sprint Insights API to AWS production..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "Please create .env.production with your production environment variables:"
    echo ""
    echo "AWS_REGION=us-east-1"
    echo "S3_BUCKET_NAME=your-production-bucket"
    echo "ENCRYPTION_KEY=your-production-encryption-key"
    echo "BEDROCK_REGION=us-east-1"
    echo "BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022"
    echo "FRONTEND_URL=https://your-frontend-domain.com"
    echo ""
    exit 1
fi

# Load production environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Navigate to API directory
cd api

# Build the project
echo "📦 Building API..."
npm run build

# Deploy with Serverless Framework
echo "🔧 Deploying to AWS..."
serverless deploy --stage production

echo "✅ Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "1. Update your frontend to use the new API URL"
echo "2. Test the production API endpoints"
echo "3. Configure your production S3 bucket"