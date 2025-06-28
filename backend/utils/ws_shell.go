package utils

import (
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func HandleShellWebSocket(w http.ResponseWriter, r *http.Request) error {
	log.Println("[WebSocket] New connection attempt")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[WebSocket] Upgrade error:", err)
		return err
	}
	defer conn.Close()
	log.Println("[WebSocket] Connection established")

	// Start bash with PTY for proper terminal behavior
	cmd := exec.Command("/bin/bash")

	// Set proper environment and working directory
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"PS1=$ ",
		"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	)

	// Set working directory to user's home or current directory
	if homeDir, err := os.UserHomeDir(); err == nil {
		cmd.Dir = homeDir
	} else {
		if cwd, err := os.Getwd(); err == nil {
			cmd.Dir = cwd
		}
	}

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Println("[Shell] Failed to start PTY:", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to start shell\r\n"))
		return err
	}
	defer func() {
		ptmx.Close()
		cmd.Process.Kill()
		log.Println("[Shell] Shell and PTY closed")
	}()

	log.Println("[Shell] Shell started with PTY in directory:", cmd.Dir)

	// Wait a moment for shell to initialize
	time.Sleep(100 * time.Millisecond)

	// Execute step command if provided
	stepCommand := r.URL.Query().Get("command")
	if stepCommand != "" {
		log.Println("[Shell] Executing step command:", stepCommand)
		// Wait for shell prompt before executing command
		time.Sleep(200 * time.Millisecond)
		ptmx.Write([]byte(stepCommand))
	}

	// Channel to signal when to stop
	done := make(chan struct{})

	// Read from WebSocket and write to PTY (user input)
	go func() {
		defer close(done)
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("[WebSocket] Read error:", err)
				return
			}

			// Handle exit commands
			msgStr := string(message)
			if msgStr == "exit\r" || msgStr == "exit\n" || msgStr == "\x04" {
				ptmx.Write([]byte("exit"))
				return
			}

			// Write user input to shell
			_, err = ptmx.Write(message)
			if err != nil {
				log.Println("[Shell] Write error:", err)
				return
			}
		}
	}()

	// Read from PTY and write to WebSocket (shell output)
	go func() {
		buf := make([]byte, 1024)
		for {
			select {
			case <-done:
				return
			default:
				// Set read timeout to avoid blocking forever
				ptmx.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				n, err := ptmx.Read(buf)
				if n > 0 {
					// Send shell output to WebSocket
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if err := conn.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
						log.Println("[WebSocket] Write error:", err)
						return
					}
				}
				if err != nil && err != os.ErrDeadlineExceeded {
					if err == io.EOF {
						log.Println("[Shell] Shell process ended")
					} else {
						log.Println("[Shell] Read error:", err)
					}
					return
				}
			}
		}
	}()

	// Wait for either goroutine to finish
	<-done
	log.Println("[WebSocket] Connection closing")
	return nil
}
