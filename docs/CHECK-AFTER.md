# Things to check after a few days

Mike's ask (2026-10-11): a list of what to look at once the new mechanisms have lived a few days on a real
store. Each entry says what to look at, where, when, and what result would change a decision. Decisions
themselves live in `docs/IMPROVEMENTS.md` ("Decisions to review"); this file is the follow-through. Strike an
entry when it's checked, with the date and what was seen.

Read-only on the owner's store: open it with `sqlite3 "file:$HOME/.counterparts/store/counterparts.sqlite?mode=ro"`
or the CLI's read commands (`counterparts mechanisms --dir …`, `counterparts doctor --config …`,
`counterparts claims-era --dir …`). Anything heavier runs on a snapshot copy, never the live store.

## Due 2026-10-12 (lived day 21, the first new-curve pass)

### The new curve actually ran
- **Look at:** `SELECT value FROM meta WHERE key = 'decay.curve'` is present, and
  `SELECT count(*) FROM memories WHERE archived = 0 AND next_change_day IS NULL` is ~0 after the day's first
  sleep cycle (log `counterpart.sleep.cycle` with `"day":21`).
- **Why:** on 10-11 the key was absent and every live row had a NULL next-change day, because day 20's decay
  ran on 0.3.16 before the 07:25 migration (decay runs once per lived day).
- **Changes a decision if:** still absent after a day-21 cycle → the turn-down isn't applying on a migrated
  store: a bug lane before anything is published.

### Below reach: 56 (live) vs 149 (the 10-10 copy at +0)
- **Look at:** `counterparts mechanisms --dir ~/.counterparts/store` "Forgetting" line, against the 10-10
  snapshot-copy numbers (in reach / below / archived at +0: 621/770 with the era on).
- **Why:** on 10-11 the live store said 56 below reach; the copy said 149. The live 56 may come from the ranking
  cache written under the old curve, not the new one.
- **Changes a decision if:** after the first real pass the live number is still far from what the curve
  predicts → the dashboard/mechanisms count reads a stale source; fix the reader before trusting any fading
  number.
- **Also send** random-06: in reach / below / archived, the era's count read at default, and any core or
  owner/us memory that moved a band.

### Dated memories archived on the first pass
- **Look at:** archives made on day 21 whose row has an `event_date` (one-off, not repeating), and whether any
  of them is something Mike would still want (a reminder for something not done yet, a felt dated fact).
- **Why:** since Mike's 10-11 call (cut the spent slope), a one-off dated memory is back on its own curve the
  day after its date plus the grace week, as if never held. A routine one written weeks ahead is archived that
  same night (readable by id, never deleted). The ~17 dated rows on the store were never counted.
- **Changes a decision if:** a reminder for something still pending is archived → its date was wrong, or the
  hold needs to key on "done" rather than on the date.

## Due 2026-10-14 (the check-in, reminder mem_8a53c5d0bc95)

### The tax deadline shows under Arriving on 10-13 and 10-14
- **Look at:** the wake in a session on the morning of 10-13 and of 10-14: "Arriving:" lists the
  Oct-15 tax deadline (a plain reminder).
- **Why:** two quiet items due 10-14 took both of Arriving's lines from it (found by the 0.3.17
  release check); Arriving now ranks plain reminders first, then nearest date (IMPROVEMENTS,
  "Decided by random-06, 2026-10-11").
- **Changes a decision if:** it is still missing → the cap needs to grow, not just reorder.

### Decision 1: faded matches crowding fresh ones in facts recall
- **Look at:** a few real facts-mode recalls on the live store (Mike's normal questions); count how often a
  faded match ranks above a fresh one that answered the question better.
- **Why:** Decision 1 (kept, Mike 10-11) ranks faded matches inline with bodies, for the benchmark's counting
  questions. Mike: be cautious about changing the core app to fit the benchmark.
- **Changes a decision if:** faded matches visibly crowd fresh ones → switch to the fallback variant (a″), a
  mild fade-scaled penalty on the order only (IMPROVEMENTS item 1).

### The rest of the Decisions list
- **Look at:** items 4, 5, 6, 8 (kept 10-11, lightly held) with the first lived days of data: the in-reach
  curve over days 21–23, which memories left reach, whether any core or owner/us memory moved.
- **Changes a decision if:** a memory Mike would miss left reach, or routine work notes are still in reach
  after ~3 lived days.

## Due at lived day 27 (7 lived days after the new curve's first pass)

### Item 6: exit at 7 instead of 14 — a dry run
- **Look at:** on a SNAPSHOT COPY, run the prune's eligibility with `D_FLOOR_DAYS` = 7 (read-only: compute,
  don't archive) and list what WOULD be archived, against what 14 archives.
- **Why:** Mike wants a faster read on whether exit at 14 is right (item 6, kept 10-11).
- **Changes a decision if:** the 7-day list holds nothing he'd miss → consider 7; if it holds things he'd miss,
  14 stays (or the curve is too steep for those kinds).
- **How:** there's no CLI for it yet; a short script on the copy using `physics` + `sleep/prune.ts`'s
  eligibility with the constant overridden. Ask the coordinator for a lane if it's needed.

## Once drewOn gives a signal (≥ ~5 lived days after it ships)

### Item 9: mood-matched recall re-test
- **Look at:** with `drewOn` and opens as the use signal, compare how often memories lifted by a matching mood
  are used vs not lifted (the 10-10 evidence was 1.3% vs 2.4% on the old use metric).
- **Changes a decision if:** mood-lifted memories are used as often or more → turn the mood weights back up
  (code kept, weights 0).
- **Also look at:** doctor's Credit line's 7-day `drewOn` count. Zero after a week means the field isn't being
  used, which is a prompt problem, not a mechanism result.

## Ongoing (first two weeks)

### The old-claims era's effect on archives
- **Look at:** `counterparts claims-era --dir …` (count read at default) and archives with no
  `archived_reason` of corrected / dream-merge / episode-regrown / handoff-cleared, i.e. exits by fading, split
  by whether the era read them at default.
- **Why:** the era (Mike 10-10) reads 468 old claims at their default; on the 10-10 copy it caused 50 more
  archives by +30 lived days than without it (73 vs 23).
- **Changes a decision if:** the era's archives include memories Mike would miss → `counterparts claims-era
  --off` reads claims as stored again (archives already made stay archived, readable by id).
