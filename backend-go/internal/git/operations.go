// Jaicode Git Operations
package git

import (
	"fmt"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"os/exec"
	"strings"

)

type Operations struct {
	log logger.Logger
}

type StatusResult struct {
	Clean  bool   `json:"clean"`
	Files  []File `json:"files"`
	Count  int    `json:"count"`
}

type File struct {
	Status string `json:"status"`
	Path   string `json:"path"`
	Staged bool   `json:"staged"`
}

type BranchResult struct {
	Current  string   `json:"current"`
	Branches []string `json:"branches"`
}

func NewOperations(log logger.Logger) *Operations {
	return &Operations{log: log}
}

func (g *Operations) Status(cwd string) (*StatusResult, error) {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = cwd
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var files []File
	for _, line := range lines {
		if line == "" {
			continue
		}
		files = append(files, File{
			Status: line[:2],
			Path:   line[3:],
			Staged: line[0] != ' ' && line[0] != '?',
		})
	}

	return &StatusResult{
		Clean: len(files) == 0,
		Files: files,
		Count: len(files),
	}, nil
}

func (g *Operations) Commit(cwd, message string, files []string) error {
	if len(files) > 0 {
		exec.Command("git", append([]string{"add"}, files...)...).Run()
	} else {
		exec.Command("git", "add", "-A").Run()
	}

	cmd := exec.Command("git", "commit", "-m", message)
	cmd.Dir = cwd
	return cmd.Run()
}

func (g *Operations) Branch(cwd string) (*BranchResult, error) {
	cmd := exec.Command("git", "branch", "--show-current")
	cmd.Dir = cwd
	out, _ := cmd.Output()
	current := strings.TrimSpace(string(out))

	cmd = exec.Command("git", "branch", "--format=%(refname:short)")
	cmd.Dir = cwd
	out, _ = cmd.Output()
	branches := strings.Split(strings.TrimSpace(string(out)), "\n")

	return &BranchResult{Current: current, Branches: branches}, nil
}

func (g *Operations) CreateBranch(cwd, name string) error {
	cmd := exec.Command("git", "checkout", "-b", name)
	cmd.Dir = cwd
	return cmd.Run()
}

func (g *Operations) Log(cwd string, count int) ([]string, error) {
	cmd := exec.Command("git", "log", "--oneline", fmt.Sprintf("-%d", count))
	cmd.Dir = cwd
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(out)), "\n"), nil
}
