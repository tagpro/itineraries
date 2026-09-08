package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tagpro/itineraries/server/internal/api"
	"github.com/tagpro/itineraries/server/internal/store"
)

const adminKey = "test-admin-key"

var fixedNow = time.Date(2026, 9, 12, 9, 0, 0, 0, time.UTC)

func newServer(t *testing.T, origins ...string) http.Handler {
	t.Helper()
	return api.New(api.Config{
		Store:          store.NewMemory(),
		AdminKey:       adminKey,
		AllowedOrigins: origins,
		Version:        "test",
		Now:            func() time.Time { return fixedNow },
	}).Handler()
}

func do(t *testing.T, h http.Handler, method, path, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func decode(t *testing.T, rr *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if ct := rr.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("expected JSON, got %q: %s", ct, rr.Body.String())
	}
	if err := json.Unmarshal(rr.Body.Bytes(), dst); err != nil {
		t.Fatalf("bad JSON %q: %v", rr.Body.String(), err)
	}
}

func createTrip(t *testing.T, h http.Handler, id string) string {
	t.Helper()
	rr := do(t, h, "POST", "/api/v1/trips", adminKey, `{"id":"`+id+`","name":"Test trip"}`)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rr.Code, rr.Body.String())
	}
	var out struct{ Token string }
	decode(t, rr, &out)
	return out.Token
}

func stamp(d time.Duration) int64 { return fixedNow.Add(d).UnixMilli() }

func TestHealthz(t *testing.T) {
	rr := do(t, newServer(t), "GET", "/api/v1/healthz", "", "")
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), `"version":"test"`) {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
	if rr.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("responses must be no-store")
	}
}

func TestAdminAuth(t *testing.T) {
	h := newServer(t)
	body := `{"id":"t","name":"T"}`
	if rr := do(t, h, "POST", "/api/v1/trips", "", body); rr.Code != 401 {
		t.Fatalf("no key: %d", rr.Code)
	}
	if rr := do(t, h, "POST", "/api/v1/trips", "wrong", body); rr.Code != 401 {
		t.Fatalf("wrong key: %d", rr.Code)
	}
	if rr := do(t, h, "GET", "/api/v1/trips", "wrong", ""); rr.Code != 401 {
		t.Fatalf("list with wrong key: %d", rr.Code)
	}

	unconfigured := api.New(api.Config{Store: store.NewMemory()}).Handler()
	if rr := do(t, unconfigured, "POST", "/api/v1/trips", "", body); rr.Code != 503 {
		t.Fatalf("no admin key configured should be 503, got %d", rr.Code)
	}
}

func TestCreateAndListTrips(t *testing.T) {
	h := newServer(t)
	rr := do(t, h, "POST", "/api/v1/trips", adminKey, `{"id":"tassie-2026","name":"  Tassie  "}`)
	if rr.Code != 201 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		ID, Name, Token string
		CreatedAt       time.Time `json:"created_at"`
	}
	decode(t, rr, &created)
	if created.ID != "tassie-2026" || created.Name != "Tassie" || len(created.Token) != 43 || !created.CreatedAt.Equal(fixedNow) {
		t.Fatalf("unexpected body %+v", created)
	}

	if rr := do(t, h, "POST", "/api/v1/trips", adminKey, `{"id":"tassie-2026","name":"again"}`); rr.Code != 409 {
		t.Fatalf("duplicate: %d", rr.Code)
	}
	for _, bad := range []string{`{"id":"Bad Id","name":"x"}`, `{"id":"ok","name":""}`, `{"id":"ok","name":"x"} trailing`, `not json`} {
		if rr := do(t, h, "POST", "/api/v1/trips", adminKey, bad); rr.Code != 400 {
			t.Errorf("%s: expected 400, got %d", bad, rr.Code)
		}
	}

	rr = do(t, h, "GET", "/api/v1/trips", adminKey, "")
	if rr.Code != 200 || strings.Contains(rr.Body.String(), "token") {
		t.Fatalf("list must not leak tokens: %d %s", rr.Code, rr.Body.String())
	}
}

func TestTripAuth(t *testing.T) {
	h := newServer(t)
	token := createTrip(t, h, "tassie")
	cases := []struct {
		path, token string
		want        int
	}{
		{"/api/v1/trips/tassie", token, 200},
		{"/api/v1/trips/tassie", "", 401},
		{"/api/v1/trips/tassie", "nope", 401},
		{"/api/v1/trips/tassie", adminKey, 401}, // the admin key is not a trip token
		{"/api/v1/trips/unknown", token, 401},   // indistinguishable from a wrong token
		{"/api/v1/trips/Bad%20Id", token, 401},
	}
	for _, c := range cases {
		if rr := do(t, h, "GET", c.path, c.token, ""); rr.Code != c.want {
			t.Errorf("GET %s token=%q: got %d want %d", c.path, c.token, rr.Code, c.want)
		}
	}
}

func TestPatchAndGetTrip(t *testing.T) {
	h := newServer(t)
	token := createTrip(t, h, "tassie")
	t1, t2 := stamp(-time.Hour), stamp(-time.Minute)

	body := `{"lists":{"before":{"b1":{"v":true,"t":` + itoa(t2) + `},"u1":{"v":{ "t" : "honey" },"t":` + itoa(t1) + `}},"daily":{"m1":{"v":true,"t":` + itoa(t1) + `}}}}`
	rr := do(t, h, "PATCH", "/api/v1/trips/tassie", token, body)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
	var out struct {
		ID    string
		Lists map[string]map[string]struct {
			V json.RawMessage
			T int64
			D bool
		}
	}
	decode(t, rr, &out)
	if out.ID != "tassie" || len(out.Lists) != 2 {
		t.Fatalf("unexpected %+v", out)
	}
	if string(out.Lists["before"]["u1"].V) != `{"t":"honey"}` {
		t.Fatalf("values should be stored compacted, got %s", out.Lists["before"]["u1"].V)
	}

	// A stale tick cannot roll back a newer one; a newer delete can.
	stale := `{"lists":{"before":{"b1":{"v":false,"t":` + itoa(t1) + `},"u1":{"v":{"t":"honey"},"t":` + itoa(t2) + `,"d":true}}}}`
	rr = do(t, h, "PATCH", "/api/v1/trips/tassie", token, stale)
	decode(t, rr, &out)
	if string(out.Lists["before"]["b1"].V) != "true" {
		t.Fatal("stale write rolled back a newer tick")
	}
	if !out.Lists["before"]["u1"].D {
		t.Fatal("newer tombstone should win")
	}

	rr = do(t, h, "GET", "/api/v1/trips/tassie", token, "")
	var again struct{ Lists map[string]map[string]any }
	decode(t, rr, &again)
	if len(again.Lists["before"]) != 2 || len(again.Lists["daily"]) != 1 {
		t.Fatalf("GET should return everything merged so far: %+v", again.Lists)
	}
}

func TestPatchValidation(t *testing.T) {
	h := newServer(t)
	token := createTrip(t, h, "tassie")
	future := stamp(10 * time.Minute)
	cases := map[string]string{
		"future stamp":  `{"lists":{"before":{"b1":{"v":true,"t":` + itoa(future) + `}}}}`,
		"no stamp":      `{"lists":{"before":{"b1":{"v":true}}}}`,
		"bad key":       `{"lists":{"before":{"b 1":{"v":true,"t":1}}}}`,
		"bad list id":   `{"lists":{"Before!":{"b1":{"v":true,"t":1}}}}`,
		"empty value":   `{"lists":{"before":{"b1":{"t":1}}}}`,
		"not an object": `[1,2,3]`,
	}
	for name, body := range cases {
		rr := do(t, h, "PATCH", "/api/v1/trips/tassie", token, body)
		if rr.Code != 400 {
			t.Errorf("%s: expected 400, got %d %s", name, rr.Code, rr.Body.String())
		}
	}
	// An empty patch is fine and just returns the current state.
	if rr := do(t, h, "PATCH", "/api/v1/trips/tassie", token, `{"lists":{}}`); rr.Code != 200 {
		t.Errorf("empty patch: %d", rr.Code)
	}
	huge := strings.Repeat("x", 300*1024)
	if rr := do(t, h, "PATCH", "/api/v1/trips/tassie", token, `{"lists":{"a":{"k":{"v":"`+huge+`","t":1}}}}`); rr.Code != 413 {
		t.Errorf("oversize body: expected 413, got %d", rr.Code)
	}
}

func TestListEndpoints(t *testing.T) {
	h := newServer(t)
	token := createTrip(t, h, "tassie")
	ts := stamp(-time.Minute)

	rr := do(t, h, "PATCH", "/api/v1/trips/tassie/lists/hobart", token, `{"entries":{"h1":{"v":true,"t":`+itoa(ts)+`}}}`)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
	var out struct {
		ID      string
		Entries map[string]any
	}
	decode(t, rr, &out)
	if out.ID != "hobart" || len(out.Entries) != 1 {
		t.Fatalf("unexpected %+v", out)
	}

	rr = do(t, h, "GET", "/api/v1/trips/tassie/lists/hobart", token, "")
	decode(t, rr, &out)
	if len(out.Entries) != 1 {
		t.Fatalf("GET list: %+v", out)
	}
	rr = do(t, h, "GET", "/api/v1/trips/tassie/lists/empty", token, "")
	var empty struct {
		ID      string
		Entries map[string]any
	}
	decode(t, rr, &empty)
	if rr.Code != 200 || len(empty.Entries) != 0 {
		t.Fatalf("unknown list should be an empty 200: %d %+v", rr.Code, empty)
	}
	if rr := do(t, h, "GET", "/api/v1/trips/tassie/lists/Bad%20List", token, ""); rr.Code != 400 {
		t.Fatalf("bad list id: %d", rr.Code)
	}
	if rr := do(t, h, "PATCH", "/api/v1/trips/tassie/lists/hobart", "", `{}`); rr.Code != 401 {
		t.Fatalf("list without token: %d", rr.Code)
	}
}

func TestRotateToken(t *testing.T) {
	h := newServer(t)
	old := createTrip(t, h, "tassie")
	rr := do(t, h, "POST", "/api/v1/trips/tassie/token", adminKey, "")
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
	var out struct{ Token string }
	decode(t, rr, &out)
	if rr := do(t, h, "GET", "/api/v1/trips/tassie", old, ""); rr.Code != 401 {
		t.Fatal("old token should stop working")
	}
	if rr := do(t, h, "GET", "/api/v1/trips/tassie", out.Token, ""); rr.Code != 200 {
		t.Fatal("new token should work")
	}
	if rr := do(t, h, "POST", "/api/v1/trips/nope/token", adminKey, ""); rr.Code != 404 {
		t.Fatalf("rotate missing trip: %d", rr.Code)
	}
	if rr := do(t, h, "POST", "/api/v1/trips/tassie/token", old, ""); rr.Code != 401 {
		t.Fatal("a trip token must not be able to rotate itself")
	}
}

func TestUnknownRouteIsJSON(t *testing.T) {
	rr := do(t, newServer(t), "GET", "/api/v1/nothing/here", "", "")
	if rr.Code != 404 || !strings.Contains(rr.Body.String(), `"error"`) {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
}

func TestCORS(t *testing.T) {
	// Off by default: no headers, even for a preflight.
	plain := newServer(t)
	req := httptest.NewRequest("OPTIONS", "/api/v1/trips/x", nil)
	req.Header.Set("Origin", "https://travel.jaspreet.info")
	rr := httptest.NewRecorder()
	plain.ServeHTTP(rr, req)
	if rr.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("CORS headers must not be sent unless configured")
	}

	h := newServer(t, "https://travel.jaspreet.info")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != 204 || rr.Header().Get("Access-Control-Allow-Origin") != "https://travel.jaspreet.info" ||
		!strings.Contains(rr.Header().Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Fatalf("preflight: %d %v", rr.Code, rr.Header())
	}

	req.Header.Set("Origin", "https://evil.example")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unlisted origin must get no CORS headers")
	}
}

func TestSplitOrigins(t *testing.T) {
	got := api.SplitOrigins(" https://a.example, ,https://b.example ")
	if len(got) != 2 || got[0] != "https://a.example" || got[1] != "https://b.example" {
		t.Fatalf("got %v", got)
	}
	if api.SplitOrigins("") != nil {
		t.Fatal("empty should be nil")
	}
}

func itoa(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
