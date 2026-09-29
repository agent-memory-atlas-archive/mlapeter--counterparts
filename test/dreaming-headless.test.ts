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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openAdapter } from "../src/adapters/claude-code/index.js";
import type { AdapterConfig, HookInput } from "../src/adapters/claude-code/index.js";
import { ENVELOPE_MAX_CHARS, deliverTurn } from "../src/adapters/claude-code/bin/hook.js";
import { recordSession } from "../src/adapters/sessions.js";
import type { Counterpart } from "../src/core/counterpart.js";
import { DREAMING_DEFAULT } from "../src/core/dream/index.js";
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
