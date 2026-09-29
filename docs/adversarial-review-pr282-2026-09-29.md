# Adversarial review: PR #282, a visible dream ask and headless `auto` (2026-09-29)

Reviewed at `422a51f` (branch `mechanisms/dreaming-headless`, base master `a319266`), in
a detached worktree. Nothing was pushed and the PR branch was not changed.

The probes were throwaway. They lived in the scratchpad (`probe-pr282.test.ts`) and used
temp stores, a temp `HOME`, and a stub `claude` placed first on `PATH`. No real `claude`
was started and no live store was opened.

## Verdict

**Fix first.** There are no blockers. The consent line holds: nothing in the working
session is told to launch an agent in `auto`, `ask` is the default, and no migration
writes the setting. The quiet child does not recurse. Starting the detached process
really works end to end: I ran hook → `spawnDetached` → `bun bin/nightly.ts` → stub
`claude` from the repo path. That link was unproven in the PR.

Four should-fix findings:

1. The headless child's binding to the launching session fails in the most common
   "first prompt of the day" case, a session left open overnight. The failure is then
   blamed on MCP registration.
2. The dream tool's own description, which the model always sees, still ties `launch` to
   `auto`.
3. `--allowedTools` is not a whitelist. The child runs unattended, with memory text as its
   prompt and no classifier.
4. A run that never reports, times out, or fails before it begins never falls back to the
   ask. It is relaunched headless up to the cap, and doctor says "Nothing to do by hand".

Counts: **0 blocker · 4 should-fix · 6 minor · 3 notes**, plus the test gaps (finding 14).

## Findings, most severe first

### 1. The child is refused by its own MCP server when the launching session is stale or has ended *(should fix)*
- **Where:**
  - `night-run.ts:224` deletes `COUNTERPARTS_SESSION` from the child.
  - `mcp/server.ts:2531-2582`: the child's fresh server has to lazy-bind, and the lazy bind
    requires `isLive`.
  - `sessions.ts:333-340`: `isLive` means `now - lastBoundaryAt <= 4 h` and not ended.
  - `hooks.ts:2059-2062`: "a prompt is not a boundary", so UserPromptSubmit never
    refreshes `lastBoundaryAt`.
- **Scenario (overnight):**
  1. A session is left open overnight. Its last Stop was at 23:00.
  2. At 08:00 the person types. That is the first prompt of the calendar day, so the hook
     claims the day, starts the run, and shows "dreaming in the background".
  3. The child `claude -p` starts. Its counterparts server is a new process, launched
     with no session, so its first `dream` call (`phase: "writer", session: <launching
     id>`) goes through `requireBoundSession`, which answers `session-not-live`
     (`stale`).
  4. The child can do nothing and exits 0. `runNight` classes the run `could-not-start` /
     `nothing-ran`.
  5. The next prompt says: *"claude ran but used none of the dream tools — is the
     counterparts MCP server registered for it?"* Doctor says the same.

  The diagnosis is wrong, and it will recur on every such morning.
- **Race:** the person's own Stop after the 08:00 prompt refreshes `lastBoundaryAt`. The run
  works only when that Stop lands before the child's first tool call. It is a race, not a
  rule.
- **Scenario (ended):** the launching session is closed within the child's start-up window
  (a quick question, then `/exit`). The server answers `session-not-live` (`ended`), with
  the same misdiagnosis.
- **Why the in-session path never hit this:** the old Agent shared the session's own MCP
  server, which was usually already bound, and a bound server skips the check.
- **Proof:** in probe P1, a session was recorded 9 h ago. The prompt started the run,
  `lastBoundaryAt` was unchanged, and a server opened with no session refused
  `dream writer` with `session-not-live`. The same call on a server opened with
  `session: "s1"` went through (`writer: false, reason: no-previous-day`). P1b repeated
  the ended case and got the same refusal.
- **Why the tests miss it:** every hook test calls `input()`, which records a fresh
  `phase: "start"` just before the prompt (`test/dreaming-headless.test.ts:66-70`). The
  stale case is never exercised.
- **Fix:** pin `COUNTERPARTS_SESSION` (and `COUNTERPARTS_SCOPE`) into the child's
  environment instead of deleting them.
  - `mcp/bin/serve.ts:78` reads that variable as `launchedSession`, which is bound without
    the liveness check, and no hook reads `SESSION_ENV`.
  - The id comes from our own hook, so no corroboration is lost.
  - This assumes the host passes the child's environment through to its stdio MCP
    servers. The repo already relies on that for `CLAUDE_PROJECT_DIR` (`serve.ts:265`).
    The coordinator's real run should confirm it, in the child's `mcp.session.bound`
    event source.
  - The pin cannot leak into the child's own session-end worker. `spawn.ts:172` pins
    `SESSION_ENV` from `input.sessionId`, the child's id, last, so the worker follows the
    child's session.
  - A weaker alternative: `startNightRun` refreshes the launching session's
    `lastBoundaryAt` before it spawns. That covers the overnight case but not the ended
    one.
- **Also:** word `nothing-ran` as "used none of the dream tools (the MCP server was not
  there, or refused the session)". Add a hook test with a stale session record.

### 2. The dream tool's description still says `launch` goes with `auto` *(should fix)*
- **Where:** `mcp/tools.ts:977`: *"Call `launch` when the line at the start of a session
  says to (the owner's setting `auto`) … hand the prompt it returns to a background agent
  unchanged."* Also line 979 ("the owner's setting decides whether it starts the run or
  asks first") and line 1054 (`auto` = "the run starts on its own … and says so").
  `tools.ts` is not in the PR's file list.
- **Scenario:** this text sits in every session's tool list. It ties an agent launch to
  the `auto` setting, which is the exact pattern the classifier refused on 09-29. The
  day's headless line ("there is nothing for you to launch") contradicts it. The
  description also doesn't know "dream on your own", so a model reading only the tool
  list learns nothing about that path.
- **Fix:** rewrite these lines:
  - `launch` is called only after the person says "dream" (or "dream on your own").
  - `auto` means the host runs the night itself, and the session launches nothing.
  - `setting auto` is for "dream on your own" or the owner turning it on.

### 3. `--allowedTools` is not a whitelist, and the child runs unattended with memory text as its prompt *(should fix)*
- **Where:** `night-run.ts:200-207` (the args). The header comment at lines 25-28 claims
  "anything else it tries stops at a prompt nobody can answer".
- **Scenario:**
  - `--allowedTools` only adds allow rules. The user's `~/.claude/settings.json` and the
    launching project's `.claude/settings*.json` allow rules still apply inside the child,
    for example a `Bash(*)`, `Edit` or `mcp__gmail__*` allowance. `--permission-mode default`
    sets the mode and doesn't remove those rules.
  - The child's prompt is the dream bundle: memory text, some of it quoted from
    elsewhere. The model runs with no one watching and, unlike the in-session Agent it
    replaces, without the auto-mode classifier in front of it.
  - It also loads the project's `CLAUDE.md`, its hooks and its `.mcp.json`.
- **Fix:** deny the built-ins explicitly. Deny rules beat allow rules, so pass
  `--disallowedTools Bash,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch,Task,Agent`.
  Where the installed host supports it, go further with an empty built-in tool set
  (`--tools ""`) and/or `--strict-mcp-config` with an `--mcp-config` that names only
  counterparts, and `--setting-sources` to keep project settings out.
  - Check the flag names against `claude --help` for the host version you target. I did
    not run `claude`.
  - Correct the header comment either way.
  - Host-mode page writer (`page-writer.ts`) has the same exposure. It predates this PR.

### 4. A run that never ends cleanly without starting a dream never falls back; doctor says there is nothing to do *(should fix)*
- **Where:**
  - `dream/index.ts:762-775` (`mayStartAgain`) and `fellBack` (`:962`): the fallback fires
    only for `could-not-start`.
  - `bin/nightly.ts:23`, `:29`, `:35` and `:53`: each stand-down records nothing.
  - `night-run.ts:276` (`record()`) and `:307`: if the first `open()` threw, the recording
    `open()` usually throws too, and the failure is swallowed.
  - `doctor.ts:2900`.
- **Scenario A (no report):** the detached process dies, stands down, or cannot open the
  store. The row stays `started`. After 30 min, `mayStartAgain` sees a `launched` line
  that no dream followed and relaunches **headless**, then again, until
  `RELAUNCHES_PER_DAY` is used up. The ask never comes. Doctor then goes amber with *"Nothing
  to do by hand: … asks instead when one cannot start"*, which is untrue here.
- **Scenario B (timed out or failed before beginning):** `claude -p` hangs on a login or
  keychain prompt, a dialog, or an update. That is 20 min, then `timed-out`, with no dream
  begun. Or it errors after more than 60 s with nothing begun (`failed/exit`). Neither is
  `could-not-start`, so the same thing happens: up to three 20-minute headless attempts a
  day, no ask, and the reason is visible only in doctor.
- **Proof:** in probe P2 (auto, the spawner records but nothing runs, prompts 31 min
  apart), there were 3 headless starts. All three prompts showed "dreaming in the
  background" and none showed the fallback. Doctor's fix text was "Nothing to do by
  hand…".
- **Fix:**
  - Treat a run as fell-back when it is `timed-out` or `failed` with `dream === null &&
    reflection === null`, or when it is `started` and older than the watchdog plus grace
    (reason `lost`).
  - Record `could-not-start/refused` in `bin/nightly.ts` wherever the store can still be
    opened. Don't open it a second time just to record a failure to open.
  - Change the lost-`started` doctor text.

### 5. `done` with an unfinished reflection, and the dream line handed back twice *(minor, flagged by the builder)*
- **Where:** `night-run.ts:365`; `hooks.ts:1212` (`nightHandBack`);
  `dream/index.ts:975` (`nightHandBackLine`).
- **Scenario:** a night journals its dream, then the reflection is refused or abandoned,
  and the process exits 0.
  1. The run is classed `done`: doctor green, hand-back says "finished" with no caveat.
  2. 30 min later the reflect-only run starts headless. Its row gets `dream =
     reflected.dream_id`, so its hand-back carries the same dream line again, plus the
     share.
- **Fix:**
  - For a whole night, `done` should require a reflection (or one already `reflected`
    today). Otherwise `failed/unfinished`, which keeps the dream id.
  - A reflection-only run's hand-back should carry the share only.

### 6. The headless start line is dropped for room, but the model is told it was shown *(minor)*
- **Where:** `bin/hook.ts:891-904` (the `told.offer === null` branch) and the headless
  `context` in `dream/index.ts:907-919` (line 918) ("Shown to Mike just now, in the terminal: …").
- **Scenario:** the recall envelope leaves no room for the notice. The run has already
  started, the person isn't told a background `claude` is spending tokens, and the model
  is told something false.
- **Fix:** keep the headless context neutral ("the host started it; the person is told in
  the terminal when there is room"), or retry the notice at the next prompt the way a
  plain reminder waits.

### 7. The same-prompt fallback reads as two starts and costs a relaunch *(minor)*
- **Where:** `hooks.ts` `dreamLines` (claim `launched`, then the fallback reclaims);
  `dream/index.ts:1003-1008`, which records `relaunched` for any reclaim;
  `dashboard/web/narrate.ts:233-237`.
- **Scenario:** the runner cannot spawn. Two `dream.ask` rows are written, `launched` and
  then `relaunched`. The feed narrates "I started the nightly run in the background…" and
  then "My last run was cut off, so I started it again.", and neither happened.
- **Relaunch count:** the fallback uses one of the day's two relaunches, leaving one for a
  real cut-off later.
- **Wording:** in the same prompt the notice says "I couldn't dream on my own **last
  time**".
- **Fix:**
  - Record the fallback as `offered` with `after: "could-not-start"`, and don't count it
    as a relaunch.
  - Word it "I couldn't start dreaming on my own: …".

### 8. "no dreams" as the day's first prompt cannot stop the run it triggers *(minor)*
- **Scenario:** the hook starts the headless run before the model reads "no dreams". The
  setting goes `off`, but today's child runs to completion, and nothing can stop a
  running headless run.
- **Fix:** `bin/nightly.ts` writes its pid on the row, and `setSetting("off")`
  SIGTERMs that process group. Or state plainly that it takes effect tomorrow.

### 9. `askLine` on a headless offer claims the day and starts nothing *(minor)*
- **Where:** `dream/index.ts:1019-1023`.
- **Scenario:** `askLine` is kept "for a caller with no terminal". With `auto` set, it
  returns "…is starting now… nothing for you to launch" and claims the day, but no
  process starts. There is no production caller today; `fired.ts:713` still names it as
  the module's door.
- **Fix:** return null (or throw) for a headless offer, or remove `askLine`.

### 10. A long `dreaming.timeoutMs` allows two runs at once *(minor)*
- **Where:** `config.ts` `readDreaming` accepts any positive value;
  `ABANDONED_AFTER_MS` is 30 min.
- **Scenario:** with a 60-min watchdog and a slow child that hasn't begun its dream by
  30 min, `mayStartAgain` starts a second headless run while the first is alive.
- **Fix:** clamp `timeoutMs` below `ABANDONED_AFTER_MS`, or treat a `started` row younger
  than its watchdog as `dreaming-now`.

### 11. Consent edges: the model's word for `auto`, and stores already on `auto` *(note, decision for the owner)*
- **The model's word:** `dream` `setting auto` over MCP (`server.ts:1864-1878`) takes the
  model's word that the person said "dream on your own". The only thing the hook text
  does is condition it. That is the same trust as `off`. The first headless start is shown
  in the terminal, so a mistake is visible and one "no dreams" undoes it.
- **Stores already on `auto`:** the default flip covers only stores with no `dream.setting`.
  A store where `auto` was written explicitly goes headless at the first prompt after
  0.3.7, without a yes to headless. 0.3.6's `off` text pointed at `--setting auto`, so
  anyone who turned dreams off and back on is in this group.
  - I found no migration or install path that writes the setting. The only writers are
    `mcp/server.ts:1870` and `cli/commands.ts:2030`.
  - **Owner:** run `counterparts dream` on your machine before installing 0.3.7 to see
    which setting you are on.

### 12. The hand-back goes to the next prompt anywhere *(note)*
- It lands in whichever session prompts next, in any project and possibly mid-task,
  including a non-owner configuration. It carries the dream's title and counts, plus the
  share. This is the same cross-session carry `pendingShare` already does. Accept it, or
  prefer an owner session in the launching scope.

### 13. The child inherits the launching project's context *(note)*
- The child starts in the launching project's directory, so it reads that project's
  `CLAUDE.md`, hooks, and project-scope `.mcp.json`. Project-scope MCP servers may be
  unapproved in `-p`. The counterparts server is `-s user` (`install.ts:450`), so the run
  itself is unaffected. See finding 3.

### 14. Tests: what they prove, and what they don't *(test gaps)*
- **Proven:** the plans (argv, env scrub, stdin, cwd); `runNight`'s classification against
  a stub; the latches; fallback and hand-back through the adapter; doctor.
- **Not proven, with what I did about each:**
  - A stale or ended launching session: not tested (finding 1).
  - The quiet flag at SessionStart (the scope question at `hooks.ts:807`, the write-up
    pointer at `:869`) and at SessionEnd/PreCompact: untested. I checked them by reading
    the code, and they are guarded.
  - `bin/nightly.ts#main`: untested in the PR. I ran it end to end (probe P3), and it works
    from the repo path. The npm package ships `src/`, so `NIGHTLY_PATH` resolves the same
    way `RUNNER_PATH` does.
  - A timed-out or failed run with nothing begun, and its (missing) fallback: finding 4.
- **bun vs Node:** `nightArgs: ["run", NIGHTLY_PATH]` under `process.execPath` assumes bun,
  exactly as `RUNNER_PATH` does. Under Node it would fail the same way the worker does.
  CLAUDE.md says Node is untested, so this is not a new defect, but it is one more entry point
  that assumes bun.

## Decisions for the owner

**A. Stores already on `auto` (finding 11).** Run `counterparts dream` on your machine before
installing 0.3.7. The question is whether the release should reset a store that has `auto`
written explicitly back to `ask`, so that headless also needs one fresh yes. Or whether
`auto` in the store counts as that yes.

**B. How strict the child's tools are (finding 3).** Options:
- Deny the built-ins only, with `--disallowedTools`.
- Also give it an empty built-in set and a strict MCP config naming only counterparts.
- Also keep project settings out, with `--setting-sources`.

The stricter the flags, the more host-version dependence there is.

**C. Where the hand-back lands (finding 12).** Either the next prompt anywhere, as built,
or prefer an owner session in the launching project.

**D. What "no dreams" does to a run already going (finding 8).** Either it stops the
running headless run, or it takes effect tomorrow and says so.

## Verified

- **Suite without `*-live.test.ts`:** 4479 pass / 0 fail / 8 skip, 116 files. This matches
  the PR. `tsc --noEmit` is clean.
- **P3, end to end with a stub `claude`:** the adapter's real `spawnDetached` started
  `bun bin/nightly.ts`, which started the stub. What the stub saw:
  - argv exactly `-p --allowedTools mcp__counterparts__{dream,reflect,self_page,recall}
    --permission-mode default`;
  - the prompt (with `⟦counterparts:dream launch⟧` and `session: s1`) on stdin, not in
    argv;
  - cwd = the launching scope;
  - `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_PROJECT_DIR`, `COUNTERPARTS_SESSION`
    and `COUNTERPARTS_SCOPE` absent;
  - `COUNTERPARTS_NIGHT_RUN`, `COUNTERPARTS_DATA_DIR` and `COUNTERPARTS_CONFIG` pinned.

  The row went `started` → `could-not-start/nothing-ran` in under a second, and the next
  prompt showed the fallback ask with the reason. This ran with
  `COUNTERPARTS_REQUIRE_EXPLICIT_DIR=1`; the pinned config means the implicit refusal
  does not trigger.
- **P1/P1b (binding) and P2 (no fallback):** as described in findings 1 and 4.
- **Recursion (read):** the child cannot claim the day or start a child. `dreamLines`
  returns nothing for `nightRun` (`hooks.ts:1108`), and SessionStart starts nothing.
  `claim()` hands capture an empty turn list (`:1530`), so the credit slice is empty and
  no write-up is owed. The Stop ask is skipped (`:1421`). The child's own session-end
  worker still runs, which is harmless.
- **Consent trace (read):**
  - The headless context says "there is nothing for you to launch".
  - The ask and the fallback say to launch only on "dream", and "dream on your own" on
    that word only.
  - `DREAMING_DEFAULT = "ask"`.
  - The residual pro-launch text is in `tools.ts` (finding 2).
- **Races (read):**
  - Two first prompts: `setDreamAsk` insert-if-absent, so one run.
  - Relaunch: `reclaimDreamAsk` compare-and-set on `prevAt`.
  - Hand-back: one event latch, plus `handedAt` so later prompts only read.
  - An older run's terminal row cannot overwrite a newer run's row.
  - A watchdog kill leaves the dream `begun`. It is resumed as left behind after 30 min,
    within the cap.
