#!/bin/bash

# DevTool Embedded Binary Installer
# This script installs the DevTool single binary

set -e

APP_NAME="dev-tool"
VERSION="1.0.0"
INSTALL_DIR="/opt/$APP_NAME"
BINARY_NAME="dev-tool"
SERVICE_USER="devtool"

echo "🚀 DevTool v$VERSION - Embedded Binary Installer"
echo "================================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Check if binary exists
if [[ ! -f "./$BINARY_NAME" ]]; then
    echo "❌ Binary '$BINARY_NAME' not found in current directory"
    echo "Please extract the distribution package first"
    exit 1
fi

echo "📦 Installing DevTool..."

# Create installation directory
echo "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Copy binary
echo "Installing binary..."
cp "./$BINARY_NAME" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Copy config if it exists
if [[ -f "./config.yaml" ]]; then
    echo "Installing configuration..."
    cp "./config.yaml" "$INSTALL_DIR/"
fi

# Copy flows directory if it exists
if [[ -d "./flows" ]]; then
    echo "Installing flows..."
    cp -r "./flows" "$INSTALL_DIR/"
fi

# Create data directories
echo "Creating data directories..."
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/logs"

# Create service user
echo "Creating service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --home "$INSTALL_DIR" --shell /bin/false "$SERVICE_USER"
    echo "✅ Created user: $SERVICE_USER"
else
    echo "✅ User already exists: $SERVICE_USER"
fi

# Set ownership
echo "Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Create systemd service
echo "Creating systemd service..."
cat >"/etc/systemd/system/$APP_NAME.service" <<EOF
[Unit]
Description=DevTool Development Flow Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/$BINARY_NAME --config=$INSTALL_DIR/config.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
echo "Configuring service..."
systemctl daemon-reload
systemctl enable "$APP_NAME"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Service Information:"
echo "  Service: $APP_NAME"
echo "  User: $SERVICE_USER"
echo "  Install Dir: $INSTALL_DIR"
echo "  Port: 24050"
echo ""
echo "🚀 To start the service:"
echo "  sudo systemctl start $APP_NAME"
echo ""
echo "📊 To check status:"
echo "  sudo systemctl status $APP_NAME"
echo ""
echo "🌐 Web Interface:"
echo "  http://localhost:24050"
echo ""
echo "📋 View logs:"
echo "  sudo journalctl -u $APP_NAME -f"
echo ""
echo "🗑️  To uninstall:"
echo "  sudo systemctl stop $APP_NAME"
echo "  sudo systemctl disable $APP_NAME"
echo "  sudo rm -rf $INSTALL_DIR"
echo "  sudo userdel $SERVICE_USER"
echo "  sudo rm /etc/systemd/system/$APP_NAME.service"
echo "  sudo systemctl daemon-reload"
