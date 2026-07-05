// Jaicode Configuration
package config

type Config struct {
	DefaultProvider string                       `json:"default_provider" mapstructure:"default_provider"`
	Providers       map[string]ProviderConfig    `json:"providers" mapstructure:"providers"`
	Language        string                       `json:"language" mapstructure:"language"`
}

type ProviderConfig struct {
	ApiKey  string `json:"apiKey" mapstructure:"apiKey"`
	BaseURL string `json:"baseURL" mapstructure:"baseURL"`
	Model   string `json:"model" mapstructure:"model"`
	Enabled bool   `json:"enabled" mapstructure:"enabled"`
}

func Default() *Config {
	return &Config{
		DefaultProvider: "anthropic",
		Providers:       map[string]ProviderConfig{},
		Language:        "en",
	}
}

func Load(path string) (*Config, error) {
	cfg := Default()
	// TODO: Read from file if path provided
	return cfg, nil
}
