### Decided by the wake-never-silent builder, 2026-10-12, lightly held (nothing in the wake is dropped without a word)

- Decided by the wake-never-silent builder, 2026-10-12, lightly held: each lane's count line ("N more
  …", or the collapsed line of a lane that lists nothing) is RESERVED inside the trim loop, not added
  last if room is left. The loop composes with the line of every lane that has lost something so far
  and pops items until items and lines fit together. Each rescue (`takeRoom`) keeps those lines, and a
  later Arriving line is listed only with its lane's count. Why: Mike's principle of 2026-10-12, the
  minimal version he chose via RANDOM. The cost: a wake at its edge lists an item or two fewer, to pay
  for the line that says they are there.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: when not even the lanes' own lines
  fit, they fold into ONE line, "More than this wake lists: N arriving, N still open, …; recall ids (the
  first 5): …", ids from the highest-ranked lane first (Arriving, Still open, Who I am, craft, Nearby).
  It sits under "Who I am". It folds before the loop pops "Who I am", and when even the fold has no room
  it takes room the way a dated line does (`takeRoom` to `arrivingFirst`: Work here, the Yesterday
  line's titles, the handoffs' room, Today elsewhere, Arriving past its head). Only past that are ids
  left unsaid (`untold`). Why: one line always costs less than several, and it keeps the table of
  contents when the lanes' own lines cannot.
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
  which random-f2's item 5 already ruled out. A session start carries the popped hints
  (`WAKE_SHOWN_KEY`'s new `more.hints`, read as empty on an older record) and lists or counts them in its
  own room.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: a due-day plain reminder stays the
  one exception (#442/#445). It is listed in full even when its lane's count then has no room; the
  render tries the fold first, and only then leaves the rest untold, with trim rows as before.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: doctor's Wake line counts
  step-downs (`self.briefing`'s new `counted`; data `steppedDown`, no clause, never amber) apart from
  silent drops (`untold`, red: "worth reporting"). The dated-item amber of 2026-10-10 stays, reworded to
  "counted, not listed, for want of room": it is still a room problem with a remedy (the page's short
  version, or a larger ceiling). A session start writes no `self.briefing` row, so its counts ride the
  ring event `counterpart.wake.assembled` only.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: `prospective.horizon()` emits one
  ring event, `prospective.horizon.excluded`, with counts and ids for each reason an arrival left the
  lane (`notDay`, `daily`, `told`), only when one did.
- Decided by the wake-never-silent builder, 2026-10-12, lightly held: the lanes' counts rank above the
  delivery's "Last here" line, as every lane does in `ROOM_ORDER`. Measured in `last-exchange.test.ts`: a
  6.5 KB page, four handoffs and eight hints the trim popped — the "Nearby: 8" line (dropped without a word
  before) now takes the room "Last here" had, and "Last here" leaves its no-room row instead. The handoffs
  stay. Why: a lane the wake chose outranks the pointer to the last chapter here; both are pointers, and
  this one says what this wake chose. Worth Mike's look.
- Measured, named, for Mike's look: the fold is not only a last resort. In the owner-shaped morning
  (`wake-dated-first.test.ts` section 6: a 6,767-byte page, four handoffs, seven dated items, 25 open,
  Nearby) the session-start wake now folds: "Arriving:" and "Still open" keep their listed items, and
  their "+5" and "+24" move into one line under "Who I am" with Nearby's 5, which had been dropped without
  a word. Its five ids are Arriving's; Still open's and Nearby's are not named there. The fuller rung
  (fold only the lanes that list nothing, keep the count under a lane that lists items, ids from each
  lane) is the natural next step if this reads badly.
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
