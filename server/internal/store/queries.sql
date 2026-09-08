-- Every statement the SQL store runs. sqlc compiles these against the
-- schema in migrations/ into internal/store/queries; nothing in Go
-- builds SQL from strings.

-- name: CreateTrip :exec
INSERT INTO trips (id, name, token_hash, created_at)
VALUES (?, ?, ?, ?);

-- name: GetTrip :one
SELECT id, name, token_hash, created_at
FROM trips
WHERE id = ?;

-- name: ListTrips :many
SELECT id, name, token_hash, created_at
FROM trips
ORDER BY created_at, id;

-- name: SetTokenHash :execrows
UPDATE trips SET token_hash = ? WHERE id = ?;

-- name: ListEntries :many
SELECT list_id, key, value, updated_at, deleted
FROM entries
WHERE trip_id = ?;

-- name: ListEntriesInList :many
SELECT key, value, updated_at, deleted
FROM entries
WHERE trip_id = ? AND list_id = ?;

-- MergeEntries is the whole merge rule in one statement. The caller passes
-- the incoming entries as a JSON array - [{"k":...,"v":"<json text>","t":...,"d":0|1}, ...]
-- - and json_each() turns it into rows, so any number of entries is one
-- round trip and three bound parameters. That matters on D1, where each
-- statement is a separate call and the free plan caps them per request.
--
-- The ON CONFLICT clause mirrors domain.Wins term for term: a later stamp
-- wins; on an equal stamp a tombstone wins; on an equal stamp and tombstone
-- the greater value wins. "WHERE true" is required by SQLite's parser to
-- disambiguate the upsert from a join ON clause after a SELECT, and the
-- CASTs are what let sqlc type the parameters as strings.
-- name: MergeEntries :exec
INSERT INTO entries (trip_id, list_id, key, value, updated_at, deleted)
SELECT
  CAST(sqlc.arg(trip_id) AS TEXT),
  CAST(sqlc.arg(list_id) AS TEXT),
  json_extract(j.value, '$.k'),
  json_extract(j.value, '$.v'),
  json_extract(j.value, '$.t'),
  json_extract(j.value, '$.d')
FROM json_each(CAST(sqlc.arg(entries) AS TEXT)) AS j
WHERE true
ON CONFLICT (trip_id, list_id, key) DO UPDATE SET
  value      = excluded.value,
  updated_at = excluded.updated_at,
  deleted    = excluded.deleted
WHERE excluded.updated_at > entries.updated_at
   OR (excluded.updated_at = entries.updated_at AND excluded.deleted > entries.deleted)
   OR (excluded.updated_at = entries.updated_at AND excluded.deleted = entries.deleted AND excluded.value > entries.value);
