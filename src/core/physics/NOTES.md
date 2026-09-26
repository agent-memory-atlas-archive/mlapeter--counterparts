# `physics/` — NOTES

Working notes beside the contract. **`CONTRACT.md` is the spec; this file never
edits it.** Where the contract is silent or its prose and its equations disagree,
the choice made in `index.ts` is recorded here so the next reader does not have to
re-derive it — and so the owner can overrule any of it cheaply (constitution
line 13: decisions are defaults).

## Implementation choices

*(First build, 2026-08-25. Every item is a place the contract did not decide, or
decided twice.)*

1. **The claimed-salience floor is stored, not applied to the dimensions.**
   §5.1 makes a claimed salience a floor clamped "at the proposal→memory seam,"
   but guarantee 2 also fixes the dimensions at birth, and §5.1 forbids ever
   defaulting a null novelty. Lifting a dimension to satisfy a claim would break
   one of those. So `Salience` gained an optional `claimed` field: the dimensions
   are stored exactly as authored, the claim is stored beside them, and
   `sal(m) = max(mean(dims), claimed)`. `sal(m)` therefore stays reproducible from
   stored state alone, the lift is inspectable forever rather than only in the
   event log, and `clampSalienceAtSeam()` still emits `salience.lifted` at the
   seam (guarantee 2's event).

2. **`base` is not clamped; only `strength` is.** §5.2 clamps at `strength`
   and nowhere else, so `base` can exceed 1 (salience 1.0 plus the consolidation
   bonus reads 1.2). Kept literal. Consequence: `THETA_ID` is compared against an
   unclamped `base`, which is the only reading under which the threshold can
   discriminate at the top of the range at all.

3. **Promotion counts a new field, `reinforcedDays`.** §5.3 gates promotion on
   "reinforcement on ≥ N = 3 **distinct lived days**," which `uses` cannot
   reconstruct — `uses` is a weighted sum (a 0.25 surfaced credit and four of
   them are indistinguishable). `MemoryPhysics` therefore gained
   `reinforcedDays`, incremented only by `creditUse()`. It is **optional** in
   `types.ts` (absent reads as 0) so that adding it breaks no other module's
   construction sites; 0 is the promotion-*blocking* direction, so an un-migrated
   row can never be promoted by accident.

4. **Any credited tier counts a reinforced day.** A 0.25 "surfaced-unused"
   credit is still a lived day on which the memory was reinforced. The contract
   distinguishes the tiers by weight, not by whether they count as an occasion.

5. **Pressure has its own stability constant, `S_PRESSURE = 60`.** §5.6 says P
   decays "like everything else — the same curve family, keyed to the last
   challenge day." *Family*, not the same constant: reusing the target's `S(m)`
   would couple how long a challenge persists to the target's own use history and
   kind, which is machinery nobody asked for (Amendment 15). One flat constant,
   no κ, no `uses` coupling.

6. **Pressure decays even against a decay-exempt identity element.** `D = 1`
   exempts the *memory* (§5.4's named deviation); nothing exempts the *pressure
   standing against it*. Otherwise a stale challenge on an identity element would
   wait forever — exactly the ambush §5.6 says pressure decay exists to prevent.

7. **Order of operations in `applyChallenge`: decay P to `d` → add F → compare.**
   The alternative (compare, then decay) would let a challenge win on pressure it
   no longer has.

8. **The credited challenge is the FIRST of the lived day, not the strongest.**
   §5.6 says "one credited challenge per target per lived day" without saying
   which. First-wins needs no lookahead and no re-scoring, and mirrors §5.5's
   occasion rule, which is also first-wins.

9. **`REVISE` is strict `>`.** The contract writes `P(old) > ι × strength(old,d)`.
   Ties hold.

10. **Novelty is clamped to [0, 1].** `1 − cos` exceeds 1 for a negative cosine;
    the contract is silent. Clamped, because every other salience dimension is
    0–1 and the mean would otherwise be out of range.

11. **`successorSeed()` inherits identity by default.** §5.3(a) says a declared
    revision landing on an identity element hands membership to the successor;
    §5.3 also says identity is "demoted only by revision." Both are true with an
    explicit `inheritIdentity: false` opt-out, so demotion is possible but never
    accidental.

12. **The prune record carries exactly the contract's fields** — day, kind, band,
    birth day, last-used day, uses, strength. No id, no hash, no body (scar
    §2.20). A caller that wants to know *which* memory it just pruned already
    knows: it passed it in. Attaching identity to telemetry is the caller's
    decision, made in the open.

13. **All three decay shapes ship behind `TUNABLES.DECAY_SHAPE`, defaulting to
    exponential.** Open question 1 names `tools/replay` as the deciding consumer
    and says all three are one line — they are. Only the default is tested for
    behavior; the alternates are tested only for `D(0) = 1` and monotonicity.
    Choosing between them is replay's job, not this module's.

14. **`livedDay()` is a function of an active-day list, not of elapsed calendar
    days.** The lived-day integer is "how many distinct active days came before
    this one," which makes a week away one interval and not seven, and makes a key
    that is not yet in the list total rather than a special case.

15. **Every verdict names its reason, and every gate names *all* its failures.**
   `blockedBy` on prune and promotion lists every failing condition, not just the
   first, so a log line can never read "refused" without saying by what. Reasons
   are a closed union, so an unhandled case is a type error rather than a string
   nobody greps for.

16. **An UNCLAIMED memory takes its channel's default floor, and a default is
   never a lift.** (2026-09-04, measured on the live parallel-run store.) All 48
   authored memories carried `relevance = emotional = predictive = 0` and most
   carried no claim, so `sal(m) = max(0, null ?? 0) = 0`: the lived channel's own
   deposits were the weakest things in the store, first to decay, and — since
   `challengeForce = strength × sal` — every revision they declared pushed with
   ZERO force. That inverts the authorship doctrine it was supposed to serve.
   `clampSalienceAtSeam()` therefore takes a fourth argument, `defaultClaim`,
   applied only when `claimed === null`; `mint.ts` passes
   `TUNABLES.AUTHORED_DEFAULT_CLAIM` on the `authored` channel and `null` on every
   other, engine-set off the channel exactly as `SWEEP_CLAIM_CEILING` is. Three
   properties are deliberate:
   - **0.25, and the number is arithmetic.** `0.25 + CONS_BONUS = 0.45 <
     THETA_SEM = 0.5`, and `max(ω_sal) = 1.0`, so a defaulted memory cannot reach
     the semantic band on the default alone even after consolidation — it needs
     3 credited days of use (`rep = 0.36`) or an actual claim. That is the
     structural form of the F5 scar (a self-claimed 0.8 parked ~75% of the store
     above `THETA_SEM`). It also sits below 0.34, the measured mean of the claims
     authors did make, so silence says strictly less than speaking, and below
     `SWEEP_CLAIM_CEILING = 0.6`, so the floor is not a promotion over the
     retelling channel.
   - **A default is recorded as `defaulted`, never as `lifted`.** The lift metric
     is "how often does an author's claim out-rank the computed dimensions"; a
     defaulted floor folded into it would read every silent note as a claim and
     destroy the number the ceiling decision needs. `SeamClamp` gained
     `defaulted` and `defaultEvent` (`salience.defaulted`) for that reason, and
     the separation is load-bearing rather than tidy: `tools/replay/baselines.ts`
     computes three watch metrics off `salience.lifted` and `mint.proposal`'s
     `lifted` flag (lift rate, mean lift size, capped share). A default entering
     either would move all three silently, against F5's own +0.150 / 97.9%
     baselines. Defaults stay out of both by construction.
   - **An explicit claim, however low, is never overridden** — the branch is on
     `claimed === null` and nothing else. An explicit `0` is testimony.
   The FALLBACK channel is untouched: its ceiling and its interpreter-supplied
   dimensions are exactly what they were. CAL, and a working default.

17. **Emotion, part A (2026-09-26) — feelings start to matter (CONTRACT §5.10).**
   Owner decisions of 2026-09-25/26, built as working defaults. Three constants,
   all CAL and unmeasured, chosen by the arithmetic below and kept modest because
   this changes decay on an existing store.

   **Where the lift lives.** In `base()`'s salience ARM (`salArm`), not in `sal()`.
   `sal()` is also what recall's turn gate reads (§9 G10: the emotional dimension
   counts only when the turn itself carries first-person feeling) and what
   `challengeForce` multiplies by (the author's own how-much-this-mattered). Folding
   the lift into `sal()` would have broken G10 silently and changed revision force.
   The repetition arm gets nothing, so "repetition never reaches identity" is still
   the cap arithmetic alone.

   **Intensity** `I = max(emotional, strongest recorded feeling)`. `feelingPeak` is
   read beside the row by `Store.row()` (one indexed subquery), which every physics
   read goes through — sleep, recall, the dashboard, `physicsOf`, `read`. A bare
   `SELECT * FROM memories` carries none and reads as the numeric score alone.

   **The simulation.** A silent authored fact (claimed default 0.25, no dimensions,
   never used, κ = 1), strength over lived days, at three intensities:

   | I | height | S (lived days) | d0 | d7 | d30 | d60 | d90 | below φ = 0.02 on |
   |---|---|---|---|---|---|---|---|---|
   | 0 | 0.250 | 60 | 0.250 | 0.222 | 0.152 | 0.092 | 0.056 | day 152 |
   | 0.5 | 0.325 | 75 | 0.325 | 0.296 | 0.218 | 0.146 | 0.098 | day 210 |
   | 0.9 | 0.385 | 87 | 0.385 | 0.355 | 0.273 | 0.193 | 0.137 | day 258 |

   (`test/emotion.test.ts` pins this table.) A `person` memory (κ = 0.75) at I = 0.9:
   S = 116, below the floor on day 344 instead of 203. A note that said only
   `emotional: 0.9`: before, height 0.300 and S = 60 (floor on day 163); now height
   0.435 and S = 87 (floor on day 268).

   **Why these numbers.**
   - `EMO_LIFT = 0.15`. The lift is felt (a strongly felt silent note starts 54%
     higher than an unfelt one) and bounded where it matters:
     `AUTHORED_DEFAULT_CLAIM + EMO_LIFT = 0.40 < THETA_SEM`, so a feeling alone does
     not make a silent note semantic at birth — consolidation (+0.2) or use still has
     to, and a consolidated one at I = 0.9 holds semantic for ~14 lived days, then
     fades back. Consolidated, it is 0.60, far under `THETA_ID = 0.85`. Larger lifts
     (0.25+) would carry a felt silent note to semantic on birth; smaller ones (0.05)
     are rounding error against a 0.25 floor.
   - `EMO_SLOPE = 0.5`. ×1.25 stability at I = 0.5, ×1.45 at 0.9 — the strongly felt
     memory lasts ~1.7× as long before it reaches the prune floor. It stays a slope,
     not an exemption: nothing becomes immortal by being felt (identity is still the
     only decay exemption, and still by promotion only).
   - `S_FEELING = 20`. A 0.9 feeling reads 0.63 after a week, 0.45 after two, 0.20
     after a month — while the fact it sits on is still at 0.79 of its height after
     two weeks. "The feeling softens faster than the fact" as arithmetic.

   **What moves on an existing store.** Every row with an `emotional` score or a
   recorded feeling is now taller and slower. The first sleep pass after an upgrade
   will re-read those bands; some episodic rows will read semantic (counted as
   up-moves by guarantee 12's counter — expected, and a one-time step). A felt row
   that reads semantic on a day after its birth is then CONSOLIDATED by the same
   pass, and `consolidated` is permanent (+0.2 to `base` for life).

   **Identity would have been reachable, in a window (adversarial review of #244) — closed below.**
   Promotion eligibility is on `base`, and the lift is in `base`. The "stays under
   identity" bound above is for a SILENT note only. For a memory whose `sal` was
   claimed or computed, the consolidated bar `THETA_ID − CONS_BONUS = 0.65` is now
   met at `sal ≥ 0.65 − 0.15 × I`: at I = 0.9 a consolidated memory with
   `sal ∈ [0.515, 0.65)` and ≥ 3 distinct reinforced days is newly eligible, where
   before it was not. Identity is decay-exempt, so this is one-way. It includes the
   retelling channel: a sweep memory at `SWEEP_CLAIM_CEILING = 0.6` with an
   `emotional` dimension ≥ 0.34 reaches 0.6 + 0.15 × I + 0.2 ≥ 0.85 (0.80 before).
   On an existing store the first sleep after the upgrade could have promoted such rows.
   **Settled 2026-09-26 (coordinator, holding the status quo until the owner's
   consolidation/dreaming redesign lands): emotion does NOT count toward identity.**
   Promotion reads `promotionBase` — `base` without the lift — so its reach is exactly
   what it was before #244, and the settling view (which reads the verdict's `base`)
   follows. The lift still makes a memory taller and slower to fade.

   Anything that ranks by strength (the self page's ordering, the dashboard's
   lists) shifts toward felt memories. Felt, consolidated, high-salience memories
   also reach the strength CEILING of 1.0 more often (`strength` clamps `base × D`,
   and base can exceed 1 with the consolidation bonus), so anything that ranks by
   strength sees more ties. The self lanes break a tie on born day, then on a hash
   of the memory's words (`self/identity.ts#tieKey`, added in review), then id —
   so two stores built alike (the demo seed's two runs) render the same wake, and
   `demo-seed.test.ts` compares the wake's bytes exactly again. On a live store,
   lines tied on everything else move from id order to hash order — both
   arbitrary, so nothing is lost; identity additionally rotates by last-rendered
   day, which dominates after one render.

   **Softening's clock, an approximation named.** A feeling softens over the lived
   days since its MEMORY's birth day: the lived-day clock is a counter and cannot map
   a feeling's wall-clock `created_at` back to a lived day. Every feeling written
   today is written in the same call that minted its memory, so they agree; a later
   `addFeelings` on an old memory would read as already softened.

   **Not carried across a revision.** Feelings belong to a memory id. A supersede
   mints a new id, so the successor starts without them (and without their lift).
   Named, not solved — revisit with the self/schemas work.

## Observations for the owner (arithmetic vs prose)

- **§5.6's "a slow kind cannot cross from rest in fewer than ~3 lived days" is
  an approximation, not a bound.** The maximum single-day force is
  `strength(new) × sal(new) = 1.0` (a challenger with all four dimensions at 1.0),
  while the highest possible self-kind bar is `ι × strength(old) = 0.9 × 1.0 =
  0.9`. So one *flawless* challenge can cross a self belief in one day. The
  per-day cap bounds **spam**, not a single perfect claim. The equations win over
  the prose (they are what §5 says to implement exactly), so nothing was "fixed"
  in code — but if the owner meant the prose as the guarantee, the cheapest fix is
  a per-day force cap (`min(F, F_day_max)`), not a change to ι.
  `test/physics.test.ts` documents the boundary by using salience 0.9 (F = 0.81)
  for its "one loud claim" spam, which is below the 0.855 bar it tests against.

- **`TAU_DUP`, `PHI_PRUNE`, `D_FLOOR_DAYS`, `POWER_LAW_PSI`, the symmetry ratio,
  and the whole per-kind table are calibration-required** and marked as such in
  the `TUNABLES` table. Per scar §2.8 and guarantee 11 they ship with a recorded
  measurement or they ship disabled; `PHI_PRUNE` and `D_FLOOR_DAYS` are the two
  with no ancestry at all (open question 5 — v1 never pruned).
