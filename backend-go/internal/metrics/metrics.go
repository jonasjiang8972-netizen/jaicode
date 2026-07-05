// Jaicode Metrics - Prometheus-compatible metrics collection
package metrics

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type Metrics struct {
	mu sync.RWMutex

	// Counters
	TotalRequests   int64            `json:"total_requests"`
	TotalTokens     int64            `json:"total_tokens"`
	InputTokens     int64            `json:"input_tokens"`
	OutputTokens    int64            `json:"output_tokens"`
	TotalErrors     int64            `json:"total_errors"`

	// Latency tracking
	Latencies       []int64          `json:"-"`
	AvgLatency      int64            `json:"avg_latency_ms"`
	P50Latency      int64            `json:"p50_latency_ms"`
	P95Latency      int64            `json:"p95_latency_ms"`
	P99Latency      int64            `json:"p99_latency_ms"`

	// Per-provider stats
	ProviderStats   map[string]*ProviderMetrics `json:"providers"`

	// Start time
	StartTime       time.Time        `json:"uptime"`
}

type ProviderMetrics struct {
	Name            string  `json:"name"`
	Requests        int64   `json:"requests"`
	Tokens          int64   `json:"tokens"`
	Errors          int64   `json:"errors"`
	AvgLatency      int64   `json:"avg_latency_ms"`
}

var instance *Metrics

func Get() *Metrics {
	if instance == nil {
		instance = &Metrics{
			ProviderStats: make(map[string]*ProviderMetrics),
			Latencies:     make([]int64, 0, 1000),
			StartTime:     time.Now(),
		}
	}
	return instance
}

func (m *Metrics) RecordRequest(latencyMs int64) {
	defer m.mu.Unlock()
	m.mu.Lock()
	m.TotalRequests++
	m.Latencies = append(m.Latencies, latencyMs)
	if len(m.Latencies) > 1000 {
		m.Latencies = m.Latencies[len(m.Latencies)-1000:]
	}
	m.calculatePercentiles()
}

func (m *Metrics) RecordTokens(provider string, inputTok, outputTok int) {
	defer m.mu.Unlock()
	m.mu.Lock()

	m.InputTokens += int64(inputTok)
	m.OutputTokens += int64(outputTok)
	m.TotalTokens += int64(inputTok + outputTok)

	cStats, ok := m.ProviderStats[provider]
	if !ok {
		cStats = &ProviderMetrics{Name: provider}
		m.ProviderStats[provider] = cStats
	}
	cStats.Requests++
	cStats.Tokens += int64(inputTok + outputTok)
}

func (m *Metrics) RecordError(provider string) {
	defer m.mu.Unlock()
	m.mu.Lock()

	m.TotalErrors++
	if cStats, ok := m.ProviderStats[provider]; ok {
		cStats.Errors++
	}
}

func (m *Metrics) calculatePercentiles() {
	if len(m.Latencies) == 0 {
		return
	}

	var total int64
	for _, l := range m.Latencies {
		total += l
	}
	m.AvgLatency = total / int64(len(m.Latencies))

	sorted := make([]int64, len(m.Latencies))
	copy(sorted, m.Latencies)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	m.P50Latency = sorted[len(sorted)*50/100]
	m.P95Latency = sorted[len(sorted)*95/100]
	m.P99Latency = sorted[len(sorted)*99/100]
}

func (m *Metrics) ToPrometheus() string {
	defer m.mu.RUnlock()
	m.mu.RLock()

	var lines []string
	prefix := "jaicode"

	lines = append(lines, fmt.Sprintf("# HELP %s_requests_total Total requests", prefix))
	lines = append(lines, fmt.Sprintf("%s_requests_total %d", prefix, m.TotalRequests))

	lines = append(lines, fmt.Sprintf("# HELP %s_tokens_total Total tokens", prefix))
	lines = append(lines, fmt.Sprintf("%s_input_tokens_total %d", prefix, m.InputTokens))
	lines = append(lines, fmt.Sprintf("%s_output_tokens_total %d", prefix, m.OutputTokens))

	lines = append(lines, fmt.Sprintf("# HELP %s_errors_total Total errors", prefix))
	lines = append(lines, fmt.Sprintf("%s_errors_total %d", prefix, m.TotalErrors))

	lines = append(lines, fmt.Sprintf("# HELP %s_request_duration_ms Request duration", prefix))
	lines = append(lines, fmt.Sprintf("%s_request_duration_ms_avg %d", prefix, m.AvgLatency))
	lines = append(lines, fmt.Sprintf("%s_request_duration_ms_p50 %d", prefix, m.P50Latency))
	lines = append(lines, fmt.Sprintf("%s_request_duration_ms_p95 %d", prefix, m.P95Latency))
	lines = append(lines, fmt.Sprintf("%s_request_duration_ms_p99 %d", prefix, m.P99Latency))

	return strings.Join(lines, "\n")
}

func init() { time.Now() }
