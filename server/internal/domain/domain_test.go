package domain

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func e(v string, t int64, deleted bool) Entry {
	return Entry{Value: json.RawMessage(v), Updated: t, Deleted: deleted}
}

func TestWinsLaterStamp(t *testing.T) {
	if !Wins(e("true", 20, false), e("false", 10, false)) {
		t.Fatal("later stamp should win")
	}
	if Wins(e("true", 10, false), e("false", 20, false)) {
		t.Fatal("earlier stamp should lose")
	}
}

func TestWinsTieIsSymmetric(t *testing.T) {
	a := e(`"apple"`, 5, false)
	b := e(`"pear"`, 5, false)
	if Wins(a, b) == Wins(b, a) {
		t.Fatal("exactly one side of a tie must win")
	}
	d := e(`"apple"`, 5, true)
	if !Wins(d, a) || Wins(a, d) {
		t.Fatal("on a tie the tombstone wins")
	}
}

func TestMergeCommutativeAndIdempotent(t *testing.T) {
	x := ListState{"b1": e("true", 100, false), "u1": e(`{"t":"honey"}`, 50, false)}
	y := ListState{"b1": e("false", 200, false), "u1": e(`{"t":"honey"}`, 50, true), "b2": e("true", 10, false)}

	xy := Merge(x, y)
	yx := Merge(y, x)
	if !reflect.DeepEqual(xy, yx) {
		t.Fatalf("merge is not commutative:\n%v\n%v", xy, yx)
	}
	if !reflect.DeepEqual(Merge(xy, y), xy) || !reflect.DeepEqual(Merge(xy, x), xy) {
		t.Fatal("merge is not idempotent")
	}
	if string(xy["b1"].Value) != "false" || xy["b1"].Updated != 200 {
		t.Fatalf("b1 should take the later value, got %+v", xy["b1"])
	}
	if !xy["u1"].Deleted {
		t.Fatal("tombstone should win a tie against a live entry")
	}
	if _, ok := xy["b2"]; !ok {
		t.Fatal("entries only on one side must survive")
	}
}

func TestMergeDoesNotMutateInputs(t *testing.T) {
	base := ListState{"k": e("1", 1, false)}
	in := ListState{"k": e("2", 2, false)}
	Merge(base, in)
	if string(base["k"].Value) != "1" {
		t.Fatal("base was mutated")
	}
}

func TestMergeTripKeepsUntouchedLists(t *testing.T) {
	base := TripState{"before": {"b1": e("true", 1, false)}, "daily": {"m1": e("true", 1, false)}}
	in := TripState{"before": {"b2": e("true", 2, false)}}
	out := MergeTrip(base, in)
	if len(out["daily"]) != 1 || len(out["before"]) != 2 {
		t.Fatalf("unexpected merge result %v", out)
	}
}

func TestValidateList(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	ok := ListState{"b1": e("true", 999_000, false)}
	if err := ValidateList(ok, now); err != nil {
		t.Fatalf("valid list rejected: %v", err)
	}

	cases := map[string]struct {
		l    ListState
		want error
	}{
		"bad key":      {ListState{"has space": e("true", 1, false)}, ErrBadKey},
		"no stamp":     {ListState{"b1": e("true", 0, false)}, ErrMissingStamp},
		"future stamp": {ListState{"b1": e("true", now.Add(10*time.Minute).UnixMilli(), false)}, ErrFutureStamp},
		"bad json":     {ListState{"b1": e("{nope", 1, false)}, ErrBadValue},
		"empty value":  {ListState{"b1": e("", 1, false)}, ErrBadValue},
	}
	for name, c := range cases {
		if err := ValidateList(c.l, now); err != c.want {
			t.Errorf("%s: got %v want %v", name, err, c.want)
		}
	}

	big := make([]byte, MaxValueBytes+1)
	for i := range big {
		big[i] = 'a'
	}
	if err := ValidateList(ListState{"b1": e(`"`+string(big)+`"`, 1, false)}, now); err != ErrValueTooBig {
		t.Errorf("oversize value: got %v", err)
	}

	many := make(ListState, MaxEntriesPerRequest+1)
	for i := 0; i <= MaxEntriesPerRequest; i++ {
		many["k"+itoa(i)] = e("true", 1, false)
	}
	if err := ValidateList(many, now); err != ErrTooMany {
		t.Errorf("too many: got %v", err)
	}
}

func TestValidateTripChecksListIDs(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	if err := ValidateTrip(TripState{"Bad List": {}}, now); err != ErrBadSlug {
		t.Fatalf("got %v", err)
	}
	if err := ValidateTrip(TripState{"before": {"b1": e("true", 1, false)}}, now); err != nil {
		t.Fatalf("got %v", err)
	}
}

func TestSlugs(t *testing.T) {
	for _, good := range []string{"tassie-2026", "a", "hobart-tail-2"} {
		if !ValidSlug(good) {
			t.Errorf("%q should be a valid slug", good)
		}
	}
	for _, bad := range []string{"", "-lead", "Upper", "with space", "a/b"} {
		if ValidSlug(bad) {
			t.Errorf("%q should not be a valid slug", bad)
		}
	}
}

func itoa(i int) string {
	b, _ := json.Marshal(i)
	return string(b)
}
