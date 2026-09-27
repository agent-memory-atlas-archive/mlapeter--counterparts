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

**S8. The upgrade census could not see the one real down-move.** *(made visible, not
changed)*
- The census compares each row with itself (returns set aside) at one moment. Returns
  are zero at the upgrade, so its down counts are zero by construction.
- The upgrade kept v7's consolidation path for legacy rows, but not v7's *promotion*
  path (`promotionBase ≥ 0.85` with 3 reinforced days, any kind).
- A legacy row that already meets that rule but is waiting for the next 3-day
  consolidation is not made core. Doctor meanwhile printed a green "none changed band".
  See the independent check below: one natural row on the demo store, and eight probes.
- Fix: the census also counts `v7WouldPromote`: legacy, not identity, meeting v7's rule,
  with the consolidation mark the same v7 pass would have set.
  - Doctor turns that line amber when the count is above 0, and names it as the owner's
    decision.
  - The green text now says what it measures ("checked by the old arithmetic and the
    new").
- Not changed: whether those rows keep the old road. That is owner question Q1.

**S9. The upgrade record's counts were of every row.** *(fixed)*
- The counts covered chapters, schema rows, archived rows and the removal tombstone. On
  the seeded demo, doctor said "183 memories" for 129 live ones.
- Fix: the counts are of live `type = 'memory'` rows. `legacy = 1` still lands on every
  row.

## Owner questions

- **Q1. The old road to the core.** Should legacy rows that were already on it (see S8)
  keep it, be grandfathered at the upgrade, or be let go as the new rule says ("facts,
  skills and places never become core")?
  - Doctor will count them on his store at the first sleep after the upgrade.
  - Under continued use, the demo shows 21 rows v7 would have made core and v8 does not
    (below).
- **Q2. Slow lane with no salience floor.** Six `self` memories with salience `[0,0,0,0]`
  (base 0–0.045) became core, permanently, on repetition alone (days 61–67 of the demo
  run). v7 had pruned five of them. Should the slow lane require a floor, such as the
  semantic floor or the warm floor?
- **Q3. Tighten the cued exception?** Count a quoted use only when the surfacing and the
  quote are on the same turn (N3).
- **Q4. Can a merge build a lane?** A merge takes the union of return days and so can
  assemble a lane (N4). Accept it, or recompute the lanes without a merge's inherited
  days?
- **Q5. Durability from dreams alone.** `DREAM_RETURN_WEIGHT` / `RETURN_GAIN`: a
  memory replayed every night becomes almost as durable as one used weekly (N5).
- **Q6. Removal and journals.** When the owner removes a memory, should that also blank
  the journal of any dream that was shown it (N8)?
- **Q7. Who "me" is.** `aboutMe` counts any `person` memory that mentions the owner's name
  (N10). Narrow it?
- **Q8. A way back after demotion?** Today a demotion is permanent (N15).

## Notes

**Migration and upgrade (item 1).** See "Independent upgrade check" below for the
measured results.

**N1. The census's band/strength/prune counts remain zero by construction.**
- The red branch is kept as an alarm and commented as such.
- Comparing the v7-written `band` column with v8's band at `band_day` would be a real
  check, but it gives false reds: a revision successor is born with its target's band.

**N2.** Folded into S8 and Q1.

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

Done independently of the PR's simulation and census, on pristine archives of `ef37eb1`
(v7) and `5dd4436` (v8). Scripts and per-row dumps are kept outside the repo.

**Seed.** The v7 `tools/demo/seed.ts` (30 lived days), then, with the v7 build:
- 4 feelings, an owner removal, an explicit archive, a self page and a dated reminder
- 9 probe memories reinforced on three days
- The store already had revisions, entity cards, a named identity core, 106 consolidated
  rows and 16 identity rows.
- The upgrade came at lived day 35.

**At the instant of the upgrade (the literal promise): met.**
- Snapshot `<base>/snapshots/<ts>-pre-migration-v7-to-v8/counterparts.sqlite`: v7, and
  every table's row count equal to the original.
- The migrated store is v8, with `legacy = 1` on 183/183 rows.
- Every v7 table is identical on every v7 column: edges 252, feelings 4, gate_session 233,
  memories 183, prospective 5, removal_record 4, removal_tombstone 1, versions 2.
- The only other differences are one `store.migrated` event and the new meta row.
- A second open took no new snapshot and left the store byte-identical.
- Band, strength and projected prune day at +0 and +1: identical row by row.

**Interrupted migration.**
- A snapshot failure gives `MIGRATION_SNAPSHOT_FAILED`. The store stays v7, the v7 build
  opens it, and a retry migrates cleanly.
- A DDL failure after the copy rolls back cleanly, but surfaces as raw SQLite text ("no
  such column: memory_id"), not a StoreError (N18).
- A retry after a v7 write between the failure and the retry reuses the earlier, now
  stale, copy (183 vs 184 memories). This is #214's reuse rule ("taken today, or not
  written since"), which predates this PR (N19).

**Observer floor (v8 CLI on a v7 store, `--dir`).** Nothing wrote: the database and WAL
hashes were unchanged and no new files appeared.
- `doctor`: exit 0, three amber lines ("on schema v7; this build reads it once a session
  has upgraded it"; "the next session copies it … and upgrades it to v8").
- `status`, `ask`, `dream --list`, `core`: exit 3, "this store is on schema v7; the next
  Claude Code session copies it and upgrades it to v8. Nothing to do: start a session,
  then run this again."
- dashboard `status`: exit 1, "This memory needs a one-time upgrade…".
- Clear. It names "Claude Code", which is wrong for another host (N20).

**Side by side after the upgrade, no further use** (each build runs its own sleep; E/S/I
= rows in the episodic, semantic and identity bands):

| checkpoint | v7 E/S/I | v8 E/S/I | lower in v8 | pruned earlier | higher in v8 |
|---|---|---|---|---|---|
| +0, +1 | 50/88/16 | 50/88/16 | 0 | 0 | 0 |
| +3 | 51/79/24 | 51/87/16 | 8 | 0 | 0 |
| +30 | 63/67/24 | 63/75/16 | 8 | 0 | 0 |
| +180 | 110/0/24 | 117/1/16 | 8 | 0 | 0 |

- The 8 are the probes. v7 promoted all of them at its day-37 consolidation. v8 refuses
  them as `not-about-me` or `no-lane-yet`.
- By +180, 7 of the 8 are episodic (strength 0.25–0.48), with v8 projected prune days
  557–896 against never under v7.
- **Natural case** (a fresh, unaugmented demo seed, upgraded at day 30): exactly one row.
  - `fact`, claimed 0.95, 4 reinforced days, consolidated.
  - v7 promotes it at day 31. v8 keeps it semantic, then episodic by +180 (0.383).
  - v8 projects a prune at lived day 675; v7 never prunes it.
- The PR's census read `bandDown 0` on both stores. That is S8.

**With use** (the same 35 ids reinforced on days +2, +5, +9, +16, +24 and +33):
- v7 ends with 41 identity rows, v8 with 27.
- 21 rows are lower in v8 (fact, entity and non-owner person rows v7 promoted), and 2 are
  higher.
- v8 keeps 5 rows v7 pruned: the six zero-salience `self` rows of Q2.
- Cued and plain reinforcement gave identical results, even with 2–16 on-display
  refusals per use day.

**Not measured.** On the real store, consolidation runs under a budget and a cursor.
Rows that meet v7's rule and have not yet been visited are a backlog of the same kind
(N21). The S8 count covers them at the first sleep.

**N18.** A DDL failure during migration reaches the person as raw SQLite text, not a
named StoreError.

**N19.** The pre-migration copy is reused after a failed attempt even when an old-build
process wrote in between. This is #214's rule, not this PR's.

**N20.** The upgrade-pending messages name "Claude Code session", which is the wrong
instruction for an MCP-only or other-host user.

**N21.** On the real store, a budget/cursor backlog of v7-eligible rows may exist. S8
counts it at the first sleep.
