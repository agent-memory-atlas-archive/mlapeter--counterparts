# Adversarial review of PR #284 (contradictions), 2026-09-29 — and what became of it

The review is below as it was written, against head 25ae6f5. This table says what the
fix round did with each item. Tests for every fixed item are in
`test/contradictions-review.test.ts` (the reviewer's probes turned into assertions),
plus the updated `test/contradictions.test.ts` and `test/store-v10.test.ts`.

| Item | Status | What changed |
|---|---|---|
| B1 — the turn's own credit erases the cut; a second credit on one lived day | **Fixed** | `memories.fade` (REAL, default 1) in v10; `strength = base × D × fade`; a `changed` settle multiplies the fade, its undo divides the factor back out; `lastUsedDay` and `base` are never touched. Credit after the read now ends weaker than before; one credit per lived day holds. Physics §5.12. |
| S1 — the cut shortens the prune's dwell | **Fixed** (by B1) | The dwell is the real one; the weak-old-memory probe is no longer archived the next night. |
| S2 — negative / before-birth last use on the dashboard | **Fixed** (by B1) | A settle never moves `last_used_day`. |
| S3 — the wake's lanes show an old fact unlabelled | **Fixed** | `self/`'s resolver hands `elementLine` the standing prefix/suffix in every lane (identity, threads, hints, …); the hints ranking sees the fade through `strength()`. |
| S4 — undo not exact when a memory is changed twice | **Fixed** (by B1) | Each undo divides its own factor; exact in either order (tested both). |
| S5 — undo creates a flag nobody raised | **Fixed** | Undo returns a pair to `unsettled` only when it was a flag (dream or pressure); otherwise `withdrawn`. |
| S6 — removing the correcting memory strands the corrected one | **Fixed** | Removal first puts each standing settle back (fade divided out, a corrected memory unarchived and re-indexed, flags it closed unsettled again), then deletes the pairs and trail. |
| M1 — session_end neighbours list siblings; large dumps | **Fixed** | A sibling written by the same call is excluded; one call lists at most `NEIGHBOURS_PER_CALL` (12). |
| M2 — `isError` follows the note when a settle rides beside it | **Fixed** | An error only when nothing landed. |
| M3 — `already-settled` sends a session to an owner CLI | **Fixed** | A session is told to raise it with the owner; the owner is told to undo first. |
| M4 — a dream's undo is on the trail as the owner | **Fixed** | Actor `dream-undo`, with the dream id. |
| M5 — a reopened pair keeps its habituation | **Fixed** | The pair's "my mind" count is reset when an undo reopens it. |
| M6 — the carry reads only the first flag's latch | **Fixed** | Raised when any duplicate flag was raised. |
| M7 — `settle()` between `openFor`'s doc comment and `openFor` | **Fixed** | Moved above the comment. |
| M8 — a test title claims belief, protected and core | **Fixed** | Title narrowed to what it tests (protected); the core case is its own test (M9). A belief target is still not exercised by this file. |
| M9 — a `how` at a core memory records nothing | **Fixed** | The pair is recorded `unsettled` (`source` pressure, latched as raised) while pressure builds, so recall and the wake label the older one; the result says so. |
| M10 — `note` publishes `required: []` | **Not changed** | An observation to watch (empty-note rate); noted in `mcp/NOTES.md`. |
| Open: should a later use lift the fade toward 1? | **Not built** | Owner's call; today a use leaves the fade alone. |
| Item 7: an owner-only `corrected` on a core memory (demote, then archive) | **Not built** | A named follow-up in the PR. |
| The raw `SCHEMA_AHEAD {json}` message 0.3.7 prints on a v10 store | **Not changed** | Pre-existing, outside this PR. |

Beyond the review, the mechanism table: **reconsolidation → built**; **interference →
partly built**, proved by a dream's near-copy merges, contradiction flags and `changed`
settles that still stand.

---

# Review: PR #284, contradictions as a full mechanism (head 25ae6f5)

Reviewer: an Opus agent, adversarial pass, 2026-09-29. It was read-only on the branch. The probes live in a throwaway file in the review worktree (`test/probe-pr284.test.ts`, not committed); each one used a hermetic temp dir.

## Verdict: FIX FIRST

Most of the PR is solid:
- the pair table and the trail
- the v10 migration, and its clean refusal by 0.3.7
- the neighbours in `structuredContent`
- the `corrected` and `open` kinds
- the readable-by-id display path, with `store.resolve` untouched
- observer stand-downs
- the settle scope for the dream and the reflection

Suite on head: **4535 pass / 0 fail / 5 skip** (118 files, excluding `*-live`).

The problem is the `changed` kind. It is carried by moving `last_used_day`, and that is fragile:
- On the most common path, the Stop hook's retrospective credit undoes the cut within the same turn.
- The same move quietly shortens the prune's 90-day dwell gate.
- It writes false history into the dashboard.

Recommendation: replace it with a per-row strength multiplier (details under B1). Everything else is should-fix or minor.

---

## BLOCKER

### B1. The turn's own credit erases the `changed` cut, and can double-credit a lived day

Where:
- `src/core/contradictions.ts:264-273` sets the fade
- `src/core/physics/index.ts:1215-1228` (`creditUse`)
- `src/core/counterpart.ts:2191` and `:2276` (`creditReferences` credits every expansion as `referenced`)
- `src/adapters/claude-code/transcript.ts:609` (the recall tool's `ids` become expansions)

Scenario: the model reads the old memory by id (`recall ids:[old]`), then writes `note {updates: old, how: "changed"}` in the same turn. That is the natural way to revise something. At Stop, `creditReferences` credits the expansion of `old`, which sets `lastUsedDay := today` and `uses += 1`. The cut is gone and the memory ends stronger than before. Meanwhile the pair still says `changed`, recall still labels it `Earlier`, and doctor counts one `changed`.

This is not the designed "use holds it later" case (the test at `contradictions.test.ts:359`). Here the credit is for the read that came before the settle.

The same credit also counts an awake RETURN. `store.reinforce` (`store/index.ts:1714`) calls `creditReturn` on every credited `referenced` use, with spacing measured from birth or the last return. So the "earlier" memory also gains stability through `returnFactor` and a return day for the core lanes. It ends more durable than before the settle, not just un-cut.

Probe P-A, lived day 7:
```
before     {last: 4,   uses: 0, s: 0.475}
settle     {last: -42,          s: 0.236}
Stop credit{last: 7,   uses: 1, s: 0.497}   // stronger than before the settle
```

Second failure. `creditUse` refuses a second credit only when `d === lastUsedDay`. So a memory credited earlier today, then settled `changed`, gets credited again the same day from another session:
```
after first credit {last: 6, uses: 1, reinforcedDays: 1}
settle + credit    {last: 6, uses: 2, reinforcedDays: 2}
```
That breaks "at most ONE credited occasion per memory per lived day" (physics §5.5, v1 G9). It also feeds `reinforcedDays`, which is the input to promotion eligibility. So an "earlier" memory can move toward core.

**Fix: a per-row strength multiplier, not a clock move.**
- Add `fade REAL NOT NULL DEFAULT 1` on `memories` and `MemoryPhysics.fade`.
- Change the strength formula to `strength = clamp01(base × D × fade)`.
- `changedFade` returns the factor. `settle` multiplies it in and records the prior value; `undo` divides it back out.
- `creditUse` does not touch `fade`. "Use holds it" still holds: a use resets decay at half height.

What stays true under this fix:
- G3 (`base` is monotone): the multiplier sits outside `base`.
- G5 (decay is a pure function of d): unchanged.
- G10: the prune dwell reads the real last use.
- Hints: `hintReading` goes through `strength()`, so it follows automatically (fixes S3).
- The dashboard's past curve stays true (fixes S2).
- Stacked settles multiply and undo exactly (fixes S4).

Cost:
- The v10 bump is already in the PR, but it is tables-only. A column means v10 also needs the `ALTER TABLE ADD COLUMN` path and the fresh-versus-migrated `table_info` equality test.
- Size: roughly 150–250 lines across `operational.ts` (DDL + migrate), `rowToPhysics`, `types.ts`, `updatePhysics`, physics `strength`/`changedFade` plus CONTRACT line 125 and §5.12, `contradictions.ts` settle/undo, and tests.
- Owner's call, left open: should a later use also lift `fade` back toward 1?
- **Timing.** The owner's live store is on v9 (0.3.7). Folding `fade` into v10 is clean only if it lands before any store migrates to v10. After that, it is v11, with its own copy and Upgrade line. So do it in this PR, before merge or release.

---

## SHOULD-FIX

### S1. The cut shortens the prune's dwell gate: a weak memory is archived the next night

Where: `src/core/physics/index.ts:1556` (`dwellDays = d - m.lastUsedDay`) and `sleep/prune.ts:132`.

The clock move adds about S·ln 2 lived days of dwell (roughly 42 for a fact, more for skill-kind or well-used memories). A memory already near the floor therefore clears both gates at once.

Probe P-B2: a weak row, 60 lived days unused.
- Before settling, its strength was 0.025, above the 0.02 floor.
- After settling it was 0.012. The fake dwell was 102, so every gate passed.
- The next `runCycle` archived it `pruned` on day 62. Its unsettled twin prunes on day 92.
- Its real dwell was 60, below `D_FLOOR_DAYS = 90`.

That goes against the owner's "fading over weeks", and against the gate's meaning (lived days since last use).

Probe P-B1 (young store, lived day 8, ordinary salience) is fine: the settled memory prunes on day 170 against its twin's 216, and the next cycle does not touch it. So check (a) passes; the problem is the weak-and-old case.

The B1 fix removes this. A pruned `changed` memory also cannot be brought back by `undo`, which restores only `lastUsedDay`.

### S2. Negative and before-birth `last_used_day` shows up as fact on the dashboard

Probe P-C: a memory born on lived day 8 ends with `lastUsedDay -40`. No reader crashes: there is no DDL constraint, and `decay` and `creditUse` are fine. But these places print it as history:
- `dashboard/web/shared/format.js:25`: "born day 8 · last used day -40"
- `memory-modal.js:128,138,260`: "used … last on lived day -40", and a use-day dot at -40
- `memory-card-words.js:47-48`: "last used, day -40"
- `mechanism-panel.ts:722` (`fadeCurve`): draws a past at full strength from day -40
- `browse.ts:217`

Readers checked and harmless:
- `sleep/decay.ts`
- `dream/mind.ts:83,162` (habituation reset only)
- `dream/index.ts:1487` (merge takes the max)
- `counterpart.ts:2807` and `handoff:717` (take the max, or set to today)
- `schemas/index.ts:1244-1358` (entity cards only; settle refuses non-`memory` rows)
- `sleep/upgrade.ts:72` (one-off v8 census)
- `operational.ts:1413` (v8 migration only)

Dream bundle selection goes by `birth_day` (`dream/index.ts:2042,2184`) and is unaffected. Prospective's `faded` exit uses strength ≤ 0.02, and a halving rarely reaches that.

These read no `lastUsedDay` at all, and see the cut only through `strength()`, which is the intended channel:
- consolidation and promotion eligibility (`physics/index.ts:817-943`)
- awake and dream returns (`lastReturnAnchor` and `creditReturn`, `:1023-1135`, anchored on birth or the last return)
- doctor's returns lines (`doctor.ts` has no `lastUsedDay` reader)

Recall credit (`creditUse`) is the reader that matters: see B1.

Fixed by B1. If B1 is deferred, clamp the display to at least `birthDay`, and add the PR's own decay-panel follow-up.

### S3. The wake's hints lane ignores the cut and shows the old fact with no label

Where: `src/core/self/identity.ts:100-105`.

`hintReading` anchors organic strength at `display.ever_last_used` whenever the memory has been shown before, so the moved `lastUsedDay` never reaches it.

Probe P-C: organic score with the cut 0.734, without it 0.734. The warm floor reads real strength, and the cut memory is at 0.372, above `WARM_FLOOR` 0.35.

Result: a `changed` memory, or the older half of an unsettled pair, keeps its "Nearby, if it helps:" slot and reads as current. The threads lane (`unresolved`) ignores strength entirely.

This is a should-fix, not a follow-up, because it is the one lane that shows memories unasked every session.

The fix is small: apply `standingOf(...).prefix` and `.suffix` to the hints, threads and identity lines in `self/briefing.ts`. B1 fixes the ranking half.

The identity lane needs the label too. `changed` and `corrected` refuse a core memory, but `open` is allowed on one (`memoryRefusal` with `moves=false`), and a dream flag can name a core memory as the older side. Today the identity lane renders either one with no `disagrees with` or `Unsettled` label.

### S4. Undo is not exact when one memory is `changed` twice

Where: `src/core/contradictions.ts:431-435`.

Probe P-D1: X is changed by Y, then changed by Z. Its `lastUsedDay` goes 4 → -42 → -88.
- `undo(first)` finds `last_used_day` ≠ `to`, reports "was used since … left as it is", and restores nothing.
- `undo(second)` restores -42.
- After both undos, X stays cut at half, and the trail says both were undone.

Fixed by B1 (the multiplier divides out). Without B1, restore by subtracting the recorded delta, or refuse the first undo by name.

### S5. Undoing a settle can create a "flag" nobody raised

Where: `src/core/store/index.ts:2594`, and dream undo at `dream/index.ts:1896`.

`undoContradictionSettle` sets every pair to `unsettled`, including pairs whose `source` is `write` or `settle` and which were never flagged.

Probe P-D2: the owner undoes an ordinary `note {updates, how: changed}` because it was "just more detail". Then:
- `recall` by id shows `unsettled — may be out of date, see [new]`
- `raiseLines` raises it the next session
- it lands on "my mind"

The builder's dream test (`contradictions.test.ts:527`) asserts the same thing after a dream's settle is undone: the undo leaves a flag the dream never made.

Fix: on undo, return a pair to `unsettled` only if it was flagged before (`source === "dream"`, or it has a `flagged` history). Otherwise mark it `withdrawn` (or delete it and keep the trail).

### S6. The owner removing the correcting memory strands the corrected one

Where: `src/core/store/owner-op-seam.ts:225-236`.

Removal deletes every pair that names the removed memory, and its trail. If the owner removes the `holds` memory, perhaps because the correction itself was wrong:
- the `over` memory stays archived `corrected`, with no pair, no label and no `settle --undo` path;
- a `changed` one keeps its cut;
- pairs closed `via` it become `settled` with `via = NULL` and no trail, so their undo refuses with `no-settle`.

Fix: before deleting a removed memory's pairs, run `undo` on each standing settle, as actor `owner` with reason `removed`, then delete.

---

## MINOR

- **M1.** Session_end neighbours include siblings from the same batch. Probe P-F: the second entry lists the first, written a moment earlier, as an "existing" memory. Fix: exclude the batch's own ids (`server.ts:1759`). Also, every entry of a large dump carries up to 3 excerpts of about 160 characters. That is bounded, but a 20-entry `session_end` adds roughly 10–15 KB. Consider capping neighbours per dump.
- **M2.** `note` with both `text` and `settle`: `isError` follows the note. A duplicate note with a successful settle reads as an error, and a retry then hits `already-settled`.
- **M3.** The `already-settled` refusal tells the model to run `counterparts settle --undo`, which is an owner CLI (`contradictions.ts:250`). It should name the model's own option: tell the owner, or settle a different pair.
- **M4.** Dream undo writes its trail row as actor `owner` (`dream/index.ts:1896`). Record `dream-undo` or the undoing session instead.
- **M5.** Undo resets `raised_day`, but "my mind" habituation (`mind.seen.<pair>`) keeps its count, so a reopened pair comes back at reduced weight.
- **M6.** The v10 carry dedupes same-pair flags to the first dream's latch. If the first flag was never raised and a later one was, the pair gets raised again (`operational.ts` `carryDreamFlags`).
- **M7.** `reflect.ts:1786`: the new `settle()` was inserted between `openFor`'s JSDoc and `openFor`, so that doc comment now sits on `settle`.
- **M8.** The test title at `contradictions.test.ts:229` claims belief, protected and core, but it only exercises protected. Core is exercised by probe P-E2.
- **M9.** An `updates` into a core memory drops `how` and records no pair (P-E2: `path identity, below-bar`). For the roughly 3 lived days of pressure, the old core fact and its replacement both read as current, with no label. Cheap improvement: record the pair `unsettled` (or `open`) when the identity arm runs with a `how`, so recall labels it while pressure builds.
- **M10.** Hint: the published `note` schema now has `required: []`. That is fine, since the server refuses. Just watch whether the rate of empty notes changes.

## NOTES (checked, fine)

- **Neighbours.**
  - They are in `structuredContent` for both `note` and each `session_end` outcome (`server.ts:989,1759`; `result()` at `:2905` puts the whole payload in both).
  - The updated memory is excluded (`revision.targetId` and `mint.updates`).
  - Also excluded: journal (the `type` filter), handoffs, schema rows, archived, superseded and tombstoned rows, and confidential rows outside the owner's session.
  - No model call. The search is bounded to 8+skip per channel.
- **Content-guessed `updates` do not settle.** `directionOf("content")` gives `confirm`, which returns before the settle arm. The fallback for a typo'd id cannot cut a guessed memory.
- **Scope of settle from the fluid side.**
  - The dream's `settle` is bounded to its `shown` set (`live()` at `dream/index.ts:1439`), requires `why`, and is capped at 5 per dream. It covers anything shown, not only flagged pairs, which the brief allows.
  - The reflection's settle is bounded to `row.shown` and requires a non-empty, gated `why` (`reflect.ts:1786`).
  - Dream undo does reverse a dream's settle now.
- **`counterparts settle --undo`.**
  - Strength: restored only if unused, and not exact under S4.
  - Archive: `restoreSuperseded` restores only when the reason is `corrected`.
  - Pair state: goes back to unsettled (see S5).
  - Latch: cleared by design.
- **Dated reminders (task 1b).**
  - `moveReminder` runs before the revision dispatch (`counterpart.ts:4485`). The old row loses its date, and gains `reminderMovedTo`, before it is settled, so a `changed` old memory does not keep firing.
  - With `corrected`, the archived old row's past windows are counted as `faded` in `exitReport` (archived counts as faded). That is an accounting label only; nothing fires differently.
- **Corrected memories are never deleted.** Nothing in `src` runs `DELETE FROM memories`. Prune skips archived rows. A `corrected` archive writes no version row.
- **Readable by id.** Recall-by-id of a superseded row shows the row itself, with `Replaced by`. The display path is `deliberate.ts`, and the confidential gate still applies. `store.resolve` is unchanged in the diff.
- **Observer stance.** It writes nothing. The refusals are on `settle`, `flag`, `undo`, `note`, `settle-only`, reflect `openFor` and the CLI.
- **Trail rows.** Every settle goes through `store.settleContradiction` and writes one: session, dream, reflection, owner, and write-time. Every undo writes one too.
- **Doctor line.**
  - Its counts are honest to the table.
  - Under B1, "N changed" can count memories whose cut is already gone.
  - Under S5, "unsettled" includes pairs that were never flagged.
- **The changed existing tests are legitimately superseded, not weakened.**
  - `seams` O-test: the ordinary arm is now `changed`, and it still asserts no supersede and no pressure.
  - `store` and `seams` fixtures: the new write methods were added to the observer totality, which strengthens the test.
  - `traits` and `reflect`: version asserts. The traits test's "no copy taken" was a comment, never an assertion.
  - `fitting-open`: flags are now pairs, so `flag()` is seeded.
- **v10 migration.**
  - Dream flags are carried with latch and habituation, deduped, and skipped when the dream was undone.
  - The id is deterministic, so the carry is idempotent.
  - The copy-first seam runs before migrating (tested).
- **Rollback.** Tested for real: 0.3.7 was extracted from the tarball, and a v10 store was made with the PR build. `status`, `note` and `doctor` under 0.3.7 each refuse `SCHEMA_AHEAD {"expected":9,"found":"10"}`. The store is untouched and reopens fine under the PR build. Going back means restoring the pre-migration copy, the same as v8/v9. The raw `SCHEMA_AHEAD {json}` message is pre-existing and unfriendly.
- **Item 7, person facts.**
  - An ordinary `kind: person` memory is a plain `type: "memory"` row, so `corrected` works today. Probe P-E1: archived `corrected`.
  - What cannot be settled:
    - an entity card, which is a schema row: link-only by design;
    - a core or identity-band person memory (P-E2), which takes the identity pressure path, with a 3-lived-day cap for slow kinds;
    - a protected one.
  - The owner will first hit this on a core person fact ("Mike works at X"). What it would take:
    - an owner-only `counterparts settle --how corrected` on a core memory, meaning demote then archive, recorded (about 40 lines through `core --demote`'s path);
    - or letting a session `corrected` add a large pressure increment plus an interim `unsettled` label (M9).
