# DevTool - Development Flow Service

A powerful development workflow automation tool that provides interactive terminals and command execution through a modern web interface.

## Features

✅ **Interactive Terminal**: Real-time WebSocket-based shell access  
✅ **Command Execution**: Synchronous command execution with detailed results  
✅ **Flow Management**: YAML-based workflow definitions  
✅ **System Service**: Runs as a systemd service with automatic startup  
✅ **Security**: Command filtering and validation  
✅ **Modern UI**: React-based responsive interface  
✅ **Configuration**: YAML-based configuration management  

## Quick Start

### Prerequisites

- **Linux** with systemd (Ubuntu 18.04+, CentOS 7+, etc.)
- **Go 1.19+** (for building from source)
- **Node.js 18+** (for building frontend)
- **sudo** access for system installation

### Installation

1. **Download and Build**:
```bash
git clone <repository-url>
cd dev-tool
make build
```

2. **Install as System Service**:
```bash
sudo make install
```

3. **Check Status**:
```bash
make status
```

4. **Access Web Interface**:
```
http://localhost:8080
```

## Build Commands

```bash
# Show all available commands
make help

# Development
make setup              # Setup development environment
make dev                # Start development servers
make dev-backend        # Start only backend
make dev-frontend       # Start only frontend

# Building
make build              # Build complete application
make build-backend      # Build only Go binary
make build-frontend     # Build only React frontend
make package            # Create deployment package

# Production
make install            # Build and install as system service
make uninstall          # Remove system service
make status             # Check service status
make logs               # View service logs
make restart            # Restart service

# Maintenance
make clean              # Clean build artifacts
make test               # Run tests
make deps               # Install dependencies
```

## Manual Installation

If you prefer manual installation or need to customize the process:

1. **Build the application**:
```bash
make build
```

2. **Extract and install**:
```bash
tar -xzf dev-tool-1.0.0-linux-amd64.tar.gz
cd dev-tool-1.0.0-linux-amd64
sudo ./scripts/install.sh
```

## Configuration

The service is configured via `/opt/dev-tool/config/config.yaml`:

```yaml
service:
  name: "dev-tool"
  port: 8080
  host: "0.0.0.0"

data:
  base_dir: "/opt/dev-tool/data"
  flows_dir: "/opt/dev-tool/data/flows"

security:
  cors:
    allowed_origins: ["http://localhost:3000", "http://localhost:8080"]

flows:
  validation:
    blocked_commands: 
      - "rm -rf /"
      - "mkfs"
      - "fdisk"
```

## Creating Flows

Create YAML files in `/opt/dev-tool/data/flows/`:

```yaml
name: "My Development Flow"
variables:
  PROJECT_PATH: "/home/user/project"
steps:
  - name: "Check Status"
    command: "git status"
    notes: "Check git repository status"
    terminal: false
    
  - name: "Interactive Shell"
    command: "cd $PROJECT_PATH"
    notes: "Open interactive terminal in project"
    terminal: true
```

## System Service Management

```bash
# Service status
sudo systemctl status dev-tool

# Start/stop service
sudo systemctl start dev-tool
sudo systemctl stop dev-tool

# Enable/disable auto-start
sudo systemctl enable dev-tool
sudo systemctl disable dev-tool

# View logs
journalctl -u dev-tool -f

# Restart service
sudo systemctl restart dev-tool
```

## Directory Structure

```
/opt/dev-tool/
├── bin/
│   └── dev-tool                 # Main binary
├── config/
│   └── config.yaml             # Configuration file
├── data/
│   ├── flows/                  # Flow definitions
│   └── logs/                   # Application logs
├── web/                        # Frontend assets
└── tmp/                        # Temporary files
```

## API Endpoints

- `GET /health` - Health check
- `GET /flows` - List available flows
- `GET /shell` - WebSocket terminal connection
- `POST /execute-command` - Execute command synchronously

## Development

### Local Development

1. **Setup environment**:
```bash
make setup
```

2. **Start development servers**:
```bash
make dev
```

3. **Access application**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8080

### Project Structure

```
dev-tool/
├── backend/           # Go backend
│   ├── main.go       # Main application
│   ├── flows/        # Sample flows
│   ├── go.mod        # Go dependencies
│   └── go.sum
├── frontend/          # React frontend
│   ├── src/          # Source code
│   ├── package.json  # Node dependencies
│   └── dist/         # Built assets
├── config.yaml       # Configuration
├── install.sh        # Installation script
├── Makefile          # Build system
└── README.md
```

## Security

- **Command Filtering**: Dangerous commands are blocked by default
- **System User**: Runs as dedicated `devtool` user
- **Resource Limits**: Memory and CPU limits via systemd
- **File Permissions**: Restricted access to system directories
- **CORS**: Configurable cross-origin restrictions

## Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status dev-tool

# View detailed logs
journalctl -u dev-tool -n 50

# Check configuration
/opt/dev-tool/bin/dev-tool --config /opt/dev-tool/config/config.yaml --help
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R devtool:devtool /opt/dev-tool/data

# Check service user
id devtool
```

### Port Already in Use

```bash
# Check what's using port 8080
sudo netstat -tlnp | grep :8080

# Change port in config.yaml
sudo nano /opt/dev-tool/config/config.yaml
sudo systemctl restart dev-tool
```

## Uninstallation

```bash
# Using Makefile
make uninstall

# Manual removal
sudo systemctl stop dev-tool
sudo systemctl disable dev-tool
sudo rm /etc/systemd/system/dev-tool.service
sudo rm -rf /opt/dev-tool
sudo userdel devtool
```

## Support

- **Logs**: `journalctl -u dev-tool -f`
- **Status**: `make status`
- **Configuration**: `/opt/dev-tool/config/config.yaml`
- **Data Directory**: `/opt/dev-tool/data/`

## Screenshots

1. Landing Page
![image](https://github.com/user-attachments/assets/8e8347cd-7221-48a0-bade-cacefe95ea0a)

2. Running Setup Commands
![image](https://github.com/user-attachments/assets/867f00bb-74c0-46dc-8f98-bfc43ba49458)

3. Example Of Command Execution
![image](https://github.com/user-attachments/assets/4a65aee7-36d8-4baa-b9b4-59f7bbef8ecc)




## License

MIT License - see LICENSE file for details.
