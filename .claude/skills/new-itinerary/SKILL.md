---
name: new-itinerary
description: Plan a trip and build its page in this repository — the installable, offline, checklist-carrying itinerary that tassie-campervan-2026 is the model for. Pulls the real bookings out of Gmail, asks what the bookings cannot say, researches routes, walks and opening hours, then writes the day-by-day plan. Use it for any request to plan, research or schedule a trip here, however it is phrased: "plan our Japan trip", "what should we actually do with 4 days on the Great Ocean Road", "put together a proper plan like the tassie one", "turn these bookings into a day by day", "we're taking mum in November and she can't do stairs", "build me the itinerary page", "add a new trip folder" — the words "itinerary" and "page" need never appear. Also for reworking an existing plan wholesale. Not for a single factual question about a place, a small edit to a page that already exists, or debugging the site or its sync API.
---

# Building a trip page

The output is one folder — `<trip-slug>/` — holding a page that a traveller
installs on their phone and opens in a valley with no signal.
`tassie-campervan-2026/` is the reference build; read it before writing
anything, because copying its *shape* is easy and copying its *judgement* is
the actual work.

What makes that page good is not the layout. Every number in it came from
somewhere, the things that could ruin a day are called out in amber before they
happen, and the last section admits what could not be confirmed. A page that
looks the same but invents its drive times is worse than no page, because it
will be trusted at 4 pm on a mountain road.

`CLAUDE.md` has the repository's conventions — the wiring that breaks silently,
the stylesheet rebuild, the writing voice. This file is the method.

## The order of work, and why

Bookings first, questions second, research third. The bookings are the only
fixed points — flights land when they land, a depot shuts when it shuts — and
they silently answer half the questions you would otherwise ask. Research done
before you know the shape of the week produces a list of attractions instead of
a plan.

## 1 · Read the bookings

Read `references/booking-emails.md` — the search passes, and the four traps
that have actually bitten here (a superseded flight number, a cancelled hotel,
a decisive fact buried in a reply, terms only in a PDF).

Work through it until you can write down, for every leg: what is booked, under
which reference, paid or payable, at what time, with which constraints and
which phone number. Keep the message date beside each fact — the page says
things like *"Apollo confirmed it in writing on 24 Aug"*, and it can only say
that because the record kept the date.

Two rules earn their place:

- **The latest email wins.** Airlines re-issue itineraries and hotels get
  moved. Once you have a reference, search that reference on its own and read
  every hit in date order.
- **When an email contradicts the printed booking, the email is the news.**
  Say so on the page, quote it, and tell the traveller to keep it on their
  phone. That single line is the most valuable thing on the Tassie page.

If Gmail is not connected, say so and ask for the confirmations to be pasted.
Do not guess a booking.

If **nothing is booked yet**, the order flips: ask first, research, then propose
the shape of the week with real options and prices. Build the page anyway — it
is a better brief than a chat — but mark every bed and vehicle as unbooked, and
put what to book, in what order, at the top of *Read this first*.

## 2 · Ask what the bookings cannot say

Now interview, in two rounds at most — this is a holiday, not an onboarding
form. Skip anything a booking already answered; being asked your own flight
time is how a plan loses trust.

- **Who is going, and what will they walk.** Ask for the hardest thing they
  would enjoy, not their fitness. A grade 4 scramble and a boardwalk are
  different holidays.
- **The one thing they would be sad to miss.** Everything else is negotiable
  and this is not; it decides which day gets the good weather.
- **Hours in the car per day before it stops being fun.** Three is a drive,
  five is a transit day, and the page should say which it is.
- **Early starts — yes or never.** Sunrises, tides and dry rock all depend on
  it, and a plan built on 5:45 alarms for people who won't wake is fiction.
- **Money posture.** Counting every dollar, or paying for the good thing and
  not thinking about it. That changes recommendations, not just the budget.

Also find the hard rules the hire terms impose. On the Tassie trip the whole
route exists because of one: no unsealed roads, since a breach voids the
liability cover. Find that rule early — it filters everything researched
afterwards.

## 3 · Research

Read `references/research.md` for what each brief must demand and the questions
worth asking. Four or five parallel subagents covers a road trip — legs and
stops, walks, the paid things, beds and vehicle, weather and light. Send them in
one message so they run together.

Then reconcile against the bookings yourself, because that is the part no
subagent can do. Research says Salamanca Market is Saturdays only; the bookings
say the town day is a Wednesday; the plan says the market is missed — and then
notices the flight home is on a Saturday and gives it back.

## 4 · Write the page

`references/page-anatomy.md` has the section-by-section build and the wiring.
Scaffold first, so the mechanical part is not done by hand:

```sh
.claude/skills/new-itinerary/scripts/scaffold.sh <trip-slug> "<Page title>" "<Short name>" <YYYY-MM-DD>
node .claude/skills/new-itinerary/scripts/make-icons.mjs <trip-slug>/icon.svg <trip-slug>/icons '#0f3d2e'
```

The scaffold copies the reference build — content and all — and rewrites the
per-trip constants. Replace the Tasmania content rather than editing around it.
Draw `icon.svg` yourself; the script's header says what makes a good one.

## 5 · Prove it before you ship it

```sh
python3 .claude/skills/new-itinerary/scripts/check.py <trip-slug>
```

It reports what it finds. That is the wiring; it cannot catch a wrong drive
time, so also:

- **Rebuild the stylesheet** after any markup change and bump `VERSION` in
  `sw.js` — `<trip-slug>/build/README.md` has both commands and the reason.
- **Look at it** at phone width, tapping through every day tab. If a headless
  browser is available, a screenshot per section catches what reading the
  source does not: a legs strip that overflows, a badge that wraps, a day panel
  left visible.
- **Walk every number back to its source.** Anything that cannot be walked back
  goes in *What couldn't be confirmed*, with the action that would settle it —
  never quietly dropped, never smoothed over.

## 6 · Ship it

Add a card for the trip to the root `index.html`; a folder nobody links to is
invisible. Mark superseded plans rather than deleting them. Commit the folder
and the root card together, open the pull request, and only then offer sync —
the page's own *Sync between phones* panel creates the trip and produces the
join link.

## Changing a page that already exists

Same references, none of the scaffolding, and two cautions. **Never renumber a
checklist `data-k`**: those are the sync keys, and a renumber silently unticks
boxes on every phone already holding the trip. And keep the diff legible — a
reflow that touches 2,000 lines to change a time hides the change that mattered.
