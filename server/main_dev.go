//go:build !js

// The native entry point, for `go run .` on a laptop. It serves the same
// API from an in-memory store so the handlers can be exercised with curl
// without Wrangler, D1 or a network. Nothing persists across restarts.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/tagpro/itineraries/server/internal/api"
	"github.com/tagpro/itineraries/server/internal/store"
)

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	adminKey := os.Getenv("ADMIN_KEY")
	if adminKey == "" {
		adminKey = "dev-admin-key"
		log.Printf("ADMIN_KEY not set; using %q", adminKey)
	}
	srv := api.New(api.Config{
		Store:          store.NewMemory(),
		AdminKey:       adminKey,
		AllowedOrigins: api.SplitOrigins(os.Getenv("ALLOWED_ORIGINS")),
		Version:        version,
	})
	log.Printf("itineraries api %s listening on http://%s (in-memory store)", version, addr)
	log.Fatal(http.ListenAndServe(addr, srv.Handler()))
}
