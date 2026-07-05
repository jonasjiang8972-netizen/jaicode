.PHONY: build run test clean proto

BINARY_NAME=jaicode-server
GO=go
PROTO_DIR=proto
PKG=github.com/jonanas8972-netizen/jaicode-go

build:
	$(GO) build -o bin/$(BINARY_NAME) cmd/jaicode-server/main.go
	@echo "Built: bin/$(BINARY_NAME)"

build-all:
	# macOS ARM64 (M5)
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO) build -o bin/$(BINARY_NAME)-darwin-arm64 cmd/jaicode-server/main.go
	# macOS x86_64
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GO) build -o bin/$(BINARY_NAME)-darwin-amd64 cmd/jaicode-server/main.go
	# Linux x86_64
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -o bin/$(BINARY_NAME)-linux-amd64 cmd/jaicode-server/main.go
	# Linux ARM64
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build -o bin/$(BINARY_NAME)-linux-arm64 cmd/jaicode-server/main.go
	# Windows x86_64
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO) build -o bin/$(BINARY_NAME)-windows-amd64.exe cmd/jaicode-server/main.go

	@echo "All platform binaries built in ./bin/"

run:
	$(GO) run cmd/jaicode-server/main.go

test:
	$(GO) test -v ./...

clean:
	rm -rf bin/
	$(GO) clean

proto:
	protoc --go_out=. --go-grpc_out=. $(PROTO_DIR)/jaicode.proto

deps:
	$(GO) mod tidy
	$(GO) mod verify

# Docker
docker-build:
	docker build -t jaicode-go:latest .

# Size check
size-check: build
	@ls -lh bin/$(BINARY_NAME)
	@echo "---"
	@file bin/$(BINARY_NAME)
