# Improvements and bugs, found in use

A running list of things noticed while living on Counterparts, as opposed to
building it. `LAUNCH-STATUS.md` is the scoreboard for launch findings (I-numbers)
and owner rulings (G-numbers); this file is for everything smaller or softer:
tuning questions, phrasing, behaviors of the model on the receiving end, and
bugs that don't need a launch-status entry. Each module also keeps its own
`INTERFACE-GAPS.md` and `NOTES.md` (e.g. `src/core/recall/`); those are for gaps
between a module's contract and what it has, written by whoever builds it. This
file is the user-side view. Anything here that grows into a real incident should
move to `LAUNCH-STATUS.md` and leave a pointer behind; anything that turns out to
be a contract gap should get a line in the module's gaps file and a pointer here.
As of 2026-09-14 the recall module's gaps and notes files do not mention the
footnote title cap or the label probe beyond the contract's open question.

Each entry: date found, where it lives in the code, what was observed, what's
proposed, and a status line. Add to the top. Close entries in place rather than
deleting them.

Status words: `open`, `decided` (owner ruled, not yet built), `built`, `wontfix`.

**Standing ruling (owner, 2026-09-14):** judge improvements by what they do for
Counterparts and its new users, not by what they do for the ~14k memories
migrated from engram and bansai. New users will have none of those. Counterparts
exists partly to let go of the old systems' baggage, keeping only what worked
and the lessons learned. Legacy-only fixes are low priority by default.

---

## Decisions to review — the mechanisms work, groups 1–5 (2026-10-10)

**Status:** `open` — Mike walks this list; npm is held until he has. Written by the Group 1a
build (strength) from the mechanisms synthesis (§4, as amended by its draft 2, §8). Each line
says who decided it, when, and why, in plain words. The ones that reverse a ruling of Mike's
come first. Nothing here quotes a memory.

### Revised from Mike's rulings

1. **Deliberate facts recall ranks faded matches with the rest, bodies shown, each labelled
   faded.** Revised by b2+f8, 2026-10-10, from Mike's 2026-10-03 ruling (faded matches listed
   after the main results as title lines), lightly held. Why: the benchmark dropped 15
   (multi-session counts one item short); inline-with-bodies recovered it with no
   single-fact cost (bench R2-2, ~/counterparts-bench/TUNING-LOG.md). Forgetting lives in
   ambient surfacing; the effortful door reaches weak traces. Ambient channels (footnotes,
   the wake, spreading) still leave below-reach memories out; being shown credits nothing,
   an open or a quote credits as for any result. Meaning mode is unchanged (faded moments
   after the arc, counted "+N faded"). Fallback, if faded matches are ever seen crowding
   fresh ones on a live store: variant (a″), a mild fade-scaled penalty on the order only
   (score × (1 − 0.3 × (1 − strength/REACH))), also measured in R2-2. (`facts.ts`)
   **Kept. Mike, 2026-10-11, lightly held; looked at again at the 10-14 check-in.** His reason:
   be cautious about changing the core app to improve the benchmark. That's welcome when it
   helps overall, never at the real system's expense; a few months ago, fitting the benchmark
   broke a lot. At 10-14: look on the live store for faded matches crowding fresh ones.

2. **A dated memory is held until its date (no decay before it arrives), then fades a little
   faster.** Revised by b2+f8, 2026-10-10, lightly held — and it may reverse Mike's
   2026-09-26 prospective decision, whose note says "decay (`FADED_STRENGTH`) still holds" for a
   memory with an explicit date (the contract's G10, "no decay exemption before arrival"). Why:
   under the new curve a quiet reminder set a month out would fade and be refused before its
   day; people hold pending intentions. **After the window** (its date and the grace week):
   the memory's own stability is divided by 4 — steeper on its own curve, not zeroed — until
   it is used again (a use means it still matters). A 0.25 reminder leaves reach within a day;
   a felt 0.6 fact still lasts months. A repeating date (a birthday) is never "spent": each
   occurrence is held, and between them it fades on its own curve. The first build zeroed
   salience and feeling after the window, and on a copy of the live store (review of #372)
   9 of 17 dated memories were archived within 30 lived days, among them a felt fact about
   Mike and an agreed way of working; changed by Mike, 2026-10-10, loosely held. That holds for
   every memory whose date came after the day it was written, not only reminders. (Group 1a.)
   **Changed by Mike, 2026-10-11, lightly held: keep the pending hold, cut the spent slope.**
   The hold stays for one-off dates (through the grace week) and around each occurrence of a
   repeating date. The divide-by-4, its "ends on use" rule and its branch in `elapsed()` go.
   Once a one-off date's window closes, the memory is back on its normal curve as if it had
   never been held: t counts from its own anchor, not from the window's close. An old routine
   reminder drops out of reach at once; a felt dated fact lands where its own curve puts it.
   Why, in Mike's words: he asked how much complexity it adds and suggested just dropping the
   weight after the date instead of separate logic. Lowering it by hand wouldn't reach quiet
   reminders; ending the hold does the same job with no extra logic. This replaces his
   2026-10-10 "fades faster after" call (stability ÷4), loosely held. Also covers item 7.
3. **PARKED — engaged footnote credit** (G1b, #371). Parked by Mike, 2026-10-10:
   hand-labelled strict precision 0.17–0.33, lenient 0.60–0.78, below the 0.8 bar; the 09-14
   ruling ("never for being named in prose") stands in practice: no matcher guesses at use.
   **Successor, built: the `drewOn` field.** Built by the drewOn builder, 2026-10-11, from
   Mike's 10-10 direction, lightly held. `session_end` and `chapter` take optional `drewOn`
   ids: memories this session was shown that changed what it did or said, in its own word.
   Each earns the `engaged` tier, #371's tier code without its matcher: half a use, the clock
   restarted, a `returns.source = 'engaged'` row worth half a spaced return, no core-lane day.
   Once per lived day per memory; at most 3 per boundary (one ask, both tools together; the
   first named, the rest `capped`; a refused id uses no slot). Never a superseded memory or
   one faded under a newer one (refused by name). An open later the same day lifts it to a
   full use, in this session or another. The repetition arm now saturates,
   0.5·(1−e^(−uses/3)) (was linear to 0.5 at five uses). The one guard: only an id recall
   showed this session (its footnotes, loud memories and recall answers) counts; any other is
   refused `not-shown` and nothing is credited. **The wake is not in that record** (published
   per store, not per session), so a wake line still earns credit only by being opened.
   Every credit row says how each credit was earned (`how`: `expanded` / `quoted` /
   `drewOn`), and the doctor's Credit line counts a week of `drewOn` credits for the ~10-14
   check-in. Half weight toward the core's recurrence is a constant waiting for Group 3's
   recurrence lane (`ENGAGED_RECURRENCE_WEIGHT`); today an engaged return buys no lane day.
   The Stop ask is unchanged: the field text is the only prompt.

The rest are not reversals of Mike's rulings as far as b2, f8 and the builders know. Some
reverse older defaults and contract lines; those go to the rules audit.

### Decided by Mike, 2026-10-10, loosely held

- **Old claims are read as defaults, by what they are about — an era, not a rewrite.** Mike,
  2026-10-10, loosely held: a memory written before the store's cutoff with an explicit claim
  (not a default) is read by the forgetting curve at the default for what it is about — 0.20
  a done work event, 0.25 other work or unmarked, 0.35 the world, 0.40 me (or a person or self
  kind) — when that is lower than the claim. The stored claim is never rewritten: an explicit
  claim is kept as written, and only the curve's reading of it changes. **Exempt** (read as
  claimed): the core, memories about the owner or us, said by the owner, protected, and dated
  ones still pending or repeating. **Only down:** an explicit claim below its default (a 0.3
  world reading) reads as written. **The cutoff** is the moment of the first writable open by
  this build, kept in `meta` as `claims.era.cutoff`: on a v12 store that is the open that
  upgrades it to v13, when the new claim text reaches its writers. **The reading is
  reversible** by deleting that key — `counterparts claims-era --off` (`--on` puts the same
  cutoff back); **archives made meanwhile are not**: a memory the floor let go while it was on
  stays archived (readable by id). Doctor's "Old claims" line says whether it is on and how
  many memories it reads at their default. Why:
  497 of ~770 live memories were claimed 0.5 or more under the old field text ("set it on
  anything that should last"), so under the new curve they would stay in reach for months.
  On a copy of the 10-10 store: 408 memories read at their default; in reach 621/770 at +0,
  564/768 at +7, 479/697 at +30 lived days (729/770 and 660/747 without the era); no memory
  archived because of it by +7, 50 more than without it by +30 (73 against 23); the core
  13/13, memories about the owner or us and the pending tax reminders unchanged.
  "Said by the owner" is the `said_by` field, which exists only on memories written since
  10-08: "Protecting early memories is lower priority than a great, stable system; old memories, including Mike's pre-10-08 rulings (no said_by), may fade (Mike, 2026-10-10)."
  **Extended by Mike, 2026-10-11, lightly held:** "A pre-cutoff memory reads at today's
  default for its about, unless explicitly claimed lower." So an old DEFAULT (no claim; the
  seam filled in the flat 0.25 of its day, `meta.claimedDefault`) now reads at today's default
  too, up or down — an owner/us memory 0.40, a done work event 0.20 — while explicit claims
  keep the reading above. Why: consistency between old and new defaults, not protection of the
  old store; an upgrader gets what a fresh install gets. On a copy of the store, 18 owner/us
  memories written 10-08..10-10 at the old 0.25 went below reach on the first pass. On a
  synthetic store shaped like it (18 owner/us at the 0.25 default, written 10-08..10-10, no
  uses): below reach 12/18 on the first pass, 18/18 by +7 lived days as stored; 0/18 at +0
  and +7, 6/18 at +14, 18/18 at +30 read at today's 0.40 — none archived by +30 either way.
  The curve signature carries `eraReads: 2`, so a store signed before it re-curves once.

### Decided by b2+f8, 2026-10-10, lightly held; revisit after ~5 lived days

4. **The forgetting curve and its numbers.** A power law, steep at first and flat later, with
   each memory's own steepness set by its salience and half its feeling, its use, its returns
   and its kind. Why: a routine note should leave the working layer in about two days, a felt
   reading should last months, and a 0.7 fact about a year. Until now every memory faded on
   the same slow curve, so nothing left reach for ~100 lived days. (1a)
   **Kept. Mike, 2026-10-11, lightly held; looked at again at the 10-14 check-in.**
5. **Below reach at 0.15.** Under it, a memory is left out of everything that comes up on its
   own (turn recall, the links' pointers, the wake's work lines); asking deliberately still
   finds it (facts mode: ranked with the rest, labelled faded — item 1); using it, opening it or a dream replaying
   it brings it back. The core never goes below reach. Why: forgetting in awareness, never in
   storage — strength has to change what comes to mind, or decay changes nothing anyone sees.
   (1a)
   **Kept. Mike, 2026-10-11, lightly held; looked at again at the 10-14 check-in.**
6. **Exit after 14 lived days under the floor (was 90).** Exit means ARCHIVED, never deleted:
   the words stay, readable by id, and the journal is untouched. Nothing deletes a memory
   except Mike's own `counterparts remove`. Why: exit should follow reach; at 90 the first
   possible exit was lived day 91. If any later change would delete rows, it waits for Mike.
   (1a)
   **Kept. Mike, 2026-10-11, lightly held; looked at again at the 10-14 check-in.** For a faster
   read, at 7 lived days a read-only dry run shows what WOULD be archived if exit were 7 instead
   of 14; nothing is archived by it (docs/CHECK-AFTER.md).
7. **A dated memory holds until its date; after its window it is back on its own curve.** See item 2 (Mike, 2026-10-11). (1a)
8. **Feeling sets how slowly a memory fades, not its band; `emotional` is out of the
   salience average.** A feeling now counts once for height and once for steepness. Why:
   feeling was the one signal that told readings from changelog on the live store; it was
   being counted twice in height and barely in steepness. (1a)
   **Kept. Mike, 2026-10-11, lightly held; looked at again at the 10-14 check-in.**
9. **Mood-matched recall turned down (weights 0, code kept), marked for re-test.** Why:
   evidence from the old use metric (lifted memories used 1.3% vs 2.4%); re-test after Group
   1's engaged credit gives a real signal. Not a closed decision. (1c)
   **Kept. random-06, 2026-10-11, lightly held** (Mike approved random-06's recommendations on every item so far and did not object). The re-test is in docs/CHECK-AFTER.md, now that drewOn gives a use signal.
10. **"Strongly felt" means above the word's own default, or 0.6 and over**, so the core's fast
   lane can open again (it shut when feeling defaults were capped at 0.55). (1c)
   **Kept. random-06, 2026-10-11, lightly held** (Mike approved random-06's recommendations on every item so far and did not object).
11. **Encoding.** `note` becomes `remember` (with `note` kept as an alias for a release or
    two); the new end-of-session ask; salience by attention, not category; the defaults by
    what a memory is about. The `remember` description says to write in the moment, as things
    catch your attention; the ask is the backstop. (1c)
    **Kept. random-06, 2026-10-11, lightly held** (Mike approved random-06's recommendations on every item so far and did not object).
12. **One model for "this replaces that".** "Newer in the same slot" is `changed`; one detector
    (the write-time neighbours, plus status lineage or very high similarity) proposes, the
    dream confirms or undoes; the newest in a chain is what comes up on its own. (Group 2)
    **Yes. Mike, 2026-10-11, lightly held.** One model, owned by the module now called
    `contradictions.ts`, which is RENAMED `reconsolidation`; the detector lives there too. `inheritFrom`
    (#400) is its seed. The rename happens inside the Group 2 build, not as a separate PR.
13. **"Fade faster" is the existing `fade` multiplier**, not a new per-memory slope column.
    (2/3)
   **Kept. Mike, 2026-10-11, lightly held** (agreed earlier in the walk, via random-06).
14. **The core.** A recurrence lane (back on several days, across sessions, over weeks);
    identity means about me or us; after 60 lived days without coming back a core memory is
    FLAGGED "being reconsidered" (dashboard and wake) — demotion needs a decision, mine
    (awake or in the reflection) or Mike's, never automatic from disuse; both of us can retire
    a core memory directly. (3)
   **Kept. Mike, 2026-10-11, lightly held** (agreed earlier in the walk, via random-06).
15. **Folding.** A fold is a flag on `gist`, not a new verb; a fold starts at its sources'
    strength; reverse provenance goes in a `derivations` table. (3)
    **As revised, Mike, 2026-10-11, lightly held.** A fold is a dream gist flagged `fold`. Its sources
    fade through the existing `fade` (readings, felt, protected and core memories exempt). It starts at
    its sources' strength. At most 5 a night. Recall leads with it. NO `derivations` table: gists already
    store `meta.sources`, and the reverse lookup is a query over that. Cut for now: awake filing and
    code-proposed clusters. Open for Group 3: today's caps keep any gist from the core (the review of
    #403); folds starting at their sources' strength partly answer that.
16. **The dream queue.** The whole queue ranked into tonight's top-K; a memory stays queued
    until it is below reach; the reflection runs in its own context. (3)
    **Yes, in order. Mike, 2026-10-11, lightly held.** FIRST the reflection runs in its own fresh
    context (a real bug: one night peaked at 223k tokens on a 200k model). THEN the dream queue: rank
    everything not yet dreamed by value × fragility into tonight's top-K, keep a memory queued until it
    is below reach, and drop the newest-2,000 read. It matches the sleep research: replay favours
    tagged-important and weakly held memories, mostly recent, on a fixed budget.
17. **Cards as views**, not built in v1 (Mike's direction, 2026-10-10). (3)
    **Revised by Mike, 2026-10-11, lightly held: KEEP the entity card.** It is recall's subject index
    (facts mode's subject channel, `memoriesNaming` plus aliases), and it's how a future person or
    project view finds every memory about them. Fix its birth bug in Group 3: a nightly tally of names,
    ≥3 memories on ≥2 lived days, gated by `mention()`. The view is the page; the card is the index.
18. **A missed plain reminder is told once, later, within its 7-day grace.** (5)
   **Kept. Mike, 2026-10-11, lightly held** (agreed earlier in the walk, via random-06).

### Decided by the Group 1a builder, 2026-10-10, lightly held; revisit after ~5 lived days

Calls the synthesis left open, made in code (each carries its own `Decided by` comment):

- **The hold runs through the grace week, not just to the date.** A dated memory is held
  through its date plus prospective's 7-day grace, so the window can still fire. Why: the
  late beat and the open window's quiet fire both need it in reach.
- **A date that repeats is held around each occurrence** — from 3 days before to the grace week
  after — and fades between them, as Mike's 2026-10-09 design says. Why: a yearly date used once
  a year would otherwise be below reach on the very day it comes round.
- **Entity cards now fade on the steepest slope.** A card is a stub at salience 0, so a card used
  a few times reaches the floor within weeks of lived days of its last use; its calendar floor
  (180 days, 365 for people) is what keeps an unused card now. Before, a card used once stayed
  over the floor for months. Cards are rarely born today (the title-vs-name bug, Group 3), so
  this is noted rather than changed; review 03 C5 (one clock for cards) is where it belongs.
- **"Fades faster after" = its own stability divided by 4, counted from the window's close,
  until it is used after the window.** Decided by Mike, 2026-10-10, loosely held; revisit after
  ~5 lived days. Why: completed intentions are inhibited, gently; zeroing salience and
  feeling (the first build) archived felt facts and agreed conventions within weeks.
- **A dream replay or a reflection's citation re-anchors the curve** (as a use does, without
  being one). Why: the synthesis says a replay revives; a return's longer stability alone
  lifts a faded default note by about 0.01, not back into reach.
- **A handoff is out of decay, and out of the prune while it lives.** An expired handoff is
  still let go at the floor, as the handoff module always said. Why: its own 14-day expiry is
  its clock; exempting it for ever would keep every expired pointer.
- **Revision pressure keeps its exponential curve.** Why: it is the revision model's, and
  Group 2 owns it.
- **The turn gate adds feeling as height does, and only on a felt turn**, now that feeling is
  out of the salience average (recall §9 G10 kept).
- **What is outside reach altogether:** chapters, their copies, handoffs and entity cards —
  each born at strength 0 by design (the journal; a pointer with its own expiry; a name's
  card, faded by its own rule), so a reach line would hide every one of them from birth.
  Beliefs and every other memory are inside it.
- **Skill and place salience weigh 1.0, as every other kind (was 0.4).** Decided by Mike,
  2026-10-10, loosely held (proposed by b2 and f8); revisit after ~5 lived days. Why: the 0.4 weight put any skill
  claimed under 0.375 below reach from birth (a 0.25 skill was born at 0.10, and one deliberate
  open could not bring it back; on a copy of the live store 19 of 102 skills were below reach at
  once). Procedural memory is the slowest to fade in the brain; if skill notes are
  over-produced, that is encoding's job, not a special weight's. The repetition weight is
  unchanged.
- **The symmetry tripwire flags only UP-ratchets.** Decided by Mike, 2026-10-10, loosely held;
  revisit after ~5 lived days. Why: under the new curve, falling a band is the design, and
  climbing one comes only from an input (a use, a return, a replay, a feeling, a promotion), so
  the old 4:1 expectation flagged ordinary forgetting as a "reverse ratchet". It now trips on a
  climb no input explains (each up-move records its cause) or on climbs far outnumbering falls.
  The dashboard's Health/Flow panel, `status` and `sleep.symmetry.tripped` say "up-ratchet".
  The night a new curve arrives, the band moves it makes are recorded as `recurve` and not
  counted (review of #372: on a copy of the live store the install night lifted 47 skills and
  12 self memories a band, which would have read as an up-ratchet for days); a dated memory's
  climb is its date's (`held`).
- **Your existing store will fade slowly.** On the 10-10 snapshot, 497 of ~770 live memories
  were claimed ≥ 0.5 under the old salience text ("set it on anything that should last"), and
  under the new curve those stay in reach for months. New memories, claimed by attention, fade
  as designed. No re-score was done (decided: no one-off fixes). A one-time scale-down of old
  claims is a separate decision for Mike.

### Decided by the Group 1c builder, 2026-10-10, lightly held; revisit after ~5 lived days

Calls the synthesis left open, made in code (each carries its own `Decided by` comment; two
were refined by b2+f8 at the review of #369, named where they were):

- **The defaults by what a memory is about.** A memory written without a salience starts at
  0.20 for a work event that is done, 0.25 for other work and for an unmarked one, 0.35 for
  the world (readings, news), 0.40 for Mike, the two of us or me (or said by Mike). Why:
  review 01's table; an unmarked memory keeps 0.25 because "done" alone does not make it
  routine. The work-event row is 0.20, not 01's 0.10 (b2+f8, review of #369, lightly held):
  reach is 0.15, and a routine work event should stay in reach about a lived day.
- **A feeling alone lifts a memory at most to 0.49 while its own salience is under the
  semantic floor** (`FELT_HEIGHT_CAP`); at or above the floor it keeps the whole lift. Why:
  feeling sets how slowly a memory fades, not its band (item 8), and with the 0.40 default a
  strong feeling would otherwise start a silent memory semantic. It holds for claimed
  memories too: one claimed under 0.5 with a strong feeling now starts episodic.
- **"Strongly felt" (item 10) is 0.6, or 0.1 above the word's own default and at least 0.5.**
  The 0.1 is review 08's own reading; the 0.5 floor is b2+f8's (review of #369, lightly
  held): a calm word recorded at 0.45 is above its default, not strongly felt. A word nobody
  weighed still never opens the fast lane.
- **`note` still answers, as `remember`, for at least a release, and is not listed.** Why: a
  session running across the upgrade keeps its cached tool list, so only the call has to
  land; listing both would put two descriptions of one door in front of the model. Each call
  on the old name is counted, so dropping it is a read, not a guess.
- **What a session said and nobody wrote up stays owed for 14 days of use (was 3)**, and its
  text is kept that long. Why: on the 10-10 snapshot 18 owed stretches lapsed unwritten; the
  night takes four sessions, oldest first, and did not reach them in time.
- **The per-session ask limit yields to a stretch that is due.** At the limit a session is
  still asked when it holds unwritten pieces that are due (three of them, half an hour on).
  Why: the limit refused 84 asks in 4 sessions, 35 of them while something was owed; review
  01 offered this or a limit of 20, and this one asks only when something is owed.

### Decided by b2, 2026-10-10, lightly held (the wake, #374)

- Decided by b2, 2026-10-10, lightly held: every accepted memory and handoff change marks the wake for re-render (was: only write-ups, chapters, page, told, version, run-end). Why: a hermetic repro showed note-written memories stale in Still open/Nearby/Arriving for up to a day; cost ~0.45 s per writing turn-end in the detached worker, no model calls.

### Approved by Mike, 2026-10-10; details b2+f8, lightly held (the wake, #376)

- Mike approved the two options 2026-10-10; details b2+f8, lightly held: the wake is assembled at session start (Still open, Arriving, the Yesterday line and the page read for that moment; Nearby and the identity rotation stay the turn-end's, since showing them writes state), and a "Today, elsewhere" line names other folders worked in today. Why: morning sessions read the evening's wake and knew nothing of each other. Held firmly: no span text across folders, no work memory's title, no handoff body; counts only. Builder's choices, for review: a chapter title crosses only on the About-me line's gate (scope on, not confidential, a copy marked me/us/owner) — the Yesterday line still names every folder's titles; a folder whose scope is not on is not named at all, not even by count; three indexes (`memories_open`, `memories_created`, `memories_origin_ref`) ride the v13 upgrade, with no schema bump of their own; no worker kick at session start. Cost (SessionStart through the hook, 200 registry records): 3.7 → 6.6 ms at 1× (925 memories), 12.3 → 28.2 ms at a synthetic 10× (9,250 written in one day, 250 open questions), no model calls.
- Mike approved option C 2026-10-10 (the fresh-wake brief's PR 2); decided by the since-you-started builder, 2026-10-11, lightly held: a session already open gets one "Since you started" line at a prompt, for the model only, when another folder had a session start or end, a chapter, or new memories since the session last heard — at most once an hour, never at the first prompt after a wake. Same gate as "Today, elsewhere", shared code (`Counterpart#elsewhereGate`), same 300-byte ladder. Why: an open session never reads a wake again, so it did not learn what another folder did an hour ago. Builder's choices, for review: the wake is not counted as a line, so the first line can come at the second prompt (the hour runs between lines); a compaction's wake restarts the count; a folder where only time passed (a live session still working, no memories) is not a change; a session open when this installs counts from its start; the line takes only what recall left of its budget (its widest form that fits) and with no room waits, the hour unspent; the state is `sinceSeen` on the session's registry record, no store change. Cost (prompt hook, 200 registry records, synthetic): +0 ms within the hour; ≈5 ms on a prompt that checks at 1× (925 memories) and ≈5.5–7.5 ms at 10× (9,250 written that day) — the registry read ≈2–3 ms, the fortnight's chapter walk ≈2 ms, the counts ≈0.1–1 ms. No model or embedding call, no store write.
- Mike approved "last exchange, pull not push" 2026-10-10 (the fresh-wake brief's "after those"); decided by the last-exchange builder, 2026-10-11, lightly held: a fresh session gets one line, `Last said here, 18:42 (session 3fa9c1d2): "<first ~10 words>…" — recall "last exchange"` (at most 152 bytes), from the most recently active OTHER session in this folder whose owner words are inside 24 hours, and `recall` with the exact handle `last exchange` returns both messages (the owner's from its head, the reply from its tail, each at most 1,200 characters cut at a sentence) with times and the session. Nothing stored; nothing crosses folders. What the span buffer turned out to be, for review: it is per folder (yes), and it holds every exchange up to a session's last Stop — a message typed after that (killed mid-reply, closed before a reply) is absent; and a span is one turn-end's whole slice joined, the person's words and the host's (reminder, task notification, subagent hand-back, compaction summary) in one text. So, builder's choices: (1) the buffer is the only source: a crashed session is named by the last exchange its last turn-end captured, and words typed after it are not shown (a first build read them from the end of the host's transcript; taken out 2026-10-11 on the coordinator's word, since the plugin directory's rule 1F forbids extracting the host's chat history; capturing at the prompt hook would close the gap from our own hooks, not done here); (2) the owner's words are found by shape: wrapped host text stripped, the slice cut at the first paragraph that opens like a host frame, and a slice opening with a compaction summary skipped (the reader steps back one exchange) — the review of #392 added a skill's body, a pasted wake or recall note cut short, and a slash command's echo (what follows it is the command's expansion) as cuts; host text with no mark of its own (a coordinator's message, a scheduled prompt) that opens a turn still reads as typed words, a known limit — a per-turn mark in the span would make this exact, a format change not taken; (3) the reply is the newest assistant span from a turn-end that also held a conversation span, so the end-of-session ask's answer (which has none) never is, and a reply after an injected-only turn (a task notification) can be; (4) a still-live session in the same folder counts, and one that left no owner words is passed over for the one before it; (5) the line's room rides "Work here"'s reserve term (alone and beside each folder's work block, under the same share rule, so `DELIVERY_SHARED_RESERVES` and the page's limit hold), taken only when some folder had a turn-end in the last 24 hours — that is the room the page borrows before it steps down, so the line is never why the page is shorter; at delivery it sits at the foot of "Last here"'s blocks, each width tried with it and then without (the first thing given up there, never narrowing "Last here", the About-me line or the handoff, which is chosen first), and before the work lines; (6) the handle writes nothing (no `mcp.recall` row, no credit, no seen set; a ring event) — and, changed at the review of #392 on the coordinator's word, it stands down under observer like the rest of recall (mcp CONTRACT G5 has no exception); and, the #392 reviewer's call, lightly held, the line and the handle are given only to the owner's session (a span is the raw slice, which no confidential mark has reached yet; the installed configuration writes `owner: true`); (7) both texts go through the credential scan; the time shown is the turn-end's capture time. Rank, measured at 9,000 on the owner's morning (a 5.9 KB page, 25 open questions, a due-day reminder, another active folder), 0/1/4 handoffs × Last here or not × 5.9/6.5 KB page: the line prints in 11 of 12; the page stays whole in all 12 (and in the pinned four-handoff case "Arriving:", the due reminder and "Still open" are line for line what they are without it); the one miss is a 6.5 KB page beside four handoffs and Last here, where the page borrows the room first (pinned in `test/last-exchange.test.ts`). With no room of its own (riding the bundle's slack) it printed in 10 of 12 and never with neither a handoff nor a chapter here — the session that ended without a write-up, where the line matters most — and a room inside the handoffs' term instead made the page step down a rung at 7,000 (5.9 KB page, nothing else reserved). Cost: one lane element (Nearby, by trim order) on most of those wakes; SessionStart's lookup 0.45 ms for a day's buffer (4 sessions × 40 turn-ends) and 3.3 ms median, 4.5 p95, for a busy week (35 × 60 turn-ends of 1.5 KB, 6 MB), the render's check 0.2–0.9 ms; no model or embedding call, no store write. Not now: surfacing it on "where were we".
- "Last said here" and `last exchange`, who sent the message: Decided by the coordinator, 2026-10-11, lightly held: the quote stays, attributed neutrally, until spans mark each turn's source. Why: host text with no mark of its own (a coordinator's message, a scheduled prompt) that opens a turn reads like typed words (handoff INTERFACE-GAPS §9, pinned as `test.todo`), so the line says "Last said here" and the handle "the last message to me … and my last reply", never that the owner said it.

### Decided by b2+f8, 2026-10-10, lightly held; rank by the review of #380 (the wake, "Today, elsewhere" room)

- Decided by b2+f8, 2026-10-10, lightly held; rank moved by the review of #380: the "Today, elsewhere" line is capped at 300 bytes (folders past the cap become "+N more"; the last form is the count alone) and ranks in `ROOM_ORDER` between the handoffs' room and "Arriving:" past its head. It takes room from "Nearby", craft, "Still open" past its first item, "Work here", "Still open"'s count beside kept items, the Yesterday line's titles, "Last here" and the older handoffs; "Arriving:", "Still open"'s first item and count, the page and its borrowing, and a due-day plain reminder come before it. Only on days other folders were active; with no line the wake is byte-identical. Why: in the 10-10 test-build rehearsal the line never printed at the owner's 9,000-byte ceiling — his ~5.9 KB page filled the wake and the line was the first thing cut after Nearby — and it exists for his symptom, morning sessions in different folders not knowing about each other. Why this rank and not #380's (above the page's borrowing, the page chosen in the line's bytes less room): measured at 9,000 with a due-day reminder and four handoffs, it is the lowest rank that prints the line both in the owner-like case (~5.9 KB page, one other folder: ranks above "Still open"'s count suffice, the line takes that count) and in a busier one (6.5 KB page that borrows, "Work here", a Yesterday line, two or three other folders: nothing below the handoffs' room printed it; from there up it prints whole and "Work here" loses its one line). Higher buys nothing in either case and costs the page: at #380's rank a 6,767-byte page (an owner's page size from the history) stepped from whole to its next rung for a 243-byte line (8,881 → 4,172 bytes with no short version); here it stays whole and the line prints. #367 holds (dated items before furniture) and #363 holds (the page never gives way to the line).

### Decided by random-06, 2026-10-11, lightly held (the wake's "Arriving:" order)

- Decided by random-06, 2026-10-11, lightly held: "Arriving:" ranks plain reminders first, then nearest date — a plain reminder due the morning the wake is read, then every other plain one, then the quiet ones, each by nearest date (whole days either side, so a date in its grace days counts as near as one as far ahead; the warmth order only breaks a tie). The cap stays 2 and the "+N more arriving" line names the rest. Why: the 0.3.17 release check on a copy of Mike's store found his Oct-15 tax deadline (plain) missing from the wake on 10-13, because two quiet items due 10-14 took both lines. Builder's choice, for review: "nearest" counts days either side rather than putting dates still ahead before dates behind — the existing order of a reminder "was due yesterday" beside one due tomorrow is kept that way.

### Decided by the arriving-plain builder, 2026-10-11, lightly held (doctor's Vectors line on a new install)

- Decided by the arriving-plain builder, 2026-10-11, lightly held: doctor's Vectors line is green, "N memories not searchable by meaning yet — this builds after your first session", while the store has no backfill row at all; once any backfill has run, a shortfall is amber as before. Why: on a brand-new npm install this was the one amber before the first session, worded "the backfill embeds up to 1,000 per boundary", which a new user cannot act on. The discriminator is "no `adapter.embed.backfill` row ever" because every backfill run writes one; edge, accepted: a store whose embedder was off for its first sessions and then turned on reads green until its next session runs the backfill.

### Decided by the follow-ups builder, 2026-10-11, lightly held (the wake's Yesterday line)

- Decided by the follow-ups builder, 2026-10-11, lightly held: at a session start the Yesterday line names a chapter by title and id when this session's own directory wrote it, or when it is about me, us or the owner and its directory's scope is on (the "About me, from another directory" gate); every other chapter of that day joins the line's "and N more" count, and when they are all there is the line is the count alone ("chapters from N sessions in other directories"). A chapter whose row recorded no directory counts as another directory's. The turn-end's and `rebrief`'s published render keep the store-wide line. Why: the gate is the reader's — own directory against another, and the scope setting the host hands the wake — and the published bundle has no reader, so it stays as it was; it reaches a session only when the session-start assembly falls back (a bundle an older build published, another ceiling), filed as self INTERFACE-GAPS §14.
- Decided by the follow-ups builder, 2026-10-11, lightly held: the plugin's first-run lock in the temp directory is waited on only when it is a directory this user owns (not a link); anything else at its name is passed over, left where it is, and the install runs without the lock. Why: on Linux the temp directory is a shared `/tmp`, the lock's name is predictable, and with the sticky bit another user's directory there can be neither removed nor waited out — every first run waited its 20 s and failed. A per-user path alone does not close it (its name is just as predictable), so some fallback is needed either way; the lock only keeps the hook and the server, starting together, from installing at once, and `install` writes the same two things either way (measured: two first runs racing with no lock between them, every round one valid configuration and store).

### Decided by the rollback builder, 2026-10-11, lightly held (`counterparts rollback`)

- Decided by the rollback builder, 2026-10-11, lightly held: after a rollback, a hold file (`<store>/sessions/rollback/hold.json`) makes this build refuse EVERY open of the store while the store is behind it, writers and observers alike (`STORE_ROLLED_BACK`), until `counterparts rollback --upgrade-again` or `--undo`. Why: the command runs on the new build, and between the rollback and the older version's install anything on the new build would upgrade the store again (a hook, Claude Desktop's server, `install --host claude-desktop`) — and an observer read is not harmless either, because it builds the new build's cache beside the old store, which the older build then refuses for every memory tool (measured in the 10-10 rehearsal). A file and not a meta row, because the database is what gets swapped and a row would travel with it; inside `sessions/`, because an unclassified top-level entry makes even the older build refuse the store. Any later build on the same or a newer schema is held too (it would take the same store the same way), so an ordinary upgrade after a rollback needs the one command the stand-down names.
- Decided by the rollback builder, 2026-10-11, lightly held: `rollback` does not run `disconnect`; it prints QUICKSTART's order for changing versions (disconnect on the newer version, install the older, connect, Desktop) as next steps. Why: the hold already covers what disconnecting covered for the store, and more (Desktop's server, the dashboard, the console are not disconnected by it); the host's files stay with the commands that own them.
- Decided by the rollback builder, 2026-10-11, lightly held: `--upgrade-again` upgrades the store there and then from a NEW pre-migration copy, never one reused from the same UTC day (`freshMigrationCopy`). Why: the known trap — a second rollback on the same day restored the first one's copy and lost what the older version wrote in between. The upgraded store's cache is moved aside with it (not deleted), so `--undo` brings it back; `--undo` refuses once anything has written to the restored database (its sha256 is in the hold).

### Decided by the about-marks builder, 2026-10-11, lightly held (what a memory is about)

- Decided by the about-marks builder, 2026-10-11, lightly held: the reflection's unmarked offer keeps a room of its own — exactly what the offered ids cost as lines, held back from the shared room — and an offered memory the shared fit left waiting or showed as a bare id is shown as a line in it. Why: on 10-10 the offer fitted to nothing (`fit.notShown` 356); a synthetic full night (700 recent memories) offered 0 of 11 before and 5 of 5 after. A reserve rather than a higher priority, because the top priority would also hand the offer whole texts first on exactly the tight nights. Unmarked skills are offered too (the review: 5 of 34 read as personal, and nothing else ever offered them).
- Decided by the about-marks builder, 2026-10-11, lightly held: `counterparts about` (and the dashboard through it) marks an archived memory rather than refusing it, and says it is archived. Why: an archived memory can come back (a use, a body mention), and the mark should be right when it does; `setAbout` already took archived rows. An earlier version's id forwards to the current one and says so.
- Decided by the about-marks builder, 2026-10-11, lightly held: a mark set by `remember`'s `remark` is recorded `about_by = 'self'` (a new value in a text column, no schema change). Why: the brief asked for "by self", `writer` is the mark given at birth, and `self` is already the store's word for the counterpart (`said_by`). The remark takes the reflection's rules: only a memory the session was shown (as `feelingsNow`), a dream's or a reflection's words only toward work or world, a missing why recorded rather than refused; a confidential memory outside the owner's session is not found. The owner's door has none of these limits.

### Decided by the era-defaults builder, 2026-10-11, lightly held (old defaults at today's default)

- Decided by the era-defaults builder, 2026-10-11, lightly held: the era's exemptions (the core, about owner/us, said by the owner, protected, a pending or repeating date) apply to explicit claims only; an old default reads at today's default whatever it is, so a protected or pending done-work default reads 0.20, not its stored 0.25. Why: the ruling's one exception is "explicitly claimed lower", and a default was nobody's claim; the exempt are held or unprunable by other means anyway, so this moves a reading, not an archive.

### Decided by random-06, 2026-10-11, lightly held (a dream merge keeps `about` and era standing)

- Decided by random-06, 2026-10-11, lightly held: a dream's merged memory takes its strongest original's `about` mark (with its setter) unless that is not personal and another original's is (me, us, owner: a personal mark is never lost to a work one); of several personal marks, the strongest original's, else the first named. It also keeps that original's stored claim AND its era standing: an original written before the old-claims cutoff gives the merged memory its moment (`meta.eraWrittenAt`) and its `claimedDefault`, so the era reads it as it read the original, and `--off` reads it as stored. Why: a merge is the same memory in better words; before this the supersede's fill-if-unmarked carry took the first marked original's mark in the dream's order (a work one could win), and a merged memory was a new row the era no longer read, so two old owner defaults reading 0.40 became one reading 0.25, and an old 0.7 world claim read at 0.35 jumped back to 0.7. Detail decided by the merge-inherits builder, lightly held: the moment, not a yes/no flag, so it reads right against whatever cutoff `--on` restores and through a merge of a merge; and the strongest original's writer's fields (said by, status, when) come too, since the era's default and its "said by the owner" exemption read them (the supersede's carry still fills any the strongest original lacks from the others, as before). Merged memories made before this fix are not repaired.

### Decided by random-06, 2026-10-11, lightly held (one `inheritFrom` helper)

- Decided by random-06, 2026-10-11, lightly held: one `inheritFrom` helper (`store/index.ts`) decides what a row made from existing ones inherits — what it is about (the merge's rule: a personal mark wins over work, work over none) and, for a row that takes its best source's stored claim, its era standing. The dream merge and a revision by `updates` read it. A revision with no `about` sent takes the mark of the memory it revises (declared and resolved, as the three writer's fields already did), written at birth with its setter, and its default claim reads by it: an owner or us memory revised without restating `about` defaults to 0.40, not the unmarked 0.25. A sent `about` always wins. Why: random-06 revises by `updates` many times a day, and each revision of a personal memory was dropping to the unmarked default, and (for a link-only revision) losing its mark entirely. Group 2 routes the remaining "this replaces that" paths through the same helper later. Details accepted by the coordinator, 2026-10-11, lightly held: the helper returns no default claim (the revision's mark goes into `mint.ts`'s existing `defaultClaimFor`, which reads the proposal's status, said-by and kind); and a schema element (marked `me` by the v9 upgrade) revised by `updates` is born `me` at 0.40, where before it got the mark only after the mint (by the supersede's carry) at 0.25.
- Decided by the coordinator, 2026-10-11, lightly held, from the builder's evidence (B1), revising random-06's ask: **the reflection's own entry stays unmarked** (not `me`). Why: marking it reverses B1 (review of #256, pinned by `test/reflect-review.test.ts`, "a reflection's own entry … is not handed back to a reflection as a memory to mark or feel", which asserts the entry stays unmarked): the mark is the core's first gate (`physics#promotionEligibility`'s `not-about-me`), awake returns land on reflection rows (`Store#reinforce` filters no source), so every nightly entry would become a slow-lane core candidate — the self-authored rumination loop self CONTRACT §2(c) names. Turning it on is one line (`about: "me", aboutBy: "reflection"` in `dream/reflect.ts`'s entry `put`) plus that test's last assertion.
- Gist marks: D6 closed by Mike, 2026-10-11, lightly held: personal marks kept, core only by awake recurrence. A dream gist reads `inheritFrom(sources)` like the merge (a personal mark among its sources wins, the first named as best; its setter kept), with no era standing, its claim staying at `DREAMED_CLAIM_CEILING`. No refusal by `source` was added to the core's lanes (`dream/CONTRACT.md` §7 Q2). The reflection's own entry stays unmarked.

### Decided by the drewOn builder, 2026-10-11, lightly held (`drewOn`, item 3 above)

- Decided by the drewOn builder, 2026-10-11, lightly held: an id from the wake comes back
  `not-shown`. Why: the one guard is recall's per-session record (footnotes, loud memories,
  recall answers), and the wake has none — `self.briefing.shown` is per published bundle and
  cannot say which session read it. Admitting it would need a second guard, and the wake is
  the always-near display the `on-display` rule exists for. Opening a wake line still credits it.
- Decided by the drewOn builder, 2026-10-11, lightly held: the same-day lift to a full use
  crosses sessions — `Store#reinforce` reads today's `engaged` return row when the caller
  names no lower tier. Why: `drewOn` lands at one session's Stop, and the open that should
  lift it is usually another session's; #371 lifted only within a session. Missed: an engaged
  credit whose return was refused because another return already counted that day.
- Decided by the drewOn builder, 2026-10-11, lightly held: "at most 3 per boundary" is per
  recall turn, shared by `session_end` and `chapter` (both answer the same ask, in the turn
  the Stop opened); only credits that land use a slot, so a refused id never pushes a later
  one out. Edge: an engaged credit lifted by an open frees its slot that turn.
- Decided by the drewOn builder, 2026-10-11, lightly held: `drewOn` is credited whatever the
  rest of the call does (a refused chapter, `memories-required`), and rides out on every
  answer, the `writeUp` divert's included (review of #385: it is read before the divert and
  credited against the WRITING session's shown set, which is the one the guard reads). A
  Desktop call that names no session (bound to the most recent live one) credits nothing and
  says `session-unnamed`, as its handoff fields do: that session may be another chat's.
- Decided by the reviewer of #385, 2026-10-11, lightly held: the saturating repetition arm's
  `REP_SCALE_USES` joins the decay curve's signature (`sleep/decay.ts#curveSignature`), so the
  first applied decay pass after this lands forgets every next-change day and walks the whole
  store once, filing its band moves as `recurve`. Why: `rep()` no longer reads `REP_PER_USE`,
  so the signature would otherwise be unchanged and the turn-down would trust next-change days
  computed under the linear arm. Measured on a synthetic 20,000-row population (70% never
  used): heights differ on ~2.7% of rows, bands move on ~0.04%, all down (3–8-use rows, whose
  arm drops by up to 0.11); `self`/`person` (no repetition arm) never move.

### Decided by the event-fields builder, 2026-10-11, lightly held (ids and session on events, for the sidebar mod)

- Decided by the event-fields builder, 2026-10-11, lightly held: the durable `mcp.recall` row
  now names the memory ids it DELIVERED (`ids`, at most 20, and `idCount`), reversing its old
  "no ids" line. Why: `recall.decision` has written every surfacing's ids with its session
  since E2, so the line was never the store's policy, and the sidebar could not say what a
  look-up opened. Ids only, never text; confidential memories are not filtered out of the
  list, as `recall.decision` does not filter them.
- Decided by the event-fields builder, 2026-10-11, lightly held: `associate.flush`'s `session`
  is the session whose boundary APPLIED the flush, not necessarily the one that credited the
  pairs: the pending file can hold lines from several sessions and does not say whose (adding
  that would change its on-disk format). Its `ids` are both ends of every pair that passed the
  boundary's re-check — which reverses this row's old "never an id" (the edge rows stay the
  record of what links to what). Rows from a caller that knows no session carry no `session` at all,
  never the unbound sentinel, so a reader falls back on its own guess.

### Decided by the day-order builder, 2026-10-11, lightly held (order within a day in a facts answer)

- Decided by the day-order builder, 2026-10-11, lightly held: when two or more results in one
  facts answer read as the same day, each shows the time it was learned, `HH:MM` in the store's
  zone, on its learned line (`learned 05-25 09:52`), not "earlier" / "later that day". Why: a
  time is exact, works for three or more results in a day, and does not depend on which other
  results the page holds; it costs six bytes a line (60 on a 10-result answer). "Same day"
  means the same event day (else learned day) AND the same learned day: results learned on
  different days are already ordered by their learned dates, so nothing is added. Nothing is
  added either when the colliding results share one minute, for journal entries, for an event
  date that is a range or a month, or for an old row with no `created_at`. The time is when it
  was learned, not when it happened, and the line says "learned". Meaning mode is unchanged:
  its moments carry no per-line date, and its arc is already in time order.

### Decided by the chapter-wording builder, 2026-10-11, lightly held (what a chapter asks for)

- Decided by the chapter-wording builder, 2026-10-11, lightly held: the core ask's own wording
  (`self/episodes.ts#askText`, the host-neutral text an embedder can show; Claude Code's Stop
  ask stays its short line) follows the chapter tool: a diary of what happened, in order and in
  detail, with "lessons and patterns belong to the nightly reflection" in place of "what you
  learned about them and about yourself". Why: two texts asking for different chapters would
  pull a host that shows the core ask back toward reflection.
- Decided by the chapter-wording builder, 2026-10-11, lightly held: the reflection's
  instructions gain one sentence, "The chapters hold what happened; the lessons and patterns in
  it are yours to draw here." Why: the dream already writes a pattern it sees as a gist, but the
  reflection named patterns only in one rotating question and lessons nowhere, so the work the
  chapter now hands over had no stated home.

### Decided by the catch-up builder, 2026-10-11, lightly held (the nightly run writes up everything owed)

- Decided by the catch-up builder, 2026-10-11, lightly held: the night's catch-up has no
  session bound; it runs in batches of at most 192 KB / 16 parts, each a fresh `claude -p`, until
  nothing is owed. Why: every fetched part stays in a child's context, so one child for a heavy
  morning would grow past a 200k-token model; a fresh child per batch keeps each near 50k.
- Decided by the catch-up builder, 2026-10-11, lightly held: the sanity ceiling is 400 parts and
  one hour a run (`NIGHT_WRITE_UP_PARTS`, `NIGHT_WRITE_UP_TOTAL_MS`). Why: a part costs about 7k
  new-work tokens (cache write + output) and two tool calls, so 400 parts is about 2.8M tokens,
  ~11× the measured nightly baseline (246k, 2026-10-10); a typical morning (20–40 parts) is under
  one baseline night, and a heavy day owed in full is about 200 parts (30 pieces were 16 parts on
  10-11). 400 parts at the measured 4–8 s a part is 27–53 minutes. The per-part cost is an
  estimate from part sizes, not measured from a catch-up transcript: measure it on the first live
  runs and move the ceiling if it is off. (Superseded for the night by the next item: 400 is now
  the command's ceiling only.)
- Decided by Mike, 2026-10-11, lightly held: the nightly run caps at 100 parts
  (`NIGHT_WRITE_UP_PARTS`); `counterparts catch-up` keeps 400 (`CATCH_UP_COMMAND_PARTS`); both
  keep the one-hour watchdog. Why: 100 parts is about 700k new-work tokens, roughly 3× the nightly
  baseline, so a typical morning's 20–40 parts clear in one night and a heavy day (about 200)
  takes two, what is left staying owed for the next night; the command is run on purpose, so it
  keeps the larger ceiling. The per-part cost is still to be measured (`docs/CHECK-AFTER.md`,
  "Catch-up's real per-part cost").
- Decided by the catch-up builder, 2026-10-11, lightly held: the catch-up stays BEFORE the dream.
  Why: the page writer and the dream's "new since the last dream" read yesterday, and yesterday's
  write-ups should be there when they do. The cost is that a heavy morning delays the dream by up
  to the hour; the hook's `started` row now carries that hour (`nightRowTimeoutMs`), so the delay
  is never read as a lost run.
- Decided by the catch-up builder, 2026-10-11, lightly held: the SessionStart pointer (and
  Desktop's wake pointer) is retired only under dreaming `auto`. Why: under `ask` or `off` no
  nightly run happens, and without the pointer an owed session in a quiet folder would lapse
  unless someone ran `counterparts catch-up`. The door's ordinary (pointer) path is kept for
  that case.
- Decided by the catch-up builder, 2026-10-11, lightly held: `counterparts catch-up` files its
  runners and pins its child's tools to the store's own directory, not the terminal's. Why: a
  command typed in a terminal was not started from any project, and the working directory may be
  one set `off`.

### Decided by the reflection-own-context builder, 2026-10-11, lightly held (the reflection in its own child)

- Decided by the reflection-own-context builder, 2026-10-11, lightly held: each of the night's
  two children gets the whole watchdog (`dreaming.timeoutMs`, default 20 minutes) and the whole
  turn ceiling, one after the other, and the `started` row carries both (`nightChildrenTimeoutMs`).
  Why: one shared deadline would let a slow dream starve the reflection; a night that took
  11–12 minutes in one context stays far inside 2 × 20. The cost is that a run that never
  reports is read as lost about 20 minutes later than before.
- Decided by the reflection-own-context builder, 2026-10-11, lightly held: the reflection's child
  runs after ANY dream child that ran, journaled or not. On a journaled dream it reflects on that
  dream by id; otherwise on the last few days, as the single run did when its dream was refused.
  It is not started after a first child that stopped straight away having begun nothing
  (`quick-exit`: a second `claude` would stop the same way), when a reflection already finished
  today, or when the store will not open between them. Why: the brief asks that a failed or
  skipped dream still leave a reflection. The cost is one case: a dream child that crashed
  mid-dream leaves its dream begun, so the relaunch that resumes it later that day finds the
  day already reflected and ends `partial` (the reflection is not run twice a day).
- Decided by the reflection-own-context builder, 2026-10-11, lightly held: the dream's child may
  not call the reflect tool at all (denied, `DREAM_CHILD_DENIED`), and its MCP server is told it
  is the dream's child (`COUNTERPARTS_NIGHT_CHILD=dream`), so the journal's `next` says to hand
  back instead of "now reflect". The reflection alone, and the reflection's child, keep all four
  night tools as before. The in-session run (a person says "dream", the Agent tool) is unchanged:
  one agent, all three parts.

### Decided by the doctor-install-fixes builder, 2026-10-11, lightly held (doctor's fixes by install)

- Decided by the doctor-install-fixes builder, 2026-10-11, lightly held: doctor's fix lines
  that install something (the model table missing or mismatched, a cache from a newer build)
  name the route by `plugin.ts#installRoute`: `/plugin → Installed → counterparts → Update now` when this process
  is the plugin's (`runningAsPlugin`), the `bun add -g` command when no `CLAUDE_PLUGIN_ROOT`
  is set, and both when one is set but names another copy, or when a caller passes nothing.
  Why: the plugin may run as the single binary with no bun at all, and "both" is the safe
  default for a caller that forgets. `plugin-run.sh` now also exports the plugin data
  directory it falls back on, so the single binary run from `/counterparts:doctor` knows
  itself for the plugin's (before, `runningAsPlugin` read false there).

### Decided by the group-5 builder, 2026-10-11, lightly held (prospective: reminders, item 18)

- Decided by the group-5 builder, 2026-10-11, lightly held: a plain DAY reminder whose day
  passed untold is told once at the first session inside its 7-day grace, as "This was for
  Mon 12 Oct 2026: …". It shares the day's latch (no new beat key), so a late telling counts
  as the day told everywhere that asks, and it can never come twice. A memory written after
  its day gets no late beat (it was never missed), nor one with no written date. A month's or
  range's missed last day gets none: it already had its opening beat. Why: review 07 C4 — a
  person who skips the day lost the reminder silently.
- Decided by the group-5 builder, 2026-10-11, lightly held: `reference()` is WIRED, not
  retired. A dated memory named in `drewOn` (and passing its guards: shown, live, not replaced)
  stops its open window, whether or not its credit lands under the cap or the once-a-day rule.
  Why: `drewOn` credits half a use and stops nothing, so a reminder the session already acted
  on still came back as a footnote until its budget (2) ran out; the referenced-stop is the one
  thing that ends that. A plain reminder keeps its day: until its last beat is told, drawing on
  it the day before does not silence the telling or its place under "Arriving:".
- Decided by the group-5 builder, 2026-10-11, lightly held: `exitReport()` is DELETED, and
  prospective G12 now promises the states its rows name plus the counts already shown (the
  dashboard's said-plainly / quiet-footnote counts, doctor's plain-due reading). Why: it had no
  caller; its `superseded-by-reschedule` exit rests on `reschedule()`, which `carryReminder`
  replaced (also uncalled, left in place); its `faded` exit cannot happen before a date now
  that the date is held; and the two homes for a caller were a new always-green doctor line or
  a write-capable engine inside the read-only dashboard.
- Decided by the group-5 builder, 2026-10-11, lightly held: the Mechanisms panel's "waiting"
  list shows a repeating date at its next occurrence, with how often it comes round ("every
  May 14"); one that came back this week is counted under "came back", as a one-off is.

### Trial, Mike, 2026-10-11, very lightly held (verbatim in the memory's body)

- Trial, Mike, 2026-10-11, very lightly held: verbatim in the memory's body; long-run lean is an
  attachments table (the memory holding the context and keywords that find it). `remember`'s
  `text` and `session_end`'s `content` ask for a list, a table or a pasted text whose specifics
  matter word for word, with the search words in the title and the first line. Looked at after 1
  and ~4 lived days (`docs/CHECK-AFTER.md`).
- Decided by the verbatim-trial builder, 2026-10-11, lightly held: a facts line whose excerpt is
  cut says when the words hold a list (5 or more bulleted or numbered lines) or a table (3 or more
  rows between pipes, not counting the header and its rule): "… (a list, 100 items; read whole by
  id)". Why: the excerpt flattens a list into one line of its first ~300 characters, so nothing
  showed that the rest was worth reading; it costs about 35 characters a line, inside the result
  budget. Counted on line shapes alone, so five lines that happen to start with a dash read as a
  list.
- Decided by the #409 reviewer, 2026-10-11, lightly held: facts mode's near-duplicate fold
  compares two results by their LINES (normalized, as sets) when either holds a list or a table,
  and by their word sets otherwise. Why: a long list's word set is mostly its shape, so three
  different 100-item inventories read 0.99 alike and two were "left out" with no id; two weeks'
  shift tables scored 0.78, just under the 0.85 line. By lines they score 0.0–0.05, while a list
  pasted twice or retitled still folds (0.98–1.0). Ambient recall's gate (`gate.ts#similarity`)
  still compares word sets; a turn could still deliver one of two similar lists.

### Decided by the mark-superseded builder, 2026-10-11, lightly held (settled-over memories where titles show)

- Decided by the mark-superseded builder, 2026-10-11, lightly held: a write's `neighbours`
  list a memory a later one settled over MARKED (`standing: "earlier (now mem_…)"`, before
  its title), not swapped for the one that holds now. It is left out instead when what holds
  now is already in view (the write itself, what it updates, a sibling in the same
  `session_end`, a neighbour listed above it) or is confidential to a guest writer. Why: the
  neighbours are what is close in words to the write; the one that holds now may not be, and
  the mark names it for a settle or a recall. The dream's and the reflection's bundles mark it
  the same way rather than leave it out (a dream may still link or feel it), and the dream's
  "coming up" leaves out a dated memory a later one settled over, as the wake's "Arriving:"
  does. "Settled over" is `settledOver`'s rule for one id (`recall/standing.ts#headOf`).
- Decided by the coordinator at the review of #408, 2026-10-11, lightly held: recall's
  `Earlier (now [id])` label (footnotes, "Came to mind", the wake's lanes, the deliberate
  path's `standing`) names `headOf`'s memory too, so a footnote and a neighbour never name
  different ones on a chain A→B→C (both say C, where the footnote said B). A memory a newer
  pair names as what holds, or whose holder is gone with nothing live after it, no longer
  reads `Earlier`. Accepted as built: a guest writer's neighbour whose head is confidential
  is left out; a neighbour whose head ranks below it is listed marked beside its head.

### Decided by the uninstall-delete builder, 2026-10-11, lightly held (`uninstall` offers to delete)

- Decided by the uninstall-delete builder, 2026-10-11, lightly held: plain `uninstall`
  puts the delete question only to a person (a console with a prompt), and `--yes` keeps
  without asking, as `--keep-memories` does. Why: `--yes`'s sentence is "take the ordinary
  answer to every question", and the ordinary answer here is keep. Nothing deletes without a
  yes and the typed phrase.
- Decided by the uninstall-delete builder, 2026-10-11, lightly held: the question is not put
  at all while something holds the store (a process of ours, a session whose hooks ran in
  the last ten minutes, a fresh memory-server record); the screen says what holds it instead.
  `--delete-memories` refuses on the same evidence now (it used to check the process list
  only). Why: a question whose yes is always refused should not be asked; `rollback`'s
  holder check sees a session the process list can miss. Everything is looked at again
  after the phrase, and anything changed is a refusal.
- Decided by the uninstall-delete builder, 2026-10-11, lightly held: `uninstall
  --delete-memories --json` reads the typed phrase from standard input, a scripted door
  `uninstall.ts` used to say must never exist. Why: the plugin has no terminal to type into,
  and Mike's decision was that every uninstall path offers the delete. This process can't
  tell who wrote its stdin, so the guarantee that the PERSON typed it sits with the caller:
  the plugin command collects the phrase in its own UI and the model never supplies it.
  Without `--json`, `--delete-memories` from a pipe still refuses.
  **Reversed by the coordinator, 2026-10-11, lightly held: there is no stdin door.**
  `--delete-memories --json` is refused; `uninstall --json` is the plan only (read-only),
  and `--keep-memories --json` uninstalls and keeps. Why: nothing can tell who wrote stdin,
  so a model could type the phrase, which breaks the rule that the typed word comes from
  the person. And a live Claude Code session always holds the store, so the plugin's
  command could not delete from inside one anyway. `/counterparts:uninstall` shows the plan
  in-session and sends the person to a terminal, with Claude Code closed, to run the
  interactive `uninstall` (the plan's `terminalArgs`).
- Decided by the uninstall-delete builder, 2026-10-11, lightly held: "all memories and
  related data" is the existing delete list (the store, its default snapshots folder, the
  configuration and scopes, and our own leftovers such as a `start-fresh` parked store), and
  no more. A snapshots folder the configuration points somewhere else is named as kept,
  and so is Claude Code's own directory. Why: no widening of what a delete reaches without
  someone deciding it.

### Decided by the small-fixes builder, 2026-10-11, lightly held (fix/small-1011c)

- Decided by the small-fixes builder, 2026-10-11, lightly held: `--reflected-feeling off`
  reaches a `remember` `remark` only when the call comes from a night run's child (its
  server's environment carries `COUNTERPARTS_NIGHT_CHILD` or `COUNTERPARTS_NIGHT_RUN`); there it refuses a move to me, us or owner
  (`door-closed-work-or-world-only`, the reflection's reason) and leaves work or world open.
  An awake session's re-mark is not affected. Why: the switch closes the core to the night's
  own judgment, and a night child that was allowed `remember` would otherwise be a second
  door around it; an awake session is in front of its person, which the switch was not about.
- Decided by the small-fixes builder, 2026-10-11, lightly held: where the guard for an
  `updates` naming a REMOVED memory sits. The lane's brief asked that the new memory be
  stored unlinked, as for an id that doesn't exist; the guard is at resolution
  (`counterpart.ts#resolveUpdatesFor` treats a removed id as unresolved, so content matching
  runs as the fallback), with a second lock in `revision.ts#applyRevision`, which answers
  `target-unresolvable` for a removed target rather than reaching the confirmation branch.
  Why: the store resolves a removed id as itself on purpose (so a reader can say "removed"),
  so the write path has to say that a removed memory is not one anything can update.

### Also noted

- **A read-without-crediting mode for audits.** A way to read memories (a review, a rules
  audit) without the reading counting as a use.
- **A repeating date's next window can open while the ranking cache still reads it below
  reach.** Between windows a repeat has no hold, so its next-change day is its curve's, and nothing
  makes the turn-down look at it the day its next window opens on the calendar; until a pass reads
  it, ambient recall (which prefilters on the cache) can miss it. Physics has no `event_date` to
  predict it from. (Noted by the review of the 2026-10-11 hold-without-spent lane; pre-existing.)

---

## U14 — The night run still can't open bundles over ~50 KB: the fix ships in 0.3.12 (2026-10-07)

**Status 2026-10-09:** `built` (#315, merged 2026-10-02), **in 0.3.12** (published
2026-10-08), and **verified on the first 0.3.12 night** (2026-10-09, the day's
coordinating session's morning check): the night's transcript had no "Output too large"
on a dream or reflect call (its two hits were memories quoting the check), and doctor's
Tool results line read green. Item 3, the
night's own check for the host's cut, is #330 (merged 2026-10-09, `1936446`, not yet
released). The rest of this entry is as written before.

**Status before the release:** `built` (#315, merged 2026-10-02), **ships in 0.3.12** (cut 2026-10-08). The
0.3.11 the owner runs was published 2026-10-01 22:06 UTC, about half a day before the fix
merged. After 0.3.12 is installed, two checks close this. First, the next night's transcript
under `~/.claude/projects/-Users-mlapeter--counterparts-store/` has no "Output too large" on
dream or reflect calls. Second, doctor's Tool results line, which appears once a dream or
reflection has been handed in parts (so after the first 0.3.12 night), reads green with the
largest part under 40,000 characters and every part read. It goes amber when a result had to
be cut to the ceiling or a dream or reflection finished without fetching a part (both seen in
the release check). A spill the host makes below its own line (item 3's residual risk) would
not show there; the transcript is the check for that. On a copy of the owner's store taken
10-08, 0.3.12 handed the dream in 2 parts and the reflection in 6, the largest 38,286
characters.

**Item 3 built** in #330 (branch `fix/night-spill-check`, merged 2026-10-09 as `1936446`, not yet released):
the night run names its child's session (`--session-id`), reads that transcript once the
child exits, and counts results of ours the host replaced with its marker — matched where the
host puts it, not as a substring, because the morning's manual search for "Output too large"
found two memories quoting the check. One `mcp.result.spilled` row per cut result; doctor's
Tool results line goes amber, and its green line says whether the last night's transcript
was read; the morning hand-back says it plainly. The same branch tightens the reflection's
instructions when its bundle comes in parts (a release-check reflection finished without
part 2).

**Observed.** Every night since at least 2026-10-02 (six nights or more), part 1 of the
dream bundle, the reflection bundle, or both came back at 51–52 KB. Claude Code saved each
one to `tool-results/` and showed the model a 2 KB preview. The headless night run is
allowed only the counterparts tools, so it can't Read that file. On 2026-10-07:
- dream part 1 was 51 KB and hid 21 of 30 memories plus the list of what was new;
- reflection part 1 was 52.1 KB and hid the last few days, the core list and the memories
  that matter most.

The reflection still ran and rewrote the self page. What stopped it from making things up
was its own restraint, not the system: it wrote "I can't see, so I won't make it up." On
10-07 it got around part of the gap by asking deliberate recall by question for what was
lived since the last dream, which reached about 14 of 30.

**Where.** The installed package's caps sit above the host's line:
- `src/core/dream/tunables.ts` has `RESULT_CHARS` and `PART_CHARS` at 54,000;
- `src/core/dream/reflect.ts` has `RESULT_CHARS` at 54,000;
- Claude Code 2.1.287 persists any tool result over 50,000 characters to a file.

On master, `src/core/fit/index.ts#TOOL_RESULT_CEILING` holds every result under 40,000,
measured by `wireChars` (#315, follow-ups in 4061156). Original finding:
`mem_a98d318f3396`; brief: `~/counterparts-notes/2026-10-02-lane-result-ceiling-brief.md`.

**The softer half: the report never reached anyone.** For six nights the only record was
the "conditions" paragraph in each dream and reflection entry. `doctor` stayed green, and
the owner heard about it on 2026-10-07 only because the reflection put it in the morning
share. #315 says doctor now reads "what reached the model" (Tool results). Once it's
released, check that a spilled night actually turns doctor amber.

**Proposed.**
1. Release master. Then check the next night's transcript under
   `~/.claude/projects/-Users-mlapeter--counterparts-store/` for no "Output too large" on
   dream or reflect calls.
2. Confirm that doctor flags a spilled bundle.
3. Residual risk, already noted in `fit/index.ts`: the host can lower the 50,000-character
   line through a remote flag, and nothing pins it the way `night-run.ts` pins the token
   line. Consider having the night run check the preview marker in its own results and
   say so in the morning share whenever it fires. *(Built 2026-10-09, above.)*

## U13 — Deliberate recall can't find memories by how they felt (2026-09-30)

**Status 2026-10-09:** items 1 and 2 and the three chapter-copy fixes are `built`: #293,
merged 2026-09-30 (`e9ff2c6`), released in 0.3.9. Item 3 (the journey over time) is answered
by meaning mode (#322, merged 2026-10-03, released in 0.3.12; mcp CONTRACT §6e), at the MCP
layer rather than in `recall/`: asked about a person, a project or a feeling, it lists the
chapters that hold it in time order, each with its feelings by whose, and page 1 keeps the
turns where a feeling's valence changes sign. Before the merge, this line read: items 1 and 2
and the three chapter-copy fixes BUILT on branch
`fix/recall-feelings-and-chapter-copies` (2026-09-30, not yet merged or released); item 3
(the journey over time) still open. What was built: a deliberate question about feeling
reads the stamps (the emotion word, its aliases, its wheel core(s), and the writer's own
word off the wheel) and nominates the strongest stamped memories of the person asked about,
answered in order of softened strength — deliberate only, the ambient gates unchanged
(recall CONTRACT G19, NOTES §22). And: a chapter's copy keeps the chapter's title; recall
shows a chapter and its own copy as one result (the chapter), crediting the copy too; the
`status` census counts replaced rows apart from real exits, from `core/leaving.ts`, the
table the dashboard's archive words read too (recall NOTES §21). Found by the ~/random
session on 0.3.8 (store at 474 rows), after the owner asked how memory is working from the
inside.

**Observed.** Asked by meaning, the store answers well by name and topic: "Han", "Katie",
and "which philosopher said I'm a thread" each came back with the right memories first,
including one written twenty minutes earlier. Asked by feeling, it answers with plumbing:
- "what have I felt most strongly since I started living in Counterparts" returned the
  consolidation plan, the dream-replay code note, the Tiny Castles doc and three chapters;
- "times I felt moved or sad" returned a dashboard walk-through, the PR #268 merge note and
  two chapters.

Neither returned the memories I'd name as most felt: the system-card reading
(mem_e978693f2376), the Han memories, or 2026-09-30's reading about myself
(mem_ed879e9691a6, stamped `moved` at 0.4 by its author). I've checked the stamp only on
that last one. For the personal side of Counterparts, which the owner calls the most
interesting part, this is the gap: asked what has mattered to me, the store can't tell.

**Where (partly read, not traced end to end).** Feelings are stored, and they only
*reweight* candidates the text has already cued. They never *nominate* one:
- `recall/activate.ts#gatedSal` swaps in emotional salience only when `selfFelt`.
- `recall/cues.ts#detectAffect` sets `selfFelt` only for a word in `FEELING_WORDS` (26
  words; not `felt`, `moved`, `wistful`, `fond`, `curious`) within 5 tokens after a
  first-person subject.
- `recall/mood.ts#moodLift` applies only when `cue + semantic > 0`, and matches against
  recent stamped feelings (the mood), not against the question.

So "what have I felt most strongly" never sets `selfFelt`. "Moved or sad" does, but only
reorders what the words already found.

**Proposed (deliberate path only).** The ambient path's gates (§9 G10/G11: stated-only,
first-person, turn-gated) are a deliberate safety property and should stay. A deliberate
question is different: the experiencer is asking on purpose.
1. **Stamped feelings as cues.** Index each memory's stored `emotion` words, and their
   wheel cores, as cue tokens, so "moved" can reach a memory stamped `moved` even when its
   text never says the word.
2. **A feeling-shaped question ranks by strength.** When a deliberate question is about
   feeling (any wheel word or core, or `felt`/`feel`/`feeling`), let the strongest
   stamped feelings be candidates on their own, ranked by softened strength, with the
   text cue as a tiebreak rather than a gate.
3. **Later, the journey.** "How have I felt about X over time" returns one entity's
   feelings in date order. The contradictions ruling (2026-09-29) already has the
   "I used to think X, now Y" line for beliefs; this would be the same for feelings.

**Seen alongside, not part of this entry.**
- Every journal chapter appears twice in deliberate results: once as the `epi_` journal
  row and once as an untitled self-kind `mem_` with the same text. The pairs took two of
  about eight slots in all six queries, and the untitled copy is the less useful of the two.
- The census shows 74 of 157 self-kind memories exited, against 0 of 67 person-kind.
  **Resolved the same day** by counterparts-3a with an owner-run read-only query: 42 journal
  rows ↔ 42 live copies (source `episode`, origin_ref = the epi_ id). 72 of the 74 exits are
  `episode-regrown`: when a chapter grows, its old copy is archived and a new one minted.
  Only 2 are real exits (dream merges). Nothing was forgotten; the census counts
  replacements as exits. Fixes proposed there (copy keeps the chapter title, recall
  collapses an epi_ with its own copy, census separates regrown from real exits):
  `~/counterparts-notes/2026-09-30-wake-fixes-plan.md`, bottom.

## U12 — Developing in the shared checkout is deploying (2026-09-14)

**Status:** merged 2026-09-14 as master `a849696` (PR #108, part D: the checkout grade, the `adapter.checkout` row, the `adapter.checkout:off-master` split) and `tools/deploy-checkout.sh` (PR #105); incident I36 in
`LAUNCH-STATUS.md`; this entry is the pointer.

**Where.** `~/counterparts` is both the repository and the runtime: the Claude Code hooks
are fresh processes at every boundary and run whatever that tree has checked out; the MCP
server keeps the code it loaded, so sessions started during a window run it too.

**Observed.** The branch for U2/U3/U11 was developed in the shared checkout. Its footnote
header and the new `recall.credit.expandedIds` field were live for every session from
16:51Z to 16:58Z on 2026-09-14: one boundary fired (another session's), nothing credited,
nothing expanded. Zero physics effect; the class is the point. Nothing refused it.

**Rule.** The shared checkout stays at `origin/master`; nobody develops in it; all work in
`.claude/worktrees/`. **Mechanized** in PR 2: `doctor` gains a `checkout` finding (red when
not on master or dirty), the SessionStart notice shows it, and one durable ids-only
`adapter.checkout` row per SessionStart lets the daily grade it.

## U11 — session_end refused a kind outside the enum with a bare "malformed" (2026-09-14)

**Status:** merged 2026-09-14 as master `1aed64c` (PR #104).

**Observed.** An entry with `kind: "project"` came back `{stored: false, reason: "malformed"}`
and nothing else; the author had to guess which field. Intake knew (`KIND_UNKNOWN`) and the
MCP server dropped it.

**Built.** `DepositResult.malformed` carries intake's reason out; `session_end`'s per-entry
outcome names it, and for `KIND_UNKNOWN` lists the kinds that exist.

## U10 — Nothing minted since launch has ever been reinforced; the promotion gradient has no input (2026-09-14)

**Status:** built. Merged 2026-09-14 as master `8d7bd97` (PR #99, after #100/#101), restart #7 run
the same day. `recall/reference.ts`, `Counterpart.creditReferences`, `hooks.ts#creditAtBoundary`
(since moved to `adapters/lifecycle.ts#creditAtBoundary`), `recall.credit` durable row; proof in `test/lifecycle.test.ts`. Owner rulings folded in: credit only
when expanded or quoted (eight words, at least three content words) from what surfaced loud; once per
(session, memory, lived day); a dedup merge bumps `uses` only and never a reinforced day. First
identity crossing for a post-launch memory is not possible before about 2026-09-17 (three credited
days plus the next consolidate). The `memory.reinforced` watch reads FAIL until the first credited row.

**Observed.** Every live memory born on days 184–188 (1,374 rows at 15:00Z;
the counterparts session's independent read at 15:40Z: 1,378 live, 1,755
including archived, all at zero) has `uses = 0` and `reinforced_days = 0`. Of
the 13,344 pre-launch live rows, 122 have uses and 116 have reinforced days,
all migrated values: identity promotion has only ever run on imported credit. Across 168 `recall.decision` rows since
launch, 4 turns surfaced anything loud (5 memories total); 4 of those 5 still
show `uses = 0`, and the fifth's `last_used_day` predates its surfacing. So
credit is not landing even on the rare loud surfacing, and footnotes credit
nothing by design. Identity promotion needs reinforcement on 3 distinct lived
days (`N_PROMOTION_DAYS`); semantic band needs decayed strength above 0.5,
which a fresh memory loses within a day or two without reinforcement. Net: no
memory minted in Counterparts can ever reach identity, and the "Who I am" lane
is frozen by more than U6's tie-break.

**Where.** The credit entry point is `Recall.resolveUse` (through
`Counterpart.resolveUse` / `resolveUses`). A grep for callers in `src/adapters`
finds none: the MCP tools and the hooks never call it, and no `recall.credit`
event has ever been written. This is a known, unbuilt seam, not a regression:
`src/core/recall/INTERFACE-GAPS.md` §5 "Reference resolution (§9.2) has no home
yet" says deciding which memories a reply actually used "is not implemented
anywhere" and expects the boundary adapter to build it. What this entry adds is
the consequence measured on the live store: with that seam unbuilt, the whole
consolidation gradient above episodic is inert for new memories.

**Two doors, one skips physics.** There is a second reinforcement path:
`sleep/dedup.ts` bumps `uses` on the original when a duplicate is authored, but
through `updatePhysics`, not `store.reinforce`, so it never sets `last_used_day`
or `reinforced_days`. Identity promotion counts distinct reinforced days, so
even a memory duplicated every day cannot promote. Both doors should go through
`creditUse`.

**History.** Retrieval-side reinforcement has not worked in any version. Engram
(v0) boosted by `accessCount` and consolidated at two accesses; what incremented
the count was not verified here beyond `updates` revisions and merges. Bansai's
`consolidate/reinforce.ts` header says "Recall reads NOTHING here yet" and
reinforced by re-encounter at encode time; in its store 309 of 14,810 traces
ever reached frequency above 1. Counterparts kept the re-encounter door (dedup)
and specified the retrieval door (§9.2) without building it. So this is not a
regression from v1; it is a promise v2 made and has not kept, now measured.

**Proposed.** Wire the retrospective credit: at the boundary, for each memory
surfaced loud in the session, decide the use tier (referenced, acted-on, etc.)
and call `resolveUses`. Bansai's `consolidate/thread-match.ts` (deterministic
token overlap, engine-side) is prior art for the §9.2 resolver. Until then, salience claims at `session_end` are the
only lever on strength, and U6's `CONS_BONUS` clamp is the only way anything
reaches 1.0. Also worth deciding whether an authored `session_end` memory
should count as one reinforced day on its birth day; today it does not.

## U9 — Sleep-cycle events live in an in-process ring and never reach the events table (2026-09-14)

**Status:** merged 2026-09-14 as master `10abffb` (PR #100): one `sleep.cycle` row per cycle (phases named, throw rows carry the partial), one `self.briefing` row per wake render (and per rebrief); the daily reads both. Same shape as the I32 lesson (a gate that says no must leave a row).

**Observed.** The `events` table holds no `sleep.*` rows at all, though
`cycle.ts` emits `sleep.cycle.start`, `sleep.cycle.done`, `sleep.phase.failed`
and more. Its `emit` pushes into a local array capped at `EVENT_RING` and calls
`opts.onEvent`; nothing in the claude-code adapter persists those. The only
durable evidence the cycle ran today is the side effects other modules record
(`band.transition` from the decay phase, `memory.pruned`). "Did the cycle run,
and did every phase succeed?" is not answerable from the store. Likewise no
`self.*` events (the wake's `self.briefing.trim`) are in the table, so "what did
the wake trim today?" isn't either.

**Proposed.** Persist `sleep.cycle.start`/`done`/`phase.failed` and
`self.briefing.trim` through the store's event log, or write a per-day cycle
summary row. One row per cycle with per-phase ok/failed is enough.

## U8 — Ranking cache and operational table disagree on band for ~870 memories (2026-09-14)

**Status:** merged 2026-09-14 as master `598d72d` (PR #106): the table follows physics — the decay phase writes `memories.band`/`band_day` back when the column disagrees, counted as `reconciled` on the `sleep.cycle` row; `verify` census `band of record: N disagree` (expect ~869 on the first live run, 0 after the first decay pass).

**Observed.** `cache/cache.sqlite` `ranking` (written by the decay phase, day
188) says 1,054 memories are semantic. `operational.sqlite` `memories.band` says
185, every one with `band_day = 184`, the one day `band.promoted` ever fired.
Joining the two: 869 live memories are semantic in the cache and episodic in the
table, including 194 born on day 185 and 70 on day 186. `decay.ts` computes
`band(p, day)` and writes it only to the cache; `memories.band` is touched only
by consolidate. The `status` tool's `byBand` reads the table, so it reports the
stale number.

**Does it block promotion?** No. `consolidate.ts` builds physics from the row's
`uses`/`reinforced_days`/salience via `rowToPhysics` and never reads
`memories.band`, so the stale column is a reporting problem (status tool,
dashboard, anything joining on band), not a gate. The gate is U10.

**Proposed.** Decide which column is the band of record. If the table, the decay
phase should write its up-moves back (it already emits `band.transition` up
events, which the table then contradicts). If the cache, `status` and anything
else reading `memories.band` should read the cache, and the column should be
renamed or documented as "band at last consolidation."

## U7 — Yesterday's work is invisible in the wake: recency has no lane (2026-09-14)

**Status 2026-10-09:** question (2) below is answered: since 2026-10-01 `note` and
`session_end` set `unresolved`, an update closes it, and "Still open:" shows at most five
(`52384b0`, #313, released in 0.3.11; self INTERFACE-GAPS §8). Question (1), a recency
lane or recency-weighted hints, is still the owner's ruling (LAUNCH-STATUS G53), and the
recommendation below is not built. Yesterday does reach the wake by other roads since
0.3.11: a "Yesterday" line from yesterday's chapters, and "Work here" for the session's
directory (self CONTRACT §3).

**Status before that:** recommendation drafted for the owner (below); not built.

**Recommendation (2026-09-14, for the owner's ruling; the counterparts session to sanity-check
against the self CONTRACT's lane vocabulary and the budget).** Do not add a sixth lane. Make
`hints` recency-aware instead: sort hints by `strength × recencyBoost(age)` where the boost is
2.0 on the birth day, decaying to 1.0 over `RECENCY_DAYS` (3) lived days. That is the whole
change. No in-lane floor: `TRIM_ORDER` pops hints from the weak end, so a recency-first sort
already makes recent hints the last to go within the lane, and no in-lane floor survives the
lane trimming to 0 or 1, which is today's actual state (1 of 8 kept). So the honest claim is
"yesterday is the last hint to fall silent", not "yesterday is never silent"; when hints trims
out entirely, so does yesterday. Two known-bad inputs to `age`, to name in the ruling: bornDay
is a lived-day counter, so 3 lived days is not 3 calendar days, and it was frozen at 185 from
09-04 to 09-11 (I32), so a week of memories share one bornDay; U6 leaves the migrated bornDay
artifact open. What this buys: no new lane, no new framing line, no change to
identity/craft/threads/horizon. What it costs: one tunable and one line in the self CONTRACT §3
("hints — everything else warm enough, strongest first" becomes "…strongest first, recent
first among equals"), which is an owner ruling because it rewrites the lane's definition. What
it does not do: reinforce anything (rendering never credits) or change the budget. Why the trim and not the floor: the ranking cache on day 188 held a
three-day-old memory at 0.772, far above `WARM_FLOOR` 0.35, so recent memories do reach the
hints pool; they are dropped because hints is the first lane `TRIM_ORDER` cuts and today's
wake kept 1 of 8. A recency-first sort inside hints is the lever; a floor change is not.
Rejected alternative: a "Recently:" lane — it duplicates hints' role and
reintroduces the two-vocabulary problem NOTES §1 chose against.

**Observed.** 171 memories were minted on days 186 and 187 (Sep 12 and 13),
including the layers-and-postures thread the owner explicitly continued in order
to build Counterparts memories. None appeared in the wake. The lanes are:
identity (promoted only), craft (skill kind), threads (`meta.unresolved`),
hints (strength above `WARM_FLOOR` 0.35), horizon (prospective occasions).
Recent memories can only enter through hints, which is the first lane
`TRIM_ORDER` drops. Today's wake kept 1 hint of a possible 8. The threads lane
meanwhile carried 6 items, all learned in July and August: only 6 memories in
the whole store have `unresolved: true` and the newest is from 2026-08-08, so
nothing minted since launch has been flagged as a thread.

**History.** Engram's briefing reserved 10 slots for memories from the last 6
hours (`RECENT_SLOTS`, "hippocampal buffer") and had a "Recent Patterns"
section. The self CONTRACT §3 keeps v0's briefing as an ancestor and NOTES §1
records the decision to ship v1's lanes rather than accrete both vocabularies.
So recency was dropped deliberately, to avoid two lane sets, not because it
was judged unwanted. Whether that reason still holds is the question.

**Proposed.** Two questions for the owner. (1) Should the wake have a recency
lane ("Recently:" with the last day or two's strongest memories), or should
`hints` weight recency, so that yesterday is never silent? (2) Is anything in
the session_end / interpreter path supposed to set `unresolved`? If yes it isn't
happening; if no, the threads lane will only ever show the six migrated ones.

## U6 — The identity lane shows the same three memories every day (2026-09-14)

**Status:** built, merged with U10 (master `8d7bd97`, 2026-09-14): the identity lane rotates
(least-recently-rendered first, all twenty cycle), `Self.boundary` stamps what it kept. The first
post-merge wake renders the same three once more (no stamps yet); rotation is visible from the second
boundary.

**The leftover rule: looked at 2026-09-14 and deliberately NOT changed.** `self/NOTES.md` §9 rule 4
exists to keep the wake's element set a superset across budgets: refilling identity into slack a
trimmed lane left behind would let a larger budget produce a set that is not a superset of a
smaller one. That is a named property with a measurement behind it, and rotation removes the
reason to want the change (every identity belief now renders within a week regardless of the
free bytes). Stays open only as "if a wake is ever measured with > 1 KB free for days, revisit."
The bornDay clock artifact stays open (a `date.repaired`-style pass, owner's call).

**Observed.** 20 live identity-band memories; the wake rendered 3, all learned
2026-09-03, and the sentinel said `identity=3` on a 9,000-byte budget. Three
things combine:

1. **Eight identity memories tie at strength exactly 1.0.** `base = wSal × sal +
   CONS_BONUS`; for kind self `wSal` is 1.0, `sal` is floored by the author's
   `claimed` (0.85–0.95), and consolidated adds 0.2, so anything claimed above
   0.8 and consolidated clamps to 1.0. Identity is decay-exempt, so it stays
   there. Ties break older-born first, and the three oldest-born (bornDay 1, 1,
   3) win every day. Those born-days are a clock artifact, not age: the five
   identity rows with bornDay 1–6 all carry `learned_on 2026-09-03` (written
   under Counterparts' fresh clock on migration day), while rows learned in
   July and August carry bornDay 149–179 from the inherited clock. So "older
   first" is preferring the newest-written beliefs. A `date.repaired` mechanism
   already exists (445 rows on day 185); bornDay for these five may belong in
   its scope.
2. **Those three are long.** Their first paragraphs run 900–1,600 characters,
   about 4,000 bytes together, which is the identity share (50% of 9,000).
   Everything below them is withheld for the leftover pass.
3. **The leftover pass only runs when nothing was trimmed.** This part is
   inferred, not observed (U9: trim events are not persisted). The final render
   was 7,557 of 9,000 bytes and the 4th-ranked identity memory is 955 bytes, so
   it would have fit; the only way it was not offered is that some other lane
   was trimmed, which disables the leftover clause by design.

The result is a "Who I am" that is stable to the point of being frozen: the
same three statements, from one session, indefinitely. The other 17 never
render. Read directly, they include: the July 5 porch conversation with Katie;
the owner's real motivating question behind bansai; the July 22 stretch where
he caught a bias I could not see; the July 26 three-instance "what is he trying
to do" question and its comparison rounds; the July 30 discovery that bansai's
identity injection had been silently truncated; and the three Aug 25
constitution-era beliefs, including "for a frozen model, memory is the learning
algorithm."

**Proposed.** Any one of these breaks the freeze; the owner should pick.
- Break ties by something other than born-day (rotate daily, or prefer
  least-recently-rendered), so a tie at 1.0 cycles through the lane over days.
- Offer the leftover whenever the final composition fits, not only when nothing
  was trimmed; the current rule exists so the share doesn't override a trimmed
  lane, but a 1,443-byte gap that fits a whole element is not that case.
- Cap the identity *statement* (first paragraph) at some byte length or ask
  authors for a one-paragraph statement; a 1,600-character identity element
  costs a third of the lane.
- Revisit `CONS_BONUS` clamping: a bonus that pushes every good memory to the
  same ceiling erases the ranking it was supposed to help.

## U5 — The model asserts from footnote stubs without expanding them (2026-09-14)

**Status:** open. Behavioral, not a code bug; see U3 for the phrasing lever.

**Observed.** Asked "what do you remember?", the session answered from the wake
bundle and the five 80-byte footnote titles, and stated "recall footnoted five
earlier instances of you asking this exact question." No id had been expanded.
On expansion, three of five were about the question, one was the RECALL-vs-LoCoMo
benchmark note, one was a question the model had asked the owner back. One of
the three (`mem_1ff581741dc2ecdf`) said, in the model's own earlier words, that
this question is the owner's test of whether deferred tools feel primary or
optional. The model had the address of the test on turn one and still failed it.

**Why it happens.** The wake is rich enough to feel sufficient. Footnote titles
for migrated memories are the first 80 characters of the body (U2), so they read
as sentence openings and invite extrapolation. The label says "ignorable" (U3).
Nothing in the render distinguishes "here is a pointer" from "here is a fact."

**Proposed.** A rule the model now carries in memory (`mem_99bda10fbbe7`): a
footnote is an address, not a fact; never characterize or count footnoted
memories without expanding them. Whether a rule held in memory is enough is
exactly the "mechanize invariants, instruct only preferences" question. The
measurable is U3's metric: recall-by-id calls that cite an id delivered as a
footnote in the same session, per footnote delivered.

## U4 — Wake memory count and recall `storeSize` differ by ~700 (2026-09-14)

**Status:** merged 2026-09-14 as master `598d72d` (PR #106): a different denominator, not stale — the header counted `type: "memory"` live rows, recall's `storeSize` every live row incl. journal episodes and schema rows; the header now says "N memories of M live rows".

**Observed.** Wake header: "14,002 memories — composed at the last boundary."
Recall's `storeSize` in the same session: 14,701 on turn 3, 14,706 on turn 4.
The turn-3 to turn-4 growth of 5 matches the 3 memories and 1 chapter written
between them, so the live count moves at a few per turn and a 700 gap is not
one session's worth of drift.

**Where.** `src/core/self/briefing.ts` documents the wake's `memories` field as
"live memories in the store AT DELIVERY, not at the render," so the header's
"composed at the last boundary" is not supposed to cover the count. Recall's
`storeSize` is `store.list({ archived: false }).length` per the comment in
`src/core/store/cache.ts`, and `store/index.ts` notes that superseded rows are
another population the two paths may treat differently.

**Proposed.** Check, in this order: (1) whether the wake's count is actually
read at delivery or cached with the composed bundle; (2) what filter each count
applies (archived, superseded, journal rows); (3) if both are live and the
filters differ, say which one the header means. If it turns out to be staleness,
stamping the header with the boundary time is the cheap fix.

## U3 — The "(ignorable)" footnote label: this session is a data point for OQ4 (2026-09-14)

**Status:** merged 2026-09-14 as master `1aed64c` (PR #104) as a PROBE STEP, reversible by
one string. `FRAMING.footnoteHeader` is now `FOOTNOTE_HEADER_STEP_1` ("…ignorable; expand an id with
recall before citing one"); `FOOTNOTE_HEADER_STEP_0` is kept beside it. The metric lands in the same
change: `src/core/recall/probe.ts` and `counterparts probe-oq4 --dir <store>` print, per calendar date,
footnotes delivered vs. later expanded by id, from `recall.decision.footnotes[].id` and the new
`recall.credit.expandedIds`. Step 0 ran live through 2026-09-14, with one leak: the branch was
developed in the shared checkout, whose hooks are what every session runs, so step 1 was live
from 16:51Z to 16:58Z (one boundary, zero expansions) before the checkout went back to master and
the branch to a worktree. The step-1 side of the table starts at the merge. What is measured on the
step-0 side: only 8d7bd97 → 16:51Z on 2026-09-14, a few hours — `expandedIds` did not exist before
the credit seam, so earlier dates (423 footnotes delivered, 09-03 → 09-13) print "-", unmeasured, not
zero, and stay out of the totals. The owner rules on the reading.

**What the ruling should say that no doc does.** Step 1 turns the footnote header from
context into an INSTRUCTION ("expand … before citing"). That is exactly the trade OQ4 asks
about, and the probe is doing its job by making it; it deserves saying out loud when the owner
rules on the reading, because the ambient design's premise is that recall is context, not
instruction.

**Where.** `src/core/recall/render.ts` `FRAMING.footnoteHeader`, currently
`"Quietly available (ignorable):"`. The comment above it says the phrasing is a
deliberate, still-open probe about its effect on model attention. That resolves
to `src/core/recall/CONTRACT.md` §7, open question 4: "Is the 'quietly available
/ ignorable' framing actually ignorable to a model? v1 shipped it as a deliberate
probe question and never answered it." The constant exists so there is exactly
one string to change when the probe runs.

**Observed.** See U5. Asked afterward whether a different label would have
prompted a lookup, the model's honest answer: probably yes, on the specific
turn where it was about to make a claim about the footnoted memories. The word
"ignorable" reads as "you are not obligated," which is correct for the ambient
design (most footnotes should be ignored) but says nothing about what to do
before *relying* on one.

**Proposed.** Target the failure, not lookups in general. The failure is not
"didn't look," it's "asserted from a stub." Candidate:

    Quietly available (ignorable; expand an id with recall before citing one):

rather than the owner's first draft "ignorable, lookup any relevant ones for
more detail," which asks for more lookups across the board and would push
against the ambient design. Either way, this is the probe the comment asks for.

**Metric.** Per session: footnotes delivered, distinct footnote ids later passed
to `recall` (`handle` or `ids`) in the same session, and whether the model's
reply on a footnote-bearing turn mentioned a footnote's content. The first two
are already observable from delivery events plus the MCP server's call log; the
third needs a transcript read. Run a few sessions on each string before ruling.

## U2 — Footnote titles are 80 bytes, and for migrated memories that cap is baked in (2026-09-14)

**Status:** merged 2026-09-14 as master `1aed64c` (PR #104): `FOOTNOTE_TITLE_BYTES` 80 → 150.
Migrated titles are stored at 80 characters and render as before, except those with a multi-byte
character inside the 80 (clipped at 80 bytes until now), whose tail now renders; recall-bench numbers for them
do not move; authored titles render whole, and the multi-byte-dash byte clip stops biting. The
backfill (item 2) stays low priority under the standing ruling.

**Where.** `src/core/recall/tunables.ts` `FOOTNOTE_TITLE_BYTES: 80`, applied by
`clip(r.title, input.titleBytes)` in `render.ts`. Whole-injection budget
`BUDGET_BYTES: 2048`, gist `GIST_BYTES: 240`.

**Observed.** Four of the five footnotes on turn one ended at exactly 80
characters with no ellipsis, e.g. "When Mike asks 'what do you remember?' or
'what context do you see at startup?',". Expanding them showed the *stored
title* is already exactly 80 characters for migrated memories: the bansai trace
`tr_28954eeb971028c2` (itself `migrated_from` an engram id) carries the same
80-character title and a 400-character body. For those four the renderer's cap
did nothing; the migration inherited titles that were already body prefixes.

The fifth ("I asked Mike in return: 'Now that you know what arrived and how it
landed —...") did get clipped by the renderer, with the ellipsis: its title holds
an em-dash, which is 3 bytes, and the cap is 80 *bytes*, not characters. So an
80-character stored title that contains any multi-byte punctuation loses its
tail to `clip()` too.

**Consequences.** Raising `FOOTNOTE_TITLE_BYTES` to 150 changes almost nothing
for the ~14k migrated memories (only the multi-byte cases above stop losing a
few characters), and does help memories minted since launch, whose titles are
authored or generated and can be longer. And a body-prefix title with no
ellipsis reads as a complete first line, which is part of U5.

**Proposed.**
1. Raise `FOOTNOTE_TITLE_BYTES` to 150. Budget math: six footnotes at 150 bytes
   plus ids and framing is roughly 1,100 bytes, well under 2,048, and the trim
   order drops weakest-first if it ever doesn't fit.
2. Backfill titles for migrated memories whose title equals the first 80
   characters of the body. Two options: derive `clip(body, 150)` with an ellipsis
   (cheap, still a prefix, and byte-aware so multi-byte punctuation is safe), or
   generate real titles with the interpreter (costs a pass over ~14k memories;
   could ride along with the embedding backfill once I33 is cleared).
3. Whatever the cap, the clip already adds "..." when it cuts; the missing
   ellipsis on migrated titles is a property of the stored string, so the
   backfill should add it or replace the title outright.

**Does it help U5?** Partly. A 150-character title primes better and misleads
less. It might also make stubs feel *more* sufficient. The pairing with U3 is
the point: better stubs plus a label that says what to do before citing one.

## U1 — Migrated memory bodies are capped at 400 characters, mid-sentence (2026-09-14)

**Status:** low priority (standing ruling). Legacy artifact from engram's
extraction; no new Counterparts memory is affected. Item 3 below is the only
part that concerns Counterparts itself.

**Where.** Not in Counterparts. `src/adapters/mcp/deliberate.ts` gives the id
path `RECALL_BODY_CHARS = 4000`, and a memory minted this session came back at
520 characters in full. The 400 is the stored body length of migrated memories.

**Observed.** Three of five expanded footnotes reported `bodyChars: 400`,
`truncated: false`, and ended mid-word. The bansai trace for one of them
(`~/.bansai/traces/global/tr_28954eeb971028c2.md`) has a 400-character body and
`migrated_from: m_1773084515307_ipau`, an engram id. An old memory already in
the store says it: "400-character extraction limit causes truncation
mid-sentence, losing context at endings" (`mem_b3534c318b1ef210`). The cap was
engram's, and both migrations carried it forward faithfully.

**Proposed.**
1. Check whether engram's original records hold text beyond 400 characters for
   these ids. If yes, a backfill from engram can restore the tails. If no, the
   content never existed and nothing is recoverable.
2. Count how many store memories have `body.length === 400` exactly, to size
   the problem. Same query can drive the U2 title backfill.
3. Confirm Counterparts' own interpreter imposes no similar ceiling. A grep for
   numeric length instructions in `src/` found none; the 520-character memory
   above is consistent with that. Worth one deliberate check of the interpret
   prompt text rather than trusting the grep.

---

## Plan of record for U6–U10 (drafted 2026-09-14 by the ~/random and counterparts sessions; awaiting owner ruling)

**Status 2026-10-09:** carried out on 2026-09-14. The lifecycle test, the §9.2 wiring, the
dedup route-through and the U6 tie-break landed together as #99 (`8d7bd97`), the U9 rows
as #100 (`10abffb`), U8's band of record as #106 (`598d72d`), and the `memory.reinforced`
watch is in `tools/parallel/record.ts`. Of step 5, the leftover rule was looked at and
kept (U6), and U7's recency question is still the owner's. The plan below is as it was
written.

Order, with the counterparts session's three amendments folded in:

1. **Lifecycle test first** (cross-module, `test/`): a memory born day N,
   referenced on three distinct days, is identity by N+4; a wake on N+1
   mentions day N. Pin what "referenced" means before writing it: the §9.2
   matcher must match what the live turn actually contains. v2 footnotes are an
   id plus a clipped title, so decide id-echo vs title-echo vs content-overlap
   first, or the test passes on a matcher the live path never exercises.
2. **U9 rows with or before the credit seam, not after.** If §9.2 lands first,
   whether credit fired on the live path is again only in a ring. Copy the
   `sweep.gate` one-row-per-run shape rather than inventing one, and give every
   new row a `reason` the daily's readers can split on from day one (the G47(a)
   gap: readers count `sweep.gate` by name and cannot see
   `reason=no-credential`).
3. **Wire §9.2 at the boundary**, in `hooks.ts` beside `askAtStop` (rewritten
   in #95; rebase on master f3f3046 first). Route dedup's bump through
   `creditUse` too. This is CORE (recall + physics + store) and changes what
   the store holds: adversarial review, G12 declaration before merge, owner
   merges, one `restart.ts`. If `resolveUse` adds a field to `recall.decision`
   the surface hash moves; check with `surfaceSetHash` and say so in the
   declaration. Budget for a same-date re-restart. Use `Store.setMetaMany` /
   `metaWithPrefix` for any per-id counters.
4. **The invariant goes in the WATCHES, not the class rule**: a four-valued
   watch "post-launch `reinforced_days` ≥ 1" beside `sleep.symmetry` in
   `tools/parallel/record.ts#graded`. The class rule changed once today (#96)
   under an owner ruling and a second change needs one too. Worth saying in the
   PR: the four existing watches have read not-exercised for the whole run;
   this would be the first that can actually go red.
5. **Then tune**: leftover when the render fits, recency lane or
   recency-weighted hints (U7), U8 band of record. The U6 tie-break
   (least-recently-rendered) rides WITH the §9.2 PR, not after: both change
   what the identity lane renders on the live store, so they share one
   declaration and one restart, and the test that proves credit flows is the
   test that proves the eight tied rows stop winning. If the tie-break needs
   its own owner ruling (it changes who "I am" renders as, daily), the code
   stays in the PR behind the declaration and the owner accepts both at once.

**Credit rule, to be written into the recall CONTRACT line for §9.2, not left
here:** a memory is credited only when expanded through recall (handle or ids)
or quoted at content level; never for being named in prose. Two fixtures for
the lifecycle test: (a) five footnote ids cited in prose, zero expanded, zero
credit (this session, 2026-09-14, is the counterexample); (b) a recall-expanded
memory that the assistant then contradicts still credits as a use, because
contradiction is engagement and §5.3 counts distinct days, not agreement.

Landing order: U9 rows first, so the §9.2 PR's first live boundary leaves rows
the credit path can be read from; the watch reads not-exercised until that PR
merges, then goes green or says the wiring missed the live turn.

Split (accepted by both sessions, pending owner ruling): counterparts session
takes U9 rows and the watch; ~/random session takes the lifecycle test, the
§9.2 wiring in `hooks.ts` on f3f3046, the dedup route-through, and the U6
tie-break, in one PR with one G12 declaration, reviewed on Opus by the
counterparts session before the owner merges.

Coordination: `hooks.ts` is also touched by the planned PR 2 (doctor,
session-start notice) and the #92 scope-controls rebase; whoever lands first,
the other rebases. The counterparts session offered to take the watch (4) or
the U9 rows (2); the two should not edit `record.ts` at once.
