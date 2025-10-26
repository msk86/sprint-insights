#!/bin/bash

# Test production environment configuration

echo "🧪 Testing production environment configuration..."

# Test 1: Check if .env.production exists
if [ -f ".env.production" ]; then
    echo "✅ .env.production file exists"
else
    echo "❌ .env.production file not found"
    exit 1
fi

# Test 2: Load environment variables
echo "📋 Loading production environment variables..."
export $(cat .env.production | grep -v '^#' | xargs)

# Test 3: Check required variables
echo "🔍 Checking required environment variables:"
required_vars=("AWS_REGION" "S3_BUCKET_NAME" "ENCRYPTION_KEY" "BEDROCK_REGION" "BEDROCK_MODEL_ID")

for var in "${required_vars[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✅ $var: ${!var}"
    else
        echo "❌ $var: Not set"
    fi
done

# Test 4: Test API with production environment
echo "🚀 Testing API with production environment..."
cd api
NODE_ENV=production node -e "
require('dotenv').config({ path: '../.env.production' });
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'Set' : 'Not set');
console.log('BEDROCK_REGION:', process.env.BEDROCK_REGION);
console.log('BEDROCK_MODEL_ID:', process.env.BEDROCK_MODEL_ID);
"

echo "✅ Production environment test complete!"
