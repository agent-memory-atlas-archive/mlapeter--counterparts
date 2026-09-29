/**
 * THE SHARED CHILD STARTER (`claude-code/child.ts`) — the part of the removed
 * host-mode page writer the headless nightly run still uses, proved on its own
 * against stub executables: the prompt arrives on STDIN, a child that ignores
 * SIGTERM is killed and given up on inside the graces, and the caller's abort
 * takes the child with it. These were proved through the page writer's host
 * mode until 2026-09-29.
 *
 * Hermetic: each test writes its stub into a temp directory it creates and
 * removes. No test starts a real `claude`.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KILL_GRACE_MS, REAP_GRACE_MS, startChild } from "../src/adapters/claude-code/index.js";
import type { ChildPlan } from "../src/adapters/claude-code/index.js";

let binDir: string;

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "counterparts-child-bin-"));
});
afterEach(() => {
  rmSync(binDir, { recursive: true, force: true });
});

/** A stub that records its argv and STDIN, then runs `body`. */
function stub(body: string): string {
  const path = join(binDir, "claude-stub");
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      `printf '%s\\n' "$@" > ${JSON.stringify(join(binDir, "argv"))}`,
      `cat > ${JSON.stringify(join(binDir, "stdin"))}`,
      body,
    ].join("\n"),
    "utf8",
  );
  chmodSync(path, 0o755);
  return path;
}

function plan(command: string, over: Partial<ChildPlan> = {}): ChildPlan {
  return { command, args: ["-p"], stdin: "THE PROMPT", env: { PATH: process.env["PATH"] ?? "/usr/bin:/bin" }, timeoutMs: 10_000, ...over };
}

describe("startChild", () => {
  test("the prompt goes on STDIN, never in argv, and a clean exit is code 0", async () => {
    const result = await startChild(plan(stub("exit 0")));
    expect(result).toMatchObject({ code: 0, timedOut: false, error: null });
    expect(readFileSync(join(binDir, "stdin"), "utf8")).toBe("THE PROMPT");
    expect(readFileSync(join(binDir, "argv"), "utf8")).not.toContain("THE PROMPT");
  });

  test("a command that is not there is an answer with the OS's code, never a throw", async () => {
    const result = await startChild(plan(join(binDir, "no-such-claude")));
    expect(result.code).toBeNull();
    expect(result.spawnCode).toBe("ENOENT");
  });

  test("a SIGTERM-IGNORING CHILD does not hang the caller: SIGTERM, then SIGKILL, then stop waiting", async () => {
    const started = Date.now();
    const result = await startChild(plan(stub("trap '' TERM; sleep 60"), { timeoutMs: 300 }));
    const elapsed = Date.now() - started;
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(KILL_GRACE_MS + REAP_GRACE_MS + 3_000);
  }, 30_000);

  test("the caller's abort outranks the child's own watchdog", async () => {
    const controller = new AbortController();
    const run = startChild(plan(stub("sleep 30"), { timeoutMs: 600_000 }), controller.signal);
    controller.abort();
    const result = await run;
    expect(result.timedOut).toBe(true);
    expect(result.error).toBe("killed");
  }, 30_000);
});
