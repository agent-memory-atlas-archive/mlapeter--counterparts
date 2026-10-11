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

### Expected on the live store until 0.3.18: personal memories at the old 0.25 default go below reach
- **Look at:** owner/us memories below reach after the first new-curve pass (preview on a copy: 18, all at the
  old 0.25 default, mostly learned 10-08..10-10).
- **Why:** the live store runs 0.3.17, where the old-claims era only reads explicit claims DOWN; reading old
  DEFAULT claims at today's default (owner/us/me → 0.40, Mike 10-11) is #395, which ships in 0.3.18. Below reach
  is not archived: asking still finds them, and the 0.3.18 re-curve lifts them back. NOT a regression.
- **Changes a decision if:** they're still below reach after 0.3.18 is installed and has had one pass → the era's
  default reading isn't applying: a bug.
- **Version facts, checked with git:** 0.3.17 (v0.3.17 @7c0d2f59) HAS the dated hold without the spent slope
  (`afterHold: "own-curve"`) and drewOn's `repScale`; it does NOT have #395 (old defaults at today's default),
  #398/#400 (merge and revision inherit about/era), #403 (gist marks), or catch-up (#401).

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

## Due at the first live catch-up (the nightly run's or `counterparts catch-up`)

### Catch-up's real per-part cost
- **Look at:** the run's `adapter.night.writeup` row (parts, batches) and its children's transcripts / usage
  (runners `writeup-nrn_…` / `writeup-cup_…`): output + cache_write tokens per part, and tool calls per part.
  Compare with the estimate (~7k new-work tokens and 2 calls a part) and the nightly baseline (246k new work,
  20 calls; `~/counterparts-notes/2026-10-10-nightly-cost-baseline.md`).
- **Why:** both ceilings (100 parts a night, 400 for the command, Mike 10-11) rest on that per-part estimate,
  which was worked out from part sizes, never measured from a catch-up transcript.
- **Changes a decision if:** the real cost per part is far above the estimate → lower the night's cap
  (`NIGHT_WRITE_UP_PARTS`), and look again at the command's.

## Due at the first live nights with the reflection in its own child

### Peak context per child on a heavy night
- **Look at:** the `dream.night` row's `children` (expect `dream:0,reflection:0`), and the two children's
  transcripts under `~/.claude/projects/-Users-mlapeter--counterparts-store/` (one session each): peak context
  (max input + cache write + cache read over a child's turns, deduped by message id) and new work per child.
- **Why:** measured once on a light night only (one agent 148k, then dream child 98k and reflection child 70k;
  `src/core/dream/NOTES.md`, 2026-10-11). A heavy night (the writer writing, 50+ fresh) was not measured.
- **Changes a decision if:** the dream child alone goes past ~150k → the dream bundle's room (`NIGHT_CHARS`) or
  the queue (Group 3) is next; if new work goes past the 2× cap (~490k), look at the reflection's re-written cache.

## Due 1 lived day after the verbatim trial ships

### Verbatim in the memory's body: first look
- **Look at:** the bench 76-question slice (counterparts-07) for meaning-search blur on long bodies: do memories
  holding a long verbatim block still come back for questions about their gist? And on the live store, any
  memory written with a list or a table since the ship (a facts line ending "(a list, N items; read whole by
  id)" finds them): did it come back whole by id, and was it findable by what it is, whose, when?
- **Why:** Mike's trial (2026-10-11, very lightly held): `remember` and `session_end` now ask for a list, a
  table or a pasted text whose specifics matter word for word in the body, with the search words in the title
  and the first line. The body is stored and read whole, but the meaning vector is made from the title and the
  body's first ~3,072 characters (at most 512 tokens; a numbered list reaches 512 tokens sooner), so the rest
  of a long block is reached by words only. Also watch: a facts answer saying "near-duplicates … left out"
  over two lists that were different (since the review of #409, a list or a table is compared by its lines,
  not its word set; two near-identical versions of one list still fold, and the older may be the one shown).
- **Changes a decision if:** long bodies blur meaning search, or real lists don't come back whole and findable
  → move to an attachments table (Mike's long-run lean), with the memory holding the context and keywords
  that find the attachment.

## Due ~4 lived days after the verbatim trial ships

### Verbatim in the memory's body: second look, and decide
- **Look at:** the same as the first look, on the days since: the bench slice again if anything changed, and
  every live memory written with a list, a table or a pasted text.
- **Changes a decision if:** decide the trial → keep it, or → attachments (a table of the blocks, the memory
  holding the context and keywords that find one). Record the call in `docs/IMPROVEMENTS.md`.

## .18 / Group 2 (one model for "this replaces that"), the first week after it is installed

### No settled-over memory outranks its head in ambient results (MOD #3)
- **Look at:** `recall.decision` events since the install: any id in `surfaced` or `footnotes` for which a
  settled `changed` / `corrected` pair names it as `over` (and whose head is live), on a turn where the head
  is not also shown. With the head-wins rule (recall CONTRACT §6b) that should be only a guest session with a
  confidential head. Also the wake's lanes, which already left settled-over memories out.
- **Why:** on 10-10 earlier versions were shown 55 times after their settle, 51 of them without the newer.
- **Changes a decision if:** an earlier one still shows beside or above its head → the gate's inhibition is
  missing a door (a quiet pointer, a carried cue): a bug lane. The head showing for an earlier the turn reached
  when the head reads wrong for the turn → the swap needs a bar of its own.

### Detector precision on the owner's store: hand-read 20 proposed slots
- **Look at:** `counterparts settle --dir …` ("Proposed as a newer state") and `contradiction.proposed`
  events: how many a day, and a hand-read of 20 (ids and verdicts only), with what the dream did to each
  (`slot` same true / false in `dream_changes`).
- **Why:** before install, on the 10-11 copy, a replay of the write-time rule over 20 lived days read 17 of
  20 right, 1 wrong, 2 unsure; replayed on the store as it stands now (the writer's own settles already made) it
  proposes 5 over 20 lived days, 4 of them in the last 7.
- **Changes a decision if:** fewer than ~3 in 4 are right → raise `SLOT_COSINE` or drop the title arm; the
  dream says `same: false` to most → the provisional cut should be a flag only (no fade) until confirmed.

### The dream's confirm/undo stays inside the night
- **Look at:** the dream bundle's "to-confirm" items (at most 4) and `toConfirmMore`, the dream's `slot`
  changes per night, and whether the night run's part count (`NIGHT_WRITE_UP_PARTS`, 100, shared with
  catch-up) or its time moved. The detector itself makes no model call; confirming rides the one dream.
- **Why:** on the 10-11 copy the 4 waiting proposals cost ~1.1k characters of on-mind text plus their memory
  lines in the fitted room; nothing else.
- **Changes a decision if:** `toConfirmMore` keeps growing night over night → proposals outpace the dream's
  4: raise `SLOT_PER_NIGHT` or tighten the rule.

## Group 4 (association), due ~5 lived days after it ships

The fast-forward on the 10-11 copy (7 lived days replayed with write-time links, replay deposits and
co-use running, no model calls) is the baseline: write-time 95 new trails (904 before the review of #423
narrowed them to a jot's own turn), replay ~505, co-use 46 pairs (all on links that already existed); 0
pointer candidates at the current threshold, ~200 of 635 turns at 0.0125; the first flush swept ~2,040
inert rows (regrown copies and merge originals). A forward simulation has no awake use, so it cannot say
how many new trails use would confirm.

### Edges laid per day, by source
- **Look at:** per lived day, `sum(json_extract(payload,'$.deposited'))` over `associate.flush`, its
  `atWrite.landed`, `contiguity.landed`, and `dream.begun`'s `replayLinks`; the drewOn `recall.credit` rows'
  `linked`.
- **Why:** "links made" counted rows rewritten until now; these are the pairs that landed. On the copy,
  write-time links were 0–59 a lived day once only jots get them; the replay is now the larger source.
- **Changes a decision if:** write-time rows swamp the table (more than ~3× contiguity's) → lower
  `WRITE_LINK_MAX`, or drop write-time links (IMPROVEMENTS, Group 4).

### The share of write-time links later reinforced
- **Look at:** the share of write-time links later reinforced, on the live store, measured a week after the
  release that ships this installs: of the pairs laid by `atWrite` (and, beside it, the replay), how many
  weigh more than 0.05 a few days later (a co-use or a drewOn deposit landed on them): `edges` with
  `weight > 0.06` whose pair first appeared on an `atWrite`/replay day.
- **Why:** the ants rule only works if use confirms some trails, and only real use can show it.
- **Changes a decision if:** ~0 after a week of drewOn → the trails are noise that nothing confirms: lower
  `WRITE_LINK_MAX` or drop write-time links; and item 4's reinforced column (v14) has nothing to act on yet.

### Hand-read 20 write-time edges for noise
- **Look at:** 20 random pairs from `atWrite` days, both memories' titles, right / noise / unsure.
- **Why:** on the copy, after the tightening, 40 read 5 right, 6 unsure, 29 noise (before it, 20 read 1, 3,
  16, the batch ones 0, 2, 14). Every own-turn candidate was a footnote; G1b's footnote precision was
  0.17–0.33.
- **Changes a decision if:** still mostly noise on real use → drop write-time links and let drewOn and the
  replay lay trails.

### "Links reached recall" > 0, and the Association light
- **Look at:** `sum(json_extract(payload,'$.linksReached'))` over `recall.decision` for the last 7 lived
  days; the dashboard's Association light.
- **Why:** it goes amber when links were laid and none reached recall, once the store has lived 14 days and
  laid 20 links that week (waiting before that). The owner's store passes both, so expect amber there after
  install: the copy had 0 pointer candidates at the current threshold.
- **Changes a decision if:** 0 for 7 lived days with deposit running → re-run the 10-02 replay arms on a fresh
  copy and decide the pointer threshold (`LINK_POINTER_MIN_FRACTION` 0.05 → 0.0125, review 06 C7).

### The clinic pair, on the bench store
- **Look at:** copy the bench store `s500-t-h55-clean/73d42213` and run one dream; the 7 AM memory and the
  memories that say the last clinic trip took two hours are linked (`edges` both ways, ≥ 0.05).
- **Why:** bench item 5/6: before, edges only ran between memories of the same conversation. The bench
  writes every memory in a session-end write-up with no recall while it writes, so write-time links never
  fire there; the replay is what links it (it did on a copy at review, 10-11).
- **Changes a decision if:** not linked → the dream's neighbours miss what a real writer had in mind; look
  at which.

## Ongoing (first two weeks)

### No settled-over memory outranks its head in ambient results
- **Look at:** turn-recall footnotes ("Quietly available", "Came to mind"), the wake's Nearby, and the other
  wake lanes, for a memory that a `changed` or `corrected` settle made earlier, shown above the memory that
  replaced it, or shown without it.
- **Why:** MOD's #3 (10-11): a settled-over memory's title showed bare beside newer ones, and a session repeated
  a corrected rule from it. Marking those titles is its own lane; this is about whether the earlier one
  ranks above its head at all.
- **Changes a decision if:** it happens → interference/supersede ranking needs a fix (Group 2).

### The old-claims era's effect on archives
- **Look at:** `counterparts claims-era --dir …` (count read at default) and archives with no
  `archived_reason` of corrected / dream-merge / episode-regrown / handoff-cleared, i.e. exits by fading, split
  by whether the era read them at default.
- **Why:** the era (Mike 10-10) reads 468 old claims at their default; on the 10-10 copy it caused 50 more
  archives by +30 lived days than without it (73 vs 23). Since 10-11 the count has two parts, read lower
  and read higher (old defaults below today's, e.g. owner/us at 0.25 → 0.40), so it jumps by the read-higher ones.
- **Changes a decision if:** the era's archives include memories Mike would miss → `counterparts claims-era
  --off` reads claims as stored again (archives already made stay archived, readable by id).
