#!/bin/bash
set -e

# Build configuration
APP_NAME="dev-tool"
VERSION="1.0.0"
BUILD_DIR="dist"
BINARY_NAME="dev-tool"

echo "🚀 Building DevTool v${VERSION}..."

# Clean previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{bin,config,web,scripts}

echo "📦 Building backend..."
cd backend
# Build for Linux (most common deployment target)
GOOS=linux GOARCH=amd64 go build -ldflags "-X main.version=${VERSION}" -o "../${BUILD_DIR}/bin/${BINARY_NAME}" main.go
cd ..

echo "🎨 Building frontend..."
cd frontend
# Install dependencies and build
npm ci
npm run build
# Copy built assets to distribution
cp -r dist/* "../${BUILD_DIR}/web/"
cd ..

echo "⚙️ Creating configuration files..."
# Copy sample flows
cp -r backend/flows "$BUILD_DIR/"

echo "📋 Creating deployment package..."
# Create tarball
tar -czf "${APP_NAME}-${VERSION}-linux-amd64.tar.gz" -C "$BUILD_DIR" .

echo "✅ Build complete!"
echo "📦 Package: ${APP_NAME}-${VERSION}-linux-amd64.tar.gz"
echo "📂 Build directory: ${BUILD_DIR}/"
echo ""
echo "To install:"
echo "  tar -xzf ${APP_NAME}-${VERSION}-linux-amd64.tar.gz"
echo "  sudo ./scripts/install.sh"
