//go:build js && wasm

// The Cloudflare Workers entry point. The JS shim instantiates this program
// afresh for every request with the request's env already attached, so the
// bindings can be resolved here in main rather than lazily per request.
package main

import (
	"database/sql"
	"net/http"

	"github.com/syumai/workers-go"
	"github.com/syumai/workers-go/cloudflare"
	"github.com/syumai/workers-go/cloudflare/d1"

	"github.com/tagpro/itineraries/server/internal/api"
	"github.com/tagpro/itineraries/server/internal/store"
)

func main() {
	conn, err := d1.OpenConnector("DB")
	if err != nil {
		// A missing binding is a deployment mistake. Say so on every
		// request rather than crashing the instance with no explanation.
		workers.Serve(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"D1 binding \"DB\" is not configured"}`))
		}))
		return
	}
	srv := api.New(api.Config{
		Store:          store.NewSQL(sql.OpenDB(conn)),
		AdminKey:       cloudflare.Getenv("ADMIN_KEY"),
		AllowedOrigins: api.SplitOrigins(cloudflare.Getenv("ALLOWED_ORIGINS")),
		Version:        version,
	})
	workers.Serve(srv.Handler())
}
