# Getting the bookings out of the inbox

Anything on a trip page a traveller can be held to — a time, a reference, a
price, a bond — should come from a confirmation email, not from a memory of the
conversation. This is how to find them without drowning in marketing.

## The separator that works

A search for one trip's operators returns a couple of hundred threads and
roughly ten are bookings. Keyword matching will not narrow it, because the
marketing quotes the booking reference too:

```
noreplyitineraries@jetstar.com     ← the itinerary
noreply@e.jetstar.com              ← "4 days to go, buy baggage"
```

Both carry the same booking reference. What separates them is the sending
domain: confirmations come from the bare domain or a transactional subdomain,
campaigns from a mailing subdomain — `e.`, `news.`, `deals.`, `info.`, `eg.` —
or from a feedback vendor. Sort by that first and most of the noise goes.

Small operators often send from their booking platform rather than their own
domain, so the sender may name software you do not recognise —
`newbook.cloud`, `book-directonline.com`, `hooroo.com` are all real booking
mail. Judge those by content, not by the name.

## Search, in four passes

Run them in order and stop when the picture is complete. `<booked-from>` is
roughly when planning started, `<travel-end>` the last day of the trip.

**1 — What Gmail already sorted.** Catches airlines, OTAs, restaurant platforms
and most chains.

```
category:reservations after:<booked-from>
category:purchases after:<booked-from>
```

**2 — The window sweep.** Catches the direct operators Gmail did not
categorise — small parks, regional depots, family-run cabins.

```
after:<booked-from> before:<travel-end> {confirmation reservation booking itinerary "booking reference" "confirmation number"}
```

**3 — By name.** The first two passes tell you who is involved; search each
operator directly.

**4 — By reference.** For every reference found, search it on its own across
all mail:

```
<reference> in:anywhere
```

This is the pass that finds the change notice, the cancellation and the reply
that moved a time. Do not skip it.

## Read threads, not messages

`search_threads` returns previews of only the oldest few messages in a thread
and shows no marker when it has truncated. Open anything plausible with
`get_thread` and `messageFormat: PLAIN_TEXT`, and read the whole thing —
including the traveller's own sent replies, which carry the question the
operator was answering.

## The four traps, each of which has happened here

**A decisive fact in a thread with a misleading subject.** The most important
line on the Tassie page — that the van may be returned any time up to 3 pm,
against a booking that prints 9 am — is a reply from the depot inside a thread
titled *"Your Quote is Expiring Soon"*. Nothing about that subject says
booking. It was found by searching the operator and reading to the end.

**A superseded booking that still looks live.** The first itinerary for that
trip carried different flight numbers; a change notice months later moved them,
and the original confirmation is still in the inbox, still correct-looking,
still wrong. Sort by date and take the last one.

**A cancelled booking beside the live one.** Two hotel confirmations existed
for the same nights, one of them later cancelled — and the cancellation is a
separate email with a different subject. Search `<reference> cancel` for every
reference before trusting it.

**Terms only in an attachment.** Vehicle hire terms, liability wording and the
bond arrive as PDFs. Read them: the unsealed-road rule that shapes the entire
Tassie route lives there, not in the email body.

## What to record

Enough that the page can cite it, plus the two things that are easy to get
wrong:

- **Whether a bond is held or actually debited.** A $7,500 hold and a $7,500
  debit are different facts about someone's credit limit for a fortnight.
- **The constraints** — unsealed roads, vehicle height and length, check-in
  cut-offs, what voids the cover. These are what the plan is built around and
  the least likely thing to be re-read later, so they belong on the page next
  to where they bite: the height near the fuel stop, not in a notes file.

One booking often produces two emails from two senders — the broker's and the
operator's — carrying two different reference numbers. Record both; at a
counter, the operator's is the one that works.

Google Calendar is worth a look across the travel window for fixed points that
never generated an email: a tour someone else booked, a dinner, a friend's
flight.
