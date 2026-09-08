package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/tagpro/itineraries/server/internal/domain"
)

// maxBody bounds a request body. A whole trip's state is a few kilobytes;
// this is generous without letting a client post a novel.
const maxBody = 256 * 1024

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// decodeJSON reads one JSON document into dst and rejects anything after
// it. It writes the error response itself and reports whether it did, so
// handlers can simply return.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return false
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "unexpected data after JSON document")
		return false
	}
	return true
}

// compactValues rewrites every entry's JSON value in its canonical compact
// form. Ties in the merge rule compare value bytes, so two spellings of the
// same value must not be able to disagree about who wins.
func compactValues(l domain.ListState) error {
	for k, e := range l {
		var buf bytes.Buffer
		if err := json.Compact(&buf, e.Value); err != nil {
			return domain.ErrBadValue
		}
		e.Value = buf.Bytes()
		l[k] = e
	}
	return nil
}
