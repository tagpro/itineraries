---
name: new-itinerary
description: Build a new trip page in this repository, modelled on tassie-campervan-2026 — an installable, offline, checklist-carrying itinerary. Reads the real bookings out of Gmail, interviews the traveller about what the bookings cannot say, fans research out across parallel subagents, and writes the day-by-day page. Use this whenever a trip is being planned or written up here: "plan our Japan trip", "make a page for the Kimberley drive", "we fly to Queenstown in March, build the itinerary", "turn these bookings into a plan", "add a new trip", or any request to research, schedule or lay out a holiday — even when the words "itinerary" and "page" never appear.
---

# Building a trip page

The output is one folder — `<trip-slug>/` — holding a page that a traveller
installs on their phone and opens in a valley with no signal. `tassie-campervan-2026/`
is the reference build; read it before you write anything, because copying its
*shape* is easy and copying its *judgement* is the actual work.

What makes that page good is not the layout. It is that every number in it came
from somewhere, the things that could ruin a day are called out in amber before
they happen, and the last section admits what could not be confirmed. A page
that looks the same but invents its drive times is worse than no page, because
it will be trusted at 4 pm on a mountain road.

## The order of work, and why

Bookings first, questions second, research third. The bookings are the only
fixed points — flights land when they land, a depot shuts when it shuts — and
they silently answer half the questions you would otherwise ask. Research done
before you know the shape of the week produces a list of attractions instead of
a plan.

## 1 · Read the bookings

Read `references/booking-emails.md` first — it carries the Gmail queries, the
sender inventory for this account, and the four traps that have actually bitten
here (a superseded flight number, a cancelled hotel, a decisive fact buried in
a reply, terms only in a PDF).

Work through it until you can write down, for every leg of the trip: what is
booked, under which reference, paid or payable, at what time, with which
constraints and which phone number. Keep the message date beside each fact.
The page later says things like *"Apollo confirmed it in writing on 24 Aug"*,
and it can only say that because the record kept the date.

Two rules earn their place here:

- **The latest email wins.** Airlines re-issue itineraries and hotels get
  moved. Once you have a reference, search that reference on its own and read
  every hit in date order.
- **When an email contradicts the printed booking, the email is the news.**
  Say so on the page, quote it, and tell the traveller to keep it on their
  phone. That single line is the most valuable thing on the Tassie page.

If Gmail is not connected, say so plainly and ask the traveller to paste the
confirmations. Do not guess a booking.

If **nothing is booked yet**, the order flips: interview first, research, then
propose the shape of the week with real options and prices. Build the page
anyway — it is a better brief than a chat — but mark every bed and vehicle as
unbooked, and put what to book, in what order, at the top of *Read this first*.
Come back and fold the confirmations in once they exist.

## 2 · Ask what the bookings cannot say

Now, and only now, interview. Use `AskUserQuestion`, two rounds at most —
this is a holiday, not an onboarding form. Skip anything a booking already
answered; being asked your own flight time is how a plan loses trust.

What actually shapes a plan:

- **Who is going, and what will they walk.** A grade 4 scramble and a
  boardwalk are different holidays. Ask for the hardest thing they would enjoy,
  not their fitness.
- **The one thing they would be sad to miss.** Everything else is negotiable
  and this is not; it decides which day gets the good weather.
- **Hours in the car per day before it stops being fun.** Three hours is a
  drive; five is a transit day, and the page should say so.
- **Early starts — yes or never.** Sunrises, tides and dry rock all depend on
  the answer, and a plan built on 5:45 alarms for people who won't wake is
  fiction.
- **Money posture.** Counting every dollar, or paying for the good thing and
  not thinking about it. This changes recommendations, not just the budget.
- **Cooking or eating out**, where there's a kitchen or a van.
- **Anything already fixed** — a tour, a birthday, someone joining for a day.
- **Who else needs the page**, which decides whether to set up sync at the end.

Also confirm the hard rules the hire terms impose. On the Tassie trip the
whole route exists because of one: no unsealed roads, since a breach voids the
liability cover. Find that rule early; it is a filter on everything researched
afterwards, not a footnote.

## 3 · Research, in parallel

Read `references/research.md` for the briefs, the source discipline and the
red-team pass. In outline: split the trip into six to ten independent
questions and give each to its own subagent in a single message so they run
together, then reconcile the answers against the bookings.

The reconciliation is the part that matters. Research says Salamanca Market is
Saturdays only; the bookings say the town day is a Wednesday; the plan says the
market is missed — and then notices the flight home is on a Saturday and gives
it back. No subagent can see that. You can.

## 4 · Write the page

Read `references/page-anatomy.md` — section by section, what each one is for,
the wiring that must be rewired per trip, and the writing voice.

Scaffold first, so the mechanical part is not done by hand:

```sh
.claude/skills/new-itinerary/scripts/scaffold.sh <trip-slug> "<Page title>" "<Short name>" <YYYY-MM-DD>
```

It copies the template folder, rewrites the per-trip constants it can
determine, and prints what is left for you. Then write the content.

Four things break silently if you skip them, so the scaffold does them and
`check.py` proves they were done:

- the folder name **is** the trip's API id, so it must match `[a-z0-9][a-z0-9-]{0,63}`;
- the `NS` prefix in the page's script must be unique, or two trips share one
  browser's storage and tick each other's boxes;
- the `VERSION` in `sw.js` must be unique, because caches are per-origin: a
  second trip using `tassie-v7` deletes the first trip's offline copy on activate;
- the countdown date, manifest, title and icons are all per-trip.

Icons:

```sh
node .claude/skills/new-itinerary/scripts/make-icons.mjs <trip-slug>/icon.svg <trip-slug>/icons '#0f3d2e'
```

Draw the SVG yourself — a flat mark on the trip's theme colour, strong
contrast, no text below about 40 px, and nothing meaningful in the outer tenth,
which Android crops away. The script writes the four PNGs the manifest and
Safari expect, including the padded maskable one.

## 5 · Prove it before you ship it

```sh
python3 .claude/skills/new-itinerary/scripts/check.py <trip-slug>
```

It checks the slug, the storage prefix, the cache name, the trip id, the
precache list, the manifest and its shortcuts, duplicate checklist and budget
keys, dead nav links, CDN references, booking references left over from the
template, and whether the root page links to the trip at all.

That is the wiring. It cannot catch a wrong drive time, so also:

- **Rebuild the stylesheet** whenever the markup changes. Tailwind only emits
  classes it can literally see in `index.html`:
  `cd <trip-slug>/build && npx tailwindcss@3.4.17 -c tailwind.config.js -i app.src.css -o tw.css --minify && cat fonts.css tw.css > ../app.css && rm tw.css`
- **Bump `VERSION` in `sw.js`** after changing any cached asset, or installed
  copies keep serving the old plan.
- **Look at it.** Open it at phone width — 390×844 — and read it as the
  traveller would, tapping through every day tab. A headless Chromium is
  usually at hand (`/opt/pw-browsers/` in the remote sandbox) and a screenshot
  per section catches what reading the source does not: a legs strip that
  overflows, a badge that wraps, a day panel left visible.
- **Walk every number back to its source.** Anything that cannot be walked
  back goes in *What couldn't be confirmed* — not quietly dropped, and never
  smoothed over. That section is the page's integrity, and travellers act on
  it: it is where "Street View this road before you leave" belongs.

## 6 · Ship it

Add a card for the trip to the root `index.html` — the trip list is
hand-maintained, and a folder nobody links to is invisible. Mark superseded
plans rather than deleting them.

Commit the folder and the root card together, open the pull request, and only
then offer sync: the page's own *Sync between phones* panel creates the trip on
the API and produces the join link. `references/page-anatomy.md` covers how the
page and the API meet; `server/README.md` is the API itself.

## Working on a page that already exists

Same references, none of the scaffolding. Two cautions:

- **Never renumber a checklist `data-k`.** Those keys are the sync keys; a
  renumber silently unticks boxes on every phone already holding the trip.
- Keep the diff legible. These pages are read by people, and a reflow that
  touches 2,000 lines to change a time hides the change that mattered.
