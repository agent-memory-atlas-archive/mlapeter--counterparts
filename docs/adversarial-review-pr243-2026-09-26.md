# Adversarial review — PR #243, prospective memory (reminders), 2026-09-26

Branch `prospective/reminders`, reviewed at `fa7c4f7` (builder's head). Scope: `eventDate` +
`remind` on `note` / `session_end`, plain "Today: …" lines via the hook `systemMessage` and
model context with the `prospective.plain` latch row, `Counterpart#spendArrivals` as
`fire()`'s live caller, `Store.datedMemories`, range windows, the four July tune
questions, and the gauges.

Baseline before any fix: full suite green in UTC (3,864 tests) and America/Denver.
`test/prospective-reminders.test.ts` **failed in Pacific/Auckland and Pacific/Kiritimati**
(S3 below).

Severity: **blocker** = the feature does not do what it says for the owner's normal use;
**should-fix** = a concrete failure a user can hit; **note** = recorded, not fixed here.

---

## Blocker

### B1 — A plain beat was spent before anyone knew the terminal would show it

`ClaudeCodeAdapter#plainFor` called `Counterpart.plainReminders`, which CLAIMS every beat
it returns, inside `sessionStart` — before `bin/hook.ts` built the output envelope. The
envelope has a hard ceiling (`ENVELOPE_MAX_CHARS` = 9,500; the host replaces anything over
10,000 characters), and at SessionStart the wake wins: notices that do not fit are dropped
(`hostDelivery`'s priority loop). The owner's wake is ~9 KB (NOTES: "a 9,038-byte wake plus
a 352-character notice is 9,618 characters"), and the plain lines also added themselves to
`additionalContext` under the `Now:` line, making it larger still.

**Failure scenario.** Owner's store, `injectionBudgetBytes` ~9,000, a note "pay your taxes"
with `eventDate: "2026-10-15", remind: "plain"`. On Oct 15 the first session starts: the
beat is claimed, the envelope with `systemMessage: "Today: pay your taxes"` is over 9,500
characters, the systemMessage is dropped (`adapter.notice.dropped`), and the latch now says
"told". Every later session and prompt that day says nothing. The terminal line — the whole
point of `plain` — never appears on any morning the wake is full. The same happened at a
prompt whose recall filled the envelope, and to every plain line at once when a day had
more of them than room.

**Fixed.** The adapter now returns plain lines UNCLAIMED (`notices` + `plain` records);
`bin/hook.ts#deliverTurn` puts them first among the notices, probes the envelope for the
longest in-order run that fits, and claims only those (`ClaudeCodeAdapter#claimPlain` →
`Counterpart.claimPlainReminder`) — the update notice's own "mark only what is certainly
leaving" rule. Whatever is not claimed (no room, or the race lost) is stripped from the
model's copy as well (`withoutPlain`) and read again at the next prompt, whose envelope is
small. Plain lines now go ahead of the doctor's red line: that line returns at the next
start; a beat would not.

## Should-fix

### S1 — The update notice could cost a plain line that fit

`deliverTurn`: `if (carried.dropped !== null) return carried;`. `carried` is the delivery
with plain lines AND the update notice; when it overflows, `hostDelivery`'s prompt branch
drops ALL notices together. **Scenario:** a prompt whose recall leaves room for
"Today: pay your taxes" but not for it plus the ~200-character update notice → neither is
shown, and (under B1) the beat was already spent. **Fixed:** when the two do not fit
together, the delivery without the update notice stands (the update notice is unmarked and
retries next turn, as before), with the drop recorded.

### S2 — The host-mode page writer's headless child spent beats

`page-writer.ts` spawns `claude -p` with the user's own settings, so the owner's hooks run
in it — and its SessionStart claimed plain beats into a terminal nobody reads.
**Scenario:** `pageWriter.mode: "host"`; the owner closes a late session at 00:30 on
Oct 15, the worker runs at that boundary and starts the night's writer (`bin/runner.ts`
step 5), the child's SessionStart is the first session of Oct 15 → it claims "Today: pay
your taxes", and the owner's morning session is told nothing. **Fixed:** `toHookInput` marks the child (`COUNTERPARTS_PAGE_WRITER` in its
environment → `HookInput.pageWriter`), and `plainFor` offers it nothing. Other headless
sessions are N6.

### S3 — The gauge test failed east of UTC; the fire row had no calendar date

`test/prospective-reminders.test.ts` "fired this week: plain and quiet counted apart"
failed under `TZ=Pacific/Auckland` and `Pacific/Kiritimati`: its clock is noon UTC on the
15th, which is the 16th there, and a `prospective.fire` row carried no calendar date, so the
fired view dated it by its wall-clock moment and counted it outside the window, while the
plain row (which carries `date`) was counted. In live use the moment and the calendar day
agree, but a quiet fire is ABOUT a calendar day, and the suite must be green in every zone.
**Fixed:** the fire row carries `date: at`, like the plain row; `rowDate` prefers it.

### S4 — More plain items than room: all or nothing

Part of B1, named separately because it survives a naive fix: at a prompt the notices are
all-or-nothing, so a day with many plain items (range openings, a month, several
deadlines) could exceed the envelope on their own and — claimed first — all be lost; with
claim-after-fit alone they would be deferred forever. **Fixed** by the longest-fitting-run
probe: what fits is said and claimed; the rest waits for the next prompt.

## Owner-level change made in this pass (not a finding)

**An explicit `eventDate` qualifies a quiet reminder regardless of the ~0.6 salience
floor** — choosing a date is itself the importance signal. `DerivableMemory` gained
`explicitDate` (the `event_date` column, filled by `Prospective.load`); the floor now gates
only a caller-extracted date (`extraDates`). The faded and archived exclusions are kept —
and because `derive` had no decay check (the floor did that work), a `faded` refusal was
added at `FADED_STRENGTH`, the line the `faded` exit already uses, so G10 still holds.
**Verified end to end**, not just at the predicate: a quiet `note` at the authored default
(0.25) reaches the footnote tier on its day through `recallForTurn` and spends its fire
(`test/prospective-review-pr243.test.ts`). Tool description, CHANGELOG, CONTRACT §3,
prospective NOTES §4/§12, mcp NOTES and the dashboard copy updated.

## Notes (recorded, not fixed here)

- **N1 — The latch is sound.** `claimPlain` is `INSERT OR IGNORE` on the partial unique
  index `events_dedup`, with `changes()` read inside the same `mutate` transaction, and
  retention never deletes a row with a `dedup_key`. The builder's "two processes racing"
  test was one process, sequential; a real two-process test was added (both children see
  the beat due, wait on a barrier, claim at once: exactly one wins, one row). A claim that
  hits SQLITE_BUSY returns false, so the line is not shown and is retried next prompt —
  never shown-but-unmarked.
- **N2 — Midnight and zones.** "Today" is the hook's local calendar date
  (`todayIn(resolveZone(timeZone))`). A session open across midnight says the new day's
  items at its next prompt; yesterday's day item is out of span. The latch key has no date,
  so flying west across the date line cannot re-tell a told beat. The prospective suites
  pass in UTC, America/Denver, Pacific/Auckland, Pacific/Kiritimati and Pacific/Pago_Pago.
- **N3 — Stale or unset lived day.** The plain lane reads calendar dates only; the lived
  day is a label on its row (0 on a store never advanced). The quiet brake "once per lived
  day" does read the lived day, so a stale one makes quiet fires rarer, never more frequent.
- **N4 — Re-firing every turn.** Bounded by brake 1 (lived day) and brake 2
  (`FIRES_PER_WINDOW`); brake 3 (session dedup) is in-process, i.e. inert across hook
  processes (builder already says so). Residual: if the fire WRITE keeps failing (a writer
  holding the lock), the cue is re-offered each turn until it lands, and the failure is a
  ring-only `counterpart.prospective.fire.failed`.
- **N5 — Confidentiality.** A confidential plain item is read only in the owner's session
  and is never claimed elsewhere, so a non-owner session cannot spend it; observers are
  told nothing and write nothing. Memories have no per-project scope in this store, so an
  owner's plain line appears in whichever of the owner's sessions starts first that day.
- **N6 — Other headless sessions can still spend a beat.** Any `claude -p` / SDK run with
  the hooks on (the owner's own scripts, a scheduled agent) looks like a session to
  SessionStart; the payload says nothing about a watching person. Left: nothing to detect
  it by. The model still gets the line in that session's context.
- **N7 — A revision drops the date.** A `note` with `updates:` and no `eventDate` mints a
  successor with no date; once the old one is superseded the reminder is gone. The tool
  description does not say "send the date again when revising". Owner's call.
- **N8 — A past `eventDate` is accepted silently.** It is stored and echoed as recorded,
  with no "that date has passed" hint to the model.
- **N9 — `datedMemories` grows with history.** It reads every dated row up to `to` and
  filters in JS, and runs twice per prompt (arrivals + plain). Fine at today's sizes.
- **N10 — Double mention at SessionStart.** A salient plain day item can appear both as a
  horizon "Arriving" line in the pre-rendered wake and as the plain line. A tact/wording
  question, not a bug.
- **N11 — Crisis deference is still unwired.** No live caller passes `refractory` or
  `previousSessionHighAffect` (pre-existing; builder named it).
- **N12 — Upgrade from 0.3.2 (v7) with nothing dated: nothing changes** in delivery —
  SessionStart and prompts carry no plain records and `deliverTurn` equals plain
  `hostDelivery` (test added). The gauges only read (`datedMemories` is a SELECT on the
  `ReadOnlyStore` surface); the Prospective light moves from "not built" grey to "nothing
  dated yet" grey, and `fired`'s prospective row moves from blind to event evidence.
- **N13 — The plain lane has no decay check, and prune could still take a far-off one.**
  At the authored default a `fact` falls under `PHI_PRUNE` after ~152 lived days; with 90
  days' dwell it is then prunable, so a plain reminder set many months of active days ahead
  can be pruned before its day. Not a near-term risk; worth knowing.
- **N14 — SessionStart's `sent` can exceed the reported budget** by the plain context lines
  (`adapter.injection.overbudget`, ring-only). The host's hard limit is the envelope, which
  B1's fix now respects.
