#!/usr/bin/env bun
/**
 * THE HEADLESS NIGHTLY RUN'S OWN PROCESS (2026-09-29) — started DETACHED by the
 * hook when the dreaming setting is `auto` (`night-run.ts#planNightRunner`),
 * with a pinned environment: the data dir and configuration the hook read, the
 * session the run is attributed to and its directory, the run's id and what it
 * is (`NIGHT_RUN_ENV`, `NIGHT_KIND_ENV`).
 *
 * It composes the launch prompt from the store, starts `claude -p` with it on
 * stdin, waits under the run's watchdog, and records what became of the run —
 * then exits 0 on every path. Nothing about a failed run may reach the host;
 * the ROW is how the next session hears of it.
 */
import { implicitConfigRefusal, namedConfigRefusal, namedUnreadableRefusal } from "../../config-path.js";

import { NIGHT_KIND_ENV, NIGHT_RUN_ENV, openNightCounterpart, readKind, runNight } from "../night-run.js";
import { isEntryPoint, pinnedScope, pinnedSession, runnerConfig, runnerConfigChoice } from "./runner.js";

async function main(): Promise<void> {
  const choice = runnerConfigChoice();
  const refusal = namedConfigRefusal(choice) ?? implicitConfigRefusal(choice);
  if (refusal !== null) {
    process.stderr.write(`[counterparts] nightly run stood down: ${refusal}\n`);
    return;
  }
  const { config, reason } = runnerConfig(choice.path);
  const unreadable = namedUnreadableRefusal(choice, reason);
  if (unreadable !== null) {
    process.stderr.write(`[counterparts] nightly run stood down: ${unreadable}\n`);
    return;
  }
  const run = (process.env[NIGHT_RUN_ENV] ?? "").trim();
  const session = pinnedSession();
  if (run.length === 0 || session === null || config.observer === true) {
    process.stderr.write("[counterparts] nightly run stood down: no run, no session, or an observer\n");
    return;
  }
  await runNight({
    open: () => openNightCounterpart(config),
    config,
    run,
    session,
    scope: pinnedScope() ?? "",
    kind: readKind(process.env[NIGHT_KIND_ENV]),
    configPath: choice.path,
  });
}

if (isEntryPoint(process.argv[1], import.meta.url)) {
  void main().then(
    () => process.exit(0),
    (err: unknown) => {
      process.stderr.write(`[counterparts] nightly run stood down: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(0);
    },
  );
}
