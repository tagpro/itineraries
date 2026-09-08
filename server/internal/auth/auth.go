// Package auth issues and checks the two kinds of bearer credential the API
// understands: the single admin key that may create trips, and the per-trip
// token that grants everyone holding it access to that trip and nothing
// else. There are no accounts and no sessions — a token is a capability.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
)

// NewToken returns a fresh 256-bit token in URL-safe base64. Only the hash
// is ever stored, so the plaintext is shown to the caller exactly once.
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Hash returns the hex SHA-256 of a token, which is what the store keeps.
func Hash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Verify reports whether token matches hash without leaking timing.
func Verify(token, hash string) bool {
	if token == "" || hash == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(Hash(token)), []byte(hash)) == 1
}

// VerifyPlain compares two secrets in constant time. It is used for the
// admin key, which is held in the Worker's environment rather than hashed
// in the database.
func VerifyPlain(presented, expected string) bool {
	if presented == "" || expected == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) == 1
}

// Bearer extracts the credential from an Authorization: Bearer header.
// It returns "" when the header is absent or malformed.
func Bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}
