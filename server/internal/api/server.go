// Package api exposes the store over HTTP. It knows nothing about where it
// runs: the same Handler serves from a Cloudflare Worker in production and
// from net/http on a laptop.
//
// Every route lives under /api/v1. Two credentials exist: the admin key,
// which may create trips and rotate their tokens, and a trip token, which
// may read and merge that one trip. Both are sent as "Authorization: Bearer".
package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/tagpro/itineraries/server/internal/store"
)

const prefix = "/api/v1"

// Config is everything a Server needs. Store and AdminKey are required for
// the API to be useful; the rest have sensible zero values.
type Config struct {
	Store    store.Store
	AdminKey string
	// AllowedOrigins enables CORS for the listed origins. Leave it empty
	// when the site and the API share a host — the intended deployment —
	// and no CORS headers are ever sent.
	AllowedOrigins []string
	Version        string
	Now            func() time.Time
}

type Server struct {
	cfg Config
	mux *http.ServeMux
}

func New(cfg Config) *Server {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if cfg.Version == "" {
		cfg.Version = "dev"
	}
	s := &Server{cfg: cfg, mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) routes() {
	m := s.mux
	m.HandleFunc("GET "+prefix+"/healthz", s.healthz)

	m.Handle("POST "+prefix+"/trips", s.requireAdmin(http.HandlerFunc(s.createTrip)))
	m.Handle("GET "+prefix+"/trips", s.requireAdmin(http.HandlerFunc(s.listTrips)))
	m.Handle("POST "+prefix+"/trips/{trip}/token", s.requireAdmin(http.HandlerFunc(s.rotateToken)))

	m.Handle("GET "+prefix+"/trips/{trip}", s.requireTrip(http.HandlerFunc(s.getTrip)))
	m.Handle("PATCH "+prefix+"/trips/{trip}", s.requireTrip(http.HandlerFunc(s.patchTrip)))
	m.Handle("GET "+prefix+"/trips/{trip}/lists/{list}", s.requireTrip(http.HandlerFunc(s.getList)))
	m.Handle("PATCH "+prefix+"/trips/{trip}/lists/{list}", s.requireTrip(http.HandlerFunc(s.patchList)))

	// Anything else under the prefix is a JSON 404 rather than the mux's
	// plain-text one, so clients only ever have to parse one shape.
	m.HandleFunc(prefix+"/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "no such route")
	})
}

// Handler returns the fully wrapped handler: panic recovery, CORS when
// configured, and no-store caching on every response.
func (s *Server) Handler() http.Handler {
	var h http.Handler = s.mux
	h = noStore(h)
	h = s.cors(h)
	h = recoverer(h)
	return h
}

// SplitOrigins turns the comma-separated ALLOWED_ORIGINS variable into a
// list, dropping blanks, so both entry points parse it the same way.
func SplitOrigins(v string) []string {
	var out []string
	for _, o := range strings.Split(v, ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	return out
}
