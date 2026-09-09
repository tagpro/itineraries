# Researching a trip in parallel

The bookings give the skeleton: where you sleep, what you drive, when you fly.
Research gives everything between those points, and it is the part of the page a
traveller cannot easily check before they are standing in it. So it is worth
doing wide, doing it at once, and then attacking your own answers.

## Fan out, then reconcile

Split the trip into six to ten questions that do not depend on each other, and
send them all in **one message** so the subagents run concurrently. Sequential
research on a week-long trip takes an afternoon and produces the same answers.

What does not parallelise is the reconciliation afterwards. Subagents come back
with facts about places; only you know the shape of the week they have to fit
into. The Tassie page has three moments that no single researcher could have
produced:

- the market is Saturdays only, the van day in town is a Wednesday, *and* the
  flight home is a Saturday — so it is lost and then given back;
- the two routes north differ by 15 km, so the inland one goes up and the coast
  one comes back, and the coast is driven southbound because that is the
  direction you face the mountains;
- the boulders face east, so one night buys both a sunset and a sunrise.

Look for those. They are what makes a plan rather than a list.

## The briefs

Adjust to the trip — a city week needs neighbourhoods and opening hours where a
drive needs road surfaces — but this spread has covered a road trip well.

**1 · The legs.** Every drive between booked beds: distance, realistic time
including the terrain, road numbers, and the surface if the hire terms care.
Steep or narrow sections, seasonal closures, current roadworks, and whether the
route suits the actual vehicle — a 5.94 m van is refused on roads a car takes.
Ask for a named alternative for any leg that could close.

**2 · Walks and activities.** Distance, elevation, official grade, time, rating
and how many people rated it, plus what the trailhead access road is. The
`AllTrails` connector, when present, gives grades and review counts directly;
otherwise use the parks authority for grade and a review site for the reality.
Flag anything that depends on weather — wet rock, tides, snow — because those
decide which day it lands on.

**3 · The stops.** For each town on the route: what is genuinely worth 40
minutes, and the practical layer — supermarket, fuel, public toilets, water,
dump point, parking a large vehicle. **Opening hours by weekday**, checked
against the day the trip actually arrives. Half the disappointments in travel
are a Tuesday closure.

**4 · What costs money.** Park passes, entry tickets, permits, and which one
covers what. This repays being pedantic: the Tassie trip needed two park passes
rather than one because Friday enters a second national park in a different
vehicle, and the cheapest-looking option covered one vehicle when two were used.
Ask for the combinations, with what each actually includes.

**5 · The vehicle and the beds.** Height and length limits, powered sites,
heating and what it runs on, dump points and potable water, check-in and
reception closing times, whether the site fits the vehicle.

**6 · Season, weather and light.** Sunrise and sunset for the real dates,
typical conditions, what the season closes or opens, and what to pack for the
nights rather than the days.

**7 · Money on the ground.** Fuel price per litre on that route now, groceries,
a meal out, parking rates. Ask for the date of every price — a two-year-old
figure is worse than an honest range.

**8 · Plan B.** For each headline activity, the wet-weather or closed-road
alternative reachable from the same bed, and what it costs to swap.

## What every brief must demand

Put these in each subagent's instructions, not just in your own head:

- **A named source and its date for every claim.** "About three hours" with no
  source is a guess wearing a number's clothes.
- **Distinguish measured from inferred.** A drive time from a routing service is
  measured; the same time plus "allow for stops" is inferred. Say which.
- **Return an explicit "could not confirm" list.** This is the most useful thing
  a researcher gives you, and subagents suppress it unless asked. It becomes the
  page's last section, and it is what stops the page lying by omission.
- **Report closures and contradictions rather than resolving them.** When two
  sources disagree about whether a road is sealed, the page says so and tells
  the traveller to look at Street View. That is a better answer than picking one.

## The red-team pass

When the draft plan exists, run one more subagent whose only job is to attack it:

- Does each day actually fit? Add the drive times, the stops and the walk, start
  from the real departure time, and see where it lands. The Tassie Saturday was
  rewritten twice this way.
- Check every opening hour against the **weekday the trip arrives**, not the
  weekday the source assumed.
- Find claims with no source behind them.
- Find the single point of failure — the one closure, sell-out or weather that
  breaks the week — and check the plan says what to do about it.

Fix what it finds, and put what cannot be fixed on the page.

## Connectors worth using when present

`AllTrails` for walk grades, distances and ratings. `Booking.com` and `Trivago`
for accommodation still to be booked and for attraction opening hours. `Expedia`
for flights and hotels. `Google Calendar` for fixed points that never generated
an email. None are guaranteed to be connected — check what this session has and
fall back to web search rather than assuming.

## Honesty, concretely

The failure mode for a page like this is not being wrong. It is being smooth: a
plausible time, a rounded price, a walk described from its photographs. A
traveller cannot tell smooth from verified, which is exactly why the page must.

Three habits carry it:

- Give a range when the truth is a range, and say what it depends on.
- Name the source in the text where it is load-bearing — "Parks Tasmania grades
  this 4", "Apollo, by email on 24 Aug".
- Write down what you could not settle, in the traveller's own terms, with the
  action that would settle it. "I couldn't confirm this road is sealed; drop a
  Street View pin on it before you leave" is worth more than either silence or
  a confident guess.
