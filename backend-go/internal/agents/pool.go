// Jaicode Sub-Agent System - Parallel task execution with goroutines
package agents

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
)

type AgentPool struct {
	log            logger.Logger
	maxConcurrent  int
	sem            chan struct{}
	wg             sync.WaitGroup
}

type Task struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Files       []string `json:"files,omitempty"`
	Status      string `json:"status"`
	Result      string `json:"result,omitempty"`
	Error       string `json:"error,omitempty"`
	Duration    int64  `json:"duration_ms"`
}

type TaskResult struct {
	TaskID   string `json:"task_id"`
	Success  bool   `json:"success"`
	Result   string `json:"result"`
	Error    string `json:"error"`
}

func NewPool(log logger.Logger, maxConcurrent int) *AgentPool {
	if maxConcurrent <= 0 {
		maxConcurrent = 4
	}
	return &AgentPool{
		log:           log,
		maxConcurrent: maxConcurrent,
		sem:           make(chan struct{}, maxConcurrent),
	}
}

// Execute runs a single sub-agent task synchronously
func (p *AgentPool) Execute(description string) (*TaskResult, error) {
	task := &Task{
		ID:          fmt.Sprintf("task-%d", time.Now().UnixNano()),
		Description: description,
		Status:      "running",
	}

	p.log.Info(fmt.Sprintf("Sub-agent started: %s", description[:min(80, len(description))]))

	start := time.Now()

	// In MVP, run as direct LLM call
	result, err := p.runTask(task)

	task.Duration = time.Since(start).Milliseconds()
	if err != nil {
		task.Status = "failed"
		task.Error = err.Error()
		return &TaskResult{TaskID: task.ID, Success: false, Error: err.Error()}, err
	}

	task.Status = "completed"
	task.Result = result

	p.log.Info(fmt.Sprintf("Sub-agent completed in %dms", task.Duration))

	return &TaskResult{TaskID: task.ID, Success: true, Result: result}, nil
}

// ExecuteParallel runs multiple tasks concurrently
func (p *AgentPool) ExecuteParallel(tasks []string) ([]TaskResult, error) {
	results := make([]TaskResult, len(tasks))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	for i, desc := range tasks {
		p.wg.Add(1)
		p.sem <- struct{}{} // Acquire semaphore

		go func(idx int, d string) {
			defer p.wg.Done()
			defer func() { <-p.sem }() // Release semaphore

			result, err := p.Execute(d)
			if err != nil {
				results[idx] = TaskResult{Success: false, Error: err.Error()}
			} else {
				results[idx] = *result
			}

			// Check for context cancellation
			select {
			case <-ctx.Done():
				return
			default:
			}
		}(i, desc)
	}

	p.wg.Wait()
	return results, nil
}

// runTask executes a single task (placeholder for actual LLM call)
func (p *AgentPool) runTask(task *Task) (string, error) {
	// In production, this would connect to the LLM service
	// For now, return a mock response indicating the framework is ready
	return fmt.Sprintf("Task framework ready for: %s", task.Description), nil
}

// GetStatus returns current pool status
func (p *AgentPool) GetStatus() map[string]int {
	return map[string]int{
		"max_concurrent": p.maxConcurrent,
		"running":        len(p.sem),
	}
}

// Helper
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
