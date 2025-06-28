package main

import (
	"encoding/base64"
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"

	"github.com/gorilla/websocket"
	"github.com/kr/pty"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type wsPty struct {
	Cmd *exec.Cmd
	Pty *os.File
}

func (wp *wsPty) Start() error {
	var err error
	wp.Cmd = exec.Command("/bin/bash", "-l")
	wp.Cmd.Env = os.Environ()
	wp.Pty, err = pty.Start(wp.Cmd)
	if err != nil {
		return err
	}
	return nil
}

func (wp *wsPty) Stop() {
	if wp.Pty != nil {
		wp.Pty.Close()
	}
	if wp.Cmd != nil && wp.Cmd.Process != nil {
		wp.Cmd.Process.Kill()
		wp.Cmd.Wait()
	}
}

func shellHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("New WebSocket connection")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Websocket upgrade failed: %s\n", err)
		return
	}
	defer conn.Close()

	wp := &wsPty{}
	err = wp.Start()
	if err != nil {
		log.Printf("Failed to start PTY: %s\n", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to start shell"))
		return
	}
	defer wp.Stop()

	log.Println("PTY started successfully")

	// Execute step command if provided
	stepCommand := r.URL.Query().Get("command")
	if stepCommand != "" {
		log.Printf("Executing step command: %s", stepCommand)
		wp.Pty.Write([]byte(stepCommand + "\n"))
	}

	// Copy from PTY to WebSocket (shell output to browser)
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := wp.Pty.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("Failed to read from pty: %s", err)
				}
				return
			}

			// Encode to base64 for transmission
			out := make([]byte, base64.StdEncoding.EncodedLen(n))
			base64.StdEncoding.Encode(out, buf[0:n])

			err = conn.WriteMessage(websocket.TextMessage, out)
			if err != nil {
				log.Printf("Failed to send to websocket: %s", err)
				return
			}
		}
	}()

	// Copy from WebSocket to PTY (browser input to shell)
	for {
		mt, payload, err := conn.ReadMessage()
		if err != nil {
			if err != io.EOF {
				log.Printf("WebSocket read failed: %s\n", err)
			}
			return
		}

		switch mt {
		case websocket.TextMessage:
			// Decode from base64
			buf := make([]byte, base64.StdEncoding.DecodedLen(len(payload)))
			n, err := base64.StdEncoding.Decode(buf, payload)
			if err != nil {
				log.Printf("base64 decoding failed: %s\n", err)
				continue
			}

			// Write to PTY
			_, err = wp.Pty.Write(buf[:n])
			if err != nil {
				log.Printf("Failed to write to pty: %s", err)
				return
			}
		case websocket.BinaryMessage:
			log.Printf("Ignoring binary message")
		default:
			log.Printf("Invalid message type %d\n", mt)
			return
		}
	}
}

func flowsHandler(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	// Simple response for now
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`[
		{
			"name": "Setup Project Locally",
			"variables": {"PROJECT_PATH": "/home/user/myproject"},
			"steps": [
				{
					"name": "Kill Process Running on Port 4646",
					"command": "kill -9 $(lsof -t -i:4646)",
					"notes": "Kill the process running on port 4646. You can skip this if no process is running on that port.",
					"skip_prompt": true
				},
				{
					"name": "Start Nomad",
					"command": "echo 'Starting Nomad...' && sleep 2 && nomad agent -dev",
					"notes": "Start the Nomad dev agent. You can skip this if already running.",
					"skip_prompt": true
				},
				{
					"name": "Run Nomad Job", 
					"command": "echo 'Running Nomad job...' && sleep 1 && echo 'Job completed'"
				},
				{
					"name": "Start Servers",
					"command": "echo 'Starting servers...' && sleep 1 && echo 'Servers are now running'"
				}
			]
		}
	]`))
}

func main() {
	flag.Parse()

	// WebSocket endpoint for shell
	http.HandleFunc("/shell", shellHandler)

	// API endpoint for flows
	http.HandleFunc("/flows", flowsHandler)

	log.Println("Server starting on :8080")
	log.Println("WebSocket endpoint: ws://localhost:8080/shell")
	log.Println("Flows API: http://localhost:8080/flows")

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatalf("Server failed to start: %s\n", err)
	}
}
