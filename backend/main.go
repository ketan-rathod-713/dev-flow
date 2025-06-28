package main

import (
	"bytes"
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
	"time"

	"github.com/gorilla/websocket"
	"github.com/kr/pty"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gopkg.in/yaml.v2"
)

// Version information (set during build)
var version = "dev"

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
	Shell  ShellConfig  `yaml:"shell"`
	Limits LimitsConfig `yaml:"limits"`
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

// Global configuration
var config *Config

// CommandRequest represents the request payload for command execution
type CommandRequest struct {
	Command string `json:"command" binding:"required"`
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

type Step struct {
	Name       string `yaml:"name" json:"name"`
	Command    string `yaml:"command" json:"command"`
	Notes      string `yaml:"notes,omitempty" json:"notes,omitempty"`
	SkipPrompt bool   `yaml:"skip_prompt,omitempty" json:"skip_prompt,omitempty"`
	Terminal   bool   `yaml:"terminal" json:"terminal"`
}

type Flow struct {
	Name      string            `yaml:"name" json:"name"`
	Variables map[string]string `yaml:"variables,omitempty" json:"variables"`
	Steps     []Step            `yaml:"steps" json:"steps"`
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
			Port:    8080,
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

// executeCommand runs the command and returns detailed execution results
func executeCommand(command string) CommandResult {
	startTime := time.Now()

	// Check if command is blocked
	if isCommandBlocked(command) {
		return CommandResult{
			Command:    command,
			ExitCode:   1,
			Stdout:     "",
			Stderr:     "Command blocked by security policy",
			Duration:   time.Since(startTime),
			Success:    false,
			ExecutedAt: startTime,
		}
	}

	// Create command
	shell := config.System.Shell.DefaultShell
	if shell == "" {
		shell = "/bin/bash"
	}
	cmd := exec.Command(shell, "-c", command)

	// Capture stdout and stderr
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Execute command
	err := cmd.Run()
	duration := time.Since(startTime)

	// Determine exit code
	exitCode := 0
	success := true
	if err != nil {
		success = false
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			exitCode = -1 // Unknown error
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

	// Execute the command
	result := executeCommand(req.Command)

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

	// Start bash with PTY
	shell := config.System.Shell.DefaultShell
	if shell == "" {
		shell = "/bin/bash"
	}
	cmd := exec.Command(shell)
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
		log.Printf("Executing command: %s", command)
		_, err := ptmx.Write([]byte(command + "\n"))
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

// getFlows handles GET /flows
func getFlows(c echo.Context) error {
	flowsDir := config.Data.FlowsDir
	if flowsDir == "" {
		flowsDir = "./flows"
	}

	// Check if flows directory exists
	if _, err := os.Stat(flowsDir); os.IsNotExist(err) {
		return c.JSON(http.StatusOK, []Flow{})
	}

	files, err := filepath.Glob(filepath.Join(flowsDir, "*.yaml"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to read flows directory",
		})
	}

	var flows []Flow
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			log.Printf("Error reading file %s: %v", file, err)
			continue
		}

		var flow Flow
		if err := yaml.Unmarshal(data, &flow); err != nil {
			log.Printf("Error parsing YAML file %s: %v", file, err)
			continue
		}

		flows = append(flows, flow)
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
	api := e.Group("")

	// Flow routes
	api.GET("/flows", getFlows)

	// Shell routes
	api.GET("/shell", handleShellWebSocket)
	api.POST("/execute-command", handleCommandExecution)

	// Health check endpoint
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":  "healthy",
			"version": version,
			"service": config.Service.Name,
		})
	})

	// Start server
	address := fmt.Sprintf("%s:%d", config.Service.Host, config.Service.Port)
	log.Printf("Server starting on %s", address)
	log.Printf("Web interface: http://localhost:%d", config.Service.Port)
	e.Logger.Fatal(e.Start(address))
}
