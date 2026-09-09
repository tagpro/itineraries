# The anatomy of a trip page

Read alongside `tassie-campervan-2026/index.html`, which is the reference
build. This says what each part is *for* — the judgement that is not visible in
the markup — and what has to change per trip.

## The folder

```
<trip-slug>/
  index.html            everything — markup, inline <style>, one inline <script>
  app.css               generated: Tailwind + @font-face. Never hand-edited
  sw.js                 precaches the shell, leaves /api/ alone
  manifest.webmanifest  name, icons, theme, shortcuts
  fonts/  icons/        served locally, so the page renders with no network
  build/                app.src.css, fonts.css, tailwind.config.js, README.md
```

One page, no framework, no CDN, no build step at read time. That is deliberate:
it has to render from cache in a valley, and a single file is also the thing a
person can read end to end before trusting it.

## Per-trip constants

`scaffold.sh` rewrites these; `check.py` proves it. The first two fail
*silently* — the page looks perfect and misbehaves a week later.

| Where | What | Why |
|---|---|---|
| folder name | the trip slug | It **is** the API trip id — the sync module reads it off the URL path. Must match `[a-z0-9][a-z0-9-]{0,63}` |
| `index.html` script | `var NS = '…:'` | localStorage is per-origin, not per-folder. Two trips sharing a prefix tick each other's boxes |
| `sw.js` | `const PREFIX` | CacheStorage is per-origin too, and `activate` deletes this trip's *older* caches. The prefix is what keeps it from deleting another trip's — see below |
| `sw.js` | `const VERSION` | `PREFIX + '-vN'`. Bump on every asset change |
| `index.html` script | the `TRIP` fallback | Only used when the path has no usable segment. Keep it equal to the slug |
| `index.html` script | `var start = new Date(…)` | The countdown, in the destination's offset |
| `<head>` | title, description, theme-color, apple-mobile-web-app-title | The title shows on the home screen |
| `manifest.webmanifest` | name, short_name, description, lang, colours, shortcuts | Shortcut URLs must point at section ids that exist |
| `icons/` | all four PNGs | |

### The cache prefix, specifically

Every itinerary on `travel.jaspreet.casa` shares one CacheStorage. The
worker's `activate` runs `caches.keys()` and deletes what is stale — so the
test it applies decides whether trips coexist:

- **`k !== VERSION`** (what this file used to do) deletes *every other trip's*
  cache. Verified in Chromium: install trip A, then open trip B, and A's
  offline copy is gone.
- **`k.indexOf(PREFIX + '-') === 0 && k !== VERSION`** deletes only this
  trip's older versions. Both trips keep their caches, and a version bump still
  evicts its own predecessor.

So the prefix must be unique per trip, and no prefix may be a prefix of
another — `tassie` and `tassie-2027` would collide. `check.py` enforces both.

## The sections

Nav pills, section ids and manifest shortcuts all have to agree.

**`#overview`** — a dark hero card (summary line, headline, the totals in bold,
a grid of tiles for the fixed points), then **the shape of the week**: one card
saying *why the trip runs in this order*. Every itinerary has a logic; most
pages leave it implicit and it reads as arbitrary. State the rule the trip
obeys, then the consequences.

Then **Read this first** — the most useful section on the page. Numbered
`<details>` for the things research *changed*, most actionable first. Jobs for
this week go above things for the trip itself, and where there is an action,
put the link or phone number in the block.

**Logistics** — plain `<dl>` cards for the vehicle, beds and flights.
Reference numbers live here so they are findable at a counter.

**`#itinerary`** — a sticky row of `.daytab` buttons and one `.daypanel` per
day, all but the first `hidden`. Each panel carries a header of badges, a legs
strip (planned route, then a card per **alternative** with the condition that
triggers it), a Google Maps link through every waypoint, a `.tl` timeline with
real clock times, and a closing `<details>` of levers for running behind: what
to cut first and what it buys back. Dot colours: ember = you get out, forest =
drive through, sky = the walk.

Days reference each other constantly — use `<a data-goto="8" class="daylink">`,
which switches day and scrolls, so the reader never loses the thread.

**`#hikes`** — a card per walk with rating, review count, distance, time,
elevation and grade, then two sentences on what it actually is. Include a
grade-scale explainer so the badges mean something, and — if a constraint cost
you walks — a card naming what was traded away. Being explicit about what the
plan gives up is what makes the rest credible.

**`#camps`** — every night: name, address, phone, reference, what is paid,
check-in and reception hours. Nights are where a plan fails hardest, so nothing
here is approximate.

**`#planb`** — the wet-weather and closure alternatives, day by day.

**`#checklists`** — grouped by *moment*, not by category: "Before you fly", "At
the depot, Saturday 9 am", "Every morning before you drive". A checklist read
at the wrong time is not read.

**`#budget`** — grouped editable rows with a sticky total. Every row says where
its figure came from and whether it is booked or estimated.

**footer — *What couldn't be confirmed*** — mandatory. Each bullet names the
open question, why it is open, and what would settle it. Mark items resolved
later as `Settled:` or `Corrected:` rather than deleting them; a reader who
acted on the old version needs to see the change.

**`#sync`** — copy the section and the sync module unchanged. The slug is the
only per-trip part; `server/README.md` has the contract.

## The data attributes the script depends on

- Checklist card: `[data-list="<id>"]`, containing `input.chk[data-k="<key>"]`
  rows, a `.custom-mount`, an `.add-form[data-add="<id>"]`, and a
  `[data-reset="<id>"]`.
- Budget row: `input[data-b="<key>"][data-group="<group>"]`, with one
  `[data-subtotal="<group>"]` and one `[data-summary="<group>"]` per group.

List ids are slugs and keys are `[A-Za-z0-9_.:-]{1,64}`, because the server
validates both and rejects the whole sync with a 400 if either is wrong. Keys
are short and stable (`b1`, `d1`, `m1` — a distinct letter per list); they are
the sync keys, so renumbering silently unticks boxes on other phones. User text
is written with `textContent`, never `innerHTML`.

## Layout notes worth knowing

Tailwind is configured in `build/tailwind.config.js`; a different trip can use
a different palette, but keep the structure — one dark hero, white cards on a
warm ground, `2xl`/`3xl` corners. The sticky offsets are tuned to the header
height (`scroll-padding-top: 118px`, the day-tab row at `top-[112px]`, the
budget card at `lg:top-[132px]`); change the header and re-tune them.

`build/README.md` has the stylesheet rebuild and the reason classes must appear
as literal strings in `index.html`.
