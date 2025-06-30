package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kr/pty"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	_ "github.com/mattn/go-sqlite3"
	"gopkg.in/yaml.v2"
)

// Version information (set during build)
var version = "dev"

// Global database connection
var db *sql.DB

// Configuration structures
type Config struct {
	Service   ServiceConfig   `yaml:"service"`
	Data      DataConfig      `yaml:"data"`
	Web       WebConfig       `yaml:"web"`
	Security  SecurityConfig  `yaml:"security"`
	Logging   LoggingConfig   `yaml:"logging"`
	WebSocket WebSocketConfig `yaml:"websocket"`
	Flows     FlowsConfig     `yaml:"flows"`
	System    SystemConfig    `yaml:"system"`
	Database  DatabaseConfig  `yaml:"database"`
}

type DatabaseConfig struct {
	Path string `yaml:"path"`
}

type ServiceConfig struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version"`
	Port    int    `yaml:"port"`
	Host    string `yaml:"host"`
}

type DataConfig struct {
	BaseDir  string `yaml:"base_dir"`
	FlowsDir string `yaml:"flows_dir"`
	LogsDir  string `yaml:"logs_dir"`
	TempDir  string `yaml:"temp_dir"`
}

type WebConfig struct {
	StaticDir string `yaml:"static_dir"`
	EnableSPA bool   `yaml:"enable_spa"`
}

type SecurityConfig struct {
	CORS CORSConfig `yaml:"cors"`
}

type CORSConfig struct {
	AllowedOrigins []string `yaml:"allowed_origins"`
	AllowedMethods []string `yaml:"allowed_methods"`
	AllowedHeaders []string `yaml:"allowed_headers"`
}

type LoggingConfig struct {
	Level      string `yaml:"level"`
	Format     string `yaml:"format"`
	Output     string `yaml:"output"`
	FilePath   string `yaml:"file_path"`
	MaxSizeMB  int    `yaml:"max_size_mb"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAgeDays int    `yaml:"max_age_days"`
}

type WebSocketConfig struct {
	AllowedOrigins  []string `yaml:"allowed_origins"`
	ReadBufferSize  int      `yaml:"read_buffer_size"`
	WriteBufferSize int      `yaml:"write_buffer_size"`
}

type FlowsConfig struct {
	LocalFlowsEnabled bool             `yaml:"local_flows_enabled"`
	FlowsDir          string           `yaml:"flows_dir"`
	Validation        ValidationConfig `yaml:"validation"`
}

type ValidationConfig struct {
	MaxSteps         int      `yaml:"max_steps"`
	MaxCommandLength int      `yaml:"max_command_length"`
	BlockedCommands  []string `yaml:"blocked_commands"`
}

type SystemConfig struct {
	Shell     ShellConfig     `yaml:"shell"`
	Limits    LimitsConfig    `yaml:"limits"`
	Workspace WorkspaceConfig `yaml:"workspace"`
}

type ShellConfig struct {
	DefaultShell  string `yaml:"default_shell"`
	Timeout       string `yaml:"timeout"`
	MaxConcurrent int    `yaml:"max_concurrent"`
}

type LimitsConfig struct {
	MaxMemoryMB   int `yaml:"max_memory_mb"`
	MaxCPUPercent int `yaml:"max_cpu_percent"`
}

type WorkspaceConfig struct {
	DefaultDir      string   `yaml:"default_dir"`
	AllowedDirs     []string `yaml:"allowed_dirs"`
	AllowHomeAccess bool     `yaml:"allow_home_access"`
}

// Global configuration
var config *Config

// CommandRequest represents the request payload for command execution
type CommandRequest struct {
	Command   string            `json:"command" binding:"required"`
	Variables map[string]string `json:"variables,omitempty"`
}

// StepExecutionRequest represents the request payload for step execution by ID
type StepExecutionRequest struct {
	StepID int `json:"step_id" binding:"required"`
}

// CommandResult represents the result of command execution
type CommandResult struct {
	Command    string        `json:"command"`
	ExitCode   int           `json:"exit_code"`
	Stdout     string        `json:"stdout"`
	Stderr     string        `json:"stderr"`
	Duration   time.Duration `json:"duration"`
	Success    bool          `json:"success"`
	ExecutedAt time.Time     `json:"executed_at"`
}

// Database models
type FlowDB struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type StepDB struct {
	ID              int    `json:"id"`
	FlowID          int    `json:"flow_id"`
	Name            string `json:"name"`
	Command         string `json:"command"`
	Notes           string `json:"notes,omitempty"`
	SkipPrompt      bool   `json:"skip_prompt"`
	Terminal        bool   `json:"terminal"`
	TmuxSessionName string `json:"tmux_session_name"`
	IsTmuxTerminal  bool   `json:"is_tmux_terminal"` // If terminal is true and this also true then use the session to run the command inside it. Create session if not exists.
	OrderIndex      int    `json:"order_index"`
}

type VariableDB struct {
	ID     int    `json:"id"`
	FlowID int    `json:"flow_id"`
	Key    string `json:"key"`
	Value  string `json:"value"`
}

// API models (keeping existing for compatibility)
type Step struct {
	ID              int    `yaml:"-" json:"id,omitempty"`
	Name            string `yaml:"name" json:"name"`
	Command         string `yaml:"command" json:"command"`
	Notes           string `yaml:"notes,omitempty" json:"notes,omitempty"`
	SkipPrompt      bool   `yaml:"skip_prompt,omitempty" json:"skip_prompt,omitempty"`
	Terminal        bool   `yaml:"terminal" json:"terminal"`
	TmuxSessionName string `yaml:"tmux_session_name,omitempty" json:"tmux_session_name,omitempty"`
	IsTmuxTerminal  bool   `yaml:"is_tmux_terminal,omitempty" json:"is_tmux_terminal,omitempty"`
}

type Flow struct {
	ID        int               `json:"id"`
	Name      string            `yaml:"name" json:"name"`
	Variables map[string]string `yaml:"variables,omitempty" json:"variables"`
	Steps     []Step            `yaml:"steps" json:"steps"`
}

type CreateFlowRequest struct {
	Name      string            `json:"name" binding:"required"`
	Variables map[string]string `json:"variables,omitempty"`
	Steps     []Step            `json:"steps"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Will be configured via config file
	},
}

// loadConfig loads configuration from YAML file
func loadConfig(configPath string) (*Config, error) {
	// Default configuration
	cfg := &Config{
		Service: ServiceConfig{
			Name:    "dev-tool",
			Version: version,
			Port:    24050,
			Host:    "0.0.0.0",
		},
		Data: DataConfig{
			BaseDir:  "./data",
			FlowsDir: "./flows",
			LogsDir:  "./logs",
			TempDir:  "./tmp",
		},
		Web: WebConfig{
			StaticDir: "./web",
			EnableSPA: true,
		},
		Security: SecurityConfig{
			CORS: CORSConfig{
				AllowedOrigins: []string{"*"},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowedHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
			},
		},
		Logging: LoggingConfig{
			Level:  "info",
			Format: "text",
			Output: "stdout",
		},
		WebSocket: WebSocketConfig{
			AllowedOrigins:  []string{"*"},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		Flows: FlowsConfig{
			LocalFlowsEnabled: true,
			FlowsDir:          "./flows",
		},
		System: SystemConfig{
			Shell: ShellConfig{
				DefaultShell:  "/bin/bash",
				Timeout:       "30m",
				MaxConcurrent: 5,
			},
		},
		Database: DatabaseConfig{
			Path: "./data/flows.db",
		},
	}

	// Load from file if provided
	if configPath != "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
	}

	return cfg, nil
}

// isCommandBlocked checks if a command contains blocked patterns
func isCommandBlocked(command string) bool {
	if config == nil || len(config.Flows.Validation.BlockedCommands) == 0 {
		return false
	}

	for _, blocked := range config.Flows.Validation.BlockedCommands {
		if strings.Contains(command, blocked) {
			return true
		}
	}
	return false
}

// getUserHomeDir returns the user's home directory
func getUserHomeDir() string {
	if home := os.Getenv("HOME"); home != "" {
		return home
	}
	// Fallback for the service user
	return "/home/bacancy"
}

// setupCommandEnvironment sets up proper environment and working directory for commands
func setupCommandEnvironment(cmd *exec.Cmd, variables map[string]string) {
	// Get user home directory
	homeDir := getUserHomeDir()

	// Determine working directory based on configuration
	workingDir := homeDir // Default to home directory
	if config != nil && config.System.Workspace.DefaultDir != "" {
		workingDir = config.System.Workspace.DefaultDir
	}

	// Set working directory
	cmd.Dir = workingDir

	// Set up environment variables
	env := os.Environ()

	// Ensure essential environment variables are set
	env = append(env, fmt.Sprintf("HOME=%s", homeDir))
	env = append(env, fmt.Sprintf("USER=%s", os.Getenv("USER")))
	env = append(env, "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")

	// Add flow variables
	for key, value := range variables {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	cmd.Env = env

	log.Printf("Command environment setup - Working Dir: %s, Home: %s", workingDir, homeDir)
}

// executeCommand executes a shell command and returns the result
func executeCommand(command string, variables map[string]string) CommandResult {
	startTime := time.Now()

	// Execute the command
	cmd := exec.Command("bash", "-c", command)

	// Setup environment and working directory
	setupCommandEnvironment(cmd, variables)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	log.Printf("Command: %s", command)
	log.Printf("Working Directory: %s", cmd.Dir)
	log.Printf("Variables: %+v", variables)

	duration := time.Since(startTime)

	exitCode := 0
	success := true
	if err != nil {
		success = false
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			exitCode = -1
		}
	}

	return CommandResult{
		Command:    command,
		ExitCode:   exitCode,
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		Duration:   duration,
		Success:    success,
		ExecutedAt: startTime,
	}
}

// HandleCommandExecution executes a command synchronously and returns the result
func handleCommandExecution(c echo.Context) error {
	var req CommandRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	if req.Command == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Command is required",
		})
	}

	// Execute the command with variables
	result := executeCommand(req.Command, req.Variables)

	return c.JSON(http.StatusOK, result)
}

// handleShellWebSocket handles WebSocket connections for interactive shell
func handleShellWebSocket(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return err
	}
	defer ws.Close()

	log.Println("WebSocket connection established")

	// Get step ID from query parameter and fetch variables from database
	var variables map[string]string
	var step *StepDB
	stepIDParam := c.QueryParam("step_id")
	if stepIDParam != "" {
		stepID := 0
		if _, err := fmt.Sscanf(stepIDParam, "%d", &stepID); err == nil {
			// Get step details to get flow ID
			step, err = getStepByID(stepID)
			if err != nil {
				log.Printf("WebSocket: Failed to get step %d: %v", stepID, err)
			} else {
				// Get flow variables
				flowVariables, err := getFlowVariables(step.FlowID)
				if err != nil {
					log.Printf("WebSocket: Failed to get variables for flow %d: %v", step.FlowID, err)
				} else {
					variables = flowVariables
					log.Printf("WebSocket: Loaded %d variables for step %d (flow %d)", len(variables), stepID, step.FlowID)
					for key, value := range variables {
						log.Printf("WebSocket: Setting environment variable %s=%s", key, value)
					}
				}
			}
		} else {
			log.Printf("WebSocket: Invalid step_id parameter: %s", stepIDParam)
		}
	}

	// Initialize empty variables map if none were loaded
	if variables == nil {
		variables = make(map[string]string)
	}

	// Start bash with PTY
	shell := config.System.Shell.DefaultShell
	var shellArgs []string = make([]string, 0)
	if shell == "" {
		shell = "/bin/bash"
	}

	if step != nil && step.IsTmuxTerminal {
		if step.TmuxSessionName == "" {
			step.TmuxSessionName = "flows_session"
		}

		// First, ensure the tmux session exists
		log.Printf("Setting up tmux session: %s", step.TmuxSessionName)
		checkCmd := exec.Command("tmux", "has-session", "-t", step.TmuxSessionName)
		setupCommandEnvironment(checkCmd, variables)

		if err := checkCmd.Run(); err != nil {
			// Session doesn't exist, create it
			log.Printf("Creating new tmux session: %s", step.TmuxSessionName)
			createCmd := exec.Command("tmux", "new-session", "-d", "-s", step.TmuxSessionName)
			setupCommandEnvironment(createCmd, variables)
			if err := createCmd.Run(); err != nil {
				log.Printf("Failed to create tmux session %s: %v", step.TmuxSessionName, err)
				return fmt.Errorf("failed to create tmux session: %v", err)
			}
		}

		// Attach to the existing session
		shell = "tmux"
		shellArgs = append(shellArgs, "attach-session", "-t", step.TmuxSessionName)
	}

	cmd := exec.Command(shell, shellArgs...)

	// Set environment variables for the shell using the new setup function
	setupCommandEnvironment(cmd, variables)

	// Add additional terminal-specific environment variables
	cmd.Env = append(cmd.Env, "TERM=xterm-256color")
	cmd.Env = append(cmd.Env, "COLORTERM=truecolor")
	cmd.Env = append(cmd.Env, "COLORFGBG=15;0")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("Failed to start shell with PTY: %v", err)
		return err
	}
	defer ptmx.Close()

	// Execute command if provided
	command := c.QueryParam("command")
	if command != "" {
		if isCommandBlocked(command) {
			log.Printf("Blocked command attempt: %s", command)
			return echo.NewHTTPError(http.StatusForbidden, "Command blocked by security policy")
		}

		// Substitute variables in the command
		finalCommand := command
		for key, value := range variables {
			placeholder := fmt.Sprintf("${%s}", key)
			finalCommand = strings.ReplaceAll(finalCommand, placeholder, value)
		}

		log.Printf("Executing command: %s", finalCommand)
		if len(variables) > 0 {
			log.Printf("Original command: %s", command)
			log.Printf("Variables: %+v", variables)
		}

		if step != nil && step.IsTmuxTerminal {
			// For tmux sessions, we need to wait a moment for the session to be ready
			// then send the command
			time.Sleep(100 * time.Millisecond)
		}

		_, err := ptmx.Write([]byte(finalCommand + "\n"))
		if err != nil {
			log.Printf("Failed to write command to PTY: %v", err)
		}
	}

	// Handle PTY output -> WebSocket
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				if err == io.EOF {
					log.Println("PTY closed")
				} else {
					log.Printf("Error reading from PTY: %v", err)
				}
				break
			}

			// Encode output as base64 before sending to WebSocket
			encodedOutput := base64.StdEncoding.EncodeToString(buf[:n])
			if err := ws.WriteMessage(websocket.TextMessage, []byte(encodedOutput)); err != nil {
				log.Printf("Error writing to WebSocket: %v", err)
				break
			}
		}
	}()

	// Handle WebSocket input -> PTY
	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			log.Printf("Error reading from WebSocket: %v", err)
			break
		}

		// Decode base64 input from WebSocket
		decodedInput, err := base64.StdEncoding.DecodeString(string(message))
		if err != nil {
			log.Printf("Error decoding base64 input: %v", err)
			continue
		}

		// Write decoded input to PTY
		if _, err := ptmx.Write(decodedInput); err != nil {
			log.Printf("Error writing to PTY: %v", err)
			break
		}
	}

	return nil
}

// Initialize database
func initDatabase() error {
	dbPath := "./data/flows.db"
	if config != nil && config.Database.Path != "" {
		dbPath = config.Database.Path
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %v", err)
	}

	var err error
	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}

	// Test connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	// Create tables
	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %v", err)
	}

	log.Printf("Database initialized successfully at: %s", dbPath)
	return nil
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS flows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS steps (
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
		)`,
		`CREATE TABLE IF NOT EXISTS variables (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT,
			FOREIGN KEY (flow_id) REFERENCES flows (id) ON DELETE CASCADE,
			UNIQUE(flow_id, key)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_steps_flow_id ON steps(flow_id)`,
		`CREATE INDEX IF NOT EXISTS idx_variables_flow_id ON variables(flow_id)`,
		`CREATE INDEX IF NOT EXISTS idx_steps_order ON steps(flow_id, order_index)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query %s: %v", query, err)
		}
	}

	return nil
}

// Database operations
func createFlow(req CreateFlowRequest) (*FlowDB, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// Insert flow
	result, err := tx.Exec(
		"INSERT INTO flows (name, description) VALUES (?, ?)",
		req.Name, "",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert flow: %v", err)
	}

	flowID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get flow ID: %v", err)
	}

	// Insert variables
	for key, value := range req.Variables {
		_, err = tx.Exec(
			"INSERT INTO variables (flow_id, key, value) VALUES (?, ?, ?)",
			flowID, key, value,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert variable %s: %v", key, err)
		}
	}

	// Insert steps
	for i, step := range req.Steps {
		_, err = tx.Exec(
			"INSERT INTO steps (flow_id, name, command, notes, skip_prompt, terminal, tmux_session_name, is_tmux_terminal, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			flowID, step.Name, step.Command, step.Notes, step.SkipPrompt, step.Terminal, step.TmuxSessionName, step.IsTmuxTerminal, i,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert step %s: %v", step.Name, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Return created flow
	return getFlowByID(int(flowID))
}

func getFlowByID(id int) (*FlowDB, error) {
	var flow FlowDB
	err := db.QueryRow(
		"SELECT id, name, description, created_at, updated_at FROM flows WHERE id = ?",
		id,
	).Scan(&flow.ID, &flow.Name, &flow.Description, &flow.CreatedAt, &flow.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to get flow: %v", err)
	}

	return &flow, nil
}

func getAllFlows() ([]Flow, error) {
	rows, err := db.Query("SELECT id, name FROM flows ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to query flows: %v", err)
	}
	defer rows.Close()

	var flows []Flow
	for rows.Next() {
		var flowID int
		var flowName string
		if err := rows.Scan(&flowID, &flowName); err != nil {
			return nil, fmt.Errorf("failed to scan flow: %v", err)
		}

		// Get variables
		variables, err := getFlowVariables(flowID)
		if err != nil {
			return nil, fmt.Errorf("failed to get variables for flow %d: %v", flowID, err)
		}

		// Get steps
		steps, err := getFlowSteps(flowID)
		if err != nil {
			return nil, fmt.Errorf("failed to get steps for flow %d: %v", flowID, err)
		}

		flows = append(flows, Flow{
			ID:        flowID,
			Name:      flowName,
			Variables: variables,
			Steps:     steps,
		})
	}

	return flows, nil
}

func getFlowVariables(flowID int) (map[string]string, error) {
	rows, err := db.Query("SELECT key, value FROM variables WHERE flow_id = ?", flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	variables := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		variables[key] = value
	}

	return variables, nil
}

func getFlowSteps(flowID int) ([]Step, error) {
	rows, err := db.Query(
		"SELECT id, name, command, notes, skip_prompt, terminal, tmux_session_name, is_tmux_terminal FROM steps WHERE flow_id = ? ORDER BY order_index",
		flowID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []Step
	for rows.Next() {
		var step Step
		if err := rows.Scan(&step.ID, &step.Name, &step.Command, &step.Notes, &step.SkipPrompt, &step.Terminal, &step.TmuxSessionName, &step.IsTmuxTerminal); err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}

	return steps, nil
}

// New function to get step by ID
func getStepByID(stepID int) (*StepDB, error) {
	var step StepDB
	err := db.QueryRow(
		"SELECT id, flow_id, name, command, notes, skip_prompt, terminal, tmux_session_name, is_tmux_terminal, order_index FROM steps WHERE id = ?",
		stepID,
	).Scan(&step.ID, &step.FlowID, &step.Name, &step.Command, &step.Notes, &step.SkipPrompt, &step.Terminal, &step.TmuxSessionName, &step.IsTmuxTerminal, &step.OrderIndex)

	if err != nil {
		return nil, fmt.Errorf("failed to get step: %v", err)
	}

	return &step, nil
}

// Enhanced executeCommand function with tmux support
func executeCommandWithTmux(command string, variables map[string]string, tmuxSessionName string, isTmuxTerminal bool) CommandResult {
	start := time.Now()

	// Substitute variables in the command
	finalCommand := command
	for key, value := range variables {
		placeholder := fmt.Sprintf("${%s}", key)
		finalCommand = strings.ReplaceAll(finalCommand, placeholder, value)
	}

	log.Printf("Executing command: %s", finalCommand)
	if len(variables) > 0 {
		log.Printf("Original command: %s", command)
		log.Printf("Variables: %+v", variables)
	}

	// Check if command is blocked by security policy
	if isCommandBlocked(finalCommand) {
		log.Printf("Command blocked by security policy: %s", finalCommand)
		return CommandResult{
			Command:    command,
			ExitCode:   -1,
			Stdout:     "",
			Stderr:     "Command blocked by security policy",
			Duration:   time.Since(start),
			Success:    false,
			ExecutedAt: start,
		}
	}

	var cmd *exec.Cmd
	var stdout, stderr bytes.Buffer

	if isTmuxTerminal && tmuxSessionName != "" {
		// Check if tmux session exists
		checkCmd := exec.Command("tmux", "has-session", "-t", tmuxSessionName)
		setupCommandEnvironment(checkCmd, variables)
		if err := checkCmd.Run(); err != nil {
			// Session doesn't exist, create it
			log.Printf("Creating tmux session: %s", tmuxSessionName)
			createCmd := exec.Command("tmux", "new-session", "-d", "-s", tmuxSessionName)
			setupCommandEnvironment(createCmd, variables)
			if err := createCmd.Run(); err != nil {
				log.Printf("Failed to create tmux session %s: %v", tmuxSessionName, err)
				return CommandResult{
					Command:    command,
					ExitCode:   -1,
					Stdout:     "",
					Stderr:     fmt.Sprintf("Failed to create tmux session: %v", err),
					Duration:   time.Since(start),
					Success:    false,
					ExecutedAt: start,
				}
			}
		}

		// For tmux execution, we'll use a different approach:
		// 1. Send the command to the session
		// 2. Capture the output by running the command in a way that returns results

		// Create a script that will execute the command and capture output
		tempScript := fmt.Sprintf("/tmp/devtool_tmux_%d.sh", time.Now().UnixNano())
		scriptContent := fmt.Sprintf(`#!/bin/bash
set -e
cd "%s"
%s
`, getUserHomeDir(), finalCommand)

		if err := os.WriteFile(tempScript, []byte(scriptContent), 0755); err != nil {
			log.Printf("Failed to create temp script: %v", err)
			return CommandResult{
				Command:    command,
				ExitCode:   -1,
				Stdout:     "",
				Stderr:     fmt.Sprintf("Failed to create temp script: %v", err),
				Duration:   time.Since(start),
				Success:    false,
				ExecutedAt: start,
			}
		}
		defer os.Remove(tempScript)

		// Execute the script in the tmux session and capture output
		cmd = exec.Command("tmux", "send-keys", "-t", tmuxSessionName, fmt.Sprintf("bash %s", tempScript), "Enter")
		setupCommandEnvironment(cmd, variables)

		// Send the command to tmux session
		if err := cmd.Run(); err != nil {
			log.Printf("Failed to send command to tmux session: %v", err)
			return CommandResult{
				Command:    command,
				ExitCode:   -1,
				Stdout:     "",
				Stderr:     fmt.Sprintf("Failed to send command to tmux session: %v", err),
				Duration:   time.Since(start),
				Success:    false,
				ExecutedAt: start,
			}
		}

		// Wait a moment for command to execute
		time.Sleep(500 * time.Millisecond)

		// Capture the session output (this is a simplified approach)
		captureCmd := exec.Command("tmux", "capture-pane", "-t", tmuxSessionName, "-p")
		setupCommandEnvironment(captureCmd, variables)
		output, err := captureCmd.Output()

		if err != nil {
			log.Printf("Failed to capture tmux output: %v", err)
			stdout.WriteString(fmt.Sprintf("Command sent to tmux session '%s': %s", tmuxSessionName, finalCommand))
		} else {
			stdout.Write(output)
		}

		log.Printf("Command sent to tmux session %s: %s", tmuxSessionName, finalCommand)

		// For tmux commands, we assume success since we can't easily get exit codes
		return CommandResult{
			Command:    command,
			ExitCode:   0,
			Stdout:     stdout.String(),
			Stderr:     stderr.String(),
			Duration:   time.Since(start),
			Success:    true,
			ExecutedAt: start,
		}
	} else {
		// Regular command execution
		cmd = exec.Command("/bin/bash", "-c", finalCommand)
		setupCommandEnvironment(cmd, variables)
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr
	}

	err := cmd.Run()
	duration := time.Since(start)

	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			exitCode = -1
		}
	}

	success := exitCode == 0

	result := CommandResult{
		Command:    command,
		ExitCode:   exitCode,
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		Duration:   duration,
		Success:    success,
		ExecutedAt: start,
	}

	log.Printf("Command completed: exit_code=%d, duration=%v, success=%v", exitCode, duration, success)
	return result
}

// New handler for step execution by ID
func handleStepExecution(c echo.Context) error {
	var req StepExecutionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	// Get step details
	step, err := getStepByID(req.StepID)
	if err != nil {
		log.Printf("Error getting step %d: %v", req.StepID, err)
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Step not found",
		})
	}

	// Get flow variables
	variables, err := getFlowVariables(step.FlowID)
	if err != nil {
		log.Printf("Error getting variables for flow %d: %v", step.FlowID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to get flow variables",
		})
	}

	// Execute the command
	result := executeCommandWithTmux(step.Command, variables, step.TmuxSessionName, step.IsTmuxTerminal)

	return c.JSON(http.StatusOK, result)
}

// Updated handlers
func handleCreateFlow(c echo.Context) error {
	var req CreateFlowRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow name is required",
		})
	}

	flow, err := createFlow(req)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Flow with this name already exists",
			})
		}
		log.Printf("Error creating flow: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create flow",
		})
	}

	return c.JSON(http.StatusCreated, flow)
}

func getFlows(c echo.Context) error {
	flows, err := getAllFlows()
	if err != nil {
		log.Printf("Error getting flows: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to retrieve flows",
		})
	}

	if flows == nil {
		return c.JSON(http.StatusOK, []Flow{})
	}

	return c.JSON(http.StatusOK, flows)
}

// setupStaticFileServer sets up static file serving for the web interface
func setupStaticFileServer(e *echo.Echo) {
	// Serve static files from the web directory
	staticDir := config.Web.StaticDir
	if staticDir == "" {
		staticDir = "./web"
	}

	// Check if static directory exists
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		log.Printf("Warning: Static directory %s does not exist", staticDir)
		return
	}

	// Serve static assets (CSS, JS, images, etc.) with proper headers
	e.Static("/assets", filepath.Join(staticDir, "assets"))

	// Serve other static files like favicon, manifest, etc.
	e.File("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))
	e.File("/vite.svg", filepath.Join(staticDir, "vite.svg"))

	// SPA support - serve index.html for all non-API, non-asset routes
	if config.Web.EnableSPA {
		e.GET("/*", func(c echo.Context) error {
			path := c.Request().URL.Path

			// Don't serve index.html for API routes
			if strings.HasPrefix(path, "/flows") ||
				strings.HasPrefix(path, "/shell") ||
				strings.HasPrefix(path, "/execute-command") ||
				strings.HasPrefix(path, "/health") {
				return echo.ErrNotFound
			}

			// Don't serve index.html for static assets
			if strings.HasPrefix(path, "/assets/") ||
				strings.HasSuffix(path, ".css") ||
				strings.HasSuffix(path, ".js") ||
				strings.HasSuffix(path, ".ico") ||
				strings.HasSuffix(path, ".svg") ||
				strings.HasSuffix(path, ".png") ||
				strings.HasSuffix(path, ".jpg") ||
				strings.HasSuffix(path, ".jpeg") ||
				strings.HasSuffix(path, ".gif") ||
				strings.HasSuffix(path, ".woff") ||
				strings.HasSuffix(path, ".woff2") ||
				strings.HasSuffix(path, ".ttf") ||
				strings.HasSuffix(path, ".eot") {
				return echo.ErrNotFound
			}

			// Serve index.html for all other routes (SPA routing)
			return c.File(filepath.Join(staticDir, "index.html"))
		})
	}

	// Serve index.html at root
	e.GET("/", func(c echo.Context) error {
		return c.File(filepath.Join(staticDir, "index.html"))
	})
}

type UpdateFlowRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description,omitempty"`
	Variables   map[string]string `json:"variables,omitempty"`
}

type UpdateStepRequest struct {
	Name            string `json:"name" binding:"required"`
	Command         string `json:"command" binding:"required"`
	Notes           string `json:"notes,omitempty"`
	SkipPrompt      bool   `json:"skip_prompt"`
	Terminal        bool   `json:"terminal"`
	TmuxSessionName string `json:"tmux_session_name,omitempty"`
	IsTmuxTerminal  bool   `json:"is_tmux_terminal"`
	OrderIndex      int    `json:"order_index"`
}

type CreateStepRequest struct {
	FlowID          int    `json:"flow_id" binding:"required"`
	Name            string `json:"name" binding:"required"`
	Command         string `json:"command" binding:"required"`
	Notes           string `json:"notes,omitempty"`
	SkipPrompt      bool   `json:"skip_prompt"`
	Terminal        bool   `json:"terminal"`
	TmuxSessionName string `json:"tmux_session_name,omitempty"`
	IsTmuxTerminal  bool   `json:"is_tmux_terminal"`
	OrderIndex      int    `json:"order_index"`
}

type UpdateVariableRequest struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value"`
}

// Export/Import types
type ExportFlowResponse struct {
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Variables   map[string]string `json:"variables"`
	Steps       []ExportStep      `json:"steps"`
	ExportedAt  time.Time         `json:"exported_at"`
	Version     string            `json:"version"`
}

type ExportStep struct {
	Name            string `json:"name"`
	Command         string `json:"command"`
	Notes           string `json:"notes,omitempty"`
	SkipPrompt      bool   `json:"skip_prompt"`
	Terminal        bool   `json:"terminal"`
	TmuxSessionName string `json:"tmux_session_name,omitempty"`
	IsTmuxTerminal  bool   `json:"is_tmux_terminal"`
	OrderIndex      int    `json:"order_index"`
}

type ImportFlowRequest struct {
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Variables   map[string]string `json:"variables"`
	Steps       []ExportStep      `json:"steps"`
	// Optional fields for validation
	ExportedAt time.Time `json:"exported_at,omitempty"`
	Version    string    `json:"version,omitempty"`
}

// Database operations for editing
func updateFlow(flowID int, req UpdateFlowRequest) (*FlowDB, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// Update flow details
	_, err = tx.Exec(
		"UPDATE flows SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		req.Name, req.Description, flowID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update flow: %v", err)
	}

	// Delete existing variables
	_, err = tx.Exec("DELETE FROM variables WHERE flow_id = ?", flowID)
	if err != nil {
		return nil, fmt.Errorf("failed to delete existing variables: %v", err)
	}

	// Insert new variables
	for key, value := range req.Variables {
		_, err = tx.Exec(
			"INSERT INTO variables (flow_id, key, value) VALUES (?, ?, ?)",
			flowID, key, value,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert variable %s: %v", key, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return getFlowByID(flowID)
}

func updateStep(stepID int, req UpdateStepRequest) (*StepDB, error) {
	_, err := db.Exec(
		"UPDATE steps SET name = ?, command = ?, notes = ?, skip_prompt = ?, terminal = ?, tmux_session_name = ?, is_tmux_terminal = ?, order_index = ? WHERE id = ?",
		req.Name, req.Command, req.Notes, req.SkipPrompt, req.Terminal, req.TmuxSessionName, req.IsTmuxTerminal, req.OrderIndex, stepID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update step: %v", err)
	}

	return getStepByID(stepID)
}

func createStep(req CreateStepRequest) (*StepDB, error) {
	result, err := db.Exec(
		"INSERT INTO steps (flow_id, name, command, notes, skip_prompt, terminal, tmux_session_name, is_tmux_terminal, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		req.FlowID, req.Name, req.Command, req.Notes, req.SkipPrompt, req.Terminal, req.TmuxSessionName, req.IsTmuxTerminal, req.OrderIndex,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create step: %v", err)
	}

	stepID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get step ID: %v", err)
	}

	return getStepByID(int(stepID))
}

func deleteStep(stepID int) error {
	_, err := db.Exec("DELETE FROM steps WHERE id = ?", stepID)
	if err != nil {
		return fmt.Errorf("failed to delete step: %v", err)
	}
	return nil
}

func updateVariable(flowID int, key string, req UpdateVariableRequest) error {
	_, err := db.Exec(
		"INSERT OR REPLACE INTO variables (flow_id, key, value) VALUES (?, ?, ?)",
		flowID, req.Key, req.Value,
	)
	if err != nil {
		return fmt.Errorf("failed to update variable: %v", err)
	}
	return nil
}

func deleteVariable(flowID int, key string) error {
	_, err := db.Exec("DELETE FROM variables WHERE flow_id = ? AND key = ?", flowID, key)
	if err != nil {
		return fmt.Errorf("failed to delete variable: %v", err)
	}
	return nil
}

func deleteFlow(flowID int) error {
	_, err := db.Exec("DELETE FROM flows WHERE id = ?", flowID)
	if err != nil {
		return fmt.Errorf("failed to delete flow: %v", err)
	}
	return nil
}

// Export/Import functions
func exportFlow(flowID int) (*ExportFlowResponse, error) {
	// Get flow details
	flow, err := getFlowByID(flowID)
	if err != nil {
		return nil, fmt.Errorf("failed to get flow: %v", err)
	}

	// Get flow variables
	variables, err := getFlowVariables(flowID)
	if err != nil {
		return nil, fmt.Errorf("failed to get flow variables: %v", err)
	}

	// Get flow steps
	steps, err := getFlowSteps(flowID)
	if err != nil {
		return nil, fmt.Errorf("failed to get flow steps: %v", err)
	}

	// Convert steps to export format
	exportSteps := make([]ExportStep, len(steps))
	for i, step := range steps {
		exportSteps[i] = ExportStep{
			Name:            step.Name,
			Command:         step.Command,
			Notes:           step.Notes,
			SkipPrompt:      step.SkipPrompt,
			Terminal:        step.Terminal,
			TmuxSessionName: step.TmuxSessionName,
			IsTmuxTerminal:  step.IsTmuxTerminal,
			OrderIndex:      i, // Use array index for consistent ordering
		}
	}

	return &ExportFlowResponse{
		Name:        flow.Name,
		Description: flow.Description,
		Variables:   variables,
		Steps:       exportSteps,
		ExportedAt:  time.Now(),
		Version:     version,
	}, nil
}

func importFlow(req ImportFlowRequest) (*FlowDB, error) {
	// Validate the import request
	if req.Name == "" {
		return nil, fmt.Errorf("flow name is required")
	}

	// Convert ImportFlowRequest to CreateFlowRequest
	createReq := CreateFlowRequest{
		Name:      req.Name,
		Variables: req.Variables,
		Steps:     make([]Step, len(req.Steps)),
	}

	// Convert steps from import format
	for i, importStep := range req.Steps {
		createReq.Steps[i] = Step{
			Name:            importStep.Name,
			Command:         importStep.Command,
			Notes:           importStep.Notes,
			SkipPrompt:      importStep.SkipPrompt,
			Terminal:        importStep.Terminal,
			TmuxSessionName: importStep.TmuxSessionName,
			IsTmuxTerminal:  importStep.IsTmuxTerminal,
		}
	}

	// Create the flow
	return createFlow(createReq)
}

// New handlers for editing
func handleUpdateFlow(c echo.Context) error {
	flowID := c.Param("id")
	if flowID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow ID is required",
		})
	}

	var req UpdateFlowRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(flowID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid flow ID",
		})
	}

	flow, err := updateFlow(id, req)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Flow with this name already exists",
			})
		}
		log.Printf("Error updating flow: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update flow",
		})
	}

	return c.JSON(http.StatusOK, flow)
}

func handleDeleteFlow(c echo.Context) error {
	flowID := c.Param("id")
	if flowID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow ID is required",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(flowID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid flow ID",
		})
	}

	if err := deleteFlow(id); err != nil {
		log.Printf("Error deleting flow: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete flow",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Flow deleted successfully",
	})
}

func handleUpdateStep(c echo.Context) error {
	stepID := c.Param("id")
	if stepID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Step ID is required",
		})
	}

	var req UpdateStepRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(stepID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid step ID",
		})
	}

	step, err := updateStep(id, req)
	if err != nil {
		log.Printf("Error updating step: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update step",
		})
	}

	return c.JSON(http.StatusOK, step)
}

func handleCreateStep(c echo.Context) error {
	var req CreateStepRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	step, err := createStep(req)
	if err != nil {
		log.Printf("Error creating step: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create step",
		})
	}

	return c.JSON(http.StatusCreated, step)
}

func handleDeleteStep(c echo.Context) error {
	stepID := c.Param("id")
	if stepID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Step ID is required",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(stepID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid step ID",
		})
	}

	if err := deleteStep(id); err != nil {
		log.Printf("Error deleting step: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete step",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Step deleted successfully",
	})
}

func handleUpdateVariable(c echo.Context) error {
	flowID := c.Param("flowId")
	key := c.Param("key")

	if flowID == "" || key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow ID and variable key are required",
		})
	}

	var req UpdateVariableRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(flowID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid flow ID",
		})
	}

	if err := updateVariable(id, key, req); err != nil {
		log.Printf("Error updating variable: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update variable",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Variable updated successfully",
	})
}

func handleDeleteVariable(c echo.Context) error {
	flowID := c.Param("flowId")
	key := c.Param("key")

	if flowID == "" || key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow ID and variable key are required",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(flowID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid flow ID",
		})
	}

	if err := deleteVariable(id, key); err != nil {
		log.Printf("Error deleting variable: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete variable",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Variable deleted successfully",
	})
}

// Export/Import handlers
func handleExportFlow(c echo.Context) error {
	flowID := c.Param("id")
	if flowID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow ID is required",
		})
	}

	id := 0
	if _, err := fmt.Sscanf(flowID, "%d", &id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid flow ID",
		})
	}

	exportData, err := exportFlow(id)
	if err != nil {
		log.Printf("Error exporting flow: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to export flow",
		})
	}

	// Set proper headers for file download
	filename := fmt.Sprintf("%s-flow-export.json", exportData.Name)
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Response().Header().Set("Content-Type", "application/json")

	return c.JSON(http.StatusOK, exportData)
}

func handleImportFlow(c echo.Context) error {
	var req ImportFlowRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Flow name is required",
		})
	}

	// Check if flow already exists
	flows, err := getAllFlows()
	if err != nil {
		log.Printf("Error checking existing flows: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to check existing flows",
		})
	}

	for _, flow := range flows {
		if flow.Name == req.Name {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": fmt.Sprintf("Flow with name '%s' already exists", req.Name),
			})
		}
	}

	flow, err := importFlow(req)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Flow with this name already exists",
			})
		}
		log.Printf("Error importing flow: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to import flow",
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Flow imported successfully",
		"flow":    flow,
	})
}

// Health check endpoint
func handleHealthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"version": version,
		"service": config.Service.Name,
	})
}

// Diagnostic endpoint for troubleshooting permissions
func handleDiagnostics(c echo.Context) error {
	homeDir := getUserHomeDir()
	workingDir := homeDir
	if config != nil && config.System.Workspace.DefaultDir != "" {
		workingDir = config.System.Workspace.DefaultDir
	}

	// Test file access in key directories
	testDirs := []string{homeDir, workingDir, "/tmp", "/opt/dev-tool"}
	dirAccess := make(map[string]interface{})

	for _, dir := range testDirs {
		info := map[string]interface{}{
			"exists":   false,
			"readable": false,
			"writable": false,
			"error":    nil,
		}

		if stat, err := os.Stat(dir); err == nil {
			info["exists"] = true
			info["mode"] = stat.Mode().String()
			info["owner"] = fmt.Sprintf("%d:%d", stat.Sys().(*syscall.Stat_t).Uid, stat.Sys().(*syscall.Stat_t).Gid)

			// Test read access
			if file, err := os.Open(dir); err == nil {
				info["readable"] = true
				file.Close()
			} else {
				info["read_error"] = err.Error()
			}

			// Test write access by creating a temp file
			testFile := filepath.Join(dir, ".devtool-test")
			if file, err := os.Create(testFile); err == nil {
				info["writable"] = true
				file.Close()
				os.Remove(testFile)
			} else {
				info["write_error"] = err.Error()
			}
		} else {
			info["error"] = err.Error()
		}

		dirAccess[dir] = info
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"service": map[string]interface{}{
			"version":     version,
			"user":        os.Getenv("USER"),
			"home":        homeDir,
			"working_dir": workingDir,
			"pid":         os.Getpid(),
			"uid":         os.Getuid(),
			"gid":         os.Getgid(),
		},
		"environment": map[string]string{
			"HOME": os.Getenv("HOME"),
			"USER": os.Getenv("USER"),
			"PATH": os.Getenv("PATH"),
			"PWD":  os.Getenv("PWD"),
		},
		"directory_access": dirAccess,
		"config": map[string]interface{}{
			"workspace_config": config.System.Workspace,
			"data_dirs":        config.Data,
		},
	})
}

func main() {
	// Command line flags
	var (
		configPath  = flag.String("config", "", "Path to configuration file")
		showVersion = flag.Bool("version", false, "Show version information")
		showHelp    = flag.Bool("help", false, "Show help information")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("DevTool v%s\n", version)
		return
	}

	if *showHelp {
		fmt.Printf("DevTool v%s - Development Flow Service\n\n", version)
		fmt.Println("Usage:")
		fmt.Println("  dev-tool [flags]")
		fmt.Println("")
		fmt.Println("Flags:")
		flag.PrintDefaults()
		return
	}

	// Load configuration
	var err error
	config, err = loadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Update version from config if available
	if config.Service.Version != "" {
		version = config.Service.Version
	}

	log.Printf("Starting DevTool v%s", version)

	// Initialize database
	if err := initDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Ensure database is closed on exit
	defer func() {
		if db != nil {
			if err := db.Close(); err != nil {
				log.Printf("Error closing database: %v", err)
			}
		}
	}()

	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// CORS middleware with configuration
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: config.Security.CORS.AllowedOrigins,
		AllowMethods: config.Security.CORS.AllowedMethods,
		AllowHeaders: config.Security.CORS.AllowedHeaders,
	}))

	// Setup static file serving
	setupStaticFileServer(e)

	// API routes
	api := e.Group("/api")

	// Flow routes
	api.POST("/flows", handleCreateFlow)
	api.GET("/flows", getFlows)

	// Step execution routes
	api.POST("/execute-step", handleStepExecution)

	// Shell routes
	api.GET("/shell", handleShellWebSocket)
	api.POST("/execute-command", handleCommandExecution)

	// Health check endpoint
	api.GET("/health", handleHealthCheck)

	// Diagnostic endpoint for troubleshooting permissions
	api.GET("/diagnostics", handleDiagnostics)

	// New handlers for editing
	api.PUT("/flows/:id", handleUpdateFlow)
	api.DELETE("/flows/:id", handleDeleteFlow)
	api.PUT("/steps/:id", handleUpdateStep)
	api.POST("/steps", handleCreateStep)
	api.DELETE("/steps/:id", handleDeleteStep)
	api.PUT("/variables/:flowId/:key", handleUpdateVariable)
	api.DELETE("/variables/:flowId/:key", handleDeleteVariable)

	// Export/Import routes
	api.GET("/flows/:id/export", handleExportFlow)
	api.POST("/flows/import", handleImportFlow)

	// Start server
	address := fmt.Sprintf("%s:%d", config.Service.Host, config.Service.Port)
	log.Printf("Server starting on %s", address)
	log.Printf("Web interface: http://localhost:%d", config.Service.Port)
	e.Logger.Fatal(e.Start(address))
}
