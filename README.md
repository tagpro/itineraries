# Itineraries

Trip plans, one page per trip, at **[travel.jaspreet.casa](https://travel.jaspreet.casa)**.

Each trip is a folder with its own `index.html`. Open one on a phone and it can
be installed to the home screen; once installed it works with no signal at all —
the route, the walks, the beds, the budget and the checklists are all there
offline. Ticks and the items you add stay on the phone, and can sync between
phones over a small API if you want them to.

| | |
|---|---|
| [`tassie-campervan-2026/`](tassie-campervan-2026/) | Tasmania, 12–19 Sep 2026 — a campervan up the east coast, then Hobart. The current plan, and the reference build for everything else |
| [`tasmania-exploration-2026/`](tasmania-exploration-2026/) | An earlier plan for the same dates, before the van was booked |
| [`tassie-2026/`](tassie-2026/) | An earlier two-base version, with a filterable trail explorer |
| [`server/`](server/) | The checklist sync API — Go on Cloudflare Workers and D1. See its [README](server/README.md) |

## How it is served

GitHub Pages publishes `main` from the root, so merging a change puts it live.
`CNAME` points the site at `travel.jaspreet.casa`, whose DNS record is proxied
through Cloudflare — which is also what lets one Worker answer `/api/v1` on the
same hostname.

## Adding a trip

The pages are written by hand, from real booking confirmations and real
research, using the [`new-itinerary`](.claude/skills/new-itinerary/) skill.
[`CLAUDE.md`](CLAUDE.md) has the conventions, the build steps and the handful of
things that break quietly if you skip them.

Briefly: scaffold the folder from the reference build, write it, then

```sh
python3 .claude/skills/new-itinerary/scripts/check.py <trip-slug>
```

before committing, and add a card for it to the root `index.html`.
