// Jaicode Structured Logger
package logger

import (
	"os"
	"path/filepath"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func NewLogger(level string) (*zap.Logger, error) {
	logDir := filepath.Join(os.Getenv("HOME"), ".jaicode", "logs")
	os.MkdirAll(logDir, 0755)

	logFile := filepath.Join(logDir, "jaicode-server.log")

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		MessageKey:     "msg",
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
	}

	fileEncoder := zapcore.NewJSONEncoder(encoderConfig)
	consoleEncoder := zapcore.NewConsoleEncoder(encoderConfig)

	logFileHandle, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	var zapLevel zapcore.Level
	switch level {
	case "DEBUG":
		zapLevel = zapcore.DebugLevel
	case "WARN":
		zapLevel = zapcore.WarnLevel
	case "ERROR":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	fileCore := zapcore.NewCore(fileEncoder, zapcore.AddSync(logHandle), zapLevel)
	consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), zapLevel)

	core := zapcore.NewTee(fileCore, consoleCore)
	return zap.New(core, zap.AddCaller()), nil
}
