# Getting the bookings out of the inbox

Everything on a trip page that a traveller can be held to — a time, a
reference, a price, a bond — should come from a confirmation email, not from a
memory of the conversation. This is how to find them without drowning in
marketing, and the four ways it has gone wrong here before.

## The shape of the problem

A search for the operators involved in one eight-day trip returns about two
hundred threads for this account, and roughly ten of them are bookings. Airlines
and parks send far more marketing than confirmations, and the marketing quotes
the booking reference, so keyword matching alone will not separate them.

The separator that works is the sending domain. Confirmations come from the
bare domain or a transactional subdomain; campaigns come from a mailing
subdomain — `e.`, `news.`, `deals.`, `info.`, `eg.` — or from a feedback
vendor.

```
noreplyitineraries@jetstar.com     ← the itinerary
noreply@e.jetstar.com              ← "4 days to go, buy baggage"
```

Both say `UIIZ7L`. Only one is a booking.

## Search, in four passes

Run the passes in order and stop when the picture is complete. Dates below are
placeholders: `<booked-from>` is roughly when planning started, `<travel-end>`
the last day of the trip.

**1 — The categories Gmail already sorted.** Catches airlines, OTAs, restaurant
platforms and most large chains.

```
category:reservations after:<booked-from>
category:purchases after:<booked-from>
```

**2 — The window sweep.** Catches direct operators, which are usually the ones
Gmail did not categorise — small parks, regional depots, family-run cabins.

```
after:<booked-from> before:<travel-end> {confirmation reservation booking itinerary "booking reference" "confirmation number"}
```

**3 — By name, once you know who is involved.** The first two passes name the
operators; search each one directly, including their booking platform. Many
small parks send from their software rather than their own domain — NewBook
(`noreply@newbook.cloud`) and `book-directonline.com` both appear here.

**4 — By reference.** For every reference found, search the reference on its
own, across all mail:

```
UIIZ7L in:anywhere
```

This is the pass that finds the change notice, the cancellation and the reply
that moved a time. Do not skip it.

## Read threads, not messages

`search_threads` returns previews of only the oldest few messages in a thread,
and shows no marker when it has truncated. Open anything plausible with
`get_thread` and `messageFormat: PLAIN_TEXT`, and read the whole thing —
including the traveller's own sent replies, which carry the question that the
operator was answering.

## The four traps, each of which has happened here

**A decisive fact inside a thread with a misleading subject.** The single most
important line on the Tassie page — that the van may be returned any time up to
3 pm, against a booking that prints 9 am — is a reply from
`info@apollocamper.com.au` inside a thread titled *"Your Quote is Expiring
Soon"*. Nothing about that subject says booking. It was found by searching the
operator, then reading the thread to the end.

**A superseded booking that still looks live.** The March itinerary for this
trip was JQ703/JQ708. A change notice in April moved it, and the September
re-issue reads JQ701/JQ706. The old confirmation is still in the inbox, still
correct-looking, and still wrong. Sort by date and take the last one.

**A cancelled booking sitting beside the live one.** Two Jetstar Hotels
confirmations exist for these dates — `JQH4V2QKF`, later cancelled, and
`JQKZANYD3`, the one being used. The cancellation is a separate email with a
different subject. Search `<ref> cancel` for every reference before trusting it.

**Terms only in an attachment.** Vehicle hire terms, the liability wording and
the bond arrive as PDFs. Read them — the unsealed-road rule that shapes the
entire Tassie route lives there, not in the email body.

## Senders seen on this account

Verified from real mail in this inbox. Treat it as a starting point, not a
whitelist — new operators appear on every trip.

| Booking | Sends from |
|---|---|
| Jetstar flights, itinerary | `noreplyitineraries@jetstar.com` |
| Jetstar flights, confirmation | `noreply@jetstar.com` |
| Jetstar schedule changes | `no-reply@notifications.jetstar.com` |
| Jetstar Hotels | `jetstar.booking@hooroo.com` |
| Jetstar Hotels, support outcomes | `support@jetstarhotels.com`, `support@hooroo.com` |
| Virgin Australia | `no-reply@virginaustralia.com` |
| Apollo campervans | `info@apollocamper.com`, `info@apollocamper.com.au` |
| THL pre-arrival (Apollo's parent) | `info@e.experiencethl.com` — campaign-shaped, but carries the reference |
| Parks on NewBook | `noreply@newbook.cloud` |
| BIG4 | `no-reply@info.big4.com.au`, plus the park's own address |
| Direct-booking parks | `donotreply@book-directonline.com` |
| Car hire brokers | `drive@airportrentals.com` |
| Restaurants | `no-reply@opentable.com.au`, `*@message.sevenrooms.com`, `reserve-noreply@google.com` |

Marketing, on this account: `noreply@e.jetstar.com`, `noreply@info.jetstar.com`,
`findyourfreedom@tasmanholidayparks.com`, `qantasff@e.qantas.com`,
`deals@travel.flightcentre.com.au`, `mail@eg.expedia.com`,
`feedback@howwasjetstar.com`, `noreply@e.wikicamps.co`.

Note the pattern in the last two rows of each list: one booking can produce two
emails from two senders — the broker's and the operator's — carrying two
different reference numbers. Record both. At a counter, the operator's is the
one that works.

## What to record

For every booking, before moving on:

- **kind** — flight, vehicle, bed, ticket, table
- **provider**, and a phone number for the actual branch, not head office
- **every reference**, broker's and operator's
- **times and dates**, with the timezone, and what the operator's opening hours
  are around them
- **paid, or payable on arrival**, and how much of each
- **the bond and the excess** — and whether the bond is held or genuinely
  debited, because a $7,500 debit is a different fact from a $7,500 hold
- **the constraints** — unsealed roads, vehicle height and length, check-in
  cut-offs, cancellation terms, what voids the cover
- **the source** — sender and date, so the page can cite it

Constraints deserve special care: they are what the plan has to be built
around, and they are the least likely thing to be re-read later. A 3.10 m
vehicle height belongs on the page, near the fuel stop, not in a notes file.

## Two adjacent sources, when connected

Google Calendar often holds the fixed points that never generated an email — a
tour someone else booked, a dinner, a friend's flight. Worth a look across the
travel window.

Google Drive is worth a search when a traveller mentions a document rather than
an email: scanned permits, a shared plan, a parking receipt with the rate on it.
