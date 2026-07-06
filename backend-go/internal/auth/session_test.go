package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSessionManagerCreateSession(t *testing.T) {
	sm := NewSessionManager("localhost", false)

	sessionID := sm.CreateSession("sk-test-key", "anthropic", "claude-sonnet-4")
	if sessionID == "" {
		t.Fatal("Expected non-empty session ID")
	}

	session, ok := sm.GetSession(sessionID)
	if !ok {
		t.Fatal("Session should exist")
	}
	if session.APIKey != "sk-test-key" {
		t.Fatalf("Expected API key 'sk-test-key', got %q", session.APIKey)
	}
}

func TestSessionManagerRotateSessionID(t *testing.T) {
	sm := NewSessionManager("localhost", false)

	initialID := sm.CreateSession("sk-key", "anthropic", "claude-sonnet-4")
	newID := sm.RotateSessionID(initialID)

	if newID == initialID {
		t.Fatal("Rotated session ID should differ from initial")
	}

	// Old session should not exist
	if _, ok := sm.GetSession(initialID); ok {
		t.Fatal("Old session should be deleted after rotation")
	}

	// New session should exist with same data
	session, ok := sm.GetSession(newID)
	if !ok {
		t.Fatal("New session should exist after rotation")
	}
	if session.APIKey != "sk-key" {
		t.Fatal("Session data should be preserved after rotation")
	}
}

func TestSessionManagerInvalidSession(t *testing.T) {
	sm := NewSessionManager("localhost", false)

	if _, ok := sm.GetSession("nonexistent-id"); ok {
		t.Fatal("Non-existent session should return false")
	}
}

func TestSessionManagerMiddleware(t *testing.T) {
	sm := NewSessionManager("localhost", false)

	// Create a test handler that requires auth
	handler := sm.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Test without cookie (non-public path)
	req := httptest.NewRequest("GET", "/api/protected", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401, got %d", rec.Code)
	}

	// Test with valid cookie
	sessionID := sm.CreateSession("sk-key", "anthropic", "claude-sonnet-4")
	req = httptest.NewRequest("GET", "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "jaicode_session", Value: sessionID})
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rec.Code)
	}
}

func TestSessionManagerPublicPaths(t *testing.T) {
	sm := NewSessionManager("localhost", false)

	handler := sm.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	publicPaths := []string{"/api/health", "/api/auth/login", "/", "/index.html"}
	for _, path := range publicPaths {
		req := httptest.NewRequest("GET", path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("Public path %s should return 200, got %d", path, rec.Code)
		}
	}
}
