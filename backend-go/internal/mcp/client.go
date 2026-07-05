// Jaicode MCP Client - JSON-RPC 2.0 protocol
package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
<<<<<<< Updated upstream
=======
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
>>>>>>> Stashed changes
	"io"
	"os/exec"
	"sync"
	"time"

<<<<<<< Updated upstream
	"go.uber.org/zap"
)

type Client struct {
	log     *zap.Logger
=======
)

type Client struct {
	log     logger.Logger
>>>>>>> Stashed changes
	clients map[string]*MCPProcess
	mu      sync.Mutex
}

type MCPProcess struct {
	Name   string
	Cmd    string
	Args   []string
	Stdin  io.WriteCloser
	Stdout io.ReadCloser
	Stderr io.ReadCloser
	NextID int
	Tools  []MCPTool
}

type MCPTool struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

<<<<<<< Updated upstream
func NewClient(log *zap.Logger) *Client {
=======
func NewClient(log logger.Logger) *Client {
>>>>>>> Stashed changes
	return &Client{log: log, clients: make(map[string]*MCPProcess)}
}

// Connect starts an MCP server process and initializes it
func (c *Client) Connect(name, command string, args []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	cmd := exec.Command(command, args...)
	stdin, _ := cmd.StdinPipe()
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start MCP server: %w", err)
	}

	proc := &MCPProcess{
		Name:   name,
		Cmd:    command,
		Args:   args,
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		NextID: 1,
	}

	// Initialize
	initReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      proc.NextID,
		"method":  "initialize",
		"params": map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]interface{}{},
			"clientInfo":      map[string]string{"name": "jaicode", "version": "0.14.0"},
		},
	}
	proc.NextID++

	if err := c.send(proc, initReq); err != nil {
		return fmt.Errorf("init failed: %w", err)
	}

	// Read init response
	if _, err := c.receive(proc); err != nil {
		return fmt.Errorf("init response failed: %w", err)
	}

	// List tools
	toolsReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      proc.NextID,
		"method":  "tools/list",
		"params":  map[string]interface{}{},
	}
	proc.NextID++

	if err := c.send(proc, toolsReq); err != nil {
		return fmt.Errorf("tools list failed: %w", err)
	}

	resp, err := c.receive(proc)
	if err != nil {
		return fmt.Errorf("tools response failed: %w", err)
	}

	// Parse tools
	if result, ok := resp["result"].(map[string]interface{}); ok {
		if tools, ok := result["tools"].([]interface{}); ok {
			for _, t := range tools {
				data, _ := json.Marshal(t)
				var tool MCPTool
				json.Unmarshal(data, &tool)
				proc.Tools = append(proc.Tools, tool)
			}
		}
	}

	c.clients[name] = proc
<<<<<<< Updated upstream
	c.log.Info("MCP connected", zap.String("name", name), zap.Int("tools", len(proc.Tools)))
=======
	c.log.Info(fmt.Sprintf("MCP connected: %s (%d tools)", name, len(proc.Tools)))
>>>>>>> Stashed changes

	return nil
}

// CallTool calls a tool on an MCP server
func (c *Client) CallTool(serverName, toolName string, args map[string]interface{}) (interface{}, error) {
	c.mu.Lock()
	proc, ok := c.clients[serverName]
	c.mu.Unlock()

	if !ok {
		return nil, fmt.Errorf("server not found: %s", serverName)
	}

	req := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      proc.NextID,
		"method":  "tools/call",
		"params":  map[string]interface{}{"name": toolName, "arguments": args},
	}
	proc.NextID++

	if err := c.send(proc, req); err != nil {
		return nil, err
	}

	resp, err := c.receive(proc)
	if err != nil {
		return nil, err
	}

	if result, ok := resp["result"]; ok {
		return result, nil
	}

	return nil, fmt.Errorf("tool call failed")
}

// Disconnect closes all MCP connections
func (c *Client) Disconnect(serverName string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if proc, ok := c.clients[serverName]; ok {
		proc.Stdin.Close()
		proc.Stdout.Close()
		delete(c.clients, serverName)
	}
}

func (c *Client) send(proc *MCPProcess, msg map[string]interface{}) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	_, err = proc.Stdin.Write(append(data, '\n'))
	return err
}

func (c *Client) receive(proc *MCPProcess) (map[string]interface{}, error) {
	reader := bufio.NewReader(proc.Stdout)
	line, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	var msg map[string]interface{}
	json.Unmarshal([]byte(line), &msg)
	return msg, nil
}

func init() {
	_ = time.Now // avoid unused import
}
