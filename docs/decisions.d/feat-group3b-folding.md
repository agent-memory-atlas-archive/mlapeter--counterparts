### Decided by the group3b builder, 2026-10-11, lightly held (folding)

- Decided by the group3b builder, 2026-10-11, lightly held: a fold leaves the open questions on its parts open
  (`supersede`'s `closeFlags: false`), where a merge closes them. Why: "these add up to X" answers no "does this
  part disagree with Z"; closing it would hide a real question behind the fold.
- Decided by the group3b builder, 2026-10-11, lightly held: besides the brief's four exemptions (readings, felt,
  protected, the core), a fold also keeps at its own weight a DATED part (through the door its reminder would move
  onto the fold), a dream's own words (a dream does not build on them, as merges already refuse), and an EARLIER
  version (it already has a head; settling it under the fold too would move its head off its real successor).
  All are still cited in `meta.sources` and tied. "Reading" is the settle guard's test (`slotExempt`: about
  `world`, or a title opening "Reading"); "felt" was any recorded feeling (`feeling_peak > 0`; narrowed by the reviewer, below). Why: the door's
  own effects (decoring, carrying a reminder, re-heading a chain) are wrong for a summary. On the owner's copy
  (10-11) the census over 1,009 live memories: 751 foldable, 87 earlier, 79 felt, 42 reading or world, 21
  dated, 16 dreamed, 13 core.
- Decided by the group3b builder, 2026-10-11, lightly held: a fold starts at the strongest part's decayed
  strength on the night (read before any part fades), floored at the insight gist's 0.3 and capped at 0.6. Why:
  the brief's "its sources' strength (≤ 0.6)"; the floor keeps a fold of parts already near reach (four routine
  events at ~0.12) from being born below reach with its parts cut to ~0.06, the "work vanishes from recall" case
  review 11 warned of.
- Decided by the group3b builder, 2026-10-11, lightly held: a fold's title is its own, with no "Dreamed:"
  prefix (review 11 C4); `source = 'dreamed'` and `meta.fold` keep where it came from. A fold needs two or more
  sources. Folds count as `fold`, not `gist`, in a dream's counts and on `dream.changed`, so the dashboard's
  "patterns dreamed" line counts insights only.
- Decided by the group3b builder, 2026-10-11, lightly held: "overflow carried and counted" is, for now, counted
  and said: a fold past the night's 5 is refused `limit-reached`, counted on `dream.changed` (`foldOverflow`)
  and named in the hand-back; its parts are left as they are. The queue read is untouched, so carrying them to
  the next night is part C's (the dream queue).
- Decided by the group3b builder, 2026-10-11, lightly held: a CORRECTION (`corrected`, any door but a fold's)
  of a fold's part raises an unsettled pair between the fold and the corrector, source `fold-source-corrected`
  (the fold, being older, reads "Unsettled — may be out of date"). Undoing the correction withdraws the flag
  while it is still unanswered. A `changed` over a part flags nothing. Why: the brief names corrections; a
  newer state of a part is what the fold already stands over.
- Decided by the group3b builder, 2026-10-11, lightly held (random-06's ride-along): the head of a memory is the
  end of the chain by its STANDING settles: of the settled `changed`/`corrected` pairs in which it is the
  `over`, the newest (by when raised). A pair in which it holds no longer re-affirms it. `recall/standing.ts`
  (`headOf`) and `self/index.ts#settledOver` changed together, so every reader (facts, ambient head-wins, the
  wake, neighbours, the dream's bundle) follows. Three tests pinned the old reading and now pin the new one
  (`reconsolidation-door`, `continuity-round2`, `settled-over-marks`). (The builder refused "settle B over C"
  while "C over B" stood; the reviewer made it the explicit reordering the brief names, below.)

### Core-lever ruling (decided by random-06, 2026-10-11, lightly held; implemented by the #432 reviewer)

- Decided by random-06, 2026-10-11, lightly held: a FOLD takes the `me`/`us` mark only when MOST of its parts
  are `me`/`us`: a strict majority of every part it cites, kept-at-weight ones included; then whichever of
  the two more parts carry (a tie: the first in order). Otherwise it takes the most common of its parts'
  other marks (owner, work, world; a tie: the first in order; unmarked parts do not vote), or none. A tie
  between personal and not is not a majority, so it is not personal. "Personal wins by one" stays for
  merges, revisions and insight gists (`inheritFrom`); a fold has its own helper beside it
  (`store/index.ts#foldMarkFrom`). Why: a fold summarises many parts; one `us` part must not make a stretch
  of work a core candidate.
- Decided by random-06, 2026-10-11, lightly held: a fold's recurrence is what came back AFTER it was
  folded. In a slot with a fold, a member already there when the slot's first fold was written gives no
  re-encoding, and only its returns after the fold (`returns.at` past the fold's `created_at`; the lived day
  where a return has no moment) count. The fold's own uses and members written since count as anywhere
  else. No minimum count of its own uses. Why: its parts' births were the encoding the fold summarises,
  not its content coming back. On the owner's copy the personal fold no longer meets the slow lane on one
  use; four post-fold use days by three sessions over seven lived days do.

### Decided by the #432 reviewer, 2026-10-11, lightly held

- Decided by the #432 reviewer, 2026-10-11, lightly held: "felt" for a fold's exemption is review 11's (C3,
  D3): a `self` or `person` memory whose recorded feeling peaks at `FOLD_FELT_FLOOR` (0.5) or more. Why: the
  brief's one word summarises review 11; "any recorded feeling" kept 79 of 1,009 live memories out of
  their folds, a mild feeling on a routine work memory among them. Review 11's reading keeps 22.
- Decided by the #432 reviewer, 2026-10-11, lightly held: a fold starts at the strongest strength of the
  parts it HOLDS OVER, not of every part cited (the 0.3 floor when it holds over none). Why: a core memory
  or a reading kept at its own weight would otherwise lift a fold of weak work to its strength, above
  every part the fold stands for. The 0.3 floor stays: without it a fold of parts near reach is born
  below reach with its parts cut further.
- Decided by the #432 reviewer, 2026-10-11, lightly held (random-06's ride-along, as the brief words it):
  "settle B over C" while "C over B" stands REORDERS that pair: the standing settle is undone (C's cut on B
  lifted, its trail kept, why `reversed: …`) and B settles over C. For the owner and a session; a `changed`
  pair only (a `corrected` one archived B), not one closed through another, not a pressure crossing, and
  not where the reading guard would keep the two side by side. A dream or a reflection is still refused
  `already-settled` (an undo of its batch could not stand the old settle back up), and the refusal now
  says which way the pair stands. Why: the brief: "a new settle reorders only the pair it names (to make
  B current again, settle B over C)".
- Decided by the #432 reviewer, 2026-10-11, lightly held: the dashboard's dreams page counts a fold as
  `fold` and says "folded N memories into what they add up to (M faded under it)". Why: it counted folds
  as patterns.
