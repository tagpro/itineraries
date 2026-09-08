// Package domain holds the core types and the merge rule. It has no
// dependencies on HTTP, storage or the Workers runtime, so it can be unit
// tested natively and reasoned about on its own.
//
// The data model is deliberately the simplest CRDT there is: a map of
// last-writer-wins registers. Every entry carries the wall-clock time at
// which its author last changed it; when two replicas disagree, the later
// write wins. Deletions are tombstones — an entry with Deleted set — so a
// delete can also lose to a later re-add, and the same rule covers both.
package domain

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"
	"time"
)

// Entry is one keyed value inside a list, together with the metadata the
// merge rule needs. Value is opaque JSON: a bool for a built-in tick, an
// object holding the label for an item the user added, or anything a future
// itinerary wants to store under a key.
type Entry struct {
	Value   json.RawMessage `json:"v"`
	Updated int64           `json:"t"`           // milliseconds since the Unix epoch, author's clock
	Deleted bool            `json:"d,omitempty"` // tombstone
}

// ListState is every entry in one list, keyed by entry key.
type ListState map[string]Entry

// TripState is every list in a trip, keyed by list id.
type TripState map[string]ListState

// Trip is the unit of sharing. Anyone holding its token can read and write
// every list in it; nobody else can see that it exists.
type Trip struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	TokenHash string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

// Wins reports whether candidate should replace current under the merge
// rule. Later Updated wins outright. Equal Updated is broken by comparing
// (Deleted, Value) so that both replicas make the same choice regardless of
// which side they start from — the property that makes the merge converge.
func Wins(candidate, current Entry) bool {
	if candidate.Updated != current.Updated {
		return candidate.Updated > current.Updated
	}
	if candidate.Deleted != current.Deleted {
		return candidate.Deleted
	}
	return bytes.Compare(candidate.Value, current.Value) > 0
}

// Merge folds incoming into base and returns the result. Neither argument is
// modified. Merge is commutative, associative and idempotent, so the same
// state is reached whatever order syncs happen in and however often they
// are repeated.
func Merge(base, incoming ListState) ListState {
	out := make(ListState, len(base)+len(incoming))
	for k, e := range base {
		out[k] = e
	}
	for k, e := range incoming {
		if cur, ok := out[k]; !ok || Wins(e, cur) {
			out[k] = e
		}
	}
	return out
}

// MergeTrip applies Merge list by list.
func MergeTrip(base, incoming TripState) TripState {
	out := make(TripState, len(base)+len(incoming))
	for id, l := range base {
		out[id] = l
	}
	for id, l := range incoming {
		out[id] = Merge(out[id], l)
	}
	return out
}

// Limits on what a client may send. They exist to keep a mistaken or
// hostile client from filling the database, not to shape the data model.
const (
	MaxEntriesPerRequest = 2000
	MaxValueBytes        = 4 * 1024
	// MaxClockSkew is how far into the future an Updated stamp may sit
	// before it is rejected. A phone with a badly wrong clock would
	// otherwise win every merge for as long as its clock stays wrong.
	MaxClockSkew = 5 * time.Minute
)

var (
	// Slugs identify trips and lists. They appear in URLs, so they are
	// kept to lower-case letters, digits and hyphens.
	slugRE = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)
	// Keys identify entries inside a list. They are chosen by the page,
	// e.g. "b4" for a built-in tick or "u1k3x9" for an added item.
	keyRE = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,64}$`)
)

var (
	ErrBadSlug      = errors.New("id must be 1-64 chars of a-z, 0-9 and hyphen, starting with a letter or digit")
	ErrBadKey       = errors.New("key must be 1-64 chars of letters, digits, '_', '.', ':' or '-'")
	ErrValueTooBig  = errors.New("value exceeds 4 KB")
	ErrBadValue     = errors.New("value is not valid JSON")
	ErrTooMany      = errors.New("too many entries in one request")
	ErrFutureStamp  = errors.New("updated stamp is too far in the future — check the device clock")
	ErrMissingStamp = errors.New("updated stamp is required")
)

// ValidSlug reports whether s may be used as a trip or list id.
func ValidSlug(s string) bool { return slugRE.MatchString(s) }

// ValidKey reports whether s may be used as an entry key.
func ValidKey(s string) bool { return keyRE.MatchString(s) }

// ValidateList checks every entry a client sent against the limits above.
// now is injected so tests are deterministic.
func ValidateList(l ListState, now time.Time) error {
	if len(l) > MaxEntriesPerRequest {
		return ErrTooMany
	}
	latest := now.Add(MaxClockSkew).UnixMilli()
	for k, e := range l {
		if !ValidKey(k) {
			return ErrBadKey
		}
		if e.Updated <= 0 {
			return ErrMissingStamp
		}
		if e.Updated > latest {
			return ErrFutureStamp
		}
		if len(e.Value) > MaxValueBytes {
			return ErrValueTooBig
		}
		if len(e.Value) == 0 || !json.Valid(e.Value) {
			return ErrBadValue
		}
	}
	return nil
}

// ValidateTrip runs ValidateList over every list, and checks the list ids.
func ValidateTrip(t TripState, now time.Time) error {
	total := 0
	for id, l := range t {
		if !ValidSlug(id) {
			return ErrBadSlug
		}
		total += len(l)
		if total > MaxEntriesPerRequest {
			return ErrTooMany
		}
		if err := ValidateList(l, now); err != nil {
			return err
		}
	}
	return nil
}
