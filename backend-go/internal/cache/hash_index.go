// Package cache provides Prompt Caching optimization for Jaicode Go backend
package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// HashIndex tracks file hashes for change detection
type HashIndex struct {
	mu      sync.RWMutex
	indexes map[string]*FileEntry
	root    string
	ignored []*regexp.Regexp
}

// FileEntry represents a tracked file
type FileEntry struct {
	Path    string `json:"path"`
	Hash    string `json:"hash"`
	Mtime   int64  `json:"mtime_ms"`
	Size    int64  `json:"size"`
	AddedAt int64  `json:"added_at_ms"`
}

// NewHashIndex creates a new hash index for the given root directory
func NewHashIndex(root string) *HashIndex {
	return &HashIndex{
		root:    root,
		indexes: make(map[string]*FileEntry),
		ignored: compilePatterns([]string{
			`node_modules`,
			`\.git`,
			`\.jaicode_backup`,
			`dist/`,
			`build/`,
			`\.cache`,
		}),
	}
}

func compilePatterns(patterns []string) []*regexp.Regexp {
	var result []*regexp.Regexp
	for _, p := range patterns {
		if re, err := regexp.Compile(p); err == nil {
			result = append(result, re)
		}
	}
	return result
}

// ShouldIgnore checks if a path should be ignored
func (hi *HashIndex) ShouldIgnore(relPath string) bool {
	for _, re := range hi.ignored {
		if re.MatchString(relPath) {
			return true
		}
	}
	return false
}

// AddFile adds or updates a file in the index
func (hi *HashIndex) AddFile(relPath, absPath string) error {
	info, err := os.Stat(absPath)
	if err != nil {
		return err
	}

	hash, err := hashFile(absPath)
	if err != nil {
		return err
	}

	hi.mu.Lock()
	defer hi.mu.Unlock()

	hi.indexes[relPath] = &FileEntry{
		Path:    relPath,
		Hash:    hash,
		Mtime:   info.ModTime().UnixMilli(),
		Size:    info.Size(),
		AddedAt: time.Now().UnixMilli(),
	}

	return nil
}

func hashFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:]), nil
}

// GetEntry retrieves a file entry
func (hi *HashIndex) GetEntry(relPath string) (*FileEntry, bool) {
	hi.mu.RLock()
	defer hi.mu.RUnlock()
	entry, ok := hi.indexes[relPath]
	return entry, ok
}

// GetUnchangedFiles returns all tracked files
func (hi *HashIndex) GetUnchangedFiles() []*FileEntry {
	hi.mu.RLock()
	defer hi.mu.RUnlock()

	result := make([]*FileEntry, 0, len(hi.indexes))
	for _, entry := range hi.indexes {
		result = append(result, entry)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Path < result[j].Path
	})

	return result
}

// GetChangedFiles returns files modified after the given timestamp
func (hi *HashIndex) GetChangedFiles(sinceMs int64) []*FileEntry {
	hi.mu.RLock()
	defer hi.mu.RUnlock()

	var result []*FileEntry
	for _, entry := range hi.indexes {
		if entry.Mtime > sinceMs {
			result = append(result, entry)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Path < result[j].Path
	})

	return result
}

// Remove deletes a file from the index
func (hi *HashIndex) Remove(relPath string) {
	hi.mu.Lock()
	defer hi.mu.Unlock()
	delete(hi.indexes, relPath)
}

// Count returns the number of tracked files
func (hi *HashIndex) Count() int {
	hi.mu.RLock()
	defer hi.mu.RUnlock()
	return len(hi.indexes)
}

// Walk scans the directory tree and indexes all files
func (hi *HashIndex) Walk() (int, error) {
	count := 0

	err := filepath.Walk(hi.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip inaccessible files
		}

		relPath, _ := filepath.Rel(hi.root, path)
		if relPath == "." {
			return nil
		}

		if info.IsDir() {
			if hi.ShouldIgnore(relPath) {
				return filepath.SkipDir
			}
			return nil
		}

		if hi.ShouldIgnore(relPath) {
			return nil
		}

		if isTextFile(path) {
			if err := hi.AddFile(relPath, path); err == nil {
				count++
			}
		}

		return nil
	})

	return count, err
}

func isTextFile(path string) bool {
	textExts := []string{
		".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
		".py", ".go", ".rs", ".java", ".kt", ".swift",
		".c", ".cpp", ".h", ".hpp",
		".md", ".mdx", ".txt", ".json", ".yaml", ".yml",
		".toml", ".xml", ".html", ".htm", ".css", ".scss",
		".sh", ".bash", ".zsh", ".fish",
		".sql", ".graphql", ".proto",
		".dockerfile", ".gitignore",
	}

	ext := strings.ToLower(filepath.Ext(path))
	for _, te := range textExts {
		if ext == te {
			return true
		}
	}
	return ext == ""
}
