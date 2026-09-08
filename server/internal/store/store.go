// Package store defines what the API needs from persistence, and provides
// two implementations: one on database/sql, which is what production runs
// against Cloudflare D1, and one in memory for tests and local development.
package store

import (
	"context"
	"errors"

	"github.com/tagpro/itineraries/server/internal/domain"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrTripExists = errors.New("trip already exists")
)

// Store is the persistence boundary. Merge is the only write path for
// entries and must apply domain.Wins per key, so that the database itself
// is a replica that converges under the same rule as every client.
type Store interface {
	CreateTrip(ctx context.Context, t domain.Trip) error
	GetTrip(ctx context.Context, id string) (domain.Trip, error)
	ListTrips(ctx context.Context) ([]domain.Trip, error)
	SetTokenHash(ctx context.Context, id, hash string) error

	GetState(ctx context.Context, tripID string) (domain.TripState, error)
	GetList(ctx context.Context, tripID, listID string) (domain.ListState, error)
	Merge(ctx context.Context, tripID, listID string, incoming domain.ListState) error
}
