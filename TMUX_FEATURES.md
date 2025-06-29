# New Features: ID-Based Execution & Tmux Terminal Support

## Overview

This update introduces two major improvements to the dev-tool:

1. **ID-Based Step Execution**: Steps are now executed using database IDs instead of passing command data directly
2. **Tmux Terminal Support**: Support for running terminal steps in tmux sessions

## ID-Based Step Execution

### Backend Changes

- **New API Endpoint**: `POST /api/execute-step`
- **Request Format**: `{ "step_id": number }`
- **Database Integration**: Steps are fetched from SQLite database using their ID
- **Variable Resolution**: Flow variables are automatically fetched and substituted

### Frontend Changes

- **New API Function**: `executeStep(stepId: number)`
- **Automatic Fallback**: If step has no ID, falls back to old execution method
- **Updated Step Interface**: Steps now include optional `id` field

### Benefits

- **Better Data Consistency**: Single source of truth in database
- **Simplified API**: No need to pass command data and variables separately
- **Enhanced Security**: Variables are server-side only, not exposed in client requests

## Tmux Terminal Support

### New Step Fields

```yaml
steps:
  - name: "Tmux Terminal Step"
    command: "echo 'Hello from tmux'"
    terminal: true
    tmux_session_name: "my-session"
    is_tmux_terminal: true
```

### Field Descriptions

- `terminal`: Must be `true` for terminal steps
- `tmux_session_name`: Name of the tmux session (supports variable substitution)
- `is_tmux_terminal`: When `true`, runs command in tmux session instead of regular terminal

### Backend Implementation

- **Session Management**: Automatically creates tmux sessions if they don't exist
- **Command Execution**: Uses `tmux send-keys` to execute commands in sessions
- **Variable Substitution**: Session names support variable placeholders like `${SESSION_NAME}`
- **Error Handling**: Graceful fallback if tmux is not available

### Frontend Updates

- **Visual Indicators**: Buttons show "Open Tmux Terminal" for tmux steps
- **Logging**: Enhanced logging shows tmux session information
- **Compatibility**: Works with both ID-based and legacy execution methods

## Usage Examples

### 1. Regular Terminal Step
```yaml
- name: "Regular Terminal"
  command: "vim myfile.txt"
  terminal: true
  is_tmux_terminal: false
```

### 2. Tmux Terminal Step
```yaml
- name: "Development Session"
  command: "cd ${PROJECT_PATH} && npm start"
  terminal: true
  tmux_session_name: "dev-${PROJECT_NAME}"
  is_tmux_terminal: true
```

### 3. Command Step (No Terminal)
```yaml
- name: "Build Project"
  command: "npm run build"
  terminal: false
```

## API Changes

### New Endpoints

- `POST /api/execute-step` - Execute step by ID
- `GET /api/flows` - Get flows with step IDs (updated)
- `POST /api/flows` - Create flows (updated)

### Updated Request/Response Formats

**Step Execution Request:**
```json
{
  "step_id": 123
}
```

**Step Response (includes ID):**
```json
{
  "id": 123,
  "name": "My Step",
  "command": "echo hello",
  "terminal": true,
  "tmux_session_name": "my-session",
  "is_tmux_terminal": true
}
```

## Database Schema

### Updated Steps Table
```sql
CREATE TABLE steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    notes TEXT,
    skip_prompt BOOLEAN DEFAULT FALSE,
    terminal BOOLEAN DEFAULT FALSE,
    tmux_session_name TEXT,
    is_tmux_terminal BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (flow_id) REFERENCES flows (id) ON DELETE CASCADE
);
```

## Migration Notes

### Backward Compatibility

- Old flows without IDs will continue to work
- Frontend automatically detects and uses appropriate execution method
- Existing API endpoints remain functional

### Tmux Requirements

- Tmux must be installed on the system for tmux terminal features
- If tmux is not available, steps will fall back to regular execution with error messages

## Testing

### Sample Flow

A new sample flow `tmux-demo-flow.yaml` demonstrates all features:

- Regular terminal steps
- Tmux terminal steps with different sessions
- Command steps with variable substitution
- Mixed step types in a single flow

### Verification Steps

1. **Backend**: Start server and check logs for database initialization
2. **Frontend**: Create flows and verify step IDs are included
3. **Execution**: Test both regular and tmux terminal steps
4. **Variables**: Verify variable substitution works in session names

## Troubleshooting

### Common Issues

1. **Tmux Not Found**: Install tmux with `sudo apt install tmux` (Ubuntu/Debian)
2. **Session Creation Failed**: Check tmux permissions and available resources
3. **Variable Substitution**: Ensure variables are defined in flow configuration
4. **Step ID Missing**: Flows created before this update may not have step IDs

### Debug Logging

Enable debug logging to see:
- Step execution method selection
- Tmux session creation/usage
- Variable substitution details
- Command execution results 