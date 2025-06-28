#!/bin/bash
set -e

# Configuration
SERVICE_NAME="dev-tool"
INSTALL_DIR="/opt/dev-tool"
USER="devtool"
GROUP="devtool"
CONFIG_FILE="config.yaml"

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

print_status "🚀 Installing DevTool Service..."

# Check if systemd is available
if ! command -v systemctl &>/dev/null; then
    print_error "systemd is required but not found. This installer only supports systemd-based systems."
    exit 1
fi

# Create user and group if they don't exist
if ! id "$USER" &>/dev/null; then
    print_status "Creating system user: $USER"
    useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false --comment "DevTool Service User" "$USER"
else
    print_status "User $USER already exists"
fi

# Create directory structure
print_status "Creating directory structure..."
mkdir -p "$INSTALL_DIR"/{bin,config,data/{flows,logs},web,tmp}

# Copy files
print_status "Installing binary and assets..."
if [ -f "bin/dev-tool" ]; then
    cp bin/dev-tool "$INSTALL_DIR/bin/"
    chmod +x "$INSTALL_DIR/bin/dev-tool"
else
    print_error "Binary not found! Make sure you've run the build script first."
    exit 1
fi

# Copy configuration
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$INSTALL_DIR/config/"
else
    print_warning "Configuration file not found, creating default..."
    cat >"$INSTALL_DIR/config/config.yaml" <<'EOF'
service:
  name: "dev-tool"
  version: "1.0.0"
  port: 8080
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

# Copy web assets
if [ -d "web" ]; then
    cp -r web/* "$INSTALL_DIR/web/"
else
    print_warning "Web assets not found, creating placeholder..."
    mkdir -p "$INSTALL_DIR/web"
    echo "<h1>DevTool - Web interface not available</h1>" >"$INSTALL_DIR/web/index.html"
fi

# Copy sample flows
if [ -d "flows" ]; then
    cp -r flows/* "$INSTALL_DIR/data/flows/"
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

# Set permissions
print_status "Setting permissions..."
chown -R "$USER:$GROUP" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR/data"
chmod 755 "$INSTALL_DIR/bin/dev-tool"

# Create systemd service file
print_status "Creating systemd service..."
cat >"/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=DevTool Development Flow Service
Documentation=https://github.com/your-org/dev-tool
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$GROUP
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/bin/dev-tool --config=$INSTALL_DIR/config/config.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/data $INSTALL_DIR/tmp
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryLimit=512M

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_status "Configuring systemd service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# Start the service
print_status "Starting DevTool service..."
if systemctl start "$SERVICE_NAME"; then
    print_success "✅ DevTool service started successfully!"
else
    print_error "❌ Failed to start DevTool service"
    print_status "Check logs with: journalctl -u $SERVICE_NAME -f"
    exit 1
fi

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    print_success "🎉 Installation completed successfully!"
    echo ""
    echo "📍 Service Status: $(systemctl is-active $SERVICE_NAME)"
    echo "🌐 Web Interface: http://localhost:8080"
    echo "📂 Data Directory: $INSTALL_DIR/data"
    echo "⚙️  Configuration: $INSTALL_DIR/config/config.yaml"
    echo ""
    echo "📋 Useful Commands:"
    echo "  sudo systemctl status $SERVICE_NAME     # Check service status"
    echo "  sudo systemctl restart $SERVICE_NAME    # Restart service"
    echo "  sudo systemctl stop $SERVICE_NAME       # Stop service"
    echo "  journalctl -u $SERVICE_NAME -f          # View logs"
    echo "  sudo systemctl disable $SERVICE_NAME    # Disable auto-start"
    echo ""
    echo "🔧 To uninstall:"
    echo "  sudo systemctl stop $SERVICE_NAME && sudo systemctl disable $SERVICE_NAME"
    echo "  sudo rm /etc/systemd/system/$SERVICE_NAME.service"
    echo "  sudo rm -rf $INSTALL_DIR"
    echo "  sudo userdel $USER"
else
    print_error "❌ Service is not running properly"
    print_status "Check logs with: journalctl -u $SERVICE_NAME -f"
    exit 1
fi
