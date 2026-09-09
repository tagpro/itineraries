#!/usr/bin/env python3
"""Check that a trip folder is wired correctly before it ships.

    python3 check.py <trip-slug>

Most of what this looks for fails silently in a browser: a shared storage
prefix, a shared service-worker cache name, a manifest shortcut pointing at a
section that no longer exists. The page looks perfect and misbehaves a week
later on someone's phone, which is the worst time to find out.

It cannot check whether a drive time is true. That is still a person's job.
"""

import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parents[4]
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")

# References from the reference build. If any of these survive into another
# trip, some of that trip's page is still Tasmania's.
LEAKED = ["BIG457700", "APXWP2", "JQKZANYD3", "UIIZ7L", "IM50456624",
          "BBA26090121260069", "1300 798 212", "03 6248 4168"]
TASSIE_WORDS = ["Tasmania", "Tassie", "Hobart", "Freycinet", "Wineglass",
                "Bay of Fires", "Coles Bay", "St Helens", "Oatlands", "Apollo"]

fails: list[str] = []
warns: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


def warn(msg: str) -> None:
    warns.append(msg)


def trip_folders() -> list[pathlib.Path]:
    """Every itinerary folder in the repository."""
    return sorted(p.parent for p in REPO.glob("*/index.html")
                  if (p.parent / "sw.js").exists())


def main(slug: str) -> int:
    if not SLUG_RE.match(slug):
        fail(f"'{slug}' is not a valid slug — it is also the API trip id, so it must "
             f"match [a-z0-9][a-z0-9-]{{0,63}}")
        return report()

    d = REPO / slug
    if not d.is_dir():
        fail(f"{slug}/ does not exist")
        return report()

    required = ["index.html", "app.css", "sw.js", "manifest.webmanifest",
                "fonts/outfit.woff2", "fonts/playfair.woff2",
                "icons/icon-192.png", "icons/icon-512.png",
                "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"]
    for r in required:
        if not (d / r).exists():
            fail(f"missing {slug}/{r}")

    html = (d / "index.html").read_text(encoding="utf-8") if (d / "index.html").exists() else ""
    sw = (d / "sw.js").read_text(encoding="utf-8") if (d / "sw.js").exists() else ""
    # The page's own script selects on these attributes, so scanning the whole
    # file would count every selector string as a second declaration. Markup
    # questions get asked of the markup only.
    markup = re.sub(r"<script\b.*?</script>", "", html, flags=re.S)

    # ── the three that fail silently ──────────────────────────────────────
    ns = re.search(r"var NS = '([^']+)'", html)
    if not ns:
        fail("index.html: no `var NS = '…'` — the storage prefix is missing")
    ver = re.search(r"const VERSION = '([^']+)'", sw)
    if not ver:
        fail("sw.js: no `const VERSION = '…'` — the cache name is missing")

    for other in trip_folders():
        if other.name == slug:
            continue
        o_html = (other / "index.html").read_text(encoding="utf-8")
        o_sw = (other / "sw.js").read_text(encoding="utf-8")
        o_ns = re.search(r"var NS = '([^']+)'", o_html)
        o_ver = re.search(r"const VERSION = '([^']+)'", o_sw)
        if ns and o_ns and ns.group(1) == o_ns.group(1):
            fail(f"index.html: NS '{ns.group(1)}' is also used by {other.name}/ — "
                 f"localStorage is shared across the origin, so the two trips would "
                 f"tick each other's boxes")
        if ver and o_ver and ver.group(1) == o_ver.group(1):
            fail(f"sw.js: cache name '{ver.group(1)}' is also used by {other.name}/ — "
                 f"whichever activates last deletes the other's offline copy")

    trip = re.search(r"\? seg : '([^']+)'", html)
    if not trip:
        warn("index.html: could not find the TRIP fallback in the sync module")
    elif trip.group(1) != slug:
        fail(f"index.html: the TRIP fallback is '{trip.group(1)}' but the folder is "
             f"'{slug}' — they must match")

    # ── the countdown ─────────────────────────────────────────────────────
    start = re.search(r"var start = new Date\('([^']+)'\)", html)
    if not start:
        warn("index.html: no countdown start date found")
    elif start.group(1).startswith("2026-09-12") and slug != "tassie-campervan-2026":
        fail("index.html: the countdown still starts on the template's date")

    # ── offline ───────────────────────────────────────────────────────────
    for cdn in ["cdn.tailwindcss.com", "fonts.googleapis.com", "cdn.jsdelivr.net",
                "unpkg.com", "cdnjs.cloudflare.com"]:
        if cdn in html:
            fail(f"index.html references {cdn} — the page must render with no network")

    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
    if shell:
        for m in re.finditer(r"'\./([^']*)'", shell.group(1)):
            rel = m.group(1)
            if rel and not (d / rel).exists():
                fail(f"sw.js precaches ./{rel}, which does not exist — install fails silently")

    # ── manifest ──────────────────────────────────────────────────────────
    mpath = d / "manifest.webmanifest"
    if mpath.exists():
        try:
            man = json.loads(mpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            man = None
            fail(f"manifest.webmanifest is not valid JSON: {e}")
        if man:
            for key in ("name", "short_name", "description", "theme_color", "start_url"):
                if not man.get(key):
                    fail(f"manifest.webmanifest: {key} is missing")
                elif "TODO" in str(man[key]):
                    fail(f"manifest.webmanifest: {key} still says TODO")
            for icon in man.get("icons", []):
                if not (d / icon.get("src", "")).exists():
                    fail(f"manifest.webmanifest: icon {icon.get('src')} does not exist")
            ids = set(re.findall(r'id="([^"]+)"', markup))
            for sc in man.get("shortcuts", []):
                frag = sc.get("url", "").split("#", 1)
                if len(frag) == 2 and frag[1] not in ids:
                    fail(f"manifest.webmanifest: shortcut '{sc.get('name')}' points at "
                         f"#{frag[1]}, which is not a section on the page")
            theme = re.search(r'<meta name="theme-color" content="([^"]+)"', html)
            if theme and man.get("theme_color") and theme.group(1) != man["theme_color"]:
                warn(f"theme-color is {theme.group(1)} in the page and "
                     f"{man['theme_color']} in the manifest")

    # ── checklists, budget, navigation ────────────────────────────────────
    keys = re.findall(r'data-k="([^"]+)"', markup)
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        fail(f"index.html: duplicate checklist keys {sorted(dupes)} — these are the "
             f"sync keys, so a duplicate makes two rows tick as one")

    budget = re.findall(r'data-b="([^"]+)"', markup)
    bdupes = {k for k in budget if budget.count(k) > 1}
    if bdupes:
        fail(f"index.html: duplicate budget keys {sorted(bdupes)}")

    groups = set(re.findall(r'data-group="([^"]+)"', markup))
    subtotals = set(re.findall(r'data-subtotal="([^"]+)"', markup))
    summaries = set(re.findall(r'data-summary="([^"]+)"', markup))
    for g in groups - subtotals:
        fail(f"index.html: budget group '{g}' has no [data-subtotal=\"{g}\"] to add up into")
    for g in groups - summaries:
        fail(f"index.html: budget group '{g}' has no [data-summary=\"{g}\"] in the total card")

    ids = set(re.findall(r'id="([^"]+)"', markup))
    for href in re.findall(r'<a href="#([^"]+)"[^>]*class="navpill', markup):
        if href not in ids:
            fail(f"index.html: nav pill points at #{href}, which is not on the page")

    for lst in set(re.findall(r'data-list="([^"]+)"', markup)):
        if f'data-add="{lst}"' not in markup:
            warn(f"index.html: list '{lst}' has no add-your-own form")
        if f'data-reset="{lst}"' not in markup:
            warn(f"index.html: list '{lst}' has no Clear ticks button")

    # ── leftovers from the reference build ────────────────────────────────
    if slug != "tassie-campervan-2026":
        for ref in LEAKED:
            if ref in html:
                fail(f"index.html still contains '{ref}' — a booking reference from "
                     f"tassie-campervan-2026")
        found = {w: html.count(w) for w in TASSIE_WORDS if w in html}
        if found:
            warn("Tasmania is still mentioned: " +
                 ", ".join(f"{w}×{n}" for w, n in sorted(found.items())) +
                 " — expected while drafting, not at the end")

    # ── the trip has to be reachable ──────────────────────────────────────
    root = (REPO / "index.html").read_text(encoding="utf-8")
    if f'href="./{slug}/"' not in root:
        fail(f"the root index.html has no card linking to ./{slug}/ — nothing would "
             f"link to the trip")

    return report()


def report() -> int:
    for w in warns:
        print(f"warn  {w}")
    for f in fails:
        print(f"FAIL  {f}")
    if fails:
        print(f"\n{len(fails)} problem(s) to fix.")
        return 1
    print(f"ok — wiring checks pass{' with ' + str(len(warns)) + ' warning(s)' if warns else ''}.")
    print("Numbers, times and prices are still yours to verify against the bookings.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: check.py <trip-slug>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
