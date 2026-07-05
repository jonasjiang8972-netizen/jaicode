// Jaicode VL Analyzer - Vision Language image analysis
package vl

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
)

type Analyzer struct {
	log    logger.Logger
	client *http.Client
}

type VLRequest struct {
	Model    string      `json:"model"`
	MaxToks  int         `json:"max_tokens"`
	Messages []VLMessage `json:"messages"`
}

type VLMessage struct {
	Role    string      `json:"role"`
	Content []VLContent `json:"content"`
}

type VLContent struct {
	Type   string      `json:"type"`
	Source *VLSource   `json:"source,omitempty"`
	Text   string      `json:"text,omitempty"`
}

type VLSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type VLResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type AnalysisResult struct {
	Description string `json:"description"`
	Provider    string `json:"provider"`
	Model       string `json:"model"`
}

func NewAnalyzer(log logger.Logger) *Analyzer {
	return &Analyzer{
		log:    log,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

// AnalyzeImage analyzes an image file using a VL-compatible provider
func (a *Analyzer) AnalyzeImage(imagePath, prompt, providerName, apiKey, model, baseURL string) (*AnalysisResult, error) {
	if prompt == "" {
		prompt = "Describe this image in detail. Focus on code, architecture, UI elements, and technical content. Reply in the same language as the user's input."
	}

	// Read and encode image
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read image: %w", err)
	}

	mimeType := detectMIME(imagePath)
	base64Data := base64.StdEncoding.EncodeToString(data)

	a.log.Info(fmt.Sprintf("VL analysis: %s (%s, %d bytes)", imagePath, mimeType, len(data)))

	var result *AnalysisResult

	switch providerName {
	case "anthropic":
		result, err = a.analyzeAnthropic(base64Data, mimeType, prompt, apiKey, model)
	case "openai":
		result, err = a.analyzeOpenAI(base64Data, mimeType, prompt, apiKey, model)
	default:
		result, err = a.analyzeOpenAICompatible(base64Data, mimeType, prompt, apiKey, model, baseURL)
	}

	if err != nil {
		return nil, err
	}

	result.Provider = providerName
	return result, nil
}

func (a *Analyzer) AnalyzeImageBase64(base64Data, mimeType, prompt, providerName, apiKey, model, baseURL string) (*AnalysisResult, error) {
	if prompt == "" {
		prompt = "Describe this image in detail."
	}

	switch providerName {
	case "anthropic":
		return a.analyzeAnthropic(base64Data, mimeType, prompt, apiKey, model)
	case "openai":
		return a.analyzeOpenAI(base64Data, mimeType, prompt, apiKey, model)
	default:
		return a.analyzeOpenAICompatible(base64Data, mimeType, prompt, apiKey, model, baseURL)
	}
}

func (a *Analyzer) analyzeAnthropic(base64Data, mimeType, prompt, apiKey, model string) (*AnalysisResult, error) {
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}

	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": 4096,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]interface{}{
							"type":       "base64",
							"media_type": mimeType,
							"data":       base64Data,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	data, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic VL error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic VL HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result VLResponse
	json.NewDecoder(resp.Body).Decode(&result)

	if len(result.Content) > 0 {
		return &AnalysisResult{Description: result.Content[0].Text, Model: model}, nil
	}
	return nil, fmt.Errorf("no response from anthropic VL")
}

func (a *Analyzer) analyzeOpenAI(base64Data, mimeType, prompt, apiKey, model string) (*AnalysisResult, error) {
	if model == "" {
		model = "gpt-4o"
	}
	return a.analyzeOpenAICompatible(base64Data, mimeType, prompt, apiKey, model, "https://api.openai.com")
}

func (a *Analyzer) analyzeOpenAICompatible(base64Data, mimeType, prompt, apiKey, model, baseURL string) (*AnalysisResult, error) {
	if model == "" {
		model = "gpt-4o"
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}

	imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": 4096,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
					{"type": "text", "text": prompt},
				},
			},
		},
	}

	data, _ := json.Marshal(reqBody)
	url := fmt.Sprintf("%s/v1/chat/completions", baseURL)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai VL error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai VL HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result VLResponse
	json.NewDecoder(resp.Body).Decode(&result)

	if len(result.Choices) > 0 {
		return &AnalysisResult{Description: result.Choices[0].Message.Content, Model: model}, nil
	}
	return nil, fmt.Errorf("no response from openai VL")
}

func detectMIME(path string) string {
	ext := filepath.Ext(strings.ToLower(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	}
	return "image/png"
}

// Ensure imports are used
var _ = base64.StdEncoding
var _ = strings.ToLower
