# DevTool v1.0.0 - Single Binary Distribution

This package contains a single binary with embedded frontend.

## Quick Start (Standalone):
1. Make binary executable: `chmod +x dev-tool`
2. Run: `./dev-tool --config=config.yaml`
3. Open browser: http://localhost:24050

## System Service Installation:
1. Run installer: `sudo ./install-embedded.sh`
2. Start service: `sudo systemctl start dev-tool`
3. Open browser: http://localhost:24050

## Files:
- `dev-tool` - Main executable (contains frontend + backend)
- `config.yaml` - Configuration file
- `install-embedded.sh` - System service installer
- `flows/` - Sample flows (if any)

## Requirements:
- Linux x86_64
- No external dependencies required!
