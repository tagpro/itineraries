#!/usr/bin/env bash
# Start a new trip page from the reference build.
#
# Copies tassie-campervan-2026/ to <slug>/ and rewrites the constants that
# would otherwise break quietly — the storage namespace, the service worker's
# cache name, the trip id, the countdown, the title and the manifest. The
# Tasmania *content* comes across with it, on purpose: rewriting a section
# with the original beside it is easier than writing one from a blank file.
# Everything left to do is printed at the end, and check.py enforces it.
#
#   scaffold.sh <slug> "<Page title>" "<Short name>" <YYYY-MM-DD> [utc-offset]
#
# e.g. scaffold.sh kimberley-2027 "Kimberley · Broome to Kununurra · May 2027" \
#                  "Kimberley" 2027-05-09 +08:00

set -euo pipefail

die() { printf 'scaffold: %s\n' "$1" >&2; exit 1; }

[ $# -ge 4 ] || die "usage: scaffold.sh <slug> \"<Page title>\" \"<Short name>\" <YYYY-MM-DD> [utc-offset]"

SLUG=$1
TITLE=$2
SHORT=$3
START=$4
OFFSET=${5:-+10:00}

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)
TEMPLATE=$REPO/tassie-campervan-2026
DEST=$REPO/$SLUG

# The slug is the API's trip id as well as the folder name, so it has to pass
# the server's own slug rule (see server/internal/domain/domain.go).
printf '%s' "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' \
  || die "'$SLUG' is not a valid slug: lower-case letters, digits and hyphens, 64 max, not starting with a hyphen"
printf '%s' "$START" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || die "start date must be YYYY-MM-DD"
[ -d "$TEMPLATE" ] || die "template not found at $TEMPLATE"
[ -e "$DEST" ] && die "$SLUG/ already exists"

mkdir -p "$DEST"
cp -R "$TEMPLATE/." "$DEST/"
rm -rf "$DEST/build/tw.css"

python3 - "$DEST" "$SLUG" "$TITLE" "$SHORT" "$START" "$OFFSET" <<'PY'
import json, pathlib, sys

dest, slug, title, short, start, offset = (sys.argv[1], sys.argv[2], sys.argv[3],
                                           sys.argv[4], sys.argv[5], sys.argv[6])
dest = pathlib.Path(dest)

def sub(path, pairs):
    p = dest / path
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in s:
            print(f"  ! {path}: could not find {old[:60]!r} — rewrite it by hand")
            continue
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")

sub("index.html", [
    # localStorage is shared across the whole origin, so this prefix is what
    # keeps one trip's ticks out of another's.
    ("var NS = 'tassie-camper-2026:';", f"var NS = '{slug}:';"),
    # Only reached when the URL has no usable path segment.
    ("? seg : 'tassie-campervan-2026';", f"? seg : '{slug}';"),
    ("new Date('2026-09-12T09:00:00+10:00')", f"new Date('{start}T09:00:00{offset}')"),
    ("<title>Tasmania · Campervan, then Hobart · 12–19 Sep 2026</title>", f"<title>{title}</title>"),
    ('<meta name="apple-mobile-web-app-title" content="Tassie Van">',
     f'<meta name="apple-mobile-web-app-title" content="{short}">'),
])

# Cache Storage is per-origin too, and activate() deletes every cache that is
# not this exact string — so a shared name wipes another trip's offline copy.
sub("sw.js", [
    ("const VERSION = 'tassie-v7';", f"const VERSION = '{slug}-v1';"),
    ("/* Tassie Campervan — offline service worker.", f"/* {short} — offline service worker."),
])

m = json.loads((dest / "manifest.webmanifest").read_text(encoding="utf-8"))
m["name"] = title
m["short_name"] = short
m["description"] = f"TODO: one sentence about {title}."
(dest / "manifest.webmanifest").write_text(
    json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

cat <<EOF

Scaffolded $SLUG/ from tassie-campervan-2026.

Rewritten for you: NS, the service worker cache name, the trip id fallback,
the countdown, <title>, the Apple web-app title, and the manifest name.

Still yours to do — none of it is optional:

  1. index.html — the header (trip name, dates, travellers, emoji), the meta
     description, theme-color, and every section. The Tasmania content is
     still in there; replace it, do not edit around it.
  2. manifest.webmanifest — description, theme_color, background_color, lang,
     and shortcut URLs that point at section ids this page actually has.
  3. icons/ — still Tasmania's. Draw $SLUG/icon.svg, then:
       node .claude/skills/new-itinerary/scripts/make-icons.mjs $SLUG/icon.svg $SLUG/icons '#0f3d2e'
  4. build/tailwind.config.js — only if this trip wants a different palette.
  5. Rebuild the stylesheet once the markup settles:
       cd $SLUG/build && npx tailwindcss@3.4.17 -c tailwind.config.js \\
         -i app.src.css -o tw.css --minify && cat fonts.css tw.css > ../app.css && rm tw.css
  6. Add a card for the trip to the root index.html.

Then: python3 .claude/skills/new-itinerary/scripts/check.py $SLUG
EOF
