// Jaicode Configuration
package config

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
}

func Default() *Config {
	return &Config{
		Providers:       map[string]ProviderConfig{},
		DefaultProvider: "anthropic",
		Language:        "en",
	}
}
