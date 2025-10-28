#!/bin/bash

# Clean sprint data cache from S3
# Usage: ./scripts/clean-cache.sh [local|production]

# Default to local if no argument provided
ENVIRONMENT=${1:-local}

echo "🧹 Cleaning sprint data cache from S3..."
echo "Environment: $ENVIRONMENT"
echo ""

if [ "$ENVIRONMENT" = "local" ]; then
    # Check if LocalStack is running
    if ! curl -s http://localhost:4566/_localstack/health > /dev/null; then
        echo "❌ LocalStack is not running."
        echo "💡 Start LocalStack with: docker-compose up -d"
        exit 1
    fi
    
    # Set LocalStack environment variables
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_DEFAULT_REGION=us-east-1
    export AWS_ENDPOINT_URL=http://localhost:4566
    
    BUCKET_NAME="sprint-insights-data"
    
    echo "📋 Listing cached sprint data in LocalStack..."
    
elif [ "$ENVIRONMENT" = "production" ]; then
    # Production environment
    # Assumes AWS credentials are configured via environment variables or AWS CLI config
    export AWS_DEFAULT_REGION=${AWS_REGION:-us-east-1}
    
    # Read bucket name from Terraform output or use default
    cd terraform
    BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "sprint-insights-data-prod")
    cd ..
    
    echo "⚠️  WARNING: This will delete cached data from PRODUCTION S3!"
    echo "Bucket: $BUCKET_NAME"
    read -p "Are you sure? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        echo "❌ Cancelled."
        exit 0
    fi
    
    echo "📋 Listing cached sprint data in production..."
    
else
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./scripts/clean-cache.sh [local|production]"
    exit 1
fi

# List objects with sprint-data/ prefix
if [ "$ENVIRONMENT" = "local" ]; then
    OBJECTS=$(aws --endpoint-url=$AWS_ENDPOINT_URL s3api list-objects-v2 \
        --bucket $BUCKET_NAME \
        --prefix "sprint-data/" \
        --query 'Contents[].Key' \
        --output text 2>/dev/null)
else
    OBJECTS=$(aws s3api list-objects-v2 \
        --bucket $BUCKET_NAME \
        --prefix "sprint-data/" \
        --query 'Contents[].Key' \
        --output text 2>/dev/null)
fi

# Check if there are any objects to delete
if [ -z "$OBJECTS" ]; then
    echo "✅ No cached data found. Cache is already empty."
    exit 0
fi

# Count objects
OBJECT_COUNT=$(echo "$OBJECTS" | wc -w | tr -d ' ')
echo "Found $OBJECT_COUNT cached file(s):"
echo "$OBJECTS" | tr '\t' '\n' | sed 's/^/  - /'
echo ""

# Delete objects
echo "🗑️  Deleting cached files..."

if [ "$ENVIRONMENT" = "local" ]; then
    for key in $OBJECTS; do
        aws --endpoint-url=$AWS_ENDPOINT_URL s3 rm "s3://$BUCKET_NAME/$key"
    done
else
    for key in $OBJECTS; do
        aws s3 rm "s3://$BUCKET_NAME/$key"
    done
fi

echo ""
echo "✅ Cache cleaned successfully!"
echo "Deleted $OBJECT_COUNT file(s)."

# Verify deletion
if [ "$ENVIRONMENT" = "local" ]; then
    REMAINING=$(aws --endpoint-url=$AWS_ENDPOINT_URL s3api list-objects-v2 \
        --bucket $BUCKET_NAME \
        --prefix "sprint-data/" \
        --query 'Contents[].Key' \
        --output text 2>/dev/null | wc -w | tr -d ' ')
else
    REMAINING=$(aws s3api list-objects-v2 \
        --bucket $BUCKET_NAME \
        --prefix "sprint-data/" \
        --query 'Contents[].Key' \
        --output text 2>/dev/null | wc -w | tr -d ' ')
fi

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ Verification: Cache is empty."
else
    echo "⚠️  Warning: $REMAINING file(s) still remain in cache."
fi

