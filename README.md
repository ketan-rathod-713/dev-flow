# DevTool - Development Flow Service

A powerful development workflow automation tool that provides interactive terminals, command execution, and flow management through a modern web interface.

## 🚀 Features

- **🖥️ Interactive Terminal**: Real-time WebSocket-based shell access
- **⚡ Command Execution**: Synchronous and asynchronous command execution
- **📋 Flow Management**: Create, edit, and manage development workflows
- **🔧 System Service**: Runs as a systemd service with automatic startup
- **🛡️ Security**: Command filtering, user isolation, and resource limits
- **🌐 Modern UI**: React-based responsive web interface
- **📁 Database**: SQLite-based storage for flows and configurations
- **🔄 Import/Export**: Backup and share your workflows

## 📦 Quick Installation (Recommended)

### Option 1: Download Pre-built Binary

1. **Download the latest release**:
```bash
# Download the latest binary (replace with actual release URL)
wget https://github.com/your-repo/dev-tool/releases/latest/download/dev-tool-linux-amd64 -O dev-tool

# Make it executable
chmod +x dev-tool
```

2. **Run directly** (no installation required):
```bash
# Run with default settings
./dev-tool

# Or with custom config
./dev-tool --config config.yaml
```

3. **Access the web interface**:
```
http://localhost:24050
```

### Option 2: Install as System Service (Recommended for Production)

1. **Download and install**:
```bash
# Download the installation script
curl -fsSL https://raw.githubusercontent.com/your-repo/dev-tool/main/install-embedded.sh | sudo bash

# Or download and inspect first
wget https://raw.githubusercontent.com/your-repo/dev-tool/main/install-embedded.sh
chmod +x install-embedded.sh
sudo ./install-embedded.sh
```

2. **Check service status**:
```bash
sudo systemctl status dev-tool
```

3. **Access the web interface**:
```
http://localhost:24050
```

## 🛠️ Manual Installation

### Prerequisites

- **Linux** with systemd (Ubuntu 18.04+, CentOS 7+, Debian 9+)
- **sudo** access for system installation
- **Internet connection** for downloading

### Step-by-Step Installation

1. **Create system user**:
```bash
sudo useradd -r -s /bin/bash -d /home/bacancy -m bacancy
sudo usermod -aG sudo bacancy
```

2. **Download the binary**:
```bash
# Create installation directory
sudo mkdir -p /opt/dev-tool/bin

# Download binary
sudo wget https://github.com/your-repo/dev-tool/releases/latest/download/dev-tool-linux-amd64 \
    -O /opt/dev-tool/bin/dev-tool

# Make executable
sudo chmod +x /opt/dev-tool/bin/dev-tool
```

3. **Create systemd service**:
```bash
sudo tee /etc/systemd/system/dev-tool.service > /dev/null <<EOF
[Unit]
Description=DevTool - Development Flow Service
Documentation=https://github.com/your-repo/dev-tool
After=network.target
Wants=network.target

[Service]
Type=simple
User=bacancy
Group=bacancy
ExecStart=/opt/dev-tool/bin/dev-tool
Restart=always
RestartSec=10
KillMode=mixed
TimeoutStopSec=30

# Working directory and environment
WorkingDirectory=/home/bacancy
Environment=HOME=/home/bacancy
Environment=USER=bacancy
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Security settings (relaxed for development)
PrivateTmp=false
ProtectSystem=false
ProtectHome=false
NoNewPrivileges=false
PrivateDevices=false
ProtectKernelTunables=false
ProtectKernelModules=false
ProtectControlGroups=false

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryLimit=1G

# Capabilities
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_SETUID CAP_SETGID CAP_DAC_OVERRIDE
AmbientCapabilities=CAP_NET_BIND_SERVICE

# File system access
ReadWritePaths=/home /opt/dev-tool /tmp /var/tmp
BindPaths=/home/bacancy

[Install]
WantedBy=multi-user.target
EOF
```

4. **Set up directories and permissions**:
```bash
# Create necessary directories
sudo mkdir -p /opt/dev-tool/{bin,data,logs}
sudo mkdir -p /home/bacancy

# Set ownership
sudo chown -R bacancy:bacancy /opt/dev-tool
sudo chown -R bacancy:bacancy /home/bacancy

# Set permissions
sudo chmod 755 /opt/dev-tool/bin/dev-tool
```

5. **Enable and start the service**:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start
sudo systemctl enable dev-tool

# Start the service
sudo systemctl start dev-tool

# Check status
sudo systemctl status dev-tool
```

## 🔧 Configuration

DevTool works out of the box with sensible defaults, but you can customize it:

### Default Configuration

The application uses these defaults when no config file is provided:
- **Port**: 24050
- **Host**: 0.0.0.0 (all interfaces)
- **Data Directory**: `./data`
- **Database**: `./data/flows.db`
- **Working Directory**: User's home directory

### Custom Configuration

Create a `config.yaml` file:

```yaml
service:
  name: "dev-tool"
  port: 24050
  host: "0.0.0.0"

data:
  base_dir: "./data"
  flows_dir: "./data/flows"
  logs_dir: "./data/logs"
  temp_dir: "./tmp"

security:
  cors:
    allowed_origins: ["*"]
    allowed_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allowed_headers: ["Origin", "Content-Type", "Accept", "Authorization"]

system:
  shell:
    default_shell: "/bin/bash"
    timeout: "30m"
    max_concurrent: 5
  workspace:
    default_dir: "/home/bacancy"
    allowed_dirs: ["/home/bacancy", "/tmp", "/opt/dev-tool"]
    allow_home_access: true

database:
  path: "./data/flows.db"
```

Run with custom config:
```bash
./dev-tool --config config.yaml
```

## 🎯 Usage

### Web Interface

1. **Open your browser** to `http://localhost:24050`
2. **Create flows** using the web interface
3. **Execute commands** interactively or in batch
4. **Manage workflows** with the built-in editor

### API Endpoints

- `GET /api/health` - Service health check
- `GET /api/diagnostics` - System diagnostics
- `GET /api/flows` - List all flows
- `POST /api/flows` - Create new flow
- `POST /api/execute-step` - Execute flow step
- `POST /api/execute-command` - Execute command
- `GET /api/shell` - WebSocket shell connection

### Command Line Usage

```bash
# Show version
./dev-tool --version

# Show help
./dev-tool --help

# Run with custom config
./dev-tool --config /path/to/config.yaml

# Run in foreground (for debugging)
./dev-tool
```

## 🔐 System Service Management

### Service Commands

```bash
# Check service status
sudo systemctl status dev-tool

# Start/stop service
sudo systemctl start dev-tool
sudo systemctl stop dev-tool
sudo systemctl restart dev-tool

# Enable/disable auto-start
sudo systemctl enable dev-tool
sudo systemctl disable dev-tool

# View logs
sudo journalctl -u dev-tool -f

# View recent logs
sudo journalctl -u dev-tool -n 100

# Follow logs in real-time
sudo journalctl -u dev-tool -f --since "1 hour ago"
```

### Log Management

```bash
# View application logs
sudo journalctl -u dev-tool

# View logs with timestamps
sudo journalctl -u dev-tool -o short-iso

# Export logs to file
sudo journalctl -u dev-tool > dev-tool.log

# Clear old logs
sudo journalctl --vacuum-time=7d
```

## 📁 Directory Structure

```
/opt/dev-tool/
├── bin/
│   └── dev-tool           # Main binary
└── data/                  # Created automatically
    ├── flows.db          # SQLite database
    ├── flows/            # Flow definitions
    ├── logs/             # Application logs
    └── tmp/              # Temporary files

/home/bacancy/            # Service user home
├── .bashrc
├── .profile
└── projects/             # Your development projects
```

## 🔍 Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status dev-tool

# View detailed logs
sudo journalctl -u dev-tool -n 50

# Check if port is in use
sudo netstat -tlnp | grep :24050

# Test binary directly
sudo -u bacancy /opt/dev-tool/bin/dev-tool --help
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R bacancy:bacancy /opt/dev-tool
sudo chown -R bacancy:bacancy /home/bacancy

# Check service user
id bacancy

# Test file access
sudo -u bacancy touch /home/bacancy/test-file
```

### Configuration Issues

```bash
# Test configuration
sudo -u bacancy /opt/dev-tool/bin/dev-tool --config /path/to/config.yaml --help

# Check configuration syntax
yaml-lint config.yaml
```

### Network Issues

```bash
# Check if service is listening
sudo netstat -tlnp | grep dev-tool

# Test local connection
curl http://localhost:24050/api/health

# Check firewall
sudo ufw status
```

## 🗑️ Uninstallation

### Complete Removal

```bash
# Stop and disable service
sudo systemctl stop dev-tool
sudo systemctl disable dev-tool

# Remove service file
sudo rm /etc/systemd/system/dev-tool.service

# Remove application directory
sudo rm -rf /opt/dev-tool

# Remove service user (optional)
sudo userdel -r bacancy

# Reload systemd
sudo systemctl daemon-reload
```

### Keep Data (Partial Removal)

```bash
# Stop and disable service
sudo systemctl stop dev-tool
sudo systemctl disable dev-tool

# Remove service file and binary only
sudo rm /etc/systemd/system/dev-tool.service
sudo rm /opt/dev-tool/bin/dev-tool

# Keep /opt/dev-tool/data for later use
```

## 🔒 Security Considerations

### Default Security Features

- **Dedicated User**: Runs as `bacancy` user with limited privileges
- **Resource Limits**: Memory and process limits via systemd
- **Command Filtering**: Dangerous commands can be blocked
- **CORS Protection**: Configurable cross-origin restrictions
- **File System Access**: Controlled access to directories

### Hardening (Optional)

For production environments, consider:

```bash
# Restrict network access
sudo ufw allow 24050/tcp
sudo ufw enable

# Monitor service
sudo systemctl edit dev-tool
# Add monitoring and alerting

# Regular updates
# Set up automatic updates for the binary
```

## 🏗️ Building from Source

If you want to build from source:

```bash
# Prerequisites
sudo apt update
sudo apt install -y git golang-go nodejs npm

# Clone and build
git clone https://github.com/your-repo/dev-tool.git
cd dev-tool
make build

# Install
sudo make install
```

## 📊 Monitoring

### Health Checks

```bash
# API health check
curl http://localhost:24050/api/health

# System diagnostics
curl http://localhost:24050/api/diagnostics

# Service status
systemctl is-active dev-tool
```

### Performance Monitoring

```bash
# Resource usage
sudo systemctl show dev-tool --property=MemoryCurrent,CPUUsageNSec

# Process information
ps aux | grep dev-tool

# Network connections
sudo netstat -tlnp | grep dev-tool
```

## 🤝 Support

- **Logs**: `sudo journalctl -u dev-tool -f`
- **Health Check**: `curl http://localhost:24050/api/health`
- **Diagnostics**: `curl http://localhost:24050/api/diagnostics`
- **Service Status**: `sudo systemctl status dev-tool`

## 📄 License

MIT License - see LICENSE file for details.

---

**Quick Start Summary:**
1. Download: `wget <binary-url> -O dev-tool && chmod +x dev-tool`
2. Run: `./dev-tool`
3. Open: `http://localhost:24050`
4. For system service: `curl -fsSL <install-script-url> | sudo bash`
