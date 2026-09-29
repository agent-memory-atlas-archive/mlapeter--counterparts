# Adversarial review: PR #285, the 2026-09-29 cleanup batch (2026-09-29)

## Fixed / not fixed (the fix round, same day)

| Item | What | Status | Where |
|---|---|---|---|
| S1 | Short debts could spend the day's two pointers ahead of a full debt in another project | **Fixed.** A short debt is offered only when no full debt anywhere in the store is waiting and not yet pointed at today. | `sessions.ts#owedWriteUps`; test "STORE-WIDE, NOT PER PROJECT" (probe P1) |
| S2 | At SessionStart a plain reminder gave way before the pointer and the question | **Fixed.** When a reminder is due and fits beside the wake in the JSON form, both asks are measured against that form (escaped, 9,500), and they give way. `gave-way` is recorded where it happens (each ask's deferral; the delivery for reminders, the dream offer, the update notice). One limit, named: on a 9,000-byte wake of ordinary lines the reminder cannot fit beside the wake even alone, so it still moves to the first prompt there. | `hooks.ts#sessionStart`, `envelope.ts`, `bin/hook.ts#deliverTurn`; `envelope-budget.test.ts` through `deliverTurn` (probe P3) |
| M1 | A written-up short session keeps its text up to 7 days past the write-up | **Fixed in the NOTES** (the sentence now says so). No code change; whether a short write-up should restart the week is Mike's call. | remember NOTES; test "A WRITTEN-UP short session…" (probe P2) |
| M2 | Recall's escaping reserve was a fixed 200 | **Fixed as far as it is cheap.** Every part of the prompt's JSON envelope except recall's own text is now measured, escaped, keys included. Recall's own escaping keeps a named 200-character reserve: its text does not exist when its budget is set, and composing it twice would spend its fires twice. Plain stdout reserves nothing. | `hooks.ts#recallRoom`, `ENVELOPE_ESCAPE_RESERVE` |
| M3 | Doctor blamed `injectionBudgetBytes` when a question or reminder took the pointer's room | **Fixed.** The deferral record names what rode beside the wake; doctor says so and advises the budget only if it keeps happening. | `sessions.ts#WriteUpPointerRecord`, `doctor.ts`; test "DOCTOR NAMES WHAT TOOK THE ROOM" (probe P4) |
| N1 | The first-launch question now comes back in unscoped directories | **Not changed, on Mike's word:** kept as built (his G41 design, once per session in each unscoped directory until he answers there). | — |
| N2 | `claude -p` / Agent SDK sessions owe a short write-up | **Fixed, with one step unverified.** The host binary (2.1.285) sets `CLAUDE_CODE_ENTRYPOINT` (`cli`; `sdk-cli` for a non-interactive start; `sdk-ts` / `sdk-py`; `mcp`; `claude-code-github-action`). The hook keeps it on the session's registry record, and a short debt with a non-interactive entrypoint is not offered. Not verified: a hook's environment on a real `claude -p` run, which would fire the owner's live hooks. | `bin/hook.ts#toHookInput`, `sessions.ts#NON_INTERACTIVE_ENTRYPOINTS`; test "NOT A PERSON'S INTERACTIVE CONVERSATION" |
| N3–N5 | Heads-ups (nightly child excluded; tiering in one project; "more" lines) | No change asked. | — |
| T1 | The SessionStart ordering test asserted at the adapter, not the delivery | **Fixed** with S2: the tests go through `deliverTurn`. | `envelope-budget.test.ts` |

The review follows as it was written, against `675485f`.

---

Adversarial review, 2026-09-29. Read-only on the branch. Suite on the PR head without
`*-live.test.ts`: **4512 pass / 8 skip / 0 fail** (119 files, 221 s), the same as the PR
states. I proved the findings with throwaway probes, all hermetic: 4 pass, each one
confirming a finding. The probe file is saved as
`~/counterparts-notes/2026-09-29-review-pr285-probes.test.ts.txt`. I removed it and the
`node_modules` link from the worktree afterwards.

## Verdict: fix first

Two should-fix items, both small. No blockers. Items 1, 3 and 4 are clean.

---

## Should-fix

### S1. Short debts can use up the day's two pointers ahead of a full debt in another project
- **Where:** `src/adapters/sessions.ts:1482-1500` (`owedWriteUps`, eligibility and tier)
  and `src/adapters/claude-code/hooks.ts:912-941` (`deliverWriteUpAsk`).
- **What goes wrong:** the "full first" tiering only sorts debts within one project, since
  `owedWriteUps` filters by `scope`. The day's allowance, though, is one count for the
  whole store (`WRITE_UP_ASK_COUNT_KEY`). So if the first two session starts of a day are
  in a project that only has short debts, both pointers go to one-line write-ups, and a
  full debt in another project waits until the next day. This happens again every day
  that quick sessions come first.
- **Evidence:** probe P1. The seed is `full-other` in OTHER and `short-a` / `short-b` in
  PROJ. The starts s1 and s2 in PROJ both get the short line. Start s3 in OTHER gets
  `ask === ""`, because the allowance is spent.
- **Why it matters:** this is exactly the brief's "Could a day's 2 asks be spent on
  trivial sessions ahead of real ones?", and the answer is yes, across projects. A full
  debt is `kept-owed`, so its raw text stays until someone writes it up. Starving full
  debts therefore keeps raw text longer, which works against the retention limit. Doctor
  also turns amber after `WRITE_UP_WAIT_DAYS` (3).
- **Fix, same primitives, no new mechanism:** make a short debt eligible only when no full
  debt anywhere in the plan is both `waitingForWriteUp` and not yet pointed at today. The
  builder's in-project tiering test stays green. A stricter alternative is to let short
  debts take the day's second pointer only.

### S2. At SessionStart, a plain reminder due today gives way before the pointer and the first-launch question (the stated order is backwards)
- **Where:** `src/adapters/claude-code/hooks.ts:740-760, 805-811`. The order is stated in
  `src/adapters/claude-code/NOTES.md:1750`, in `TUNABLES.HOST_OUTPUT_CHARS`'s doc, in the
  PR body, and in `test/envelope-budget.test.ts:144`.
- **What goes wrong:** the scope question and the write-up pointer are measured against
  10,000 in plain stdout. A plain reminder, though, reaches the person only inside the JSON
  envelope (`systemMessage`), and that envelope is limited to 9,500 after escaping
  (`bin/hook.ts#hostDelivery`). On a full morning the asks fit in plain form, the JSON form
  does not, and `deliverTurn` drops the reminder, leaves it unclaimed and moves it to the
  first prompt. The pointer and the question are delivered.
- **Evidence:** probe P3. The setup is an unset directory, a 9,000-byte wake, one owed
  debt and one plain reminder due today, sent through the real `deliverTurn`:
  - the adapter reports `plain 1`, with the scope ask and the pointer both present;
  - at delivery the output is plain (not JSON), the reminder is not shown, and
    `dropped = {noticeChars:33, envelopeChars:10464, limitChars:9500}`;
  - afterwards the reminder is "still due".
- **What this does not cost:** the reminder is not lost. It is said at the first prompt,
  and the old code already behaved this way for the pointer. But the brief asked that "a
  plain reminder due today should be the last to go", and the documented order says so,
  while delivery does the opposite.
- **Two smaller consequences:**
  - The new adapter check `adapter.envelope.gave-way: plain` (`hooks.ts:757`) is measured
    at 10,000 plain, so on the real path it essentially never fires. The drop is recorded
    only as `adapter.notice.dropped`.
  - `envelope-budget.test.ts`'s SessionStart cases 1 and 2 assert "the reminder stays" on
    the adapter's `plain` field, not through `deliverTurn`. At delivery that is false. (See
    also T1.)
- **Fix:** either
  - when `plain.due` is non-empty, measure the scope ask and the pointer against the JSON
    envelope, i.e. `JSON.stringify` of the would-be envelope ≤ `ENVELOPE_CHARS`, and defer
    whichever of them does not fit; or
  - correct the docs and the test header to the true order. At SessionStart that order is:
    notices → plain reminders (sent to the first prompt) → pointer → question → wake.

  Either way, move the probe through `deliverTurn` into `envelope-budget.test.ts`.

## Minor

### M1. A short session that gets written up keeps its text up to 7 days past the write-up
- **Where:** `src/core/remember/owes.ts` (`clockFrom` includes `writtenUpAt`) and
  `src/core/remember/NOTES.md:605` ("exactly as before").
- **Evidence:** probe P2. The session ended 6 days ago and was written up now with `[]`.
  Its verdict is `kept-young` at +2 and +5 days and `deleted` at +8. Before this PR it would
  have been deleted at +1 day.
- **Assessment:** this is bounded (at most about 14 days after the session ended) and
  follows the same rule as full debts, so it is not "growth without bound". The NOTES
  claim is still only true for a short session nobody gets to.
- **Fix:** one sentence in the NOTES. No code change is needed unless Mike wants a short
  write-up not to restart the clock.

### M2. Recall's escaping reserve is a fixed 200 characters
- **Where:** `hooks.ts#recallRoom`, with `ENVELOPE_ESCAPE_RESERVE = 200`.
- **What goes wrong:** when a person-facing line rides the prompt, recall is sized to
  9,500 minus the other lines' bytes minus 200. The newlines and quotes inside recall's own
  text are not counted. A recall close to its 9,000 budget with more than about 200 of
  them would push the JSON envelope over 9,500, and the person-facing line (plain reminder
  or dream offer) would wait for the next prompt. It is deferred and unclaimed, not lost.
- **Assessment:** unproven, and unlikely at real recall sizes.
- **Fix:** subtract an escape estimate from recall's own output, or re-size and retry once
  when `deliverTurn` reports `dropped`.

### M3. A short pointer is at the edge of the room left beside a full wake
- **Evidence:** probe P4. After a 9,000-byte wake and the 400-byte scope question, the
  room left is 564 bytes. A short pointer with the host's 36-character ids is about
  410 + 96 = 506 bytes, and each plain-reminder line in the lead takes about 100 more.
- **What goes wrong:** when a pointer defers for `host-cap`, doctor tells Mike to "lower
  `injectionBudgetBytes`". The real cause is then the scope question or a reminder, not
  the wake, so the advice is misleading. (Doctor only says this while a full debt is
  waiting.)
- **Fix:** have doctor's wording name what else took the room, or accept the risk.

## Notes (heads-up, no change asked)

- **N1. The first-launch question comes back on Mike's machine.** Before this PR it was
  measured against the 9,000 injection budget, so on his near-full wake it was deferred
  every time. Now it is measured against 10,000, and it will appear in every session in
  every directory that has no scope entry, until he answers it there.
  - Cap safety is fine. The plain form stays within 10,000 (P4: 400 bytes needed, 564
    left). With a doctor notice, the JSON form drops the notice first; the notice comes
    back at the next start.
  - It is a real change on a normal day, so Mike should expect it.
- **N2. Which sessions now owe a short write-up.** Every registered, non-observer,
  non-night-run session that captured text and stayed under 6 turns / 24 KB now owes one.
  That includes `claude -p` / Agent SDK sessions that other tools start in hooked
  projects.
  - Probe P1's s1/s2 show that the pointer text for these reads like any other short
    debt.
  - Allowance is at most 2 pointers a day, and unanswered short debts expire after 7 days,
    so the volume is bounded. The cost is attention: Mike's first sessions each day start
    with a write-up chore.
  - If he wants these left out, the host's entrypoint in the hook environment (e.g.
    `CLAUDE_CODE_ENTRYPOINT`, if present — I have not verified that it is) could exclude
    non-interactive sessions. That is his call.
- **N3. The headless nightly child is properly excluded.**
  - `claim()` (`hooks.ts:1630`) is the one capture path for stop, pre-compact and session
    end, and it takes `turns = []` when `nightRun` is set.
  - The pointer, the scope ask, plain reminders and dream lines are all gated on
    `nightRun` (`hooks.ts:841, 905, 1192, 1373, 1521`).
  - The child's allowed tools are dream, reflect, self_page and recall. `note`, the jot
    path at `mcp/server.ts:931`, is not among them.
  - The unbound `mcp` id is excluded by adffd2a (the registry check). Observers capture
    nothing.
- **N4. The ordering tier within one project is sound.** The order is: full debts not yet
  pointed at today → short → full debts already pointed at today. Pruning now keeps
  progress entries for short debts. The pointer's wording is one plain sentence, appended
  to the existing line.
- **N5. The wake's "more" lines.**
  - The overflow ids come from the same `scanned` set as the lanes, so protected and
    confidential rows are already filtered by the interpreter copy's `omit`.
  - Reading by id still withholds confidential memories in a session that isn't the
    owner's (`mcp/server.ts:1272`).
  - A bundle a day old can name an id that has since been archived. That is harmless:
    recall returns nothing for it.
  - One effect worth watching: the lines invite `recall ids:` calls, which may reinforce
    memories that were overflow. Watch for it; no change asked.

## Items checked and clean

- **Item 1 (host mode removed).**
  - `child.ts`'s `startChild` is byte-identical in logic to the original: the diff against
    `page-writer.ts:386-520` changes comments only. That covers detached spawn, stdin via
    `end`, stdout and stderr ignored, the process-group SIGTERM then SIGKILL, the reap
    timer, the abort listener, and `spawnCodeOf`.
  - `planNightChild` / `planNightRunner` lose only `delete env[PAGE_WRITER_ENV]`. The
    variable is now read nowhere, so an exported leftover is inert. The flags
    (`--allowedTools`, `--disallowedTools`, permission mode, `--max-turns`), the
    stdin prompt, env pinning and the watchdog are unchanged.
  - Old configs: `mode:"host"`, `timeoutMs` and `command` go into `retired`, which doctor
    prints on its "Old settings" line (`doctor.ts:925`). The mode reads `session`, and the
    file is never refused.
  - The MCP `env` option: `tsc` is clean and a grep finds no other reader. Its only use was
    the pin.
  - One test was removed, "MODE COMES FROM THE CLAIM". It exercised the env channel only;
    the registry-channel tests remain.
- **Item 3 (a told plain reminder leaves Arriving).**
  - `horizon()` filters on `toldForGood`, and `arrivals()` is untouched. The new tests
    cover: told on its day leaves the lane for the whole grace week; the quiet one stays;
    it still arrives for recall; untold stays.
  - The month/range half is unreachable today, as the PR says.
- **Item 4 (the wake says what it trimmed).**
  - `offerLeftover` mutates `kept` and `held` in place, so `lostByLane` and the
    re-compose in `withMoreLines` see what was actually restored. There is no drift
    between what the wake shows and what it names as more.
  - The lines are added only while the whole wake stays within budget, and they are left
    out of the counts and the sentinel. The ids go through the real MCP `recall` handler
    in `wake-more.test.ts`.
- **Item 5 (nothing marked is lost).**
  - The scope ask and the pointer are marked before delivery, but they ride inside `out`,
    and `hostDelivery` never cuts `out`.
  - The only way to exceed the cap is a wake that is itself over 10,000. In that case both
    asks see negative room and defer unmarked, the reminder defers unclaimed, and
    `overCap` records it.
  - Dream hand-back and share lines stay in the model's context. They are not shed, and
    that is unchanged.

## Tests changed

**T1.** None of the rewrites weakens a guarantee:
- `below-threshold` now expects a short pointer, the `short-1` door case now returns
  `not-asked`, and the day-0 lane test now expects the "more" line. Each follows from the
  intended behaviour.
- The scope-ask deferral test now fills the host cap instead of using a 10-byte budget.
  That is equivalent under the new single budget.
- The host-mode tests were removed along with the mode. The starter's SIGTERM-ignoring and
  abort cases moved to `test/child.test.ts`.

The one gap is S2's: the new SessionStart ordering test asserts at the adapter layer
only, and delivery contradicts it.

## Rebase note (#284)

`hooks.ts` `userPromptSubmit` gets a new `recallRoom` call that reads
`dream.told.notice` / `dream.note.notice`. `dreamLines` loses its `pageWriter` guard.
`mcp/server.ts` loses `env` and has edits in `pageWriterMark` / `pageWriterClaim` and the
writer's why-map. `doctor.ts#pageWriterFindings` also changes. If #284 touches
`dreamLines`, the raise lines or the dream notice shapes, expect conflicts in those
regions. After rebasing, `recallRoom`'s `personLines` has to be re-checked against any new
person-facing line #284 adds.
