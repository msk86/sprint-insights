#!/bin/bash

# Setup LocalStack environment for Sprint Insights

echo "Setting up LocalStack environment..."

# Check if LocalStack is running
if ! curl -s http://localhost:4566/_localstack/health > /dev/null; then
    echo "LocalStack is not running. Starting LocalStack..."
    docker-compose up -d
    echo "Waiting for LocalStack to start..."
    sleep 10
fi

# Verify LocalStack is running
if curl -s http://localhost:4566/_localstack/health | grep -q "running"; then
    echo "✅ LocalStack is running successfully!"
else
    echo "❌ Failed to start LocalStack. Please check docker-compose logs."
    exit 1
fi

echo "🎉 LocalStack setup complete!"
echo ""
echo "Next steps:"
echo "1. Run './scripts/deploy-local.sh' to deploy infrastructure"
echo "2. Run 'npm run dev' to start development servers"
