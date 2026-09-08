package store

import (
	"context"
	"sort"
	"sync"

	"github.com/tagpro/itineraries/server/internal/domain"
)

// Memory is a Store that lives in the process. It backs the native dev
// server and the API tests; nothing in it survives a restart.
type Memory struct {
	mu    sync.RWMutex
	trips map[string]domain.Trip
	state map[string]domain.TripState
}

var _ Store = (*Memory)(nil)

func NewMemory() *Memory {
	return &Memory{trips: map[string]domain.Trip{}, state: map[string]domain.TripState{}}
}

func (m *Memory) CreateTrip(_ context.Context, t domain.Trip) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.trips[t.ID]; ok {
		return ErrTripExists
	}
	m.trips[t.ID] = t
	m.state[t.ID] = domain.TripState{}
	return nil
}

func (m *Memory) GetTrip(_ context.Context, id string) (domain.Trip, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	t, ok := m.trips[id]
	if !ok {
		return domain.Trip{}, ErrNotFound
	}
	return t, nil
}

func (m *Memory) ListTrips(_ context.Context) ([]domain.Trip, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]domain.Trip, 0, len(m.trips))
	for _, t := range m.trips {
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) SetTokenHash(_ context.Context, id, hash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.trips[id]
	if !ok {
		return ErrNotFound
	}
	t.TokenHash = hash
	m.trips[id] = t
	return nil
}

func (m *Memory) GetState(_ context.Context, tripID string) (domain.TripState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.state[tripID]
	if !ok {
		return nil, ErrNotFound
	}
	// Hand back a copy so callers can't reach into the store's maps.
	return domain.MergeTrip(nil, s), nil
}

func (m *Memory) GetList(_ context.Context, tripID, listID string) (domain.ListState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.state[tripID]
	if !ok {
		return nil, ErrNotFound
	}
	return domain.Merge(nil, s[listID]), nil
}

func (m *Memory) Merge(_ context.Context, tripID, listID string, incoming domain.ListState) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.state[tripID]
	if !ok {
		return ErrNotFound
	}
	s[listID] = domain.Merge(s[listID], incoming)
	return nil
}
