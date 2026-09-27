# `dream/` — NOTES

What the build learned, and every choice the brief left open (2026-09-26).

## The tunables (`tunables.ts`), and why each number

| name | value | reason |
|---|---|---|
| `MIN_NEW` | 3 | a dream with less than three new memories to replay is not worth the owner's minutes |
| `FIRST_DREAM_DAYS` | 7 | a store that never dreamed treats the last week as "new" |
| `MAX_NEW` | 40 | bounds the bundle: newest first |
| `NEIGHBOURS` | 6 | the owner's "5–8" |
| `MIXING` / `MIXING_FROM_RANK` / `MIXING_TO_RANK` | 5 / 12 / 40 | "loosely related": ranks 12–40 of a new memory's neighbourhood, picked at random (a seeded RNG, so a bundle is reproducible from its dream id) |
| `LOOKBACK_DAYS` ± `LOOKBACK_SPREAD`, `LOOKBACK_COUNT` | 7 ± 2, 5 | "about a week back", the strongest-felt five |
| `TEXT_CHARS`, `PAGE_CHARS`, `WAKE_CHARS`, `CHAPTER_CHARS`, `MAX_CHAPTERS` | 400, 6000, 6000, 3000, 6 | keep the bundle well under an MCP tool result's size |
| `LIMITS` | merge 10, link 20, gist 3, replayed 60, contradiction 10, feeling-now 10, nominate-core 3 | the owner's "~10 merges, 20 links, 3 gists"; the rest sized so a dream over 40 new memories can replay each |
| `LINK_WEIGHT` | 0.3 | about three Hebbian co-activations (`HEBB_RATE` 0.1): a dream's link is a suggestion, not a certainty |
| `MAX_TEXT_CHARS`, `MAX_JOURNAL_CHARS` | 2000, 12000 | bounds, not targets |

## Choices the brief left open

1. **The journal is a column on `dreams`, not a memory kind.** The brief allowed either.
   A memory kind would have needed every scan (decay, dedup, prune, recall, the wake,
   the census, the dashboard's lists) to learn to skip it; a table nobody scans for
   memories needs nothing. The owner reads it with `counterparts dream --show` and on
   the dashboard.
2. **"Last dreamed" is the newest `dreams` row**, and the snooze a `dream_asks` row per
   calendar date — both durable rows, not meta.
3. **The ask is once per calendar day across sessions**, claimed when the line is
   composed. A line the host then drops (an envelope too small) costs that day's ask;
   the plain reminders' claim-at-delivery would fix it (INTERFACE-GAPS §2).
4. **The ask waits for a store's second lived day**: "I haven't dreamed since …" needs a
   since.
5. **A begun dream that did nothing does not use up the day**: the next `begin` closes it
   `undone` and opens a fresh one (an agent that gave up, a crash).
6. **A merge takes 2–3 memories of ONE kind, none of them core.** The merged memory
   stands where the strongest original stood (its salience, its channel, its legacy
   consolidation), with the most uses, the latest use and the earliest birth, every
   original's returns (the `returns` rows are carried) and feelings, and their links
   (`associate.retargetOnSupersede`, which had no caller until now). So a merge never
   leaves a memory weaker than what it was made from.
7. **`feeling-now` is the self's feeling, capped at the memory's peak.** A dream records
   softening; it cannot raise a memory, nor open the core's fast lane.
8. **`nominate-core` only for a memory about me or about us** — the same reading the
   lanes use; a nomination of anything else would be noise.
9. **A dream's words are redacted of credentials, not run through the full gate
   battery.** The battery refused short text (`content-too-short`): a one-line journal,
   a nomination's reason, a merged sentence. The words are rewordings of memories that
   already crossed the battery.
10. **Contradictions are raised once each**, by a meta latch (`dream.raised.<dream>.<seq>`),
    at most two a session, and only when both memories are showable in that session.

11. **The ask is cheap, because it runs on every prompt.** `status` answers observer,
    first day, dreamed today and the day's ask row before it counts anything, and "new
    since" is one bounded read (`store.newMemoryIds`, the column gates in SQL) with the
    deny-list and confidentiality applied to what comes back. The first version walked
    every memory row per prompt (~17k queries on the owner's store) on every quiet day.
12. **One anchor for "the last dream"**: the newest dream not undone. The ask, "new
    since" and `begin` all read it, so after an undo they agree.
13. **A dream cannot strengthen what a dream wrote**: `replayed` and `merge` refuse a
    `dreamed` row (`dreamed-rises-only-awake`). A gist rises only by proving true awake.
14. **A dream can refer to what it made** in an earlier `propose` call of the same dream
    (a merge's memory, a gist): those ids join what it was shown.

## What it cost to find out

- The dashboard's import-scan reads `from"` as a module path, so reading a merge's
  `from` key needed a destructure (dashboard NOTES).
- The store bans deletion verbs in method names; undo's helpers are `restoreEdge` and
  `retract*`.


## After the review of #251 (2026-09-26)

- **Merged return days are a UNION (Q4, confirmed and tested).** `supersedeInto` copies
  returns under `(memory_id, day, source)`, and `return_days` is `COUNT(DISTINCT day)`
  of awake rows. Two originals that came back on the same day give the merged memory
  that day once.
- **An undone dream no longer lights anything.** Proofs read from dream events carry
  `stands`, which drops rows whose dream is undone. This covers Dreaming,
  Consolidation's dream merges, and Episodic → semantic's gist.
- **Replays follow spacing** (physics NOTES): a memory in every night's bundle counts at
  most once a week.
- **Removal redacts journals** that cite or quote the removed memory (store NOTES).
