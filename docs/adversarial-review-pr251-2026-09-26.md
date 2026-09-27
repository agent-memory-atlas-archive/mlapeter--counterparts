# Adversarial review — PR #251, dreaming + consolidation (2026-09-26)

Reviewed at `5dd4436` (branch `mechanisms/dreaming-consolidation`, merge base `ef37eb1`).
Blockers and should-fixes are fixed on the branch in the review commit; notes and owner
questions are left as they are. Each fix has a test in `test/dream-review.test.ts` that
fails on `5dd4436` and passes after the fix.

The store this lands on: the owner's v7 store (~200 memories, 6 lived days), migrated
the first time a session opens after install.

## Blocker

**B1. A dream's merge or gist dropped confidentiality.** *(fixed)*
`Store.put` recomputes `confidential` from `meta`. The merge wrote
`meta: { dream, mergedFrom }` and the gist `meta: { dream, dreamed, sources }`. Neither
carried the marker. `showable` admits confidential rows in the owner's own session.
- The scenario: the owner's session dreams and merges two confidential near-copies (or
  cites one in a gist).
- The result is a non-confidential memory with the same words, which recall then shows
  in every session.
- Fix: the merge and the gist carry `confidential: true` (and the first named
  `confidentiality` class) when any original or source is confidential.

## Should-fix (all fixed)

**S1. A dream's replay took the lane day of an organic return the same day.**
`lastReturnAnchor` includes `lastDreamDay`, and `creditReturn` refused any return with a
gap of 0. The ask comes mid-session and the day goes on.
- The effect: every memory the dream replayed could not earn an awake return (a core-lane
  day) for the rest of that lived day.
- Undoing the dream did not bring that return back.
- Fix (`physics#creditReturn`): an awake return's "already today" is checked against
  awake returns only. It still counts (lane day, `returnDays` + 1), at the weight its zero
  gap from the replay gives it (0). No durability is double-counted.
- A dream after an awake return the same day is still refused.

**S2. A dream left open stayed writable for ever.**
`begin` closed an earlier open dream only when it was the same lived day and had no
changes.
- A dream begun yesterday with changes and never journaled stayed `begun`. `openFor`
  accepted it, with its own limits and its own shown set, next to today's dream. The
  result was two dreams' worth of changes in one day.
- Fix: `openFor` refuses a dream once a newer non-undone dream exists (`dream-closed`).

**S3. Undo after later edits resurrected originals beside a live successor.**
- The scenario: a merged memory is later revised into a successor (a `note` correction,
  pressure), or merged again by a later dream. `archiveQuietly` then skips it (it is
  already archived), and the originals are restored anyway.
- The result: the originals and the successor are live side by side, as duplicates.
- Fix: such a merge is left as it is and counted as `kept`, and the rest of the dream is
  still reversed. `undo` returns `reason: "undone-except-moved-on"`, and the CLI says so.

**S4. Merging a dated reminder silently killed it.**
- The merged memory carried no `event_date`, so the reminder never fired.
- Fix: a merge that includes a dated memory is refused (`dated-is-not-merged`).

**S5. A merge undid the owner's demotion.**
- `coreDemoted` is keyed by id. A demoted memory merged into a new id (the merge carries
  its returns and feelings) could be promoted again by a lane.
- Fix: a merge that includes a demoted memory is refused (`demoted-is-not-merged`).

**S6. A dream's own merges counted as "new" for the next ask.**
- `newMemoryIds` excluded source `dreamed` but not merges, whose `created_at` falls after
  the dream's `started_at`.
- With three merges, the next day's ask became due on the dream's own output alone, and
  the next dream saw those merges as fresh.
- Fix: rows with `origin_ref` `dream:%` are excluded.

**S7. The session was told to retell the dream in its own words.**
- The `launch` result said "tell the owner in a line or two what the dream did". That
  assistant text carries no mark.
- It is `conversation` and swept, and the dream's title and changes read as something
  that happened. This was the most likely leak of dream words into lived memory in real
  use.
- Fix: the instruction now says to show the hand-back line exactly as it came back. It
  carries the mark, so the reader tags it `dream` in either role.

## Notes and owner questions

**Migration and upgrade (item 1).** See "Independent upgrade check" below for the
measured results.

**N1. The upgrade census is tautological.**
- `preV8` zeroes `returns`, and returns are zero at the upgrade. The only term v8 adds for
  a legacy row is `R(returns) ≥ 1`.
- So `bandDown`, `weaker` and `pruneSooner` can never be non-zero, and doctor's red
  branch cannot be reached.
- The green line is true, but it reads as a measurement and is one by construction only
  (constitution 11).
- Owner question: reword it ("by construction: the arithmetic for existing rows is
  unchanged"), or drop it. The real check is the independent run below.
- The obvious real alternative is to compare the v7-written `band` column against v8's
  band at `band_day`. That would raise false reds: revision successors inherit the
  target's band at birth.

**N2. The v7 promotion road is closed for legacy rows.**
- v7 promoted any kind at `promotionBase ≥ 0.85` with 3 reinforced days. v8 promotes only
  `self` and owner-`person` rows, by lanes.
- A legacy fact that was on that road now never becomes identity. Nothing moves down at
  the instant of the upgrade. Measured over time below.
- Owner question: should `legacy` keep the v7 promotion rule too, or is this the intended
  retirement?

**N3. The cued exception is session-wide, not "the turn's own cue".**
- `creditReferences` builds its candidates from everything surfaced loud this session.
- Recall does not suppress hints-lane memories from loud surfacing. So a memory the wake
  displayed, once surfaced by any cue this session, is a counted return when quoted, even
  when the quote came from the wake.
- It is bounded: at most one return per lived day, and habituation (the load grows +1 per
  day shown; by the fifth day the pull is 1/6) pushes it out of the lane.
- But a cued return after the memory leaves the lane resets its load, so it comes straight
  back. This is not the old loop, but it is not closed either.
- Owner question: count a cued use only when the surfacing and the quote are on the same
  turn?

**N4. A merge can assemble a lane.**
- The successor takes the union of the originals' return days, the earliest birth and all
  their feelings.
- Example: two `self` near-copies, A (returns on days 1, 8, 15) and B (days 22, 29),
  merge into a successor with 5 return days over 28, which is the slow lane. It is
  promoted at the next consolidation.
- The returns were real awake returns, so this is defensible. It is still a way a dream
  contributes to promotion. Owner question.

**N5. Growth of returns: no runaway, but dreams alone buy real durability.**
- Returns lengthen stability only. `base`, and so the strength ceiling, is untouched.
- R = 1 + ln(1 + returns):

  | Returns | R after 30 days | R after 90 days | R after 365 days |
  |---|---|---|---|
  | Awake, daily | 2.61 | 3.56 | 4.90 |
  | Awake, weekly | 2.31 | 3.21 | 4.53 |
  | Dream replay only, daily | 2.10 | 2.94 | 4.23 |

- A memory that sits in every night's bundle (a neighbour of whatever is new) and is
  replayed each time ends up almost as durable as one that comes back awake every week,
  without ever being used awake.
- Bundle selection is by similarity, time and feeling, not by strength, so there is no
  direct replay → strength → shown → replay loop.
- Owner question on `DREAM_RETURN_WEIGHT` and `RETURN_GAIN`.

**N6. Undo drops awake learning made after the dream.**
- Uses, returns and co-activation edges earned by the merged memory after the merge are
  archived with it.
- `restoreEdge(null)` deletes a dream link that awake co-activation may have strengthened
  since.
- Edges evicted by `linkMany`'s fan-out cap when the dream linked are not restored.

**N7. "An undo leaves no trace" is slightly overstated.**
- An awake return weighed against a dream replay's anchor keeps its smaller weight (0 on
  the same day, after S1) once the dream is undone.

**N8. Owner removal and dream words.**
- `chaseRemoved` blanks dream-change refs. It leaves `dreams.journal`, which may quote the
  removed memory, and a merged successor's reworded words (the same as revision
  successors on master).
- Owner question: should removing a memory also blank the journal of any dream whose
  `shown` held it?

**N9. A merge drops the originals' meta.**
- The successor loses `unresolved` (the threads lane), a person memory's `name`/`entity`
  (which `aboutMe` reads, so a person-about-owner memory identified by meta alone stops
  qualifying for the core), and `happened_on`/`learned_on`.

**N10. `aboutMe` is a whole-word match on the owner's name in any `person` memory.**
- "Sarah told Mike she would handle the release" is about me, so core-eligible.
- Owner question: narrow it, for example to `meta.entity`/`name` or the title?

**N11. Mechanism lights: an undone dream still lights Dreaming (and a gist still lights
Episodic → semantic) green for the week.**
- That is evidence it fired, not that it stuck. Honest enough; worth a word in the panel.
- Consolidation's light reads the `returns` table, which is real evidence, and an undone
  dream's replays are deleted from it.

**N12. Capture edges.**
- `parseTranscript` does not filter `isSidechain` entries. This predates the PR. The
  owner's host writes subagent turns to their own files and hands back as a peer message,
  so it does not bite today.
- A dreamer that paraphrases instead of returning the hand-back verbatim leaves no mark,
  and its hand-back is `injected`, so kept and swept. This depends on the model complying.

**N13. Per-prompt cost of the ask is bounded.**
- On a day with too little new, the ask never claims, and every prompt runs:
  - `newMemoryIds`: a scan and sort over `memories`, LIMIT 120
  - `deniedIds`
  - at most 120 row reads
  - `raiseLines`' at most 10 `dream_changes` reads
- That is trivial at 200 rows and a few ms at 16k.
- It is quiet: it goes into model context only, never a terminal notice, and never to the
  page writer or under observer (tested through the real hook).

**N14. An MCP server started before the install keeps the v7 code on a v8 store.**
- Until the session restarts, its consolidation can still mark post-upgrade rows
  `consolidated` (+CONS_BONUS), because it does not know `legacy`.
- Restart open sessions after installing. This is the same shape as the v7 upgrade.

**N15. A demotion is permanent: nothing can make that memory core again.**
- Owner question: is a door back in wanted?

**N16. Doctor shows the "Upgrade" line amber until the first sleep, for a benign state.**

### Verified and held

- **Dream limits.** Enforced server-side, per action, per dream, across `propose` calls.
- **What a dream can touch.** Only ids it was shown. Never core, protected, schema, the
  page or a handoff. No delete, promote, page edit or in-place rewrite.
- **feeling-now.** Capped at the memory's intensity. `feeling_peak` is the raw MAX, not
  softened, so a dream's feeling cannot raise intensity or open the fast lane.
- **Observer stance.** Every phase refuses, and nothing is written.
- **Session binding.** The MCP tool always binds the session.
- **Merges keep links.** `retargetOnSupersede` copies edges rather than moving them, so
  restored originals keep theirs.
- **The core's rules.**
  - Only `self` and owner-`person` rows can be promoted (guarantee 4), and the cap of 3 a
    sleep holds.
  - A demotion is sticky and restarts fading from today.
  - The self page never crosses.
- **Hooks.** The Stop ask is unchanged: `hooks.ts` changes only UserPromptSubmit's
  context.

## Independent upgrade check

(See the section appended below: a store seeded by the v7 build at `ef37eb1`, migrated by
this build, and advanced side by side with no use.)
