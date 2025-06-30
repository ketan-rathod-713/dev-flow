# DevTool Makefile
.PHONY: help build build-frontend build-backend clean test install uninstall package dev build-embedded package-embedded build-embedded-package build-separate install-nodejs check-deps build-frontend-embedded-existing build-embedded-existing build-quick install-separate install-embedded

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

build: build-embedded-package ## Build single embedded binary (default)
	@echo "✅ Default build complete! Single binary ready for distribution."

build-separate: clean build-backend build-frontend package ## Build separate binary and static files
	@echo "✅ Separate build complete!"

build-embedded: clean build-frontend-embedded build-backend-embedded ## Build single embedded binary
	@echo "✅ Embedded build complete!"

build-backend: ## Build Go backend binary
	@echo "📦 Building backend..."
	@mkdir -p $(BUILD_DIR)/bin
	echo "Command Executing: cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME) main.go"
	@cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME) main.go
	@echo "✅ Backend built successfully"

build-backend-embedded: ## Build Go backend binary with embedded frontend
	@echo "📦 Building embedded backend binary..."
	@mkdir -p $(BUILD_DIR)/bin
	echo "Command Executing: cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME)-embedded main.go"
	@cd backend && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BUILD_DIR)/bin/$(BINARY_NAME)-embedded main.go
	@echo "✅ Embedded backend built successfully"

build-frontend: ## Build React frontend
	@echo "🎨 Building frontend..."
	echo "Command Executing: cd frontend && npm ci && npm run build"
	@mkdir -p $(BUILD_DIR)/web
	@cd frontend && npm ci && npm run build
	echo "Command Executing: cp -r frontend/dist/* $(BUILD_DIR)/web/"
	@cp -r frontend/dist/* $(BUILD_DIR)/web/
	@echo "✅ Frontend built successfully"

build-frontend-embedded: ## Build React frontend for embedding
	@echo "🎨 Building frontend for embedding..."
	echo "Command Executing: cd frontend && npm ci && npm run build"
	@cd frontend && npm ci && npm run build
	echo "Command Executing: rm -rf backend/frontend_dist && mkdir -p backend/frontend_dist"
	@rm -rf backend/frontend_dist && mkdir -p backend/frontend_dist
	echo "Command Executing: cp -r frontend/dist/* backend/frontend_dist/"
	@cp -r frontend/dist/* backend/frontend_dist/
	@echo "✅ Frontend built for embedding successfully"

build-frontend-embedded-existing: ## Use existing frontend build for embedding
	@echo "🎨 Using existing frontend build for embedding..."
	@if [ ! -d "dist/web" ]; then echo "❌ No existing frontend build found in dist/web/"; exit 1; fi
	echo "Command Executing: rm -rf backend/frontend_dist && mkdir -p backend/frontend_dist"
	@rm -rf backend/frontend_dist && mkdir -p backend/frontend_dist
	echo "Command Executing: cp -r dist/web/* backend/frontend_dist/"
	@cp -r dist/web/* backend/frontend_dist/
	@echo "✅ Existing frontend copied for embedding successfully"

build-embedded-existing: clean build-frontend-embedded-existing build-backend-embedded ## Build embedded binary using existing frontend
	@echo "✅ Embedded build complete using existing frontend!"

build-quick: build-embedded-existing package-embedded ## Quick build using existing frontend files
	@echo "✅ Quick embedded build complete! No Node.js/npm required."

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	echo "Command Executing: rm -rf $(BUILD_DIR)"
	@rm -rf $(BUILD_DIR)
	echo "Command Executing: rm -f $(PACKAGE_NAME).tar.gz"
	@rm -f $(PACKAGE_NAME).tar.gz
	echo "Command Executing: rm -rf backend/frontend_dist"
	@rm -rf backend/frontend_dist
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

install: build ## Build and install locally using embedded binary
	@echo "🔧 Installing DevTool locally (embedded version)..."
	@if [ ! -f "$(BUILD_DIR)/embedded/install-embedded.sh" ]; then echo "❌ Embedded installer not found. Run 'make build' first."; exit 1; fi
	echo "Command Executing: cd $(BUILD_DIR)/embedded && sudo ./install-embedded.sh"
	@cd $(BUILD_DIR)/embedded && sudo ./install-embedded.sh
	@echo "✅ Installation complete"

install-separate: build-separate ## Build and install using separate binary + static files
	@echo "🔧 Installing DevTool locally (separate version)..."
	echo "Command Executing: sudo ./$(BUILD_DIR)/scripts/install.sh"
	@sudo ./$(BUILD_DIR)/scripts/install.sh
	@echo "✅ Installation complete"

install-embedded: build-embedded-package ## Build and install embedded binary
	@echo "🔧 Installing DevTool locally (embedded version)..."
	echo "Command Executing: cd $(BUILD_DIR)/embedded && sudo ./install-embedded.sh"
	@cd $(BUILD_DIR)/embedded && sudo ./install-embedded.sh
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
	@echo "Port: 24050"
	@echo "Web UI: http://localhost:24050"

diagnose: ## Run diagnostics to check file permissions and access
	@echo "🔍 Running DevTool Diagnostics..."
	@echo "Checking service status..."
	@systemctl is-active $(APP_NAME) >/dev/null 2>&1 && echo "✅ Service is running" || echo "❌ Service is not running"
	@echo ""
	@echo "Checking API diagnostics endpoint..."
	@curl -s http://localhost:24050/api/diagnostics | python3 -m json.tool 2>/dev/null || echo "❌ Could not reach diagnostics endpoint"
	@echo ""
	@echo "Recent service logs:"
	@journalctl -u $(APP_NAME) --no-pager -n 20 || echo "❌ Could not read service logs"

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
setup: ## Setup development environment
	@echo "🛠️  Setting up development environment..."
	@echo "Checking dependencies..."
	@which node >/dev/null 2>&1 || (echo "❌ Node.js not found. Run 'make install-nodejs' first." && exit 1)
	@which npm >/dev/null 2>&1 || (echo "❌ npm not found. Run 'make install-nodejs' first." && exit 1)
	@which go >/dev/null 2>&1 || (echo "❌ Go not found. Please install Go first." && exit 1)
	@echo "✅ All dependencies found"
	@mkdir -p backend/flows backend/logs
	@echo "✅ Development environment ready"
	@echo ""
	@echo "Next steps:"
	@echo "  make build        # Build single embedded binary (recommended)"
	@echo "  make build-separate # Build separate binary + static files"
	@echo "  make dev          # Start development servers"
	@echo "  make install      # Install as system service"

install-nodejs: ## Install Node.js and npm (Ubuntu/Debian)
	@echo "📥 Installing Node.js and npm..."
	@echo "This will install Node.js LTS version..."
	@sudo apt update
	@curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
	@sudo apt-get install -y nodejs
	@echo "✅ Node.js and npm installed"
	@echo "Versions:"
	@node --version
	@npm --version

check-deps: ## Check if all dependencies are installed
	@echo "🔍 Checking dependencies..."
	@echo -n "Go: "
	@which go >/dev/null 2>&1 && go version || echo "❌ Not found"
	@echo -n "Node.js: "
	@which node >/dev/null 2>&1 && node --version || echo "❌ Not found"
	@echo -n "npm: "
	@which npm >/dev/null 2>&1 && npm --version || echo "❌ Not found"
	@echo -n "make: "
	@which make >/dev/null 2>&1 && make --version | head -1 || echo "❌ Not found"

package-embedded: ## Create single binary package for distribution
	@echo "📦 Creating embedded binary package..."
	echo "Command Executing: mkdir -p $(BUILD_DIR)/embedded"
	@mkdir -p $(BUILD_DIR)/embedded
	echo "Command Executing: cp $(BUILD_DIR)/bin/$(BINARY_NAME)-embedded $(BUILD_DIR)/embedded/$(BINARY_NAME)"
	@cp $(BUILD_DIR)/bin/$(BINARY_NAME)-embedded $(BUILD_DIR)/embedded/$(BINARY_NAME)
	echo "Command Executing: cp config.yaml $(BUILD_DIR)/embedded/"
	@cp config.yaml $(BUILD_DIR)/embedded/
	echo "Command Executing: cp install-embedded.sh $(BUILD_DIR)/embedded/"
	@cp install-embedded.sh $(BUILD_DIR)/embedded/
	@chmod +x $(BUILD_DIR)/embedded/install-embedded.sh
	echo "Command Executing: cp -r backend/flows $(BUILD_DIR)/embedded/ 2>/dev/null || echo "No flows directory found""
	@cp -r backend/flows $(BUILD_DIR)/embedded/ 2>/dev/null || echo "No flows directory found"
	
	# Create a simple README for the distribution
	@echo "Creating distribution README..."
	@echo "# DevTool v$(VERSION) - Single Binary Distribution" > $(BUILD_DIR)/embedded/README.md
	@echo "" >> $(BUILD_DIR)/embedded/README.md
	@echo "This package contains a single binary with embedded frontend." >> $(BUILD_DIR)/embedded/README.md
	@echo "" >> $(BUILD_DIR)/embedded/README.md
	@echo "## Quick Start (Standalone):" >> $(BUILD_DIR)/embedded/README.md
	@echo "1. Make binary executable: \`chmod +x $(BINARY_NAME)\`" >> $(BUILD_DIR)/embedded/README.md
	@echo "2. Run: \`./$(BINARY_NAME) --config=config.yaml\`" >> $(BUILD_DIR)/embedded/README.md
	@echo "3. Open browser: http://localhost:24050" >> $(BUILD_DIR)/embedded/README.md
	@echo "" >> $(BUILD_DIR)/embedded/README.md
	@echo "## System Service Installation:" >> $(BUILD_DIR)/embedded/README.md
	@echo "1. Run installer: \`sudo ./install-embedded.sh\`" >> $(BUILD_DIR)/embedded/README.md
	@echo "2. Start service: \`sudo systemctl start dev-tool\`" >> $(BUILD_DIR)/embedded/README.md
	@echo "3. Open browser: http://localhost:24050" >> $(BUILD_DIR)/embedded/README.md
	@echo "" >> $(BUILD_DIR)/embedded/README.md
	@echo "## Files:" >> $(BUILD_DIR)/embedded/README.md
	@echo "- \`$(BINARY_NAME)\` - Main executable (contains frontend + backend)" >> $(BUILD_DIR)/embedded/README.md
	@echo "- \`config.yaml\` - Configuration file" >> $(BUILD_DIR)/embedded/README.md
	@echo "- \`install-embedded.sh\` - System service installer" >> $(BUILD_DIR)/embedded/README.md
	@echo "- \`flows/\` - Sample flows (if any)" >> $(BUILD_DIR)/embedded/README.md
	@echo "" >> $(BUILD_DIR)/embedded/README.md
	@echo "## Requirements:" >> $(BUILD_DIR)/embedded/README.md
	@echo "- Linux x86_64" >> $(BUILD_DIR)/embedded/README.md
	@echo "- No external dependencies required!" >> $(BUILD_DIR)/embedded/README.md
	
	echo "Command Executing: tar -czf $(PACKAGE_NAME)-embedded.tar.gz -C $(BUILD_DIR)/embedded ."
	@tar -czf $(PACKAGE_NAME)-embedded.tar.gz -C $(BUILD_DIR)/embedded .
	@echo "✅ Embedded package created: $(PACKAGE_NAME)-embedded.tar.gz"
	@echo ""
	@echo "📋 Single Binary Distribution Ready:"
	@echo "  📦 Package: $(PACKAGE_NAME)-embedded.tar.gz"
	@echo "  📏 Size: $(shell du -h $(PACKAGE_NAME)-embedded.tar.gz 2>/dev/null | cut -f1 || echo 'Unknown')"
	@echo "  🎯 Binary: $(BUILD_DIR)/embedded/$(BINARY_NAME)"
	@echo "  📄 Binary Size: $(shell du -h $(BUILD_DIR)/embedded/$(BINARY_NAME) 2>/dev/null | cut -f1 || echo 'Unknown')"
	@echo ""
	@echo "🚀 To test locally:"
	@echo "  cd $(BUILD_DIR)/embedded && ./$(BINARY_NAME) --config=config.yaml"
	@echo ""
	@echo "📤 To share with others:"
	@echo "  1. Send them: $(PACKAGE_NAME)-embedded.tar.gz"
	@echo "  2. They extract: tar -xzf $(PACKAGE_NAME)-embedded.tar.gz"
	@echo "  3. Quick run: ./$(BINARY_NAME) --config=config.yaml"
	@echo "  4. Or install as service: sudo ./install-embedded.sh"

# Add convenience target for full embedded build and package
build-embedded-package: build-embedded package-embedded ## Build and package embedded binary
	@echo "✅ Complete embedded build and package ready!" 