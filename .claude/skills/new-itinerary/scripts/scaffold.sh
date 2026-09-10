#!/usr/bin/env bash
# Start a new trip page from the reference build.
#
# Copies tassie-campervan-2026/ to <slug>/ and rewrites the constants that
# would otherwise break quietly. The Tasmania *content* comes across with it,
# on purpose: rewriting a section with the original beside it is easier than
# writing one from a blank file. check.py enforces that it all got replaced.
#
#   scaffold.sh <slug> "<Page title>" "<Short name>" <YYYY-MM-DD> [utc-offset]
#
# e.g. scaffold.sh kimberley-2027 "Kimberley · Broome to Kununurra · May 2027" \
#                  "Kimberley" 2027-05-09 +08:00

set -euo pipefail

die() { printf 'scaffold: %s\n' "$1" >&2; exit 1; }

[ $# -ge 4 ] || die "usage: scaffold.sh <slug> \"<Page title>\" \"<Short name>\" <YYYY-MM-DD> [utc-offset]"

SLUG=${1%/}
TITLE=$2
SHORT=$3
START=$4
OFFSET=${5:-+10:00}

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)
TEMPLATE=$REPO/tassie-campervan-2026
DEST=$REPO/$SLUG

# The slug is the API's trip id as well as the folder name, so it has to pass
# the server's own rule (server/internal/domain/domain.go).
printf '%s' "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' \
  || die "'$SLUG' is not a valid slug: lower-case letters, digits and hyphens, 64 max, not starting with a hyphen"
printf '%s' "$START" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || die "start date must be YYYY-MM-DD"
[ -d "$TEMPLATE" ] || die "template not found at $TEMPLATE"
[ -e "$DEST" ] && die "$SLUG/ already exists"

mkdir -p "$DEST"
cp -R "$TEMPLATE/." "$DEST/"

python3 - "$DEST" "$SLUG" "$TITLE" "$SHORT" "$START" "$OFFSET" <<'PY'
import html, json, pathlib, sys

dest, slug, title, short, start, offset = sys.argv[1:7]
dest = pathlib.Path(dest)
# Titles carry ampersands and quotes — "Broome & Kununurra" — and these land
# inside attributes and element text, so they are escaped going in.
e_title, e_short = html.escape(title, quote=True), html.escape(short, quote=True)

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
    # localStorage is shared across the whole origin; this prefix is what keeps
    # one trip's ticks out of another's.
    ("var NS = 'tassie-camper-2026:';", f"var NS = '{slug}:';"),
    # Only reached when the URL has no usable path segment.
    ("? seg : 'tassie-campervan-2026';", f"? seg : '{slug}';"),
    ("new Date('2026-09-12T09:00:00+10:00')", f"new Date('{start}T09:00:00{offset}')"),
    ("<title>Tasmania · Campervan, then Hobart · 12–19 Sep 2026</title>", f"<title>{e_title}</title>"),
    ('<meta name="apple-mobile-web-app-title" content="Tassie Van">',
     f'<meta name="apple-mobile-web-app-title" content="{e_short}">'),
])

# CacheStorage is per-origin. activate deletes this trip's older caches and
# leaves other trips' alone, which only works if the prefix is this trip's.
sub("sw.js", [
    ("const PREFIX  = 'tassie';", f"const PREFIX  = '{slug}';"),
    ("PREFIX + '-v11'", "PREFIX + '-v1'"),
    ("/* Tassie Campervan — offline service worker.", f"/* {short} — offline service worker."),
])

m = json.loads((dest / "manifest.webmanifest").read_text(encoding="utf-8"))
m["name"], m["short_name"] = title, short
m["description"] = f"TODO: one sentence about {title}."
(dest / "manifest.webmanifest").write_text(
    json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

# The template's build notes are about the Tassie page and its history.
(dest / "build" / "README.md").write_text(f"""# Rebuilding `app.css`

Generated — don't hand-edit. Tailwind only emits classes it can see as literal
strings in `../index.html`, inline `<script>` included, so never assemble a
class name from fragments at runtime.

```sh
cd {slug}/build
npx tailwindcss@3.4.17 -c tailwind.config.js -i app.src.css -o tw.css --minify
cat fonts.css tw.css > ../app.css && rm tw.css
```

Then bump `VERSION` in `../sw.js`, or installed copies keep serving the old
stylesheet. The fonts are the latin subsets of Outfit and Playfair Display,
served from `../fonts` so the page renders offline.
""", encoding="utf-8")
PY

cat <<EOF

Scaffolded $SLUG/ from tassie-campervan-2026 — constants rewritten, content
still Tasmania's. Replace it rather than editing around it, then draw
$SLUG/icon.svg and run make-icons.mjs.

  python3 .claude/skills/new-itinerary/scripts/check.py $SLUG

lists what is left.
EOF
