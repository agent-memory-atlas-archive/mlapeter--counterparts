/**
 * The self tab refreshes live and closes nothing — in a real browser, run in a
 * child process. The scenario and its assertions are `test/live/dashboard-self.live.ts`.
 *
 * WHY A CHILD (2026-09-26): with chromium launched in the suite's own process, a
 * full `bun test` was SIGKILLed (exit 137) ~100 s in, every run, a few seconds
 * after this file passed — two files later, in `pre-migration.test.ts` (once
 * visibly just before its test that spawns child `bun` processes). Every file
 * passed alone and in small groups. Moving the launch from module top level into
 * `beforeAll` passed one full run and died the next. Open fds, RSS, leftover
 * chromium and playwright's exit handlers were all clean. The mechanism inside
 * bun was not found, so the browser was moved out of the suite's process
 * instead: see `test/live/harness.ts`.
 *
 * (A killed run looked silent because bun prints only failures when it sees
 * `CLAUDECODE=1` — its agent mode — not because it buffers. Run with
 * `env -u CLAUDECODE bun test` to watch each file land.)
 */
import { liveScenario } from "./live/harness.js";

liveScenario({
  label: "dashboard-self-live",
  title: "the self tab, live > a refresh through the pulse redraws the panels and closes nothing",
  scenario: "dashboard-self.live.ts",
});
