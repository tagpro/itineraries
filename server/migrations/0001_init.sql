-- Migration number: 0001 	 2026-09-08
-- A trip is the unit of sharing; entries are last-writer-wins registers
-- keyed by (trip, list, key). See internal/domain for the merge rule the
-- ON CONFLICT clause in internal/store/sql.go implements.

CREATE TABLE IF NOT EXISTS trips (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_at  INTEGER NOT NULL          -- unix milliseconds
);

CREATE TABLE IF NOT EXISTS entries (
  trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  list_id     TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,            -- JSON, opaque to the server
  updated_at  INTEGER NOT NULL,         -- unix milliseconds, author's clock
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, list_id, key)
);
