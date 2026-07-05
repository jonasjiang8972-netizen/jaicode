// Jaicode Go Backend - Main Entry Point (v0.14.0)
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/hooks"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/llm"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/mcp"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/session"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/config"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	security "github.com/jonasjiang8972-netizen/jaicode-go/pkg/security"
	"github.com/jonasjiang8972-netizen/jaicode-go/server"
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
	rootCmd.Flags().String("addr", ":3003", "HTTP listen address")
	rootCmd.Flags().String("log-level", "INFO", "log level (DEBUG/INFO/WARN/ERROR)")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runServer(cmd *cobra.Command, args []string) error {
	logLevel, _ := cmd.Flags().GetString("log-level")
	log, err := logger.NewLogger(logLevel)
	if err != nil {
		return fmt.Errorf("failed to init logger: %w", err)
	}
	defer log.Sync()

	log.Info("Jaicode Go Backend starting", zap.String("version", version))

	cfg, err := config.Load(cfgFile)
	if err != nil {
		log.Warn("Using default config", zap.Error(err))
		cfg = config.Default()
	}

	// Initialize services
	fileSvc := files.NewService(log)
	llmSvc := llm.NewService(cfg, log)
	sessionSvc := session.NewService(log)
	hooksEngine := hooks.NewEngine(log)
	mcpClient := mcp.NewClient(log)
	gitOps := git.NewOperations(log)
	_ = security.NewInputFilter()
	_ = security.NewOutputFilter()

	// Create server
	srv := &http.Server{
		Addr:    ":3003",
		Handler: newRouter(fileSvc, llmSvc, sessionSvc, hooksEngine, mcpClient, gitOps, log),
	}

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Info("Shutting down...")
		cancel()
		srv.Shutdown(ctx)
	}()

	log.Info("Server listening", zap.String("addr", ":3003"))
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}

	return nil
}

func newRouter(
	fileSvc *files.Service,
	llmSvc *llm.Service,
	sessionSvc *session.Service,
	hooksEngine *hooks.Engine,
	mcpClient *mcp.Client,
	gitOps *git.Operations,
	log *zap.Logger,
) http.Handler {
 mux := http.NewServeMux()

	// Chat (SSE)
	mux.HandleFunc("/api/chat", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		handleChat(w, r, llmSvc, log)
		log.Debug("Chat request", zap.Duration("duration", time.Since(start)))
	})

	// File operations
	mux.HandleFunc("/api/file/read", handleFileRead(fileSvc, log))
 mux.HandleFunc("/api/file/write", handleFileWrite(fileSvc, log))

	// Git
	mux.HandleFunc("/api/git/status", handleGitStatus(gitOps, log))
 mux.HandleFunc("/api/git/commit", handleGitCommit(gitOps, log))

	// Health
	mux.HandleFunc("/api/health", handleHealth)

	return mux
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","version":"0.14.0"}`)
}
