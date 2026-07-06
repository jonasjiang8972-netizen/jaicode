// Session Manager - Cookie-based authentication
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"sync"
	"time"
)

type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	domain   string
	secure   bool
}

type Session struct {
	ID         string
	UserID     string
	APIKey     string
	Provider   string
	Model      string
	CreatedAt  time.Time
	LastAccess time.Time
}

func NewSessionManager(domain string, secure bool) *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
		domain:   domain,
		secure:   secure,
	}
}

func (sm *SessionManager) CreateSession(apiKey, provider, model string) string {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sessionID := generateSessionID()
	sm.sessions[sessionID] = &Session{
		ID:         sessionID,
		UserID:     generateSessionID()[:8],
		APIKey:     apiKey,
		Provider:   provider,
		Model:      model,
		CreatedAt:  time.Now(),
		LastAccess: time.Now(),
	}

	return sessionID
}

func (sm *SessionManager) GetSession(sessionID string) (*Session, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, ok := sm.sessions[sessionID]
	if ok {
		session.LastAccess = time.Now()
	}
	return session, ok
}

func (sm *SessionManager) DeleteSession(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, sessionID)
}

func (sm *SessionManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow public paths
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie("jaicode_session")
		if err != nil {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		session, ok := sm.GetSession(cookie.Value)
		if !ok {
			http.Error(w, `{"error":"Session expired"}`, http.StatusUnauthorized)
			return
		}

		// Set session in request context
		ctx := WithSession(r.Context(), session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (sm *SessionManager) SetSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "jaicode_session",
		Value:    sessionID,
		Domain:   sm.domain,
		Path:     "/",
		MaxAge:   86400 * 7, // 7 days
		HttpOnly: true,
		Secure:   sm.secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func (sm *SessionManager) ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "jaicode_session",
		Value:    "",
		Domain:   sm.domain,
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   sm.secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func isPublicPath(path string) bool {
	publicPaths := []string{
		"/api/health", "/api/auth/login", "/api/auth/logout",
		"/", "/index.html", "/login",
	}
	for _, p := range publicPaths {
		if path == p || path[:len(p)] == p {
			return true
		}
	}
	// Static files
	if len(path) > 4 && path[len(path)-4:] == ".js" {
		return true
	}
	if len(path) > 5 && path[len(path)-5:] == ".css" {
		return true
	}
	if len(path) > 4 && path[len(path)-4:] == ".png" {
		return true
	}
	if len(path) > 5 && path[len(path)-5:] == ".svg" {
		return true
	}
	if len(path) > 4 && path[len(path)-4:] == ".ico" {
		return true
	}
	return false
}

func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// ============ Context helpers ============

type contextKey string

const sessionContextKey contextKey = "session"

func WithSession(ctx context.Context, session *Session) context.Context {
	return context.WithValue(ctx, sessionContextKey, session)
}

func GetSessionFromContext(ctx context.Context) (*Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(*Session)
	return session, ok
}
