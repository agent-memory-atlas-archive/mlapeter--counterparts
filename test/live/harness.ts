/**
 * Live browser scenarios, each run in a child process.
 *
 * WHY: with playwright's chromium launched inside the suite's own process, a full
 * `bun test` was SIGKILLed (exit 137) about 100 s in — see the note at the top of
 * `test/dashboard-self-live.test.ts`. A scenario here runs as its own `bun test`
 * in a child, so the suite's process never loads playwright or starts a browser;
 * it only waits for the child's exit code and relays its output when it fails.
 *
 * ADDING ONE: write `test/live/<name>.live.ts` (an ordinary bun test file, with
 * its own `beforeAll`/`afterAll`; launch chromium in `beforeAll`), then a
 * `test/<name>-live.test.ts` that calls `liveScenario(...)`. The `.live.ts` name
 * keeps it out of the suite's own discovery; run it alone with
 * `bun test ./test/live/<name>.live.ts`.
 *
 * SKIPPING: before registering the test, a child probe launches and closes
 * chromium. If it cannot, the test is skipped and a line says why, so a machine
 * without `bunx playwright install chromium` is not failed by it.
 *
 * HOMES: children get an explicit `env` (the preload's temp `HOME`, so bun's
 * `homedir()` in them is the temp one — see `test/preload.ts`). Playwright finds
 * its browsers under the home, so the one real-home path handed down is
 * `PLAYWRIGHT_BROWSERS_PATH`, the browser cache — read-only binaries, nothing of
 * the owner's.
 */
import { expect, test } from "bun:test";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

/** Where playwright keeps its browsers, resolved as playwright itself does but from the REAL home. */
function browsersPath(): string {
  const set = process.env["PLAYWRIGHT_BROWSERS_PATH"];
  if (set !== undefined && set !== "") return set;
  // `homedir()` is the preload's temp home in this process; the passwd entry is not.
  const home = userInfo().homedir;
  if (process.platform === "darwin") return join(home, "Library", "Caches", "ms-playwright");
  if (process.platform === "win32") return join(process.env["LOCALAPPDATA"] ?? join(home, "AppData", "Local"), "ms-playwright");
  return join(process.env["XDG_CACHE_HOME"] ?? join(home, ".cache"), "ms-playwright");
}

function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env["PLAYWRIGHT_BROWSERS_PATH"] = browsersPath();
  return env;
}

type Probe = { ok: true } | { ok: false; why: string };

/** Can a child launch chromium? Asked once per file, before its test is registered. */
function probeChromium(): Probe {
  const r = Bun.spawnSync([process.execPath, join(HERE, "probe.ts")], {
    cwd: ROOT,
    env: childEnv(),
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });
  const last = r.stdout.toString().trim().split("\n").pop() ?? "";
  try {
    const parsed = JSON.parse(last) as { ok?: unknown; why?: unknown };
    if (parsed.ok === true) return { ok: true };
    return { ok: false, why: String(parsed.why) };
  } catch {
    const first = r.stderr.toString().trim().split("\n")[0] ?? "";
    return { ok: false, why: `probe exited ${String(r.exitCode)}${first ? `: ${first}` : ""}` };
  }
}

/**
 * Register one test that runs `test/live/<scenario>` in a child `bun test` and
 * passes when the child ran at least one test and none failed.
 */
export function liveScenario(opts: { label: string; title: string; scenario: string; timeoutMs?: number }): void {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const probe = probeChromium();
  if (!probe.ok) console.log(`${opts.label}: skipped — no chromium for playwright (${probe.why})`);
  test.skipIf(!probe.ok)(
    opts.title,
    async () => {
      const child = Bun.spawn([process.execPath, "test", `./test/live/${opts.scenario}`], {
        cwd: ROOT,
        env: childEnv(),
        stdout: "pipe",
        stderr: "pipe",
        // Ends the child before this test's own timeout does, so its output is still read.
        timeout: timeoutMs - 5_000,
        killSignal: "SIGKILL",
      });
      const [code, out, err] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      const text = `${err}${out}`;
      if (code !== 0) throw new Error(`${opts.scenario} failed in its child (exit ${code}):\n${text}`);
      const passed = Number(/(\d+) pass/.exec(text)?.[1] ?? "0");
      const failed = Number(/(\d+) fail/.exec(text)?.[1] ?? "-1");
      expect({ scenario: opts.scenario, ranSome: passed > 0, failed }).toEqual({ scenario: opts.scenario, ranSome: true, failed: 0 });
    },
    timeoutMs,
  );
}
