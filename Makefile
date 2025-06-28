# DevTool Makefile
.PHONY: help build build-frontend build-backend clean test install uninstall package dev

# Configuration
APP_NAME := dev-tool
VERSION := 1.0.0
BUILD_DIR := dist
BINARY_NAME := dev-tool
PACKAGE_NAME := $(APP_NAME)-$(VERSION)-linux-amd64

# Go build flags
LDFLAGS := -ldflags "-X main.version=$(VERSION) -s -w"
BUILD_FLAGS := $(LDFLAGS)

# Default target
help: ## Show this help message
	@echo "DevTool v$(VERSION) - Build System"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: clean build-backend build-frontend package ## Build complete application
	@echo "✅ Build complete!"

build-backend: ## Build Go backend binary
	@echo "📦 Building backend..."
	@mkdir -p $(BUILD_DIR)/bin
	echo "Command Executing: cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME) main.go"
	@cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME) main.go
	@echo "✅ Backend built successfully"

build-frontend: ## Build React frontend
	@echo "🎨 Building frontend..."
	echo "Command Executing: cd frontend && npm ci && npm run build"
	@mkdir -p $(BUILD_DIR)/web
	@cd frontend && npm ci && npm run build
	echo "Command Executing: cp -r frontend/dist/* $(BUILD_DIR)/web/"
	@cp -r frontend/dist/* $(BUILD_DIR)/web/
	@echo "✅ Frontend built successfully"

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	echo "Command Executing: rm -rf $(BUILD_DIR)"
	@rm -rf $(BUILD_DIR)
	echo "Command Executing: rm -f $(PACKAGE_NAME).tar.gz"
	@rm -f $(PACKAGE_NAME).tar.gz
	@echo "✅ Clean complete"

test: ## Run tests
	@echo "🧪 Running tests..."
	echo "Command Executing: cd backend && go test ./..."
	@cd backend && go test ./...
	echo "Command Executing: cd frontend && npm test -- --run"
	@cd frontend && npm test -- --run
	@echo "✅ Tests complete"

dev-backend: ## Run backend in development mode
	@echo "🚀 Starting backend in development mode..."
	echo "Command Executing: cd backend && go run main.go --config=../config.yaml"
	@cd backend && go run main.go --config=../config.yaml

dev-frontend: ## Run frontend in development mode
	@echo "🎨 Starting frontend in development mode..."
	echo "Command Executing: cd frontend && npm run dev"
	@cd frontend && npm run dev

dev: ## Start both backend and frontend in development mode
	@echo "🚀 Starting development servers..."
	echo "Command Executing: make -j2 dev-backend dev-frontend"
	@make -j2 dev-backend dev-frontend

package: ## Create deployment package
	@echo "📦 Creating deployment package..."
	echo "Command Executing: mkdir -p $(BUILD_DIR)/scripts"
	@mkdir -p $(BUILD_DIR)/scripts
	echo "Command Executing: cp config.yaml $(BUILD_DIR)/"
	@cp config.yaml $(BUILD_DIR)/
	echo "Command Executing: cp install.sh $(BUILD_DIR)/scripts/"
	@cp install.sh $(BUILD_DIR)/scripts/
	echo "Command Executing: cp backend/flows $(BUILD_DIR)/ -r 2>/dev/null || echo "No flows directory found""
	@cp backend/flows $(BUILD_DIR)/ -r 2>/dev/null || echo "No flows directory found"
	echo "Command Executing: chmod +x $(BUILD_DIR)/scripts/install.sh"
	@chmod +x $(BUILD_DIR)/scripts/install.sh
	echo "Command Executing: tar -czf $(PACKAGE_NAME).tar.gz -C $(BUILD_DIR) ."
	@tar -czf $(PACKAGE_NAME).tar.gz -C $(BUILD_DIR) .
	@echo "✅ Package created: $(PACKAGE_NAME).tar.gz"

install: build ## Build and install locally
	@echo "🔧 Installing DevTool locally..."
	echo "Command Executing: sudo ./$(BUILD_DIR)/scripts/install.sh"
	@sudo ./$(BUILD_DIR)/scripts/install.sh
	@echo "✅ Installation complete"

uninstall: ## Uninstall DevTool service
	@echo "🗑️  Uninstalling DevTool service..."
	echo "Command Executing: sudo systemctl stop $(APP_NAME) 2>/dev/null || true"
	@sudo systemctl stop $(APP_NAME) 2>/dev/null || true
	echo "Command Executing: sudo systemctl disable $(APP_NAME) 2>/dev/null || true"
	@sudo systemctl disable $(APP_NAME) 2>/dev/null || true
	echo "Command Executing: sudo rm -f /etc/systemd/system/$(APP_NAME).service"
	@sudo rm -f /etc/systemd/system/$(APP_NAME).service
	echo "Command Executing: sudo systemctl daemon-reload"
	@sudo systemctl daemon-reload
	@sudo rm -rf /opt/$(APP_NAME)
	@sudo userdel devtool 2>/dev/null || true
	@echo "✅ Uninstall complete"

status: ## Check service status
	@echo "📊 DevTool Service Status:"
	echo "Command Executing: systemctl is-active $(APP_NAME) >/dev/null 2>&1 && echo "Status: ✅ Running" || echo "Status: ❌ Stopped""
	@systemctl is-active $(APP_NAME) >/dev/null 2>&1 && echo "Status: ✅ Running" || echo "Status: ❌ Stopped"
	echo "Command Executing: systemctl is-enabled $(APP_NAME) >/dev/null 2>&1 && echo "Auto-start: ✅ Enabled" || echo "Auto-start: ❌ Disabled""
	@systemctl is-enabled $(APP_NAME) >/dev/null 2>&1 && echo "Auto-start: ✅ Enabled" || echo "Auto-start: ❌ Disabled"
	@echo "Port: 8080"
	@echo "Web UI: http://localhost:8080"

logs: ## View service logs
	@echo "📋 DevTool Service Logs:"
	echo "Command Executing: journalctl -u $(APP_NAME) -f"
	@journalctl -u $(APP_NAME) -f

restart: ## Restart the service
	@echo "🔄 Restarting DevTool service..."
	echo "Command Executing: sudo systemctl restart $(APP_NAME)"
	@sudo systemctl restart $(APP_NAME)
	@echo "✅ Service restarted"

# Development helpers
deps-backend: ## Install backend dependencies
	@echo "📥 Installing backend dependencies..."
	echo "Command Executing: cd backend && go mod tidy && go mod download"
	@cd backend && go mod tidy && go mod download

deps-frontend: ## Install frontend dependencies
	@echo "📥 Installing frontend dependencies..."
	echo "Command Executing: cd frontend && npm ci"
	@cd frontend && npm ci

deps: deps-backend deps-frontend ## Install all dependencies

format: ## Format code
	@echo "💅 Formatting code..."
	echo "Command Executing: cd backend && go fmt ./..."
	@cd backend && go fmt ./...
	echo "Command Executing: cd frontend && npm run format 2>/dev/null || echo "No format script found""
	@cd frontend && npm run format 2>/dev/null || echo "No format script found"

lint: ## Lint code
	@echo "🔍 Linting code..."
	echo "Command Executing: cd backend && go vet ./..."
	@cd backend && go vet ./...
	echo "Command Executing: cd frontend && npm run lint 2>/dev/null || echo "No lint script found""
	@cd frontend && npm run lint 2>/dev/null || echo "No lint script found"

# Build info
info: ## Show build information
	@echo "DevTool Build Information:"
	@echo "  App Name: $(APP_NAME)"
	@echo "  Version:  $(VERSION)"
	@echo "  Package:  $(PACKAGE_NAME).tar.gz"
	@echo "  Build Dir: $(BUILD_DIR)"
	@echo ""
	@echo "System Information:"
	@echo "  OS: $(shell uname -s)"
	@echo "  Arch: $(shell uname -m)"
	@echo "  Go Version: $(shell go version 2>/dev/null || echo 'Not installed')"
	@echo "  Node Version: $(shell node --version 2>/dev/null || echo 'Not installed')"

# Quick development setup
setup: deps ## Setup development environment
	@echo "🛠️  Setting up development environment..."
	@mkdir -p backend/flows backend/logs
	@echo "✅ Development environment ready"
	@echo ""
	@echo "Next steps:"
	@echo "  make dev          # Start development servers"
	@echo "  make build        # Build for production"
	@echo "  make install      # Install as system service" 