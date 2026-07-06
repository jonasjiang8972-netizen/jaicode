package cache

import (
	"os"
	"testing"
)

func TestHashIndexAddFile(t *testing.T) {
	idx := NewHashIndex("/tmp")
	defer idx.Remove("test.txt")

	// Create temp file
	content := []byte("hello world")
	path := "/tmp/test_cache_file.txt"
	if err := writeFile(path, content); err != nil {
		t.Skip("Cannot write temp file:", err)
	}
	defer removeFile(path)

	err := idx.AddFile("test.txt", path)
	if err != nil {
		t.Fatal(err)
	}

	entry, ok := idx.GetEntry("test.txt")
	if !ok {
		t.Fatal("File not found in index")
	}
	if entry.Hash == "" {
		t.Fatal("Hash is empty")
	}
	if entry.Size != int64(len(content)) {
		t.Fatalf("Size mismatch: got %d, want %d", entry.Size, len(content))
	}
}

func TestHashIndexChangeDetection(t *testing.T) {
	idx := NewHashIndex("/tmp")
	defer idx.Remove("change_test.txt")

	path := "/tmp/test_cache_change.txt"
	writeFile(path, []byte("version1"))
	defer removeFile(path)

	idx.AddFile("change_test.txt", path)
	entry1, _ := idx.GetEntry("change_test.txt")

	writeFile(path, []byte("version2 - modified"))
	idx.AddFile("change_test.txt", path)
	entry2, _ := idx.GetEntry("change_test.txt")

	if entry1.Hash == entry2.Hash {
		t.Fatal("Hash should change when content changes")
	}
}

func TestEstimateTokens(t *testing.T) {
	tests := []struct {
		text     string
		minToken int
		maxToken int
	}{
		{"", 0, 0},
		{"hello", 1, 2},
		{"hello world foo bar", 3, 5},
		{"你好世界", 2, 3},
	}

	for _, tt := range tests {
		got := EstimateTokens(tt.text)
		if got < tt.minToken || got > tt.maxToken {
			t.Errorf("EstimateTokens(%q) = %d, want [%d, %d]", tt.text, got, tt.minToken, tt.maxToken)
		}
	}
}

func TestPrefixSplitter(t *testing.T) {
	ps := NewPrefixSplitter()
	ps.MaxPrefixSize = 100

	files := []ContextFile{
		{Path: "a.go", Content: "package main\nfunc main() {}", IsStatic: true},
		{Path: "b.go", Content: "package util\nfunc helper() {}", IsStatic: true},
		{Path: "c.txt", Content: "large content that exceeds threshold", IsStatic: false},
	}

	result := ps.Split(files)

	if len(result.StaticPrefix) == 0 {
		t.Fatal("Expected static prefix files")
	}
	if !result.UseCache && result.StaticTokens > 0 {
		t.Logf("Static tokens: %d, cache enabled: %v", result.StaticTokens, result.UseCache)
	}

	// Sensitive files should be excluded
	sensitive := []ContextFile{
		{Path: ".env", Content: "SECRET_KEY=123", IsStatic: true},
		{Path: "src/main.go", Content: "package main", IsStatic: true},
	}
	result2 := ps.Split(sensitive)
	for _, f := range result2.StaticPrefix {
		if f.Path == ".env" {
			t.Fatal("Sensitive file .env should be excluded from cache")
		}
	}
}

func TestBuildAnthropicCacheControl(t *testing.T) {
	block := BuildAnthropicCacheControl("test content", true)
	if block["type"] != "text" {
		t.Fatalf("Expected type=text, got %v", block["type"])
	}
	if block["text"] != "test content" {
		t.Fatalf("Expected text='test content', got %v", block["text"])
	}
	cc, ok := block["cache_control"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected cache_control block")
	}
	if cc["type"] != "ephemeral" {
		t.Fatalf("Expected cache_control type=ephemeral, got %v", cc["type"])
	}
}

func TestBuildMessageStructure(t *testing.T) {
	files := []ContextFile{
		{Path: "main.go", Content: "package main", IsStatic: true},
		{Path: "latest.go", Content: "changes", IsStatic: false},
	}

	messages := BuildMessageStructure("You are helpful", files, "my question")

	if len(messages) < 3 {
		t.Fatalf("Expected at least 3 messages, got %d", len(messages))
	}
	if messages[0]["role"] != "system" {
		t.Fatal("First message should be system")
	}
}

func writeFile(path string, content []byte) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(content)
	return err
}

func removeFile(path string) {
	os.Remove(path)
}
