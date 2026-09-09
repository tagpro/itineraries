# The anatomy of a trip page

Read alongside `tassie-campervan-2026/index.html`, which is the reference build.
This describes what each part is for and what has to change per trip, so you can
copy the structure without copying Tasmania.

- [The folder](#the-folder)
- [Per-trip constants](#per-trip-constants)
- [The sections](#the-sections)
- [Design language](#design-language)
- [The wiring](#the-wiring)
- [Sync, and the API](#sync-and-the-api)
- [Rebuilding the stylesheet](#rebuilding-the-stylesheet)

## The folder

```
<trip-slug>/
  index.html            everything — markup, inline <style>, one inline <script>
  app.css               generated: Tailwind + @font-face. Never hand-edited
  sw.js                 service worker; precaches the shell, leaves /api/ alone
  manifest.webmanifest  name, icons, theme, shortcuts
  fonts/                outfit.woff2, playfair.woff2 — latin subsets, variable
  icons/                192, 512, maskable 512, apple-touch 180
  build/                app.src.css, fonts.css, tailwind.config.js, README.md
```

One page, no framework, no CDN, no build step at read time. That is deliberate:
the page has to render from cache in a valley, and a single file is also the
thing a person can read end to end before trusting it.

## Per-trip constants

Everything in this table is Tasmania-specific in the template and must be
changed. `scaffold.sh` does most of it; `check.py` proves it was done. The first
three fail *silently* — the page looks perfect and misbehaves later.

| Where | What | Why it matters |
|---|---|---|
| folder name | the trip slug | It **is** the API trip id: the sync module derives it from the URL path. Must match `[a-z0-9][a-z0-9-]{0,63}` |
| `index.html` script | `var NS = 'tassie-camper-2026:'` | localStorage is per-origin, not per-folder. Two trips sharing a prefix tick each other's boxes and overwrite each other's budgets |
| `sw.js` | `const VERSION = 'tassie-v7'` | Cache Storage is per-origin too, and `activate` deletes every cache that is not `VERSION`. A second trip reusing the name wipes the first trip's offline copy |
| `index.html` script | the `TRIP` fallback string | Only used when the path has no usable segment, e.g. opened from a file. Keep it equal to the slug |
| `index.html` script | `var start = new Date('2026-09-12T09:00:00+10:00')` | The countdown. Use the trip's first moment in the destination's offset |
| `<head>` | `<title>`, `meta description`, `meta theme-color`, `apple-mobile-web-app-title` | Title shows on the home screen |
| `manifest.webmanifest` | `name`, `short_name`, `description`, `lang`, `theme_color`, `background_color`, `shortcuts` | Shortcut URLs must point at section ids that exist |
| `icons/` | all four PNGs | See `scripts/make-icons.mjs` |
| header | trip name, dates, travellers, the emoji | |
| `sw.js` | `SHELL` | Only if the asset list changes |

## The sections

Nav pills in the header, section ids, and the manifest shortcuts all have to
agree. The order below is the order a traveller reads in.

**`#overview`** — the hero, then *the shape of the week*, then *Read this first*.

The hero is a dark card: a one-line summary, a headline, a paragraph with the
trip's totals in bold, and a grid of small tiles for the fixed points — land,
pick up, drop off, vehicle, hotel, fly home. Tiles are label / value / detail.

*The shape of the week* is a single card explaining **why the trip runs in this
order**. Every itinerary has a logic; most pages leave it implicit and it reads
as arbitrary. State the rule the trip obeys, then the consequences as ticks.

*Read this first* is the most useful section on the page: numbered `<details>`
blocks for the things research **changed**, most actionable first, each with a
badge (`1 · SATURDAY'S SHAPE`), a one-line claim, a subtitle, and the reasoning
inside. Jobs for this week go above things for the trip itself. Where there is
an action, put the link or the phone number in the block.

**A logistics strip** — plain cards of `<dl>` rows for the vehicle, the beds,
the flights. Reference numbers live here so they are findable at a counter.

**`#itinerary`** — a sticky row of `.daytab` buttons and one `.daypanel` per day,
all but the first carrying `hidden`. Each panel:

1. *header* — `DAY n` badge, distance and drive time, walk distance, and a
   character badge (`easiest drive of the week`, `sunrise day`), then the day's
   title and the string of places.
2. *legs* — the planned route as a horizontal strip of dots and durations, then
   a card per **alternative** with the condition that triggers it (`IF ST MARYS
   PASS IS SHUT`). Dot colour: ember = you get out, forest = drive through, sky
   = the walk. A legend and the note that times are driving only.
3. *links* — a Google Maps directions URL through every waypoint, plus any live
   status page worth checking the week before.
4. *timeline* — `.tl` items with real clock times (`11:35 – 12:25 · STOP 1`), a
   title, the reason it is worth stopping, and an amber callout where research
   says it is tight.
5. *"If you're running behind"* — a `<details>` of levers: what to cut first and
   what it buys back, what to keep, and what is closed or not worth it.

Days reference each other constantly. Use `<a data-goto="8" class="daylink">` —
it switches day and scrolls, so the reader never loses the thread.

**`#hikes`** — a card per walk: badge for the day, name, park, rating and review
count, then badges for distance, time, elevation and grade, then two sentences
on what it actually is. Add a card of shorter options from the same car parks, a
grade-scale explainer so the badges mean something, and — if a constraint cost
you walks — a card naming what was traded away. Being explicit about what the
plan gives up is what makes the rest credible.

**`#camps`** — every night, booked or not: name, address, phone, reference,
what is paid, check-in and reception hours, and the site type. Nights are where
a plan fails hardest, so nothing here is approximate.

**`#planb`** — the wet-weather and closure alternatives, day by day.

**`#checklists`** — see the wiring below. Group by *moment*, not by category:
"Before you fly", "At the depot, Saturday 9 am", "Every morning before you
drive". A checklist read at the wrong time is not read.

**`#budget`** — grouped rows of editable numbers with a sticky total. Every row
says where its figure came from and whether it is booked or estimated.

**footer — *What couldn't be confirmed*** — mandatory. Bullets, each naming the
open question, why it is open, and what would settle it. Mark items that were
settled later as `Settled:` and corrections as `Corrected:` rather than deleting
them; a reader who acted on the old version needs to see the change.

**`#sync`** — the panel that connects the phone to the trip. Copy as-is.

## Design language

Tailwind, configured in `build/tailwind.config.js`: `forest` 50–900 as the
primary, `sand` 50–200 as the ground, `ember` 500/600 for warnings, `shadow-soft`,
Outfit for text and Playfair Display for display. A different trip can use a
different palette — change the config and rebuild — but keep the structure:
one dark hero, white cards on a warm ground, rounded corners at `2xl`/`3xl`.

Colour carries meaning, and the meaning has to stay consistent:

- **forest / green** — settled, booked, confirmed
- **amber / ember** — tight, needs a decision, watch this
- **red** — could break the day
- **sky** — a note, a different mode (the Hobart days, after the van)

Small classes worth reusing: `.badge`, `.chk` and `.chk-label`, `.tl` (timeline
rail), `.daylink`, `.navpill`, `.no-sb` (hides scrollbars on the horizontal
strips), `.chev` (rotates in an open `<details>`).

Two constraints from the build: **Tailwind only emits classes it can see as
literal strings in `index.html`**, so never assemble a class name from
fragments at runtime — the JS that repaints day tabs writes both full class
strings out. And the sticky offsets (`scroll-padding-top: 118px`, the day-tab
row at `top-[112px]`, the budget card at `top-[132px]`) are tuned to the header
height; change the header and re-tune them.

## The wiring

One IIFE at the bottom of `index.html`, in ES5 style so it parses on an old
phone. All of it reads and writes `localStorage` behind `get`/`set`/`del`
helpers that swallow exceptions, because Safari throws in private mode.

**Checklists.** A card is `[data-list="<id>"]`, its built-in rows are
`input.chk[data-k="<key>"]`, and it holds `.custom-mount` for the traveller's
own items, an `.add-form`, a progress bar and a `data-reset` button. Ticks are
stored at `chk:<key>`; added items at `items:<list>` as `[{id,t}]`.

Keys are short and stable (`b1`, `d1`, `m1`, `h1` — a distinct letter per list).
They are also the **sync keys**: renumbering them silently unticks boxes on
every other phone. Add new items with new keys; never reuse a retired one.

User text is written with `textContent`, never `innerHTML`.

**Budget.** `input[data-b="<key>"][data-group="<group>"]`, one
`[data-subtotal="<group>"]` and one `[data-summary="<group>"]` per group.
Values persist at `bud:<key>`; *Reset to defaults* restores the markup values.

**Persistent storage.** The page asks for `navigator.storage.persist()` and
reports the answer, because Safari evicts script-writable storage for sites left
unvisited about a week — which is exactly the gap between packing and flying.
Installing to the home screen is what flips it, so the message says so.

**Offline.** `sw.js` precaches the shell, serves navigations network-first so
edits land, assets cache-first with a background refresh, ignores everything
off-origin, and never touches `/api/`. A waiting worker raises a "newer plan is
ready" bar rather than reloading under the reader.

## Sync, and the API

The API is one Cloudflare Worker for every itinerary, at
`https://travel.jaspreet.casa/api/v1`. `server/README.md` is the full contract.
What the page needs to know:

- The **trip id is the folder name**. Nothing else has to be registered.
- The page keeps a **ledger** beside the plain storage: one entry per tick or
  item, `{v, t, d}` — value, millisecond stamp, tombstone. It `PATCH`es the
  whole ledger and absorbs the merged reply. Later stamp wins; on a tie, a
  tombstone wins; then the greater value. The same rule runs in the page, in Go
  and in the SQL, so all three agree.
- Auth is a **trip token**, 43 URL-safe base64 characters, held on the phone.
  The join link carries it after `#`, so it never reaches the server or its
  logs, and the page strips it from the address bar on arrival.
- Creating the trip needs the **admin key**, typed once into *Enable sync* and
  not kept. Rotating invalidates every other phone.

A new page inherits all of this by copying the `#sync` section and the sync
module unchanged. The only per-trip part is the slug.

## Rebuilding the stylesheet

`app.css` is generated. After any markup change:

```sh
cd <trip-slug>/build
npx tailwindcss@3.4.17 -c tailwind.config.js -i app.src.css -o tw.css --minify
cat fonts.css tw.css > ../app.css && rm tw.css
```

Then bump `VERSION` in `sw.js`, or installed copies keep the old stylesheet.
