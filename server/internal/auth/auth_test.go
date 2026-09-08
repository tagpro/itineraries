package auth

import (
	"net/http/httptest"
	"testing"
)

func TestTokenRoundTrip(t *testing.T) {
	tok, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) != 43 {
		t.Fatalf("expected 43-char base64url token, got %d", len(tok))
	}
	h := Hash(tok)
	if !Verify(tok, h) {
		t.Fatal("token should verify against its own hash")
	}
	if Verify(tok+"x", h) || Verify("", h) || Verify(tok, "") {
		t.Fatal("wrong or empty credentials must not verify")
	}
	other, _ := NewToken()
	if other == tok {
		t.Fatal("two tokens should not collide")
	}
}

func TestVerifyPlain(t *testing.T) {
	if !VerifyPlain("s3cret", "s3cret") {
		t.Fatal("equal secrets should verify")
	}
	if VerifyPlain("s3cret", "S3cret") || VerifyPlain("", "") || VerifyPlain("x", "") {
		t.Fatal("unequal or empty secrets must not verify")
	}
}

func TestBearer(t *testing.T) {
	cases := map[string]string{
		"Bearer abc":   "abc",
		"bearer abc":   "abc",
		"Bearer  abc ": "abc",
		"Basic abc":    "",
		"Bearer":       "",
		"":             "",
	}
	for header, want := range cases {
		r := httptest.NewRequest("GET", "/", nil)
		if header != "" {
			r.Header.Set("Authorization", header)
		}
		if got := Bearer(r); got != want {
			t.Errorf("%q: got %q want %q", header, got, want)
		}
	}
}
