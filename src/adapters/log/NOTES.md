# `log/` — NOTES

## 2026-09-30 — the first build

- **Measured before building:** a hermetic SessionStart, prompt, two Stops, SessionEnd and a
  worker run emit several dozen distinct names across the rings. The allowlist keeps about a
  dozen of them. The heavy ones left out are `store.*` (including
  `store.event.appended`, which fires once per durable row and would have doubled every row)
  and the per-prompt recall family.
- **Volume, roughly:** a UserPromptSubmit writes two lines (start, end); a Stop about four
  (start, `adapter.boundary`, `adapter.ask`, end); a worker run about six. At ~200 bytes a
  line, a busy day is some hundreds of kilobytes. If that proves noisy, the hook's
  `process.start` is the first thing to drop — `process.end` carries `ms`, so the start is
  recoverable — at the cost of not seeing a hook the host killed mid-run.
- **`clean` is a guard on values, not a list of fields.** Emitters already keep to codes and
  counts; the guard is there so a future emitter's path or sentence reaches the file as
  `[text:N]`, not as itself. `/` is allowed in the middle of a value (for the error location,
  `adapters/claude-code/hooks.ts:123`); a leading `/` or `~`, and `..`, are not.
- **`errorFields` never reads a message.** For something thrown that is not an `Error` it
  writes the value's type (`error: "string"`, `code: "UNKNOWN"`) and no location.
- **A store this build refuses to open still gets its lines**: the hook's start, and an end
  by a throw with the store's code (`STORE_PRE_ROWS`), beside the stand-down marker in the
  same classified directory. `hook-standdown.test.ts` names the file.
- **Bun's `rmSync(dir, { force: true })` throws on a directory**, empty or not (measured,
  bun 1.3.10), so `pruneSessions` cannot remove `sessions/log/`. The test pins it with the
  directory's mtime set a month back.
- **The MCP server opens its log after the store**, because the store is what resolves the
  directory; the counterpart's `onEvent` is a forwarding closure until then. Events emitted
  while the store opens are not logged (none of them is on the list unless it fails, and a
  failure there throws).
- **`process.end`'s `reason`** is the process's own word: the hook's `HookResult.reason`, the
  worker's `RunReport.reason`, the night run's state (its own reason goes in `why`), and
  `stdin-closed` for the server.
- **A new `localTime` in `core/time.ts`** (`HH:MM:SS`, 24-hour) for `counterparts log`: the
  date is the file's, and seconds are what tell two lines apart.
