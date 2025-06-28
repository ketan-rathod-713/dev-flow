package main

import (
	"bytes"
	"encoding/base64"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kr/pty"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gopkg.in/yaml.v2"
)

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
}

type Flow struct {
	Name      string            `yaml:"name" json:"name"`
	Variables map[string]string `yaml:"variables,omitempty" json:"variables"`
	Steps     []Step            `yaml:"steps" json:"steps"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// executeCommand runs the command and returns detailed execution results
func executeCommand(command string) CommandResult {
	startTime := time.Now()

	// Create command
	cmd := exec.Command("/bin/bash", "-c", command)

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
	cmd := exec.Command("/bin/bash")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("Failed to start shell with PTY: %v", err)
		return err
	}
	defer ptmx.Close()

	// Execute command if provided
	command := c.QueryParam("command")
	if command != "" {
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

// getFlows handles GET /api/flows
func getFlows(c echo.Context) error {
	flowsDir := "./flows"

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

func main() {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// CORS middleware
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept},
	}))

	// API routes
	api := e.Group("")

	// Flow routes
	api.GET("/flows", getFlows)

	// Shell routes
	api.GET("/shell", handleShellWebSocket)
	api.POST("/execute-command", handleCommandExecution)

	// Start server
	log.Println("Server starting on :8080")
	e.Logger.Fatal(e.Start(":8080"))
}
