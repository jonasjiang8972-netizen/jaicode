// Jaicode Go Backend - Main Entry Point
// Version: Dual-language policy - Go branch starts at v0.14.0
// See VERSION_POLICY.md for details
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/hooks"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/llm"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/mcp"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/session"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/config"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

var (
	version = "0.14.0"
	cfgFile string
)

func main() {
	rootCmd := &cobra.Command{
		Use:     "jaicode-server",
		Short:   "Jaicode Go Backend Server",
		Version: version,
		RunE:    runServer,
	}

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file path")
	rootCmd.PersistentFlags().String("socket", "/tmp/jaicode.sock", "Unix socket path")
	rootCmd.PersistentFlags().Int("port", 3003, "gRPC port")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runServer(cmd *cobra.Command, args []string) error {
	// Initialize logger
	log, err := logger.NewLogger()
	if err != nil {
		return fmt.Errorf("failed to init logger: %w", err)
	}
	defer log.Sync()

	log.Info("Jaicode Go Backend starting", zap.String("version", version))

	// Load configuration
	cfg, err := config.Load(cfgFile)
	if err != nil {
		log.Warn("Using default config", zap.Error(err))
		cfg = config.Default()
	}

	// Initialize core services
	fileService := files.NewService(log)
	llmService := llm.NewService(cfg, log)
	sessionManager := session.NewService(log)
	hooksEngine := hooks.NewEngine(log)
	mcpClient := mcp.NewClient(log)
	gitOps := git.NewOperations(log)

	// Create gRPC server
	socketPath, _ := cmd.Flags().GetString("socket")
	port, _ := cmd.Flags().GetInt("port")

	server := NewJaicodeServer(fileService, llmService, sessionManager, hooksEngine, mcpClient, gitOps, log)

	// Start gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	log.Info("Server listening", zap.Int("port", port))

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Info("Shutting down...")
		cancel()
	}()

	// Start serving (simplified - real implementation would use gRPC)
	<-ctx.Done()
	return nil
}
