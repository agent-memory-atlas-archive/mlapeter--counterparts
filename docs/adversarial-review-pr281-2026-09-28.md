# Adversarial review — PR #281, association build 2 (2026-09-28)

Reviewed at `7e310b8` (branch `mechanisms/association-2`, base master `4ce81c9`). The
fixes are on the branch, one commit per fix or small group, each naming its finding
("Review of #281, finding N"). The owner's decisions are left as they are.

Probes were throwaway, in temp dirs they create and remove, plus bench scripts run on
fresh copies of a seeded demo store. No live store was opened.

## Verdict

**Fix first, and the fix is small.** The pointer lane leaks nothing: every filter was
tried, and a pointer goes through the same `recallable` test and the same
confidentiality and dedup checks as a cued memory. The contiguity cursor, the spread
arithmetic, the hop ceiling and the measurement do what the PR says. One real problem:
temporal contiguity also linked what the nightly run writes. Dream gists, dream merges
and reflection entries carry the launching session's id, so each night's outputs were
chained to each other and to that session's last notes, with full waking homeostasis
and no waking use — the thing the #279 ruling refused for dream-proposed links.

One decision matters a lot: whether the pointer lane ships on. On the bench, the
pointers it shows are mostly the same handful of hub memories, and no setting of the
threshold separates those hubs from the one pointer that helped.

## Findings, most severe first

### 1. Temporal contiguity linked dream and reflection outputs as the session's own notes *(should fix — fixed)*
- **Where:** the two contiguity reads, `Store.memoriesWrittenSince` and
  `Store.memoriesOfSession`, used by `Counterpart.contiguityPass`.
- **Scenario:** a session S launches the nightly run. `Dreams.begin` stores the
  session; every gist (`source: "dreamed"`), every merge and the reflection entry
  (`source: "reflection"`) is a memory row with `origin.session = S`. At the next
  boundary the pass read them as S's newest memories: written seconds apart, so one
  batch, linked to each other at 0.045 both ways; the first gist linked to S's last
  note at 0.06 forward (over 60 s later, so a "real order"); later notes linked to the
  gists; merges, which combine memories from many past sessions, linked to whatever S
  wrote last.
- **Why it matters:** #279 decided a dream link lands only where there is room and never
  evicts or renormalizes waking-learned edges. Contiguity goes through full homeostasis,
  so dream outputs got links that evict and scale waking-learned edges with no waking
  use behind them (finding 9), and gists are already the store's biggest hubs.
- **Proof:** a probe put two notes and two gist-shaped rows (`source: "dreamed"`,
  `origin: {session: "s1", ref: "dream:d1"}`) in one session and ran a boundary:
  `n2→g1 0.06, g1→g2 0.045, n1→g1 0.03`.
- **Fix taken:** both reads know a nightly row by origin (`dream:` / `reflection:`, which
  also catches merges, whose source is their best source's) and by source (`dreamed` /
  `reflection`). The session's sequence skips them; the pass counts them (`excluded`,
  on the pass, the boundary's `associate.flush` row and doctor). Test: "the nightly
  run's rows are not the session's", including a `dreamed` row with no origin ref.

### 2. Doctor said contiguity "linked" N pairs; it counted pairs buffered *(minor — fixed)*
- A buffered pair can fail to become a link: at a full node the new edge can be the
  weakest and be evicted in the same flush; a real-order lag-2 backward half (0.015) is
  under the floor and swept; the flush can fail.
- **Fix taken:** the boundary keeps the pairs it buffered and, after its flush, reports
  `landed` (a link conducting in at least one direction). Doctor says "buffered N …, M
  landed as links".

### 3. A failed pass left no durable trace; pairs lost between the cursor move and the flush were not counted *(minor — fixed)*
- A pass that threw was said only in the in-process event ring, which the detached
  runner never reads. A process that died after moving the cursor and before its flush
  dropped its pairs (at most once, by design) with no record.
- **Fix taken:** the boundary's `associate.flush` row (same name and shape, `rows` 0) is
  also written when the pass failed, buffered pairs its flush did not write, or finds an
  earlier pass's pairs lost. The pass plans before moving the cursor, and the cursor
  carries a `pending` count until the row about them lands; still there at the next
  pass, it is reported as `lostEarlier`. Doctor says failed passes and lost pairs.

### 4. The pointer's own ceiling changed no decision *(minor — fixed by removal)*
- `LINK_POINTER_CAP_FRACTION` capped the number written on a pointer's verdict; the gate
  ranks and admits pointers by the anchored sum and never reads it.
- **Fix taken:** the cap and its count (`pointersCapped`) are removed; recall NOTES §19
  says so, and that a real bound, if wanted, caps the anchored sum in the gate.

### 5. The durable `recall.decision` row could not tell a pointer footnote from a cued one *(minor — fixed)*
- **Fix taken:** the footnote and surfaced entries carry `via: "link"` when the verdict
  has it, inside the existing arrays; the field list does not move. The OQ4 probe reads
  ids off those rows unchanged.

### 6. A memory committed behind the cursor is never linked, and nothing counts it *(minor, unlikely — stated as a known gap)*
- `created_at` is stamped before the write lock is taken. Writer A stamps 100 and waits;
  writer B stamps 101 and commits; the pass reads B and moves the cursor to 101; A
  commits at 100 and is never fresh. Needs lock contention, which does happen.
- A fix, if wanted: re-read from `cursor.at − CONTIGUITY_BATCH_MS` against a small seen
  set. Stated in associate NOTES §14.

### 7. Lag 2 is close to inert, and the tunable comment overstated how long contiguity links live *(documentation — fixed)*

| edge | weight | lived days above the floor (`S_EDGE` 30, floor 0.02) |
|---|---|---|
| lag 1, real order, forward | 0.06 | 33 |
| lag 1, one batch | 0.045 | 24 |
| lag 1, real order, back | 0.03 | 12 |
| lag 2, real order, forward | 0.03 | 12 |
| lag 2, one batch | 0.0225 | 3.5 |
| lag 2, real order, back | 0.015 | swept at once |

A 0.0225 edge passes 0.28% of what its node carries, under the spread threshold even
from the strongest seed. "596 rows for 152 pairs" on the bench is 304 directed rows plus
sibling rows `plan()` rewrote (touching a node realizes the decay of all its edges) and
the renormalized nodes, so a count of `rows` ("links written") counts rewrites too.
**Fix taken:** the table is in the tunable's comment and associate NOTES §14. Whether lag
2 earns its rows is the owner's decision.

### 8. Tests: what was loosened, and whether each loosening was justified *(one tightened back — fixed)*
- `test/seams.test.ts`: the stop-reason check had become "any string". **Not justified;**
  the closed list is back, with `threshold` added.
- The deleted seams test "a hop RAISES a candidate the OTHER channels reached (a semantic
  hit)": justified by the change (semantic hits are seeds now, and a seed receives
  nothing); the lift is tested with `SPREAD_SEEDS: 1`, and the cue-fraction invariant by
  the "cannot DEMOTE" test. Hops landing on semantic hits (47 on master's semantic arm)
  are now impossible by construction; no delivered result was lost, because master
  delivered nothing through a hop either.
- "A hop NEVER mints a candidate" became the pointer test (intended), with a
  single-co-use-stays-dark test added. `landed` 1 → 0 in the record test: every candidate
  there is a seed. The demote test's `SPREAD_SEEDS: 0, HOP_CEILING: Infinity` and the
  associate erase/archive tests' `SPREAD_MIN_FRACTION: 0` isolate the property under test.
  Doctor test counts moved because rows were added.

### 9. Contiguity at a full node evicts a waking-learned link *(note — a decision; now counted)*
- A hub with 31 learned edges at 0.1 and one faded co-use at 0.03: a lag-1 contiguity
  pair (0.045) makes the count cap evict the learned 0.03 edge. At the outgoing bound,
  every learned sibling is scaled down by 4/4.045.
- This follows the brief ("full waking homeostasis"). **Now counted:** the boundary row
  says how many OTHER links contiguity pushed out at the nodes it touched
  (`evictedOther`), how many of its own new links were evicted (`evictedOwn`), and how
  many of its nodes were scaled back (`renormalizedNodes`); doctor says it.

### 10. The dashboard says the opposite of what the code now does *(note — the dashboard session's)*
- The association mechanism page says "a link cannot bring one to mind by itself" and
  "Links form only from use" — both false after this PR.
- The registry describes `associate.flush` as having "wired together the memories its
  sessions credited together"; boundary rows now also carry contiguity.
- `mechanism-evidence.ts` has the comment "a hop only lifts what the turn already
  reached".
- Listed in the PR's dashboard follow-ups.

### 11. Two runners at once could plan the same pairs twice *(note — stated as a known gap)*
- The cursor read, the row read and the cursor write are not one transaction and the
  runner has no lock; two boundaries inside about a millisecond could buffer the same
  deltas. A session that ends twice is fine (the second pass is `nothing-new`). Stated in
  associate NOTES §14.

## Decisions for the owner

**A. The pointer lane: on, off, or a different number.** Bench, head `7e310b8`, 40
labelled queries on the seeded demo store; "off" is `LINK_POINTERS_MAX: 0`.

| setting | lexical hits | lexical delivered/turn, precision | lexical pointers (relevant; distinct) | semantic hits | semantic pointers (relevant; distinct) | bytes/turn | fixture |
|---|---|---|---|---|---|---|---|
| off | 17/40 | 4.38, 0.114 | 0 | 21/40 | 0 | 813 | 0/6 |
| **0.05, 2 a turn (as built)** | **18/40** | 5.17, 0.101 | 32 (1; 8) | **22/40** | 31 (1; 8) | 932 | **6/6** |
| 0.06, 2 | 17/40 | 5.00, 0.100 | 25 (0; 7) | 22/40 | 23 (1; 8) | 909 | 6/6 |
| 0.0625, 2 | 17/40 | 4.97, 0.101 | 24 (0; 7) | 22/40 | 22 (1; 7) | 905 | 6/6 |
| 0.07, 2 | 17/40 | 4.90, 0.102 | 21 (0; 6) | 21/40 | 16 (0; 6) | 896 | 0/6 |
| 0.08, 2 | 17/40 | 4.75, 0.105 | 15 (0; 6) | 21/40 | 13 (0; 6) | 872 | 0/6 |
| 0.10, 2 | 17/40 | 4.55, 0.110 | 7 (0; 5) | 21/40 | 5 (0; 4) | 842 | 0/6 |
| 0.05, 1 a turn | 17/40 | 4.88, 0.103 | 20 (0; 7) | 21/40 | 20 (0; 7) | 881 | 6/6 |
| 0.05, 2, strongest single path only (a probe) | 17/40 | 4.78, 0.105 | 16 (0; 4) | 21/40 | 15 (0; 4) | 884 | 6/6 |

- The fixture has a cliff at 0.0625, by arithmetic: its link weighs 0.5 and a direct link
  from the strongest seed passes w/8. Every setting that keeps the fixture keeps 22–32
  pointers a run; every setting that cuts them much loses it.
- The pointers are hubs: 32 shown are 8 distinct memories — five self-beliefs linked to
  each other at 0.57–0.69, and three chapter journal entries with 30 ties each at 0.3,
  which get in by summation. A single-path rule removes the chapters but keeps the
  self-belief cluster, and loses the one relevant pointer (which arrived by summation).
- Cost: about 115–120 bytes a turn (about +15% of the injection on this store); latency
  unchanged. A shown pointer the reply expands with its anchor strengthens the link that
  produced it, so hubs can grow.
- The reviewer's read: the number is not the lever; on/off is. Leaning slightly to
  **on at 0.05, 2 a turn, and watch doctor's shown/expanded ratio** for a week or two;
  off if expanded stays near zero. The demo store's links are not the owner's.

**B. Contiguity through full homeostasis, or "lands only where there is room" like dream
links.** Finding 9 shows the cost; `planProposal` already implements room-only landing.

**C. Keep lag 2?** It lives 3.5 lived days in the common one-batch case; dropping it
halves contiguity's rows.

**D. "A strong hop-2 node beats a weak seed"** holds in the queue order and not in the
result: a seed receives nothing, seeds are the top 24 and the cut keeps 24, so hops only
lift what ranks past 24, and on the bench nothing lifted was delivered. Whether seeds may
receive from other seeds is the next build's question.

**E. The failing dashboard test.** Green is correct: the seeder's boundaries always
flushed co-use pairs in-process, and the boundary now writes a row for that flush, so the
light is backed by real rows of real links (for example day 30: `pairs 35`, of which
`contiguity.pairs 7`). The change to `test/dashboard-mechanisms.test.ts` 137–139 is the
review's.

**F. Contiguity's first pass on the live store, and revised memories.** It links only
memories born on the current lived day, after one read of every memory row (no bodies).
A superseding row is linked as new; see associate NOTES §14 for what carries over.

## Verified

- Typecheck clean; the bench reproduced to the digit on `7e310b8` (lexical 18/40, 5.17,
  0.101, 32 shown, 1 relevant; semantic 22/40, 5.25, 0.119, 31 shown, 1 relevant;
  fixture 6/6 both channels; contiguity backfill 152 pairs, 596 rows, 8 renormalized,
  21 swept).
- No leak through the pointer lane: archived, superseded, owner-removed and confidential
  (to a stranger) targets were none shown; the confidential one was recorded
  `confidential-withheld`. Only the ambient turn wires spread; deliberate recall shows no
  pointers.
- Never loud; pointers trimmed before their anchors; shown and expanded counted; the
  best-first walk deterministic; the hop ceiling as described.
- Worst case probed: 240 pointer candidates in one turn cost 33 ms of prose reads (2.2 ms
  without) against a 1200 ms budget; all were unanchored. Deferring the read past the
  anchor check would save them; not needed at this size.
- Hygiene: no dashboard source touched; no attribution lines; no NEVER/ALWAYS language.

## Suite and bench after the review commits

- `tsc --noEmit`: clean.
- Bare `bun test`: 4464 tests across 118 files, 4456 pass, 0 fail, 8 skip (the live
  browser files included; the run was not killed).
- The final bench arm and the fixture re-run on fresh copies: unchanged to the digit —
  lexical 18/40, 5.17 delivered a turn, precision 0.101, 32 pointers; semantic 22/40,
  5.25, 0.119, 31; fixture 6/6 in both channels; no delivered set changed. The seeded
  store has no nightly-run rows, so finding 1's fix does not show on it.

## Decisions taken

| Finding | What was done | Where |
|---|---|---|
| 1 | Nightly run's rows left out of contiguity (origin and source), counted as `excluded` | `store/index.ts` contiguity reads, `counterpart.ts#bufferContiguity`, doctor |
| 2 | `landed` reported; doctor says "buffered … landed" | `counterpart.ts#contiguityOutcome`, doctor |
| 3 | Durable row on a failed pass, unflushed pairs, or pairs lost; cursor `pending` mark | `counterpart.ts#recordBoundaryFlush`, `#bufferContiguity` |
| 4 | Pointer ceiling and `pointersCapped` removed | `recall/activate.ts`, `recall/tunables.ts`, recall NOTES §19 |
| 5 | `via: "link"` on durable footnote rows | `counterpart.ts#tierRows` |
| 6 | Known gap, stated | associate NOTES §14 |
| 7 | Lifetimes table in the tunable comment and NOTES; lag 2 kept | `associate/tunables.ts`, associate NOTES §14 |
| 8 | Stop-reason list restored, with `threshold` | `test/seams.test.ts` |
| 9 | Counted (`evictedOther`, `evictedOwn`, `renormalizedNodes`); full homeostasis kept | `counterpart.ts#contiguityOutcome`, doctor |
| 10 | Listed as dashboard follow-ups | PR body |
| 11 | Known gap, stated | associate NOTES §14 |
| A | Pointer lane on or off | waiting for the owner |
| B | Contiguity through full homeostasis or room-only | waiting for the owner |
| C | Keep lag 2 | waiting for the owner |
| D | Seeds receiving from other seeds | waiting for the owner (a later build) |
| E | Dashboard test changed to green, as the review gave it | `test/dashboard-mechanisms.test.ts` |
| F | First pass today-only; supersede noted | waiting for the owner ("start at the next boundary after release") |
