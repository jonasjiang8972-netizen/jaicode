// Jaicode Configuration
package config

<<<<<<< Updated upstream
import (
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	Providers      map[string]ProviderConfig `mapstructure:"providers"`
	DefaultProvider string                    `mapstructure:"default_provider"`
	Language       string                    `mapstructure:"language"`
}

type ProviderConfig struct {
	ApiKey  string `mapstructure:"apiKey"`
	BaseURL string `mapstructure:"baseURL"`
	Model   string `mapstructure:"model"`
	Enabled bool   `mapstructure:"enabled"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()

	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		home, _ := os.UserHomeDir()
		v.AddConfigPath(filepath.Join(home, ".jaicode"))
		v.SetConfigName("config")
		v.SetConfigType("json")
	}

	v.SetDefault("language", "en")
	v.SetDefault("default_provider", "anthropic")

	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
=======
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
>>>>>>> Stashed changes
}

func Default() *Config {
	return &Config{
<<<<<<< Updated upstream
		Providers:       map[string]ProviderConfig{},
		DefaultProvider: "anthropic",
		Language:        "en",
	}
}
=======
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
>>>>>>> Stashed changes
