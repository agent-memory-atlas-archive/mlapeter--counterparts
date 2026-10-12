### Decided by the wake-never-silent builder, 2026-10-12, lightly held (nothing in the wake is dropped without a word)

- Decided by the wake-never-silent builder, 2026-10-12, lightly held: each lane's count line ("N more
  …", or the collapsed line of a lane that lists nothing) is RESERVED inside the trim loop, not added
  last if room is left. The loop composes with the line of every lane that has lost something so far
  and pops items until items and lines fit together. Each rescue (`takeRoom`) keeps those lines, and a
  later Arriving line is listed only with its lane's count. Why: Mike's principle of 2026-10-12, the
  minimal version he chose via RANDOM. The cost: a wake at its edge lists an item or two fewer, to pay
  for the line that says they are there.
- Decided by COUNTERPARTS, 2026-10-12, lightly held (the follow-up on this PR), as built: a lane that
  still lists an item keeps its own "N more" line directly under it, and only the lanes that list
  NOTHING fold into ONE line under "Who I am": "More than this wake lists: 3 still open (recall ids:
  mem_…, mem_…, mem_…, and 7 more); 5 nearby (recall ids: …)". Each folded lane carries its own first
  three ids (`FOLD_LINE_IDS`), which the recall tool opens (`wake-more.test.ts`); no name handle like
  "recall 'nearby'" exists today, so ids it is. "Who I am" never folds. The lanes that list nothing fold
  before the loop pops "Who I am", and when even the fold has no room it takes room the way a dated line
  does (`takeRoom` to `arrivingFirst`: Work here, the Yesterday line's titles, the handoffs' room, Today
  elsewhere, Arriving past its head). Only past that are ids left unsaid (`untold`). Why: an item under
  a heading with no count reads as the only one; the first version folded every count and moved
  Arriving's "+5" and Still open's "+24" away from their lanes in the owner's own morning.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: the page does NOT give up room to
  the folded line. I tried keeping the fold's bytes out of the page's room (as the brief's sizing
  suggested); it stepped pages in their own room down a rung in ten pinned tests and contradicts
  `ROOM_ORDER`, where the page in its own room outranks everything. The fold-then-borrow path covered
  every real-shaped case measured, so the reserve was left out. A page that fills every byte with no
  lent room left still leaves the lanes untold, and doctor says so in red.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: "Nearby" counts what its trim
  popped (at most `HINTS_MAX` hints the wake chose), with ids, in the same "N more nearby" and collapsed
  lines; its cap's overflow (the rest of the warm store) is still not counted. Why: the popped hints are
  a bounded list the wake chose, so the count means something; the cap's count is the store's size,
  which random-f2's item 5 already ruled out.
- Decided by COUNTERPARTS, 2026-10-12, lightly held, as built: "Nearby"'s count is NOT reserved. The
  least of the lanes, it takes only room nothing else wants (`tellLost`): its own line if that fits, else
  a place in the folded line, else it is left out and recorded as `quiet` — a step-down (`self.briefing`'s
  `quiet`, doctor's `steppedDown`), never a silent drop. So it never costs another lane an item, nor
  "Last here" its room (the first version did: `last-exchange.test.ts` is back as it was). A session start carries the popped hints
  (`WAKE_SHOWN_KEY`'s new `more.hints`, read as empty on an older record) and lists or counts them in its
  own room.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: a due-day plain reminder stays the
  one exception (#442/#445). It is listed in full even when its lane's count then has no room; the
  render tries the fold first, then the counts the rescue itself composed with, and only then leaves
  Arriving's rest untold, with trim rows as before. Measured in the invariant sweep: only below about
  1,200 bytes with no lent room, and only Arriving.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: doctor's Wake line counts
  step-downs (`self.briefing`'s new `counted`; data `steppedDown`, no clause, never amber) apart from
  silent drops (`untold`, red: "worth reporting"). The dated-item amber of 2026-10-10 stays, reworded to
  "counted, not listed, for want of room": it is still a room problem with a remedy (the page's short
  version, or a larger ceiling). A session start writes no `self.briefing` row, so its counts ride the
  ring event `counterpart.wake.assembled` only.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: `prospective.horizon()` emits one
  ring event, `prospective.horizon.excluded`, with counts and ids for each reason an arrival left the
  lane (`notDay`, `daily`, `told`), only when one did.
- Measured, the owner-shaped morning (`wake-dated-first.test.ts` section 6: a 6,767-byte page, four
  handoffs, seven dated items, 25 open, six personal facts, at 9,000 through the session start): it
  prints exactly what master printed — Arriving 2 and its own "+5", Still open 1 and its own "+24", three
  handoffs and "+1 older", the page whole, 8,997 bytes — and the five hints the turn-end chose and the
  session start had no room for are now recorded as `quiet` instead of vanishing from every record.
- Named, a weakened guarantee: "a smaller budget yields a subset" (self NOTES section 9 names its
  exceptions) has a new one at the fold's boundary. A synthetic sweep (12 identity, 8 each of craft,
  threads and hints) re-admitted "Still open"'s first item at 1,200 bytes that 1,600 had left out: the
  folded line is shorter than the lanes' own, and the rescue spends the difference. `self.test.ts`'s
  subset sweep still passes (its fixture does not cross that boundary). Folding before the loop pops
  "Who I am" removed the case that sweep did hit.
- Named, a cleanup left for later: `keepArrivingCount` is reachable only when Arriving's count was not
  reserved, which no longer happens (the trim loop pins it whenever the lane lost something). Left in
  place as a guard.
- Not done, named: the delivery's own lines ("Last here", "Last said here", "Work here", "Today,
  elsewhere" at its last step) and the Yesterday line when not even its pointers fit still drop with
  only a durable row or a ring event, as before. Their rungs already exist; reserving them is the fuller
  version, for later if doctor's counts show sessions need it.
