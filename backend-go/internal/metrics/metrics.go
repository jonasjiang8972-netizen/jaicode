package metrics

import (
	"sort"
	"sync"
	"time"
)

var instance *Metrics
var once sync.Once

type Metrics struct {
	mu            sync.RWMutex
	TotalRequests int64            `json:"total_requests"`
	TotalTokens   int64            `json:"total_tokens"`
	TotalErrors   int64            `json:"total_errors"`
	AvgLatency    int64            `json:"avg_latency_ms"`
	P95Latency    int64            `json:"p95_latency_ms"`
	Latencies     []int64          `json:"-"`
	Providers     map[string]int64 `json:"providers"`
	StartTime     time.Time        `json:"uptime"`
}

func Get() *Metrics {
	once.Do(func() {
		instance = &Metrics{
			Latencies: make([]int64, 0, 1000),
			Providers: make(map[string]int64),
			StartTime: time.Now(),
		}
	})
	return instance
}

func (m *Metrics) RecordRequest(latency int64, provider string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TotalRequests++
	m.Latencies = append(m.Latencies, latency)
	if len(m.Latencies) > 1000 {
		m.Latencies = m.Latencies[len(m.Latencies)-1000:]
	}
	m.Providers[provider]++
	// Calculate stats
	if len(m.Latencies) > 0 {
		var total int64
		for _, l := range m.Latencies {
			total += l
		}
		m.AvgLatency = total / int64(len(m.Latencies))
		sorted := make([]int64, len(m.Latencies))
		copy(sorted, m.Latencies)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
		m.P95Latency = sorted[len(sorted)*95/100]
	}
}

func (m *Metrics) RecordError() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TotalErrors++
}

func (m *Metrics) RecordTokens(tok int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TotalTokens += tok
}

func init() { time.Now() }
