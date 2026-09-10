# Working in this repository

Trip itineraries, one folder per trip, served as a static site from `main` by
GitHub Pages at **travel.jaspreet.casa**, plus one small Go API that lets the
checklists on those pages sync between phones.

The pages are read by two people standing in the weather, on a phone, often
with no signal. That is the whole design constraint, and most of the
conventions below follow from it.

## Layout

```
index.html                  the trip list — hand-maintained, one card per trip
fonts/  icons/              the list page's own copies, so archiving a trip
                            cannot break it
CNAME                       travel.jaspreet.casa
tassie-campervan-2026/      the reference build: offline, installable, syncing
server/                     the sync API — Go on Cloudflare Workers + D1
.github/workflows/api.yml   tests the API on every change; deploys from main
.claude/skills/             skills for working here
```

Nothing is generated at read time. Every trip page is one `index.html` with an
inline `<style>` and one inline `<script>`, a pre-compiled `app.css`, and its
own fonts and icons. No CDN, no framework, no bundler.

## Adding or changing a trip page

Use the **`new-itinerary`** skill (`.claude/skills/new-itinerary/`). It carries
the whole method — reading the bookings out of Gmail, the interview, the
parallel research, and the page's anatomy — plus scripts that do the
error-prone mechanical parts:

```sh
.claude/skills/new-itinerary/scripts/scaffold.sh <slug> "<Title>" "<Short>" <YYYY-MM-DD>
node .claude/skills/new-itinerary/scripts/make-icons.mjs <slug>/icon.svg <slug>/icons '#0f3d2e'
python3 .claude/skills/new-itinerary/scripts/check.py <slug>
```

Run `check.py` before committing any change to a trip page. It catches the
class of mistake that a browser hides until someone is on a mountain.

### The things that break silently

- **The folder name is the API's trip id.** It must match
  `[a-z0-9][a-z0-9-]{0,63}`, and the page derives it from the URL path.
- **`var NS` in the page script must be unique per trip.** localStorage is
  per-origin, so two trips sharing a prefix tick each other's checkboxes.
- **`const PREFIX` in `sw.js` must be this trip's slug.** Cache Storage is
  per-origin too, and `activate` deletes this trip's older caches — it filters
  on `PREFIX` so it leaves other trips' alone. Deleting everything that is not
  the current `VERSION`, which this file used to do, wipes the offline copy of
  whichever trip was installed first. No prefix may be a prefix of another
  (`tassie` and `tassie-2027` collide); `check.py` enforces both.
- **Checklist `data-k` keys are the sync keys.** Renaming or renumbering one
  unticks that box on every phone already holding the trip. Add new keys; never
  reuse a retired one.
- **A section the menu opens must carry `.pane`, and every `.pane` needs a menu
  row.** One section shows at a time; a mismatch either leaves two on screen at
  once or strands a section nothing can reach. `check.py` fails on both.

### `app.css` is generated

Do not hand-edit it, and never assemble a class name from fragments at runtime
— Tailwind only emits classes it can see as literal strings in `index.html`.
`<slug>/build/README.md` has the rebuild command; run it after any markup
change, then bump `VERSION` in `sw.js` or installed copies keep the old page.

## The API

`server/README.md` is the contract, the commands and the setup; read it before
touching `server/`. In short: one Worker for every itinerary at
`travel.jaspreet.casa/api/v1`, D1 for storage, a trip is a set of lists of
keyed entries, and the merge rule is a map of last-writer-wins registers
implemented identically in Go, in SQL and in the page's JavaScript. A trip's
folder name is its id; the page validates list ids and entry keys because the
server rejects a whole sync if either is malformed.

Secrets never enter the repository. The Cloudflare token and the API admin key
live in the GitHub `api-production` environment and in Doppler
(`all-projects` / `dev_personal`); the deploy job pushes the admin key into the
Worker after each deploy.

## Deploys

The site publishes itself: GitHub Pages serves `main` from the root, so a
merged page change is live within a minute or two.

The API deploys from `.github/workflows/api.yml` on pushes to `main` that touch
`server/`, or by hand from the Actions tab. Its deploy job names the
`api-production` environment, which is what gates the secrets — and that
environment requires a reviewer, so a deploy waits for approval rather than
failing.

## Writing, on the pages themselves

The voice is the point, not decoration. It is what makes the plan trustworthy
at 4 pm on an unfamiliar road.

- **Say where a fact came from** when it is load-bearing: *"Parks Tasmania
  grades this 4"*, *"Apollo, by email on 24 Aug"*.
- **Give reasons, not just instructions.** A traveller who knows *why* the
  route runs one way round can improvise when it fails; one who only has the
  route cannot.
- **Colour carries meaning and must stay consistent** — forest for settled,
  amber for tight or undecided, red for what could break the day, sky for a
  note or a change of mode.
- **Every page ends with what could not be confirmed**, in the traveller's own
  terms, with the action that would settle it. Mark things later resolved as
  `Settled:` or `Corrected:` rather than deleting them — someone may have acted
  on the old version.
- No unsourced numbers. A range, honestly labelled, beats a confident guess.

## Comments, in the code

The pages and the server both comment the *why*, in prose, above the thing they
explain — what a reader would otherwise have to reconstruct. Match that. Do not
add comments that restate the line beneath them.

## Commits and pull requests

- Work on a branch; open a pull request. `main` is protected.
- Commit as `Claude <noreply@anthropic.com>` — GitHub rejects the account's
  private address with GH007.
- Subject lines say what changed for the traveller, not which files moved.
- Never commit a secret, a trip token or an admin key. Tokens belong in the
  page's *Sync between phones* panel and nowhere else.
- Keep model names out of page copy, code comments and pull request bodies.
  A commit's `Co-Authored-By` trailer is the one place they belong.
