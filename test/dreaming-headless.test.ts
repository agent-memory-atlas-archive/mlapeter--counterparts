/**
 * DREAMING, 2026-09-29 — the ask the person sees, and (later in this file) the
 * headless nightly run.
 *
 * A. With the setting `ask` (now the default) the day's dream line is shown to
 *    the PERSON in the terminal (the prompt hook's `systemMessage`) as well as
 *    handed to the model, and the day is claimed only when the envelope
 *    certainly carries the person's line — the plain reminder's rule.
 *
 * Hermetic: a fresh temp data dir per test, removed after. No process is
 * started for real anywhere in this file except the stub executables it writes.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  KILL_GRACE_MS,
  NIGHT_KIND_ENV,
  NIGHT_RUN_ENV,
  REAP_GRACE_MS,
  loadConfig,
  nightTimeoutMs,
  openAdapter,
  openNightCounterpart,
  planNightChild,
  planNightRunner,
  readKind,
  runNight,
} from "../src/adapters/claude-code/index.js";
import type { AdapterConfig, HookInput } from "../src/adapters/claude-code/index.js";
import { ENVELOPE_MAX_CHARS, deliverTurn, toHookInput } from "../src/adapters/claude-code/bin/hook.js";
import { recordSession } from "../src/adapters/sessions.js";
import type { Counterpart } from "../src/core/counterpart.js";
import { DREAMING_DEFAULT, DREAM_MARK, nightRunOf, nightRunWords } from "../src/core/dream/index.js";
import type { PutInput } from "../src/core/store/index.js";

let dir: string;
const open: { close(): void }[] = [];
const AT = "2026-09-29";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-dreaming-headless-"));
});

afterEach(() => {
  for (const c of open.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

function hooks(over: Partial<AdapterConfig> = {}): ReturnType<typeof openAdapter> {
  const config: AdapterConfig = { dataDir: dir, injectionBudgetBytes: 20_000, owner: true, ...over };
  const a = openAdapter(config, { command: "/bin/true", args: ["runner"], spawner: () => ({ pid: 1 }) });
  open.push(a.counterpart);
  return a;
}

function input(over: Partial<HookInput> = {}): HookInput {
  const hook: HookInput = { sessionId: "s1", scope: "proj", turns: [], at: AT, prompt: "good morning", ...over };
  recordSession(dir, { sessionId: hook.sessionId, scope: hook.scope, phase: "start" });
  return hook;
}

function mem(c: Counterpart, body: string, over: Partial<PutInput> = {}): string {
  const day = c.store.livedDay();
  return c.store.put({
    type: "memory",
    kind: "fact",
    body,
    salience: { relevance: 0.6, emotional: 0.3, predictive: 0.6 },
    physics: { birthDay: day, lastUsedDay: day },
    ...over,
  });
}

/** Lived days behind the store, and four new memories: the day's line is due. */
function lived(c: Counterpart): void {
  c.store.advanceClock("2026-09-10");
  for (let d = 11; d <= 20; d += 1) c.store.advanceClock(`2026-09-${String(d)}`);
  mem(c, "The migration step must run before the container boots, or it boots empty.");
  mem(c, "Run the migration before starting the container, otherwise the container starts empty.");
  mem(c, "Mike likes to talk decisions through out loud before he commits to one.", { kind: "person" });
  mem(c, "I say what I do not know before I guess.", { kind: "self" });
}

function doorsOf(a: ReturnType<typeof openAdapter>): Parameters<typeof deliverTurn>[4] {
  return { updateNotice: () => null, markUpdateNotice: () => false, claimDream: a.claimDream.bind(a) };
}

// ═══════════════════════════════════════════════════════════════════════════
// A. the ask the person sees
// ═══════════════════════════════════════════════════════════════════════════

describe("A. the day's ask is shown to the person, and claimed only when it leaves", () => {
  test("`ask` is the default", () => {
    expect(DREAMING_DEFAULT).toBe("ask");
    const a = hooks();
    expect(a.counterpart.dreams.setting()).toBe("ask");
  });

  test("a prompt whose envelope has room: the terminal shows the ask, the model's line rides along, the day is claimed once", () => {
    const a = hooks();
    lived(a.counterpart);
    const turn = a.userPromptSubmit(input());
    const told = turn.dream;
    if (told === undefined) throw new Error("no dream line");
    expect(told.notice).toBe('Counterparts: I haven\'t dreamed yet (4 new memories). Say "dream" to start, or "dream on your own" to let me do it each day.');
    expect(turn.injection).toContain(told.context);
    const out = deliverTurn("user-prompt-submit", turn, {}, null, doorsOf(a), input());
    const parsed = JSON.parse(out.stdout) as { systemMessage: string; hookSpecificOutput: { additionalContext: string } };
    expect(parsed.systemMessage).toBe(told.notice);
    expect(parsed.hookSpecificOutput.additionalContext).toContain('says "dream on your own", call the dream tool with phase "setting"');
    expect(a.counterpart.store.dreamAsk(AT)?.state).toBe("offered");
    // Once a day: the next prompt, in any session, has no line.
    expect(a.userPromptSubmit(input({ sessionId: "s2" })).dream).toBeUndefined();
  });

  test("an envelope with no room: nothing claimed, the model's line stripped too, and the next prompt offers it again", () => {
    const a = hooks();
    lived(a.counterpart);
    const turn = a.userPromptSubmit(input());
    const told = turn.dream;
    if (told === undefined) throw new Error("no dream line");
    const full = { ...turn, injection: `${turn.injection ?? ""}\n${"x".repeat(ENVELOPE_MAX_CHARS)}` };
    const out = deliverTurn("user-prompt-submit", full, {}, null, doorsOf(a), input());
    expect(out.stdout).not.toContain("dream on your own");
    expect(out.dropped).not.toBeNull();
    expect(a.counterpart.store.dreamAsk(AT)).toBeUndefined();
    // Not spent: the next prompt carries it.
    const again = a.userPromptSubmit(input());
    expect(again.dream?.notice).toBe(told.notice);
  });

  test("a claim lost to another session: this one shows nothing and tells the model nothing", () => {
    const a = hooks();
    lived(a.counterpart);
    const mine = a.userPromptSubmit(input());
    const theirs = a.userPromptSubmit(input({ sessionId: "s2" }));
    // The other session's delivery lands first.
    deliverTurn("user-prompt-submit", theirs, {}, null, doorsOf(a), input({ sessionId: "s2" }));
    expect(a.counterpart.store.dreamAsk(AT)?.session).toBe("s2");
    const out = deliverTurn("user-prompt-submit", mine, {}, null, doorsOf(a), input());
    expect(out.stdout).not.toContain("systemMessage");
    expect(out.stdout).not.toContain("dream on your own");
  });

  test("the page writer's headless child and an observer are offered nothing", () => {
    const a = hooks();
    lived(a.counterpart);
    expect(a.userPromptSubmit(input({ sessionId: "pw", pageWriter: true })).dream).toBeUndefined();
    const o = hooks({ observer: true });
    expect(o.userPromptSubmit(input({ sessionId: "o1" })).dream).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. the headless run's own process, proved against a stub `claude`
// ═══════════════════════════════════════════════════════════════════════════

describe("B. the headless run: the child's plan, and what becomes of a run", () => {
  let binDir: string;
  beforeEach(() => {
    binDir = mkdtempSync(join(tmpdir(), "counterparts-night-bin-"));
  });
  afterEach(() => {
    rmSync(binDir, { recursive: true, force: true });
  });

  /** A stub that records argv, environment, stdin and its directory, then runs `body`. */
  function stub(body: string): string {
    const path = join(binDir, "claude-stub");
    writeFileSync(
      path,
      [
        "#!/bin/sh",
        `printf '%s\\n' "$@" > ${JSON.stringify(join(binDir, "argv"))}`,
        `env > ${JSON.stringify(join(binDir, "env"))}`,
        `pwd > ${JSON.stringify(join(binDir, "cwd"))}`,
        `cat > ${JSON.stringify(join(binDir, "stdin"))}`,
        body,
      ].join("\n"),
      "utf8",
    );
    chmodSync(path, 0o755);
    return path;
  }

  const config = (over: Partial<AdapterConfig> = {}): AdapterConfig => ({ dataDir: dir, owner: true, identity: { name: "Mike" }, ...over });

  function nightOf(over: Partial<Parameters<typeof runNight>[0]> = {}): Parameters<typeof runNight>[0] {
    const cfg = over.config ?? config();
    return {
      open: () => openNightCounterpart(cfg),
      config: cfg,
      run: "nrn_test",
      session: "s1",
      scope: binDir,
      kind: { kind: "night" },
      date: AT,
      baseEnv: { PATH: "/usr/bin:/bin" },
      ...over,
    };
  }

  /** A counterpart on the test's store, closed after the test. */
  function openNight(): Counterpart {
    const c = openNightCounterpart(config());
    open.push(c);
    return c;
  }

  function latest(): ReturnType<typeof nightRunOf> {
    const c = openNightCounterpart(config());
    try {
      return nightRunOf(c.store);
    } finally {
      c.close();
    }
  }

  test("the child's plan: `-p`, exactly four tools, permission `default`, the prompt on stdin, the launching session's directory", () => {
    const plan = planNightChild({
      config: config({ dreaming: { model: "claude-opus-5-5" } }),
      run: "nrn_1",
      prompt: "THE PROMPT",
      scope: "/proj/here",
      configPath: "/cfg/claude-code.json",
      baseEnv: {
        PATH: "/usr/bin",
        COUNTERPARTS_DATA_DIR: "/somewhere/else",
        COUNTERPARTS_SESSION: "parent",
        COUNTERPARTS_SCOPE: "/parent",
        COUNTERPARTS_OBSERVER: "1",
        COUNTERPARTS_PAGE_WRITER: "2026-09-28",
        CLAUDE_PROJECT_DIR: "/parent",
        CLAUDECODE: "1",
      },
    });
    expect(plan.ok).toBe(true);
    expect(plan.command).toBe("claude");
    expect(plan.args).toEqual([
      "-p",
      "--allowedTools",
      "mcp__counterparts__dream,mcp__counterparts__reflect,mcp__counterparts__self_page,mcp__counterparts__recall",
      "--permission-mode",
      "default",
      "--model",
      "claude-opus-5-5",
    ]);
    expect(plan.args.join(" ")).not.toContain("THE PROMPT");
    expect(plan.stdin).toBe("THE PROMPT");
    expect(plan.cwd).toBe("/proj/here");
    expect(plan.timeoutMs).toBe(20 * 60_000);
    for (const gone of ["COUNTERPARTS_SESSION", "COUNTERPARTS_SCOPE", "COUNTERPARTS_OBSERVER", "COUNTERPARTS_PAGE_WRITER", "CLAUDE_PROJECT_DIR", "CLAUDECODE"]) {
      expect(plan.env[gone]).toBeUndefined();
    }
    expect(plan.env[NIGHT_RUN_ENV]).toBe("nrn_1");
    expect(plan.env["COUNTERPARTS_DATA_DIR"]).toBe(dir);
    expect(plan.env["COUNTERPARTS_CONFIG"]).toBe("/cfg/claude-code.json");
    // No model pinned: no flag.
    expect(planNightChild({ config: config(), run: "r", prompt: "p", scope: "/x" }).args).not.toContain("--model");
    expect(planNightChild({ config: config({ observer: true }), run: "r", prompt: "p", scope: "/x" }).reason).toBe("OBSERVER");
  });

  test("a model pin that looks like a flag is not read", () => {
    const loaded = loadConfig({ dataDir: dir, dreaming: { model: "--dangerously-skip-permissions", timeoutMs: -1 } });
    expect(loaded.config.dreaming?.model).toBeUndefined();
    expect(loaded.config.dreaming?.timeoutMs).toBeUndefined();
    expect(loaded.config.dreaming?.ignored?.length).toBe(2);
    expect(loaded.config.observer).toBeUndefined();
    expect(loadConfig({ dataDir: dir, dreaming: { model: "sonnet", timeoutMs: 60_000 } }).config.dreaming).toEqual({ model: "sonnet", timeoutMs: 60_000 });
  });

  test("the detached process's plan: pinned last, refused by name, and outlasting the child's watchdog", () => {
    const base = { config: config(), command: "/usr/bin/bun", run: "nrn_2", session: "s1", scope: "/proj", kind: { kind: "reflection", dream: "drm_x" } as const };
    const plan = planNightRunner({ ...base, args: ["run", "/pkg/bin/nightly.ts"], configPath: "/cfg.json", baseEnv: { COUNTERPARTS_SESSION: "other", COUNTERPARTS_OBSERVER: "1" } });
    expect(plan.ok).toBe(true);
    expect(plan.args).toEqual(["run", "/pkg/bin/nightly.ts"]);
    expect(plan.env["COUNTERPARTS_SESSION"]).toBe("s1");
    expect(plan.env["COUNTERPARTS_SCOPE"]).toBe("/proj");
    expect(plan.env[NIGHT_RUN_ENV]).toBe("nrn_2");
    expect(plan.env[NIGHT_KIND_ENV]).toBe("reflection:drm_x");
    expect(readKind(plan.env[NIGHT_KIND_ENV])).toEqual({ kind: "reflection", dream: "drm_x" });
    expect(plan.env["COUNTERPARTS_OBSERVER"]).toBeUndefined();
    expect(plan.timeoutMs).toBeGreaterThan(nightTimeoutMs(config()) + KILL_GRACE_MS + REAP_GRACE_MS);
    expect(planNightRunner({ ...base, args: undefined }).reason).toBe("NO_RUNNER");
    expect(planNightRunner({ ...base, args: ["x"], config: config({ observer: true }) }).reason).toBe("OBSERVER");
  });

  test("a stub that exits 0 having called no tool: the run could not do its job — `nothing-ran`; the prompt went on stdin, the child ran in the session's directory", async () => {
    const out = await runNight(nightOf({ command: stub("exit 0") }));
    expect(out).toMatchObject({ state: "could-not-start", reason: "nothing-ran", code: 0, run: "nrn_test", date: AT, session: "s1" });
    expect(latest()).toMatchObject({ run: "nrn_test", state: "could-not-start", reason: "nothing-ran" });
    const stdin = readFileSync(join(binDir, "stdin"), "utf8");
    expect(stdin).toContain(DREAM_MARK);
    expect(stdin).toContain("session: s1");
    expect(readFileSync(join(binDir, "argv"), "utf8")).not.toContain("session: s1");
    expect(readFileSync(join(binDir, "env"), "utf8")).toContain(`${NIGHT_RUN_ENV}=nrn_test`);
    expect(realpathSync(readFileSync(join(binDir, "cwd"), "utf8").trim())).toBe(realpathSync(binDir));
  });

  test("a stub that exits 1 at once: could not start (`quick-exit`) — is it logged in?", async () => {
    const out = await runNight(nightOf({ command: stub("exit 1") }));
    expect(out).toMatchObject({ state: "could-not-start", reason: "quick-exit", code: 1 });
    expect(nightRunWords(out)).toContain("is it logged in?");
  });

  test("no `claude` on the path: could not start (`no-claude`)", async () => {
    const out = await runNight(nightOf({ command: join(binDir, "no-such-claude") }));
    expect(out).toMatchObject({ state: "could-not-start", reason: "no-claude" });
    expect(nightRunWords(out)).toBe("the claude command was not found");
  });

  test("a run past its watchdog is stopped and recorded `timed-out`", async () => {
    const out = await runNight(nightOf({ config: config({ dreaming: { timeoutMs: 300 } }), command: stub("sleep 30") }));
    expect(out).toMatchObject({ state: "timed-out", reason: "watchdog" });
    expect(latest()?.state).toBe("timed-out");
  }, 20_000);

  test("a run that dreamed and reflected is `done`, with both ids — read from the store, not from its output", async () => {
    lived(openNight());
    const out = await runNight(
      nightOf({
        start: async () => {
          const c = openNightCounterpart(config());
          try {
            const d = c.dreams.begin({ session: "s1" });
            if (!d.ok) throw new Error(d.reason);
            c.dreams.journal({ dream: d.bundle.dream, session: "s1", text: "A dream." });
            const r = c.reflections.begin({ session: "s1", dream: d.bundle.dream });
            if (!r.ok) throw new Error(r.reason);
            c.reflections.finish({ reflection: r.bundle.reflection, session: "s1", entry: "Nothing much tonight." });
          } finally {
            c.close();
          }
          return { code: 0, timedOut: false, error: null };
        },
      }),
    );
    expect(out.state).toBe("done");
    expect(out.dream).toMatch(/^drm_/);
    expect(out.reflection).toMatch(/^rfl_/);
    // One event per state, latched by run and state.
    const c = openNight();
    const states = c.store.eventLog({ name: "dream.night" }).map((e) => String((JSON.parse(e.payload ?? "{}") as { state?: unknown }).state));
    expect(states.sort()).toEqual(["done", "started"]);
  });

  test("a run that began and then exited with an error is `failed`, not `could not start`", async () => {
    lived(openNight());
    let t = 1_000_000;
    const out = await runNight(
      nightOf({
        now: () => (t += 90_000),
        start: async () => {
          const c = openNightCounterpart(config());
          try {
            c.dreams.begin({ session: "s1" });
          } finally {
            c.close();
          }
          return { code: 3, timedOut: false, error: null };
        },
      }),
    );
    expect(out).toMatchObject({ state: "failed", reason: "exit", code: 3 });
  });
});

describe("B. the quiet child: the headless run's own hooks capture nothing and ask nothing", () => {
  test("the flag comes from the environment; its prompt has no dream line, its Stop no ask, its turns no spans", () => {
    const a = hooks();
    lived(a.counterpart);
    const flagged = toHookInput({ session_id: "child", hook_event_name: "Stop" }, { scope: "proj", env: { [NIGHT_RUN_ENV]: "nrn_q" } });
    expect(flagged.nightRun).toBe(true);
    expect(toHookInput({ session_id: "x" }, { scope: "proj", env: {} }).nightRun).toBeUndefined();
    const child = input({ sessionId: "child", nightRun: true });
    expect(a.userPromptSubmit(child).dream).toBeUndefined();
    const turns = [
      { role: "user" as const, text: "A long enough prompt that would ordinarily be captured as the day's words, twice over.", entry: 1 },
      { role: "assistant" as const, text: "And a long enough answer that would ordinarily be captured as well, with more words.", entry: 2 },
    ];
    const stop = a.stop({ ...child, turns });
    expect(stop.ask).toBeNull();
    expect(stop.spansAppended).toBe(0);
    // The same turns in an ordinary session are captured.
    expect(a.stop({ ...input({ sessionId: "ordinary" }), turns }).spansAppended).toBeGreaterThan(0);
  });
});
