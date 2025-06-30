#!/bin/bash

# DevTool Embedded Binary Installer
# This script installs the DevTool single binary

set -e

APP_NAME="dev-tool"
VERSION="1.0.0"
INSTALL_DIR="/opt/$APP_NAME"
BINARY_NAME="dev-tool"
SERVICE_USER="bacancy" # Use actual user instead of system user
SERVICE_GROUP="bacancy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🚀 DevTool v$VERSION - Embedded Binary Installer"
echo "================================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

# Check if binary exists
if [[ ! -f "./$BINARY_NAME" ]]; then
    print_error "Binary '$BINARY_NAME' not found in current directory"
    print_error "Please extract the distribution package first"
    exit 1
fi

print_status "📦 Installing DevTool..."

# Create installation directory
print_status "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"/{bin,config,data/{flows,logs},tmp}

# Copy binary
print_status "Installing binary..."
cp "./$BINARY_NAME" "$INSTALL_DIR/bin/"
chmod +x "$INSTALL_DIR/bin/$BINARY_NAME"

# Copy config if it exists
if [[ -f "./config.yaml" ]]; then
    print_status "Installing configuration..."
    cp "./config.yaml" "$INSTALL_DIR/config/"
else
    print_warning "Configuration file not found, creating default..."
    cat >"$INSTALL_DIR/config/config.yaml" <<'EOF'
service:
  name: "dev-tool"
  version: "1.0.0"
  port: 24050
  host: "0.0.0.0"
data:
  base_dir: "/opt/dev-tool/data"
  flows_dir: "/opt/dev-tool/data/flows"
  logs_dir: "/opt/dev-tool/data/logs"
  temp_dir: "/opt/dev-tool/tmp"
web:
  static_dir: "/opt/dev-tool/web"
  enable_spa: true
logging:
  level: "info"
  format: "json"
  output: "both"
  file_path: "/opt/dev-tool/data/logs/dev-tool.log"
EOF
fi

# Copy flows directory if it exists
if [[ -d "./flows" ]]; then
    print_status "Installing flows..."
    cp -r "./flows"/* "$INSTALL_DIR/data/flows/"
else
    print_status "Creating sample flow..."
    mkdir -p "$INSTALL_DIR/data/flows"
    cat >"$INSTALL_DIR/data/flows/sample.yaml" <<'EOF'
name: "Sample Flow"
steps:
  - name: "System Info"
    command: "uname -a && whoami && pwd"
    notes: "Display system information"
    terminal: false
  - name: "Interactive Shell"
    command: "echo 'Welcome to DevTool!'"
    notes: "Open interactive terminal"
    terminal: true
EOF
fi

# Create service user if doesn't exist
print_status "Setting up service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    print_status "Creating user: $SERVICE_USER"
    useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false --comment "DevTool Service User" "$SERVICE_USER"
    print_success "✅ Created user: $SERVICE_USER"
else
    print_status "✅ User already exists: $SERVICE_USER"
fi

# Set permissions
print_status "Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR/data"
chmod 755 "$INSTALL_DIR/bin/$BINARY_NAME"

# Ensure user home directory has proper permissions for the service
print_status "Setting up workspace access..."
if [ -d "/home/$SERVICE_USER" ]; then
    # Add the service user to the user's group for file access
    usermod -a -G "$SERVICE_USER" "$SERVICE_USER" 2>/dev/null || true

    # Ensure the user's home directory is accessible
    chmod 755 "/home/$SERVICE_USER" 2>/dev/null || true

    print_status "Workspace access configured for /home/$SERVICE_USER"
else
    print_warning "User home directory /home/$SERVICE_USER not found"
fi

# Create additional directories that might be needed
mkdir -p "/tmp/dev-tool" "/var/tmp/dev-tool"
chown "$SERVICE_USER:$SERVICE_GROUP" "/tmp/dev-tool" "/var/tmp/dev-tool"
chmod 755 "/tmp/dev-tool" "/var/tmp/dev-tool"

# Create systemd service
print_status "Creating systemd service..."
cat >"/etc/systemd/system/$APP_NAME.service" <<EOF
[Unit]
Description=DevTool Development Flow Service
Documentation=https://github.com/your-org/dev-tool
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/bin/$BINARY_NAME --config=$INSTALL_DIR/config/config.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Security settings - Relaxed for development tool usage
NoNewPrivileges=true
PrivateTmp=false
ProtectSystem=false
ProtectHome=false
ReadWritePaths=/home /opt/$APP_NAME /tmp /var/tmp
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_SETUID CAP_SETGID CAP_DAC_OVERRIDE

# Allow access to common development directories
BindReadOnlyPaths=/usr/bin /usr/local/bin
BindPaths=/home/$SERVICE_USER

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryLimit=1G

# Environment variables
Environment=HOME=/home/$SERVICE_USER
Environment=USER=$SERVICE_USER
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_status "Configuring systemd service..."
systemctl daemon-reload
systemctl enable "$APP_NAME"

# Start the service
print_status "Starting DevTool service..."
if systemctl start "$APP_NAME"; then
    print_success "✅ DevTool service started successfully!"
else
    print_error "❌ Failed to start DevTool service"
    print_status "Check logs with: journalctl -u $APP_NAME -f"
    exit 1
fi

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet "$APP_NAME"; then
    print_success "🎉 Installation completed successfully!"
    echo ""
    echo "📍 Service Status: $(systemctl is-active $APP_NAME)"
    echo "🌐 Web Interface: http://localhost:24050"
    echo "📂 Data Directory: $INSTALL_DIR/data"
    echo "⚙️  Configuration: $INSTALL_DIR/config/config.yaml"
    echo ""
    echo "🔍 Diagnostic Commands:"
    echo "  curl http://localhost:24050/api/health          # Check service health"
    echo "  curl http://localhost:24050/api/diagnostics     # Check file permissions"
    echo ""
    echo "📋 Useful Commands:"
    echo "  sudo systemctl status $APP_NAME     # Check service status"
    echo "  sudo systemctl restart $APP_NAME    # Restart service"
    echo "  sudo systemctl stop $APP_NAME       # Stop service"
    echo "  journalctl -u $APP_NAME -f          # View logs"
    echo "  sudo systemctl disable $APP_NAME    # Disable auto-start"
    echo ""
    echo "🏠 Workspace Access:"
    echo "  Home Directory: /home/$SERVICE_USER"
    echo "  Working Directory: /home/$SERVICE_USER (default)"
    echo "  Allowed Directories: /home, /opt/$APP_NAME, /tmp, /var/tmp"
    echo ""
    echo "🚨 If you experience file permission issues:"
    echo "  1. Check diagnostics: curl http://localhost:24050/api/diagnostics"
    echo "  2. Verify home directory permissions: ls -la /home/$SERVICE_USER"
    echo "  3. Check service logs: journalctl -u $APP_NAME -f"
    echo "  4. Ensure user $SERVICE_USER exists and has proper permissions"
    echo ""
    echo "🗑️  To uninstall:"
    echo "  sudo systemctl stop $APP_NAME"
    echo "  sudo systemctl disable $APP_NAME"
    echo "  sudo rm -rf $INSTALL_DIR"
    echo "  sudo userdel $SERVICE_USER"
    echo "  sudo rm /etc/systemd/system/$APP_NAME.service"
    echo "  sudo systemctl daemon-reload"
else
    print_error "❌ Service is not running properly"
    print_status "Check logs with: journalctl -u $APP_NAME -f"
    exit 1
fi
