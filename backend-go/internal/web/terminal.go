// Jaicode Web Terminal - ttyd integration for browser access
package web

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
)

type Server struct {
	log    logger.Logger
	port   int
	cmd    string
	ttyd   *exec.Cmd
}

func NewServer(log logger.Logger) *Server {
	return &Server{
		log:  log,
		port: 8080,
		cmd:  "jaicode",
	}
}

// IsTtydAvailable checks if ttyd is installed
func IsTtydAvailable() bool {
	_, err := exec.LookPath("ttyd")
	return err == nil
}

// InstallInstructions returns how to install ttyd
func InstallInstructions() string {
	switch runtime.GOOS {
	case "darwin":
		return "brew install ttyd"
	case "linux":
		return "sudo apt install -y ttyd  # or: snap install ttyd"
	default:
		return "Install ttyd from https://github.com/tsl0922/ttyd"
	}
}

// Start launches ttyd web terminal
func (s *Server) Start(port int, workDir string) error {
	if port > 0 {
		s.port = port
	}

	if !IsTtydAvailable() {
		s.log.Warn("ttyd not found. Install: " + InstallInstructions())
		return fmt.Errorf("ttyd not found. Install: %s", InstallInstructions())
	}

	// Check port availability
	if !isPortAvailable(s.port) {
		return fmt.Errorf("port %d is not available", s.port)
	}

	args := []string{
		"--port", fmt.Sprintf("%d", s.port),
		"--cwd", workDir,
		"bash", "-c", "cd " + workDir + " && node packages/tui-node/src/tui.js",
	}

	s.ttyd = exec.Command("ttyd", args...)
	s.ttyd.Stdout = os.Stdout
	s.ttyd.Stderr = os.Stderr

	if err := s.ttyd.Start(); err != nil {
		return fmt.Errorf("failed to start ttyd: %w", err)
	}

	s.log.Info(fmt.Sprintf("Web terminal started on http://localhost:%d", s.port))
	return nil
}

// Stop terminates ttyd
func (s *Server) Stop() error {
	if s.ttyd != nil && s.ttyd.Process != nil {
		s.ttyd.Process.Kill()
		s.log.Info("Web terminal stopped")
	}
	return nil
}

// PortFree checks if a port is available
func isPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// FindFreePort finds an available port starting from the given port
func FindFreePort(start int) int {
	for p := start; start < 65535; p++ {
		if isPortAvailable(p) {
			return p
		}
	}
	return 0
}

// Clean up unused imports
var _ = strings.ToLower
