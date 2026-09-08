package api

import (
	"context"
	"errors"
	"log"
	"net/http"
	"runtime/debug"

	"github.com/tagpro/itineraries/server/internal/auth"
	"github.com/tagpro/itineraries/server/internal/domain"
	"github.com/tagpro/itineraries/server/internal/store"
)

type ctxKey int

const ctxTrip ctxKey = iota

// tripFrom returns the trip that requireTrip authenticated.
func tripFrom(ctx context.Context) domain.Trip {
	t, _ := ctx.Value(ctxTrip).(domain.Trip)
	return t
}

// requireAdmin admits only the admin key. With no key configured the
// admin routes are switched off rather than open.
func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.AdminKey == "" {
			writeError(w, http.StatusServiceUnavailable, "admin key is not configured")
			return
		}
		if !auth.VerifyPlain(auth.Bearer(r), s.cfg.AdminKey) {
			writeError(w, http.StatusUnauthorized, "admin key required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireTrip loads the trip named in the path and checks the bearer token
// against it. A missing trip, a wrong token and a token of the wrong shape
// all produce the same response, so a caller without a token cannot learn
// which trip ids exist. The shape check comes first: it costs nothing, so
// junk aimed at the API never reaches the database.
func (s *Server) requireTrip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("trip")
		tok := auth.Bearer(r)
		if !domain.ValidSlug(id) || !auth.WellFormed(tok) {
			writeError(w, http.StatusUnauthorized, "trip token required")
			return
		}
		t, err := s.cfg.Store.GetTrip(r.Context(), id)
		if err != nil && !errors.Is(err, store.ErrNotFound) {
			s.fail(w, r, err)
			return
		}
		if err != nil || !auth.Verify(tok, t.TokenHash) {
			writeError(w, http.StatusUnauthorized, "trip token required")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxTrip, t)))
	})
}

// cors answers preflights and stamps responses for origins on the allow
// list. Bearer tokens make every cross-origin request preflighted, so the
// OPTIONS branch is not optional if the list is non-empty.
func (s *Server) cors(next http.Handler) http.Handler {
	if len(s.cfg.AllowedOrigins) == 0 {
		return next
	}
	allowed := func(origin string) bool {
		for _, o := range s.cfg.AllowedOrigins {
			if o == "*" || o == origin {
				return true
			}
		}
		return false
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowed(origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// noStore keeps every response out of caches. The whole point of the API is
// that the answer changes between one call and the next.
func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// recoverer turns a panic into a 500 instead of a dropped connection.
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("panic: %v\n%s", v, debug.Stack())
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// fail logs an unexpected error and answers 500 without echoing details.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("%s %s: %v", r.Method, r.URL.Path, err)
	writeError(w, http.StatusInternalServerError, "internal error")
}
