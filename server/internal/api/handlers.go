package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/tagpro/itineraries/server/internal/auth"
	"github.com/tagpro/itineraries/server/internal/domain"
	"github.com/tagpro/itineraries/server/internal/store"
)

// Wire shapes. Trips never expose their token hash; the plaintext token is
// returned exactly once, at creation or rotation.
type tripSummary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type tripCreated struct {
	tripSummary
	Token string `json:"token"`
}

type tripStateBody struct {
	tripSummary
	Lists domain.TripState `json:"lists"`
}

type listBody struct {
	ID      string           `json:"id"`
	Entries domain.ListState `json:"entries"`
}

func summarise(t domain.Trip) tripSummary {
	return tripSummary{ID: t.ID, Name: t.Name, CreatedAt: t.CreatedAt}
}

func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "version": s.cfg.Version})
}

// createTrip — admin. Mints a trip and its token.
func (s *Server) createTrip(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	switch {
	case !domain.ValidSlug(in.ID):
		writeError(w, http.StatusBadRequest, "id: "+domain.ErrBadSlug.Error())
		return
	case in.Name == "" || len(in.Name) > 120:
		writeError(w, http.StatusBadRequest, "name must be 1-120 characters")
		return
	}
	token, err := auth.NewToken()
	if err != nil {
		s.fail(w, r, err)
		return
	}
	t := domain.Trip{ID: in.ID, Name: in.Name, TokenHash: auth.Hash(token), CreatedAt: s.cfg.Now().UTC()}
	if err := s.cfg.Store.CreateTrip(r.Context(), t); err != nil {
		if errors.Is(err, store.ErrTripExists) {
			writeError(w, http.StatusConflict, "a trip with that id already exists")
			return
		}
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, tripCreated{tripSummary: summarise(t), Token: token})
}

// listTrips — admin. Ids and names only.
func (s *Server) listTrips(w http.ResponseWriter, r *http.Request) {
	trips, err := s.cfg.Store.ListTrips(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := make([]tripSummary, 0, len(trips))
	for _, t := range trips {
		out = append(out, summarise(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"trips": out})
}

// rotateToken — admin. Invalidates the old token and returns a new one.
func (s *Server) rotateToken(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("trip")
	if !domain.ValidSlug(id) {
		writeError(w, http.StatusNotFound, "no such trip")
		return
	}
	token, err := auth.NewToken()
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if err := s.cfg.Store.SetTokenHash(r.Context(), id, auth.Hash(token)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "no such trip")
			return
		}
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "token": token})
}

// getTrip — trip token. The whole trip in one round trip, which is what a
// page wants on load and on every sync.
func (s *Server) getTrip(w http.ResponseWriter, r *http.Request) {
	t := tripFrom(r.Context())
	state, err := s.cfg.Store.GetState(r.Context(), t.ID)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tripStateBody{tripSummary: summarise(t), Lists: state})
}

// patchTrip — trip token. Merges every list sent and returns the whole
// trip afterwards. Sending the same body twice is harmless; sending a
// stale body cannot roll anything back.
func (s *Server) patchTrip(w http.ResponseWriter, r *http.Request) {
	t := tripFrom(r.Context())
	var in struct {
		Lists domain.TripState `json:"lists"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := domain.ValidateTrip(in.Lists, s.cfg.Now()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	for id, l := range in.Lists {
		if err := compactValues(l); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(l) == 0 {
			continue
		}
		if err := s.cfg.Store.Merge(r.Context(), t.ID, id, l); err != nil {
			s.fail(w, r, err)
			return
		}
	}
	state, err := s.cfg.Store.GetState(r.Context(), t.ID)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tripStateBody{tripSummary: summarise(t), Lists: state})
}

// getList — trip token. One list.
func (s *Server) getList(w http.ResponseWriter, r *http.Request) {
	t := tripFrom(r.Context())
	id := r.PathValue("list")
	if !domain.ValidSlug(id) {
		writeError(w, http.StatusBadRequest, "list: "+domain.ErrBadSlug.Error())
		return
	}
	l, err := s.cfg.Store.GetList(r.Context(), t.ID, id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, listBody{ID: id, Entries: l})
}

// patchList — trip token. Merges into one list and returns it.
func (s *Server) patchList(w http.ResponseWriter, r *http.Request) {
	t := tripFrom(r.Context())
	id := r.PathValue("list")
	if !domain.ValidSlug(id) {
		writeError(w, http.StatusBadRequest, "list: "+domain.ErrBadSlug.Error())
		return
	}
	var in struct {
		Entries domain.ListState `json:"entries"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := domain.ValidateList(in.Entries, s.cfg.Now()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := compactValues(in.Entries); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(in.Entries) > 0 {
		if err := s.cfg.Store.Merge(r.Context(), t.ID, id, in.Entries); err != nil {
			s.fail(w, r, err)
			return
		}
	}
	l, err := s.cfg.Store.GetList(r.Context(), t.ID, id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, listBody{ID: id, Entries: l})
}
