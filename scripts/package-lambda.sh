#!/bin/bash

# Package Lambda function without bundling (pure TypeScript compilation)
# Creates a deployment-ready ZIP file

set -e

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "📦 Packaging Lambda function..."

cd "$ROOT_DIR/api"

# 1. Clean old build artifacts
echo "  ➜ Cleaning old build..."
rm -rf dist
mkdir -p dist

# 2. Build with TypeScript compiler (no bundling)
echo "  ➜ Compiling TypeScript..."
npm run build:lambda

# 3. Create temp directory for packaging
TEMP_DIR=$(mktemp -d)
echo "  ➜ Creating package in $TEMP_DIR"

# 4. Copy compiled code (entire dist folder structure)
echo "  ➜ Copying compiled code..."
cp -r dist/* "$TEMP_DIR/"

# 5. Install production dependencies
echo "  ➜ Installing production dependencies..."
cd "$TEMP_DIR"
cp "$ROOT_DIR/api/package.json" .
npm install --omit=dev --no-package-lock > /dev/null 2>&1

# 6. Remove package.json (not needed in Lambda)
rm package.json

# 7. Create ZIP
echo "  ➜ Creating ZIP file..."
zip -r "$ROOT_DIR/api/lambda-deployment.zip" . -q

# 8. Cleanup
echo "  ➜ Cleaning up..."
rm -rf "$TEMP_DIR"

cd "$ROOT_DIR/api"
ZIP_SIZE=$(du -h lambda-deployment.zip | cut -f1)
echo "✅ Lambda package created: lambda-deployment.zip ($ZIP_SIZE)"

