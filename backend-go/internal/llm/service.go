// Jaicode LLM Service - Multi-provider routing with streaming
package llm

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
<<<<<<< Updated upstream
	"io"
	"net/http"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/config"
	"go.uber.org/zap"
)

type Service struct {
	cfg    *config.Config
	log    *zap.Logger
=======
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"io"
	"net/http"
	"time"
)

type Service struct {
	log    logger.Logger
>>>>>>> Stashed changes
	client *http.Client
}

type ProviderConfig struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Model   string `json:"model"`
	Format  string `json:"format"` // "anthropic" or "openai"
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type StreamChunk struct {
	Type    string `json:"type"` // "text", "error", "done"
	Content string `json:"content,omitempty"`
	Error   string `json:"error,omitempty"`
}

<<<<<<< Updated upstream
func NewService(cfg *config.Config, log *zap.Logger) *Service {
	return &Service{
		cfg: cfg,
		log: log,
=======
func NewService(log logger.Logger) *Service {
	return &Service{
		log:    log,
>>>>>>> Stashed changes
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

// Chat sends a non-streaming chat request
func (s *Service) Chat(provider ProviderConfig, messages []ChatMessage) (string, error) {
	if provider.Format == "anthropic" {
		return s.chatAnthropic(provider, messages)
	}
	return s.chatOpenAI(provider, messages)
}

// StreamChat sends a streaming chat request and returns a channel of chunks
func (s *Service) StreamChat(provider ProviderConfig, messages []ChatMessage) (<-chan StreamChunk, error) {
	out := make(chan StreamChunk, 10)

	go func() {
		defer close(out)

		var err error
		if provider.Format == "anthropic" {
			err = s.streamAnthropic(provider, messages, out)
		} else {
			err = s.streamOpenAI(provider, messages, out)
		}

		if err != nil {
			out <- StreamChunk{Type: "error", Error: err.Error()}
		}
	}()

	return out, nil
}

func (s *Service) chatOpenAI(provider ProviderConfig, messages []ChatMessage) (string, error) {
	body := map[string]interface{}{
		"model":    provider.Model,
		"messages": messages,
		"max_tokens": 4096,
	}

	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/v1/chat/completions", provider.BaseURL)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+provider.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("no response from API")
}

func (s *Service) streamOpenAI(provider ProviderConfig, messages []ChatMessage, out chan<- StreamChunk) error {
	body := map[string]interface{}{
		"model":      provider.Model,
		"messages":   messages,
		"max_tokens": 4096,
		"stream":      true,
	}

	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/v1/chat/completions", provider.BaseURL)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+provider.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			out <- StreamChunk{Type: "done"}
			return nil
		}
		if err != nil {
			return err
		}

		if len(line) < 6 || line[:6] != "data: " {
			continue
		}

		jsonData := line[6:]
		if jsonData == "[DONE]\n" {
			out <- StreamChunk{Type: "done"}
			return nil
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}

		if err := json.Unmarshal([]byte(jsonData), &chunk); err == nil {
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				out <- StreamChunk{Type: "text", Content: chunk.Choices[0].Delta.Content}
			}
		}
	}
}

func (s *Service) chatAnthropic(provider ProviderConfig, messages []ChatMessage) (string, error) {
	body := map[string]interface{}{
		"model":      provider.Model,
		"max_tokens": 4096,
		"messages":   messages,
	}

	data, _ := json.Marshal(body)

	url := provider.BaseURL + "/v1/messages"
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", provider.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}

	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Content) > 0 {
		return result.Content[0].Text, nil
	}

	return "", fmt.Errorf("no response")
}

func (s *Service) streamAnthropic(provider ProviderConfig, messages []ChatMessage, out chan<- StreamChunk) error {
	body := map[string]interface{}{
		"model":      provider.Model,
		"max_tokens": 4096,
		"messages":   messages,
		"stream":      true,
	}

	data, _ := json.Marshal(body)

	url := provider.BaseURL + "/v1/messages"
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", provider.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			out <- StreamChunk{Type: "done"}
			return nil
		}
		if err != nil {
			return err
		}

		if line[:6] == "data: " {
			jsonData := line[6:]
			var event struct {
				Type  string `json:"type"`
				Delta struct {
					Text string `json:"text"`
				} `json:"delta"`
			}
			if err := json.Unmarshal([]byte(jsonData), &event); err == nil {
				if event.Type == "content_block_delta" && event.Delta.Text != "" {
					out <- StreamChunk{Type: "text", Content: event.Delta.Text}
				}
			}
		}
	}
}
