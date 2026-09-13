# Testing the pages

The API has Go tests (`cd server && make test`). This is the other half: the
page itself, which is where most of the behaviour now lives — a service worker,
a section router, a checklist store and a budget that syncs between phones, all
in one inline script.

```sh
./test/run.sh            # everything
./test/run.sh page       # the page on its own
./test/run.sh sync       # two phones against the real API
./test/run.sh upgrade    # the update a phone already holding the trip makes
```

`run.sh` starts what each spec needs and cleans up after itself. It installs
`playwright-core` into `test/node_modules` the first time.

**Chromium** is not bundled. `test/browser.mjs` looks for `$CHROME_PATH`, then a
Playwright-managed build, then the usual macOS and Linux installs. If it finds
none: `npx playwright install chromium`, or point `CHROME_PATH` at a browser you
already have.

## What each spec is for

**`page.test.mjs`** — no API, no git. One section on screen at a time, the star
that chooses which one, and the hash rules: a manifest shortcut opens its
section but is then spent, so a fragment left in a tab cannot outrank the star
on every refresh. Also the day cross-references, local budget editing, the iOS
install note appearing on iOS and nowhere else, printing (hiding sections must
not lose them on paper), and offline.

It also measures the **safe-area insets**. Chromium cannot emulate
`env(safe-area-inset-*)`, so `run.sh` serves a second copy of the page with real
lengths substituted and the spec measures that. This is not decoration: an
unmeasured inset is how the header ended up underneath the iPhone's clock.

**`sync.test.mjs`** — the real Go API on its in-memory store, with `serve.py`
putting the site and `/api/v1` on one origin so the page runs exactly as it does
in production. Two browser contexts join one trip and must converge: additions,
renames, deletions and spends travel both ways.

The assertion that matters most is *"its own seed did not overwrite the plan"*.
Every phone seeds every budget row on its first run, so a seed carrying a
current clock beats an edit the other phone made yesterday — the second phone to
join silently undoes the first one's week. This spec is what caught that.

**`upgrade.test.mjs`** — a fresh install proves nothing about the people
actually carrying the page. This one installs whatever `main` has, uses it (a
tick, a starred section, an edited figure), drops the working tree underneath
it, taps the update bar, and checks that none of that survived only by luck.
Then it goes offline.

## Adding to them

`browser.mjs` holds the shared parts: finding Chromium, a results collector so a
spec reads as a list of claims rather than a pile of asserts that stop at the
first failure, and helpers (`visible`, `budgetRows`, `go`, `openMenu`) that
behave the same at phone and desktop widths.

A spec exits non-zero if any claim fails, and prints every result either way.
