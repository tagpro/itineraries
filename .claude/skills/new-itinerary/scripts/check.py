#!/usr/bin/env python3
"""Check that a trip folder is wired correctly before it ships.

    python3 check.py <trip-slug>

Most of what this looks for fails silently in a browser: a shared storage
prefix, a service worker that deletes another trip's cache, a manifest shortcut
pointing at a section that no longer exists, a list id the server will reject.
The page looks perfect and misbehaves a week later on someone's phone.

It cannot check whether a drive time is true. That is still a person's job.
"""

import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parents[4]
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
KEY_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")   # server: domain.ValidKey

# Booking references from the reference build. If these survive into another
# trip, some of that trip's page is still Tasmania's.
LEAKED = ["BIG457700", "APXWP2", "JQKZANYD3", "UIIZ7L", "IM50456624",
          "BBA26090121260069", "1300 798 212", "03 6248 4168"]
TASSIE_WORDS = ["Tasmania", "Tassie", "Hobart", "Freycinet", "Wineglass",
                "Bay of Fires", "Coles Bay", "St Helens", "Oatlands", "Apollo"]

fails: list[str] = []
warns: list[str] = []


def trip_folders() -> list[pathlib.Path]:
    return sorted(p.parent for p in REPO.glob("*/index.html")
                  if (p.parent / "sw.js").exists())


def first(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text)
    return m.group(1) if m else None


def main(slug: str) -> int:
    slug = slug.strip().rstrip("/")
    if not SLUG_RE.match(slug):
        fails.append(f"'{slug}' is not a valid slug — it is also the API trip id, so it "
                     f"must match [a-z0-9][a-z0-9-]{{0,63}}")
        return report()

    d = REPO / slug
    if not d.is_dir():
        fails.append(f"{slug}/ does not exist")
        return report()

    for r in ["index.html", "app.css", "sw.js", "manifest.webmanifest",
              "fonts/outfit.woff2", "fonts/playfair.woff2", "icons/icon-192.png",
              "icons/icon-512.png", "icons/icon-maskable-512.png",
              "icons/apple-touch-icon.png"]:
        if not (d / r).exists():
            fails.append(f"missing {slug}/{r}")

    html = (d / "index.html").read_text(encoding="utf-8") if (d / "index.html").exists() else ""
    sw = (d / "sw.js").read_text(encoding="utf-8") if (d / "sw.js").exists() else ""
    # The page's own script selects on these attributes, so scanning the whole
    # file would count every selector string as a declaration.
    markup = re.sub(r"<script\b.*?</script>", "", html, flags=re.S)

    # ── the two that fail silently ────────────────────────────────────────
    ns = first(r"var NS = '([^']+)'", html)
    prefix = first(r"const PREFIX\s*=\s*'([^']+)'", sw)
    if not ns:
        fails.append("index.html: no `var NS = '…'` — the storage prefix is missing")
    if not prefix:
        fails.append("sw.js: no `const PREFIX = '…'` — without it activate cannot tell "
                     "this trip's caches from another trip's")

    version = first(r"const VERSION\s*=\s*PREFIX \+ '([^']+)'", sw)
    if prefix and not version:
        fails.append("sw.js: VERSION should be `PREFIX + '-vN'`, so the cache name "
                     "carries the prefix activate filters on")

    # activate must delete only this trip's caches. The reference build used to
    # delete everything that was not its own VERSION, which wipes whichever
    # trip was installed first — verified in Chromium.
    if sw and "indexOf(PREFIX + '-')" not in sw:
        fails.append("sw.js: activate does not filter on PREFIX — as written it deletes "
                     "every other trip's cache on this origin when it activates")

    for other in trip_folders():
        if other.name == slug:
            continue
        o_html = (other / "index.html").read_text(encoding="utf-8")
        o_sw = (other / "sw.js").read_text(encoding="utf-8")
        o_ns = first(r"var NS = '([^']+)'", o_html)
        o_prefix = first(r"const PREFIX\s*=\s*'([^']+)'", o_sw)
        if ns and o_ns == ns:
            fails.append(f"index.html: NS '{ns}' is also used by {other.name}/ — "
                         f"localStorage is shared across the origin, so the two trips "
                         f"would tick each other's boxes")
        if prefix and o_prefix:
            # Not just equal: one being a prefix of the other is enough for a
            # trip to sweep away the other's caches.
            a, b = prefix + "-", o_prefix + "-"
            if a.startswith(b) or b.startswith(a):
                fails.append(f"sw.js: cache prefix '{prefix}' collides with "
                             f"{other.name}/'s '{o_prefix}' — one trip would delete the "
                             f"other's offline copy")

    trip = first(r"\? seg : '([^']+)'", html)
    if trip is None:
        warns.append("index.html: could not find the TRIP fallback in the sync module")
    elif trip != slug:
        fails.append(f"index.html: the TRIP fallback is '{trip}' but the folder is "
                     f"'{slug}' — they must match")

    start = first(r"var start = new Date\('([^']+)'\)", html)
    if not start:
        warns.append("index.html: no countdown start date found")
    elif start.startswith("2026-09-12") and slug != "tassie-campervan-2026":
        fails.append("index.html: the countdown still starts on the template's date")

    # ── offline ───────────────────────────────────────────────────────────
    for cdn in ["cdn.tailwindcss.com", "fonts.googleapis.com", "cdn.jsdelivr.net",
                "unpkg.com", "cdnjs.cloudflare.com"]:
        if cdn in html:
            fails.append(f"index.html references {cdn} — the page must render with no network")

    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
    if shell:
        for m in re.finditer(r"'\./([^']*)'", shell.group(1)):
            if m.group(1) and not (d / m.group(1)).exists():
                fails.append(f"sw.js precaches ./{m.group(1)}, which does not exist — "
                             f"install fails silently")

    # ── manifest ──────────────────────────────────────────────────────────
    ids = set(re.findall(r'id="([^"]+)"', markup))

    # One section shows at a time, and .pane is what marks one.
    panes = set()
    for tag in re.findall(r'<[a-z]+\b[^>]*\bclass="[^"]*\bpane\b[^"]*"[^>]*>', markup):
        pid = first(r'id="([^"]+)"', tag)
        if pid:
            panes.add(pid)
        else:
            fails.append("index.html: a .pane has no id, so the menu cannot reach it")
    mpath = d / "manifest.webmanifest"
    if mpath.exists():
        try:
            man = json.loads(mpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            man = None
            fails.append(f"manifest.webmanifest is not valid JSON: {e}")
        if man:
            for key in ("name", "short_name", "description", "theme_color", "start_url"):
                if not man.get(key):
                    fails.append(f"manifest.webmanifest: {key} is missing")
                elif "TODO" in str(man[key]):
                    fails.append(f"manifest.webmanifest: {key} still says TODO")
            for icon in man.get("icons", []):
                if not (d / icon.get("src", "")).exists():
                    fails.append(f"manifest.webmanifest: icon {icon.get('src')} does not exist")
            for sc in man.get("shortcuts", []):
                frag = sc.get("url", "").split("#", 1)
                if len(frag) == 2 and frag[1] not in panes:
                    fails.append(f"manifest.webmanifest: shortcut '{sc.get('name')}' points "
                                 f"at #{frag[1]}, which is not a section the menu opens — "
                                 f"the shortcut would land on the default section instead")
            theme = first(r'<meta name="theme-color" content="([^"]+)"', html)
            if theme and man.get("theme_color") and theme != man["theme_color"]:
                warns.append(f"theme-color is {theme} in the page and "
                             f"{man['theme_color']} in the manifest")

    # ── what the sync API will accept ─────────────────────────────────────
    # domain.ValidateTrip rejects the whole PATCH with a 400 if any list id or
    # entry key is malformed, so the page would simply stop syncing.
    lists = set(re.findall(r'data-list="([^"]+)"', markup))
    for lst in sorted(lists):
        if not SLUG_RE.match(lst):
            fails.append(f"index.html: list id '{lst}' is not a slug — the server rejects "
                         f"the whole sync, and the page stops syncing")
        if f'data-add="{lst}"' not in markup:
            warns.append(f"index.html: list '{lst}' has no add-your-own form")
        if f'data-reset="{lst}"' not in markup:
            warns.append(f"index.html: list '{lst}' has no Clear ticks button")

    keys = re.findall(r'data-k="([^"]+)"', markup)
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        fails.append(f"index.html: duplicate checklist keys {sorted(dupes)} — these are "
                     f"the sync keys, so a duplicate makes two rows tick as one")
    for k in sorted({k for k in keys if not KEY_RE.match(k)}):
        fails.append(f"index.html: checklist key '{k}' is not [A-Za-z0-9_.:-]{{1,64}} — "
                     f"the server rejects the whole sync")

    budget = re.findall(r'data-b="([^"]+)"', markup)
    bdupes = {k for k in budget if budget.count(k) > 1}
    if bdupes:
        fails.append(f"index.html: duplicate budget keys {sorted(bdupes)}")

    groups = set(re.findall(r'data-group="([^"]+)"', markup))
    for g in sorted(groups - set(re.findall(r'data-subtotal="([^"]+)"', markup))):
        fails.append(f'index.html: budget group "{g}" has no [data-subtotal="{g}"]')
    for g in sorted(groups - set(re.findall(r'data-summary="([^"]+)"', markup))):
        fails.append(f'index.html: budget group "{g}" has no [data-summary="{g}"]')

    # ── the side menu ─────────────────────────────────────────────────────
    # The menu is the only way between sections, so a row pointing at
    # something that is not a pane leaves two sections on screen at once, and
    # a pane with no row is simply unreachable.
    # Attribute order is not fixed, so match the tag and then look inside it.
    linked = set()
    for tag in re.findall(r"<a\b[^>]*>", markup):
        if "navitem" in tag:
            href = first(r'href="#([^"]+)"', tag)
            if not href:
                fails.append("index.html: a menu item has no href, so it opens nothing")
                continue
            linked.add(href)
            if href not in ids:
                fails.append(f"index.html: menu item points at #{href}, which is not on the page")
            elif href not in panes:
                fails.append(f"index.html: menu item points at #{href}, which is not a .pane — "
                             f"opening it would leave two sections on screen at once")
    if not linked:
        fails.append("index.html: no .navitem rows — nothing can reach any section")
    for orphan in sorted(panes - linked):
        fails.append(f"index.html: #{orphan} is a .pane with no menu item, so nothing on the "
                     f"page can open it")

    for sec in sorted(re.findall(r'data-sec="([^"]+)"', markup)):
        if sec not in panes:
            fails.append(f"index.html: menu row data-sec=\"{sec}\" has no matching .pane")

    # ── leftovers from the reference build ────────────────────────────────
    if slug != "tassie-campervan-2026":
        for ref in LEAKED:
            if ref in html:
                fails.append(f"index.html still contains '{ref}' — a booking reference from "
                             f"tassie-campervan-2026")
        bre = d / "build" / "README.md"
        if bre.exists() and "tassie-campervan-2026" in bre.read_text(encoding="utf-8"):
            fails.append("build/README.md still gives the template's folder in its "
                         "rebuild command")
        found = {w: html.count(w) for w in TASSIE_WORDS if w in html}
        if found:
            warns.append("Tasmania is still mentioned: " +
                         ", ".join(f"{w}×{n}" for w, n in sorted(found.items())) +
                         " — expected while drafting, not at the end")

    if f'href="./{slug}/"' not in (REPO / "index.html").read_text(encoding="utf-8"):
        fails.append(f"the root index.html has no card linking to ./{slug}/ — nothing "
                     f"would link to the trip")

    return report()


def report() -> int:
    for w in warns:
        print(f"warn  {w}")
    for f in fails:
        print(f"FAIL  {f}")
    if fails:
        print(f"\n{len(fails)} problem(s) to fix.")
        return 1
    print("ok — wiring checks pass" +
          (f" with {len(warns)} warning(s)" if warns else "") + ".")
    print("Numbers, times and prices are still yours to verify against the bookings.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: check.py <trip-slug>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
