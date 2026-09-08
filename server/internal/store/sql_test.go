//go:build !js

package store_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/tagpro/itineraries/server/internal/domain"
	"github.com/tagpro/itineraries/server/internal/store"
)

// openSQL builds a fresh SQLite file from the real migration, so the test
// exercises the schema that D1 will actually run.
func openSQL(t *testing.T) *store.SQL {
	t.Helper()
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	schema, err := os.ReadFile(filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(schema)); err != nil {
		t.Fatal(err)
	}
	return store.NewSQL(db)
}

func ent(v string, ts int64, deleted bool) domain.Entry {
	return domain.Entry{Value: json.RawMessage(v), Updated: ts, Deleted: deleted}
}

func mustTrip(t *testing.T, s store.Store, id string) domain.Trip {
	t.Helper()
	tr := domain.Trip{ID: id, Name: "Trip " + id, TokenHash: "hash-" + id, CreatedAt: time.UnixMilli(1_700_000_000_123).UTC()}
	if err := s.CreateTrip(context.Background(), tr); err != nil {
		t.Fatal(err)
	}
	return tr
}

// Both implementations must behave identically; run every case on each.
func eachStore(t *testing.T, fn func(t *testing.T, s store.Store)) {
	t.Run("sql", func(t *testing.T) { fn(t, openSQL(t)) })
	t.Run("memory", func(t *testing.T) { fn(t, store.NewMemory()) })
}

func TestTrips(t *testing.T) {
	eachStore(t, func(t *testing.T, s store.Store) {
		ctx := context.Background()
		want := mustTrip(t, s, "tassie")

		got, err := s.GetTrip(ctx, "tassie")
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("round trip mismatch:\n got %+v\nwant %+v", got, want)
		}
		if err := s.CreateTrip(ctx, want); !errors.Is(err, store.ErrTripExists) {
			t.Fatalf("duplicate: got %v", err)
		}
		if _, err := s.GetTrip(ctx, "nope"); !errors.Is(err, store.ErrNotFound) {
			t.Fatalf("missing: got %v", err)
		}
		if err := s.SetTokenHash(ctx, "nope", "x"); !errors.Is(err, store.ErrNotFound) {
			t.Fatalf("rotate missing: got %v", err)
		}
		if err := s.SetTokenHash(ctx, "tassie", "new-hash"); err != nil {
			t.Fatal(err)
		}
		if got, _ := s.GetTrip(ctx, "tassie"); got.TokenHash != "new-hash" {
			t.Fatalf("token hash not updated: %+v", got)
		}

		mustTrip(t, s, "alps")
		list, err := s.ListTrips(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(list) != 2 {
			t.Fatalf("expected 2 trips, got %d", len(list))
		}
	})
}

func TestMergeLastWriterWins(t *testing.T) {
	eachStore(t, func(t *testing.T, s store.Store) {
		ctx := context.Background()
		mustTrip(t, s, "tassie")

		merge := func(l domain.ListState) {
			t.Helper()
			if err := s.Merge(ctx, "tassie", "before", l); err != nil {
				t.Fatal(err)
			}
		}
		get := func(k string) domain.Entry {
			t.Helper()
			l, err := s.GetList(ctx, "tassie", "before")
			if err != nil {
				t.Fatal(err)
			}
			return l[k]
		}

		merge(domain.ListState{"b1": ent("true", 100, false)})
		merge(domain.ListState{"b1": ent("false", 50, false)}) // stale write
		if e := get("b1"); string(e.Value) != "true" || e.Updated != 100 {
			t.Fatalf("stale write should lose, got %+v", e)
		}
		merge(domain.ListState{"b1": ent("false", 150, false)})
		if e := get("b1"); string(e.Value) != "false" || e.Updated != 150 {
			t.Fatalf("later write should win, got %+v", e)
		}
		merge(domain.ListState{"b1": ent("false", 150, true)}) // tie: tombstone wins
		if e := get("b1"); !e.Deleted {
			t.Fatalf("tombstone should win a tie, got %+v", e)
		}
		merge(domain.ListState{"b1": ent("false", 150, false)}) // tie, loses to tombstone
		if e := get("b1"); !e.Deleted {
			t.Fatalf("live entry must not beat a tombstone on a tie, got %+v", e)
		}
		merge(domain.ListState{"b1": ent("true", 200, false)}) // resurrect
		if e := get("b1"); e.Deleted || string(e.Value) != "true" {
			t.Fatalf("later live write should resurrect, got %+v", e)
		}

		// Equal stamp, equal tombstone: greater value wins, symmetrically.
		merge(domain.ListState{"u1": ent(`"apple"`, 5, false)})
		merge(domain.ListState{"u1": ent(`"pear"`, 5, false)})
		if e := get("u1"); string(e.Value) != `"pear"` {
			t.Fatalf("tie-break by value failed, got %+v", e)
		}
		merge(domain.ListState{"u1": ent(`"apple"`, 5, false)})
		if e := get("u1"); string(e.Value) != `"pear"` {
			t.Fatalf("tie-break must not flip back, got %+v", e)
		}
	})
}

func TestMergeMatchesDomainInAnyOrder(t *testing.T) {
	// Two replicas with overlapping keys and every combination of stamp
	// relation. Whatever order the store receives them in, its state must
	// equal the pure domain.Merge of the two — that is the whole contract.
	a, b := domain.ListState{}, domain.ListState{}
	for i := 0; i < 40; i++ {
		k := fmt.Sprintf("k%02d", i)
		switch i % 5 {
		case 0: // only in a
			a[k] = ent(`1`, 10, false)
		case 1: // only in b
			b[k] = ent(`2`, 10, false)
		case 2: // a later
			a[k], b[k] = ent(`"a"`, 20, false), ent(`"b"`, 10, true)
		case 3: // b later
			a[k], b[k] = ent(`"a"`, 10, false), ent(`"b"`, 20, true)
		case 4: // tie
			a[k], b[k] = ent(`{"x":1}`, 15, false), ent(`{"x":2}`, 15, false)
		}
	}
	want := domain.Merge(a, b)

	eachStore(t, func(t *testing.T, s store.Store) {
		ctx := context.Background()
		for i, order := range [][]domain.ListState{{a, b}, {b, a}} {
			id := fmt.Sprintf("order-%d", i)
			mustTrip(t, s, id)
			for _, l := range order {
				if err := s.Merge(ctx, id, "l", l); err != nil {
					t.Fatal(err)
				}
			}
			got, err := s.GetList(ctx, id, "l")
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("store diverged from domain.Merge\n got %v\nwant %v", got, want)
			}
		}
	})
}

func TestMergeLargeBatch(t *testing.T) {
	// A whole trip's worth of entries in one call is one statement; every
	// row must land, and a value that is itself JSON must come back intact.
	s := openSQL(t)
	ctx := context.Background()
	mustTrip(t, s, "big")
	l := domain.ListState{}
	for i := 0; i < 53; i++ {
		l[fmt.Sprintf("k%d", i)] = ent("true", int64(i+1), false)
	}
	if err := s.Merge(ctx, "big", "x", l); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetList(ctx, "big", "x")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 53 {
		t.Fatalf("expected 53 entries, got %d", len(got))
	}
	nested := domain.ListState{"n": ent(`{"t":"Buy \"honey\"","tags":["a",1,null]}`, 9, false), "s": ent(`"plain string"`, 9, false)}
	if err := s.Merge(ctx, "big", "x", nested); err != nil {
		t.Fatal(err)
	}
	got, _ = s.GetList(ctx, "big", "x")
	for k, want := range nested {
		if string(got[k].Value) != string(want.Value) {
			t.Fatalf("%s: value mangled in transit: got %s want %s", k, got[k].Value, want.Value)
		}
	}
}

func TestStateGroupsByList(t *testing.T) {
	eachStore(t, func(t *testing.T, s store.Store) {
		ctx := context.Background()
		mustTrip(t, s, "tassie")
		if err := s.Merge(ctx, "tassie", "before", domain.ListState{"b1": ent("true", 1, false)}); err != nil {
			t.Fatal(err)
		}
		if err := s.Merge(ctx, "tassie", "daily", domain.ListState{"m1": ent("true", 1, false), "m2": ent("false", 2, false)}); err != nil {
			t.Fatal(err)
		}
		st, err := s.GetState(ctx, "tassie")
		if err != nil {
			t.Fatal(err)
		}
		if len(st) != 2 || len(st["before"]) != 1 || len(st["daily"]) != 2 {
			t.Fatalf("unexpected state %v", st)
		}
		if _, err := s.GetState(ctx, "nope"); !errors.Is(err, store.ErrNotFound) {
			t.Fatalf("missing trip state: got %v", err)
		}
		if err := s.Merge(ctx, "nope", "x", domain.ListState{"k": ent("1", 1, false)}); !errors.Is(err, store.ErrNotFound) {
			t.Fatalf("merge into missing trip: got %v", err)
		}
		empty, err := s.GetList(ctx, "tassie", "unknown-list")
		if err != nil || len(empty) != 0 {
			t.Fatalf("unknown list should be empty, got %v %v", empty, err)
		}
	})
}
