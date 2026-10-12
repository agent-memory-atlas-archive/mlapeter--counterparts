### Decided by the Group 2b builder, 2026-10-11, lightly held (one door for "A over B", item 12)

- Decided by the Group 2b builder, 2026-10-11, lightly held: one function,
  `reconsolidation.ts#supersede`, writes every "A over B" — a settle, a write's `updates`, a
  slot confirmed, a dream merge (source `dream-merge`), the core's pressure crossing
  (`pressure`), a fulfilled plan (`fulfilled`), a moved reminder (`reminder-moved`); Group 3's
  folds call it with source `fold` (factor ×0.5 is already its default). `settle` keeps the
  guards and goes through it. Why: review 10 counted seven paths with three effects; one door
  gives one record (pair, trail, event with its source) and one undo.
- Decided by random-06, 2026-10-11, lightly held (replacing the builder's "replaces" axis): no
  effect axis besides `how` — a "replaces" was a fourth relation in disguise. A dream MERGE is
  a real `changed`: each original fades ×0.5 (the existing changed fade), STAYS LIVE and is
  labelled earlier under the merged memory; head-wins hides it in ambient recall and facts mode
  folds it under the head; its own curve archives it at the floor, the ordinary way. The
  PRESSURE CROSSING is the same (changed, fade, live, labelled), and the FULFILLED lane is
  `changed` plus the core path (the plan leaves the core in one step), not an archive. Merges
  are not `corrected` (the originals were not wrong). Cost accepted: more live near-copies for
  a couple of weeks, hidden from ambient. Old merges (archived originals from before this
  build) stay as they are, with no backfill, and undo the old way.
- Decided by the #427 reviewer, 2026-10-11, lightly held (following random-06's ruling): a core
  memory a change reaches through the door — only the core path's doors get there, since
  `settle` refuses the core — LEAVES THE CORE in the settle's own transaction: the promotion
  flag off, its fading restarted today (as the owner's demotion restarts it), the band column
  set from its physics; then the ×0.5 cut lands (a core memory has nothing to cut otherwise).
  The trail keeps its band, band day, last use and flag, so an undo puts it back exactly, and
  the `contradiction.settled` event says `leftCore`. No `core_events` "demoted" row and no
  `band.demoted` event: those are the owner's demotion, sticky against re-promotion, and
  `fired.ts` reads `band.demoted` as the owner's door.
- Decided by the #427 reviewer, 2026-10-11, lightly held: a merge carries what
  `supersedeInto` used to — each original's returns, and its about mark and writer's fields
  where the merged memory has none (`Store#carryInto`) — and its links
  (`retargetOnSupersede`, already a copy) onto the merged memory, which is still at least as
  durable and connected as what it was made from; the originals keep their own. An original that already has a head is refused
  (`earlier-is-not-merged`: merge the one that holds), so a live earlier version is not merged
  into a copy of a copy. A merge's door row writes no "how does it sit now" invitation (its
  feelings travelled to the merged memory), nor does a moved reminder's.
- Decided by the Group 2b builder, 2026-10-11, lightly held (unchanged by the ruling, simpler
  now): the owner may undo one original's pair of a merge (`counterparts settle --undo`); that
  original's strength comes back and it stands beside the merged memory, which keeps standing
  for the rest. The dream's own undo undoes every original's pair and archives the merged
  memory, as before.
- Decided by the Group 2b builder, 2026-10-11, lightly held (confirmed by random-06): a settle
  over a memory with a reminder still to come CARRIES the reminder to the holder (date, plain
  or quiet, how often; `reminderMovedTo` / `reminderFrom`), and its undo carries it back; it
  refuses only when the holder has a date of its own (the owner's settle goes through as
  before). A holder whose status is `done` SPENDS it. Why: the brief's "the door calls
  carryReminder"; a `done` memory firing on the old date would be wrong.
- Decided by the #427 reviewer, 2026-10-11, lightly held: "spent" removes the date from the
  earlier memory (`reminderSpentBy` names the `done` holder; the date stays in its version
  row; an undo puts it back). Why: `prospective/` skips only a forwarded row, so a live
  settled-over memory keeps firing on its date — with the archive gone, a fulfilled dated plan
  would have reminded on a trip already made. The same for a WRITE: a `done` write that
  `updates` a dated memory and sends no date no longer inherits the date (it used to, and fired
  on it); and the fast lane counts a date that very write just took off the plan, which the
  deposit moves before the revision runs (otherwise a dated core plan with no status never took
  the fast lane).
- Decided by the Group 2b builder, 2026-10-11, lightly held: a moved reminder's old memory gets
  its row AFTER the write's declared revision, and only when the two are not already a pair.
  Why: written first, it would make the writer's own settle refuse `already-settled` and lose
  its `how` and words. The older remnants get theirs once, at open, latched in meta
  (`reconsolidation.remindersMoved`) like the regrown-links pass, not in a sleep phase: a move
  writes its own row from now on, so the pass never has new work. On the 10-11 copy, 9 live
  remnants: 7 already had the writer's pair; 2 (both at fade 1.0) got one.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review 10 C4): an AUTHORED
  `changed` or `corrected` at a core memory credits force `max(raw, F_DAY_CAP_SLOW)`; a slow
  kind is still capped at 0.35, so the three-lived-day property is unchanged; a swept
  declaration keeps its own force. `corrected` is included beside the brief's `changed`: it
  is the stronger declaration.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review 10 C4; the effect revised by
  random-06's ruling above): the fast lane is read off the rows' own fields — the core memory
  has a status other than `done` or a date, and the memory updating it has status `done` —
  and the `done` memory holds over it `changed` (source `fulfilled`): the plan leaves the core,
  fades and is labelled earlier; no successor minted, no pressure; the `done` memory stays as
  it was, not core. Held as the brief wrote it: the real Han pair's core memory has no status
  and no date, so it stays on the slow path (three lived days of declared changes). Not
  widened to read the words. "Such items don't enter the core at all" is Group 3's.
- Decided by the #427 reviewer, 2026-10-11, lightly held: at a CORE memory the update guard no
  longer lets a status change ("planned", now "done") or a redate through unread. Why: the fast
  lane takes a core plan out of the core on one write, so an unrelated write that named the id
  with status `done` was enough; a plan and its "done" share their subject, so the real case
  still reads related (the Han-shaped test).
- Decided by the Group 2b builder, 2026-10-11, lightly held (the effect revised by random-06's
  ruling above): the pressure crossing mints its successor with `put` (the challenger's words,
  the core band, source `accommodation`, as before) and settles `changed` over the old memory
  through the door (pair source `pressure`, the pressure pair closed through it); the old one
  leaves the core, fades, stays live and is labelled earlier, and its links are copied to the
  successor. Undoing the crossing puts the old memory back in the core at full strength,
  withdraws the crossing's pair (the pressure pair it closed reopens) and archives the minted
  successor `pressure-undone`. Decided by the #427 reviewer, 2026-10-11, lightly held: that
  archive stays though the crossing archives nothing now — with the old memory back in the
  core, the successor (a core copy of the words weighed against it) would stand beside it as a
  second core memory. The old memory's accumulated pressure is left as it was.
- Decided by the Group 2b builder, 2026-10-11, lightly held: the schema belief and
  current-state arms (path 4) have no live producer — only `tools/demo/seed.ts` and tests
  reach `addBelief` / `addCurrentState` — and are left as they were, neither deleted nor
  routed. Why: routing a path nothing reaches needs a record-only mode for an
  already-superseded memory; deleting it takes schemas' contract, the demo and about ten test
  files, its own lane. Chapters' `episode-regrown` (path 6) stays out: it is one chapter's
  copy re-rendered, not one memory over another. Legacy link-only rows (path 7): 33 on the
  copy, 3 from day 9 and none since; not backfilled. Link-only is still produced by refusal
  fallbacks (a protected or entity target, a thread this session may not close, the crash
  sweep), each with its reason.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review 10 C6): two honest cards,
  not one "Updating" card. Interference counts the detected doors (dream merges, dream flags,
  slot proposals, confirmed slots); Reconsolidation counts declared settles and pressure; a
  merge's rows count once, as the merge. Why: smaller than renaming a mechanism across the
  dashboard, the console, the sidebar copy and the "N of 11" count. Settles from before this
  build carry no source and count as declared. Every `contradiction.settled` event now says
  its `source`, and a write's says `howSent` (true: the writer sent `how`; false: defaulted
  to `changed`). Not in `gate.deposit`, whose field list is pinned.
- Decided by the Group 2b builder, 2026-10-11, lightly held: a `corrected` settle hands the
  old memory's links to the holder (`Associate.retargetOnSupersede`, injected, or the door's
  own when a caller has none) and its undo carries them back; `corrected` joins
  `TERMINAL_ARCHIVE_REASONS`. Settles from before were carried once at open
  (`associate.corrected.relink`, 10 on the copy), and the sweep leaves `corrected` and
  `episode-regrown` alone until their one-time pass has latched (review of #423).
- Decided by the Group 2b builder, 2026-10-11, lightly held (review of #420 (a)): settles are
  ordered by when they were RAISED (`flagged_day`, then the moment made), not when answered,
  in `headOf` and the wake's `settledOver` alike; and a settle over B no longer closes a slot
  proposal in which B is the newer — the question "B is the newer state of A" stays for the
  dream. Why: closing it lifted A's cut and stood A back up as current; with raised order a
  late confirmation cannot re-affirm B over a newer settle.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review of #420 (b)): a proposal
  whose newer memory was replaced with a forwarding address is carried to what replaced it —
  withdrawn and proposed again between that one and the older, the cut the same — before the
  dream reads; one whose memory is simply gone is withdrawn as before. The carried proposal
  writes no second `contradiction.proposed` event (its trail row names the pair it came from),
  so Interference counts the question once. Noted by the #427 reviewer: since random-06's
  ruling no door forwards a memory, so this is for rows replaced the old way; a proposal whose
  newer memory is merged through the door simply stays open (both still stand), and once the
  dream confirms it the chain reads older → newer → merged.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review of #420 (d)): with
  dreaming set to `off`, and only then, a proposal unanswered for 14 lived days
  (`SLOT_EXPIRY_DAYS`) is withdrawn and its cut put back, checked once a lived day at a write.
  Why: random-06's "no silent expiry while a dream can answer"; a cap on waiting proposals
  would stop the detector at the cap instead.
- Decided by the Group 2b builder, 2026-10-11, lightly held (review of #420 (c), (e)): a
  meaning-mode answer marks an earlier moment `earlier (now [id])` ("a later version" when the
  asker may not be shown it); a slot proposal's event says `bandDrop` when its provisional cut
  moves the older from semantic to episodic.
- Decided by the Group 2b builder, 2026-10-11, lightly held (left from #420): a head the turn
  reaches only through a link (a quiet pointer) counts as not reached, so it is brought in to
  stand for the earlier version the words reached and its pointer candidate is dropped. Why:
  the dedicated test showed both shown — a pointer sat in its own slots, apart from what the
  gate inhibits.
