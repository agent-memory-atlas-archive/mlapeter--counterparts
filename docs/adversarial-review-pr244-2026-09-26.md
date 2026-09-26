# Adversarial review — PR #244, emotion part A (2026-09-26)

Branch `emotion/part-a`, reviewed at `a087056`. Scope: emotional intensity in `base()` and
stability, `Store.row()`'s `feeling_peak`, mood-matching (recall G18), the lone
`emotional` score, the wheel additions / blends / aliases / suggestions, the displays.

**Verdict: no blocker.** One finding needs an owner decision (identity through the
lift); two should-fix items and the doc corrections were fixed on the branch; the rest are
notes.

## Blockers

None found. Checked and holding:

- **Guarantee 4 (repetition alone never reaches identity).** The lift goes only on the
  salience arm, and `base` is a `max` of the two arms plus `cons`, so the repetition arm is
  still `REP_CAP + CONS_BONUS = 0.70 < 0.85`. A silent note (claimed default 0.25, no
  dimensions) at the strongest feeling tops out at `max(0.40, 0.5) + 0.2 = 0.70`.
- **The authored default still cannot reach semantic on its own.** A silent note at
  I = 1 is 0.40 at birth, below `THETA_SEM`. Consolidation needs the semantic band first,
  so the +0.2 comes only through use. A lone `emotional: 1.0` gives
  `1/3 + 0.15 = 0.483`, still below 0.5.
- **Every physics read agrees.** All `rowToPhysics` callers get their row from
  `Store.row()` / `requireRow()`: sleep decay, prune, consolidate and dedup, recall
  `activate`, `reinforce`, `read` / `physicsOf`, the dashboard memories list and the
  settling view, and the fired probes. The one bare `SELECT * FROM memories`
  (`rebuildCache`) computes no physics. The subquery is one probe on the
  `feelings_memory` index per row.
- **An observer or read-only store can't hit a missing `feelings` table.** A store one
  schema behind refuses under observer at open, and a writer migrates it, so the subquery
  always has its table.
- **Mood never admits an uncued memory.** The lift is computed only when
  `cue + semantic > 0`, which is the same test as hard gate (a). It goes into `sal`,
  never `activation`, and both hard gates run before `sal` is read. The end-to-end test
  compares activations with the mood on and off and finds them identical.
- **No feedback loop.** Feelings are written only onto a memory in the same call that
  mints it (`server.ts#recordFeelings` takes `deposit.memoryId`), so a memory that
  surfaces never gains a feeling. A feeling recorded inside the window is the mood and
  never matches. The lift is at most 0.3 and reaches `sal` only. A lifted memory that
  gets used is credited like any other use; nothing feeds back into the feelings.
- **Removal.** `owner-op-seam.ts` deletes the memory's `feelings` rows.
  `feelingsSince` and `emotionCensus` exclude archived and superseded rows.
- **Wheel validation.** A wrong core is still refused (`emotion-under-another-core`). A
  blend written under its second core is stored under its primary. An alias resolves to
  a wheel key and says `readAs`. A word the builder added that the poster already has
  throws at build time.
- **Opposite valence.** A non-blend word is offered only when its valence is 0 or matches
  the core's sign. See N5 for the one deliberate exception, blends.

## Should-fix

### S1 — Identity is newly reachable through the lift, and the docs said it wasn't

*Fixed in docs and pinned by a test. The design choice itself is left to the owner.*

`promotionEligibility` reads `base`, and the lift is in `base`. The PR text, the
`EMO_LIFT` comment and CONTRACT guarantee 13 all say emotion keeps a memory "below
`THETA_ID` even consolidated". That is only true for a silent note. For a memory whose
`sal` was claimed or computed, a consolidated memory now meets the identity bar at
`sal ≥ 0.65 − 0.15 × I`. Before, it needed `sal ≥ 0.65`. Identity is decay-exempt, so the
change is one-way. The retelling channel's capped claim is inside that window too, so
`SWEEP_CLAIM_CEILING`'s "sits structurally below THETA_ID" held for the claim alone and
stopped holding once the lift is added.

**Failure scenario.** A sweep-minted memory has the capped claim of 0.6 and the sweep's
own `emotional: 0.5`. It was consolidated, and it was used on three separate days. Before
this PR its base was `0.6 + 0.2 = 0.80`, so it stayed out of identity. After it, the base
is `0.6 + 0.075 + 0.2 = 0.875`, and the first sleep after the upgrade promotes it on the
owner's store without anyone deciding to. An authored note at claimed 0.55 with a 0.9
feeling crosses the same way (`0.55 + 0.135 + 0.2 = 0.885`).

**What was done.**
- Physics NOTES §17 gained "Identity is newly reachable, in a window": the arithmetic,
  the sweep case, and that consolidation is permanent.
- CONTRACT guarantee 13 is now scoped to silent notes, and the `EMO_LIFT` and
  `SWEEP_CLAIM_CEILING` comments are corrected to match.
- The CHANGELOG says a felt memory close to identity can now cross into it.
- `emotion.test.ts` pins the window. At the sweep ceiling, I = 0.3 is not eligible,
  I = 0.4 is, and a silent note is never eligible.

**Owner decision (open).** Either keep emotion counting toward identity, which is what
the build does now, or have promotion read the base without the lift. The second is a
small change in `promotionEligibility`, and the dashboard's settling projection
(`mind.ts`) would follow it. Before the upgrade runs a sleep on the live store, the
dashboard's settling view on this build shows which memories are within reach and which
are already `eligible`. It reads the same `salArm`, so it is the preview.

### S2 — `demo-seed.test.ts` compared the wake within 2% instead of exactly

*Fixed.*

`self/identity.ts` broke ties on strength, then born day, then the random id. Emotion
puts more memories at the strength ceiling of 1.0, so two demo stores built from the
same script rendered different wakes.

**Failure scenario, reproduced.** Five seeds gave 5886, 5886, 5886, 5926 and 5926 bytes.
Two identity lines swapped places and a hints line changed. The 2% tolerance would also
have hidden a real regression of up to about 118 bytes.

**Fix.** `Ranked` gains an optional `tieKey`, a sha256 of the memory's body, set in
`rank()`. `byStrength` and `byThreadAge` compare it before the id. It is a hash, so
`Ranked` still holds only ids and numbers. The horizon lane has no memory behind it and
no key. The test's exact `toEqual` is back.

**Verified.** Eight seeds in UTC and six in `TZ=America/Denver` all came out
byte-identical (5886 bytes, one sha).

**On the live store.** Tied lines are reordered once, by the words' hash instead of the
id. Identity's rotation by last-rendered day absorbs that after one render.

**Merging with PR #238.** The edits sit away from #238's hunks: the field goes after
`bornDay`, the literal line after `bornDay: s.doc.bornDay,`, and one import. They should
merge cleanly. #238's new `byHintScore` ends in `byStrength`, so it gets the tie-break
too.

### S3 — G18 said the absolute regimes ignore `sal` entirely, which is false

*Fixed in docs.*

`gate.ts` orders the loud pool by `activation + SAL_SORT_WEIGHT × sal` in every regime,
and `MAX_SURFACED` is 1.

**Failure scenario.** A cold-start store admits two memories as loud. A mood lift of up
to 0.3 on one of them adds 0.15 to its sort key. That can move it into the single
surfaced slot and push the other one down to a footnote. Admission is unchanged; which
memory is surfaced is not.

**Fix.** Recall CONTRACT G18 and the `mood.ts` header now name this. The `mood.ts` header
also claimed "one indexed query"; `feelingsSince` has no index on `created_at` (see N1),
and the header now says it scans.

## Notes

- **N1 — `feelingsSince` scans the whole table on every turn.** There is no index on
  `created_at`. The table is small today, a few rows per memory at most. Adding an index
  is a schema change: an up-to-date store runs no DDL at open. It belongs with the next
  version bump.
- **N2 — Feelings don't follow a supersede or a dedup merge.** The PR discloses this.
  - Supersede: a belief with `emotional: 0` and a 0.9 feeling is revised. The successor
    starts at the unlifted height and the unslowed slope.
  - Dedup merge: the archived duplicate keeps its own feelings, so the original never
    gets their lift.
  - Both fall back to pre-PR behaviour.
- **N3 — Mood applies whether or not the turn is felt.** G10 gates the emotional
  *dimension* on first-person feeling in the turn. Mood-matching comes from a recorded
  feeling in the last 3 hours instead. The CONTRACT names the tension with G11, and it is
  the owner's decision.
- **N4 — Blends go under their primary core.** "Tender" written under happy is stored
  under sad. The per-core calendars (`feelingCounts` by core) count it there.
- **N5 — The valence rule exempts blends.** Under happy, "wistfull" is offered "wistful",
  whose valence is −1, because a blend "belongs to" both of its cores. The word offered is
  the one the writer misspelled, so this is acceptable. The test for "never opposite
  valence" uses non-blend words.
- **N6 — Words stored as `other` before the upgrade stay `other`.** A "grateful" kept as
  `other` before this PR stays `other`. From now on the same word is stored as the wheel
  key, so the calendars split one word across the upgrade.
- **N7 — The test adaptations.**
  - **`physics.test.ts` (`Sflat`): fixture adapted.** Reverting `Sflat` to `S` fails 10
    tests, and every failure is a pinned number: force 0.3364, base 0.9, the prune day,
    "starts semantic" at 0.55. The behavioural claims still hold with emotion on: the
    08-24 exhibit still crosses on day 2, and regression 2 (one loud claim doesn't flip a
    friend-model) still holds.
  - **`sleep.test.ts`, three demotion fixtures: fixture adapted.** The lift keeps an
    `emotional: 0.8` row semantic longer, which is the intended behaviour.
  - **`dashboard-mechanisms.test.ts`: a policy change.** A light backed only by a census
    can now be green with no event seq behind it. "emotional" is off the grey list. The
    census is window-bounded (memories born this week). Accepted, and named here.
  - **`feelings.test.ts`: fixture adapted.** "relieved" is now a wheel word, so the
    migrated-store notice test writes "clarified".
- **N8 — The affect flag fires more often on a felt store.** Its "charged" test now reads
  intensity, so a memory whose only emotion is a recorded feeling ≥ 0.7 counts as
  charged. That is intended.
- **N9 — The mood tunables are unmeasured.** The recall bench has no feelings in it. The
  PR discloses this.
