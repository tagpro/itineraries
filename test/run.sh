#!/usr/bin/env bash
# Runs the page specs. Starts everything it needs and cleans up after itself.
#
#   test/run.sh              every spec
#   test/run.sh page         the page on its own — no API, no git
#   test/run.sh sync         two phones against the real API
#   test/run.sh upgrade      the update a phone already holding the trip makes
#
# Needs: python3, node, and a Chromium (set CHROME_PATH, or
# `npx playwright install chromium`). sync also needs Go, upgrade needs git.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
TRIP=tassie-campervan-2026
WHICH=${1:-all}
TMP=$(mktemp -d)
PIDS=()
FAILED=0

cleanup() {
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
  # `go run` leaves the binary it built holding the port.
  [ -n "${API_CHILD:-}" ] && kill "$API_CHILD" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

need() { command -v "$1" >/dev/null || { echo "skipping: $1 not installed"; return 1; }; }
wait_for() { for _ in $(seq 1 90); do curl -sf -o /dev/null "$1" && return 0; sleep 1; done; return 1; }
run() { echo; node "$@" || FAILED=1; }

if [ ! -d test/node_modules ]; then
  echo "installing playwright-core…"
  (cd test && npm install --silent) || exit 1
fi

# ── the site, plus a copy with the safe-area insets given real lengths,
#    because Chromium cannot emulate env(safe-area-inset-*) ──────────────
python3 test/serve.py --port 8099 --root "$REPO" --api http://127.0.0.1:8787 >/dev/null 2>&1 &
PIDS+=($!)
mkdir -p "$TMP/inset"
cp -r "$TRIP" "$TMP/inset/"
python3 - "$TMP/inset/$TRIP/index.html" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text(encoding="utf-8")
for name, px in (("top", "59px"), ("bottom", "34px"), ("left", "0px"), ("right", "0px")):
    s = s.replace(f"env(safe-area-inset-{name})", px)
p.write_text(s, encoding="utf-8")
PY
python3 test/serve.py --port 8096 --root "$TMP/inset" >/dev/null 2>&1 &
PIDS+=($!)
wait_for http://127.0.0.1:8099/$TRIP/ || { echo "the site never came up"; exit 1; }

if [ "$WHICH" = all ] || [ "$WHICH" = page ]; then
  run test/page.test.mjs "http://127.0.0.1:8099/$TRIP/" "http://127.0.0.1:8096/$TRIP/"
  run test/peninsula.test.mjs "http://127.0.0.1:8099/$TRIP/"
fi

if [ "$WHICH" = all ] || [ "$WHICH" = sync ]; then
  if need go; then
    (cd server && go run . >"$TMP/api.log" 2>&1) &
    PIDS+=($!)
    if wait_for http://127.0.0.1:8787/api/v1/healthz; then
      API_CHILD=$(pgrep -f 'go-build.*/server$' | head -1)
      run test/sync.test.mjs "http://127.0.0.1:8099/$TRIP/" http://127.0.0.1:8787 dev-admin-key
    else
      echo "the API never came up:"; cat "$TMP/api.log"; FAILED=1
    fi
  fi
fi

if [ "$WHICH" = all ] || [ "$WHICH" = upgrade ]; then
  if need git; then
    # The last released version is whatever main has; the working tree is new.
    # On a CI checkout of a pull request there is no local main, only
    # origin/main — and silently skipping the most valuable spec is worse
    # than not having it.
    BASE=""
    for ref in "${UPGRADE_BASE:-}" main origin/main; do
      [ -n "$ref" ] || continue
      if git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then BASE=$ref; break; fi
    done

    mkdir -p "$TMP/old"
    if [ -z "$BASE" ]; then
      echo "skipping upgrade: no main branch to compare against"
    elif ! git archive "$BASE" "$TRIP" 2>/dev/null | tar -x -C "$TMP/old" 2>/dev/null; then
      echo "skipping upgrade: $BASE has no $TRIP/ to compare against"
    elif diff -rq "$TMP/old/$TRIP" "$TRIP" >/dev/null 2>&1; then
      # Nothing to upgrade to. On a clean checkout of main this is the normal
      # answer, not a failure: there is no new version to offer the phone.
      echo "skipping upgrade: the working tree matches $BASE, so there is no update to make"
    else
      python3 test/serve.py --port 8095 --root "$TMP/old" >/dev/null 2>&1 &
      PIDS+=($!)
      if wait_for "http://127.0.0.1:8095/$TRIP/"; then
        run test/upgrade.test.mjs "http://127.0.0.1:8095/$TRIP/" "$TMP/old" "$REPO"
      else
        echo "the old-version site never came up"; FAILED=1
      fi
    fi
  fi
fi

echo
[ $FAILED -eq 0 ] && echo "everything passed" || echo "something failed"
exit $FAILED
