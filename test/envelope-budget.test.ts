/**
 * ONE BUDGET PER HOOK ENVELOPE (2026-09-29, audit item 9).
 *
 * Everything one SessionStart or one UserPromptSubmit prints is measured
 * against the host's one cap (`TUNABLES.HOST_OUTPUT_CHARS`), and a crowded day
 * gives way in a stated order:
 *
 *   SessionStart — notices, then the write-up pointer, then the first-launch
 *   question, then today's plain reminders (to the first prompt); the wake is
 *   never cut at delivery (it trims itself at the boundary, identity last).
 *
 *   UserPromptSubmit — the update notice, then the turn's recall (sized to what
 *   the other lines leave), and last the reserved lines: the dream's, today's
 *   plain reminders, the clock.
 *
 * And the plain-stdout fallback is checked against the cap: past it, the
 * delivery says so (`overCap`) rather than printing a preview silently.
 *
 * Hermetic (CLAUDE.md): a fresh temp data dir per test, removed afterwards.
 * The wake's SIZE is set by replacing `counterpart.wake` on the one adapter a
 * test opens — the one way to put a wake at an exact number of bytes.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { CUE_MODE_META } from "../src/core/prospective/index.js";
import { SELF_TUNABLES } from "../src/core/self/index.js";
import type { WakeResult } from "../src/core/self/index.js";
import { SCOPE_ASK, SCOPE_ASK_BYTES, TUNABLES, openAdapter } from "../src/adapters/claude-code/index.js";
import type { AdapterConfig, ClaudeCodeAdapter, HookInput } from "../src/adapters/claude-code/index.js";
import { WRITE_UP_OPEN } from "../src/adapters/claude-code/hooks.js";
import { hostDelivery } from "../src/adapters/claude-code/bin/hook.js";
import { recordSession } from "../src/adapters/sessions.js";

const DAY = 86_400_000;
let root: string;
let storeDir: string;
let PROJ: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-envelope-")));
  storeDir = join(root, "store");
  PROJ = join(root, "proj");
  mkdirSync(PROJ, { recursive: true });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const today = (): string => new Date().toISOString().slice(0, 10);

function config(over: Partial<AdapterConfig> = {}): AdapterConfig {
  return { dataDir: storeDir, owner: true, injectionBudgetBytes: 9_000, ...over };
}

function adapter(mode: "on" | "unset"): ClaudeCodeAdapter {
  return openAdapter(config(), {
    command: "/bin/true",
    args: ["runner"],
    spawner: () => ({ pid: 4242 }),
    ...(mode === "unset" ? {} : { scope: { mode: "on", matched: PROJ, entry: null } }),
  });
}

/** A wake of exactly `bytes` bytes, whatever the store holds. */
function fixWake(a: ClaudeCodeAdapter, bytes: number): void {
  const text = `${"w".repeat(Math.max(0, bytes - 1))}\n`.slice(0, bytes);
  const fake: WakeResult & { budgetBytes: number | null } = {
    text,
    ok: true,
    reason: "loaded" as WakeResult["reason"],
    bytes: Buffer.byteLength(text, "utf8"),
    sentinel: null,
    reading: null,
    preface: null,
    budgetBytes: 9_000,
  };
  (a.counterpart as unknown as { wake: () => typeof fake }).wake = () => fake;
}

/** Seed: one plain reminder due today, and one session that ended owing a write-up. */
function seed(): void {
  const c = Counterpart.open({ dir: storeDir, owner: true });
  try {
    c.store.put({
      type: "memory",
      kind: "fact",
      title: "pay the quarterly estimate",
      body: "Pay the quarterly estimated tax today, before the bank closes.",
      eventDate: today(),
      meta: { [CUE_MODE_META]: "plain" },
      salience: { relevance: 0.8, emotional: 0.5, predictive: 0.8 },
    });
    const at = Date.now() - 2 * DAY;
    recordSession(storeDir, { sessionId: "old-1", scope: PROJ, phase: "start", at });
    c.captureSpans({
      session: "old-1",
      scope: PROJ,
      turns: [
        { role: "user", text: "The reservoir loop keeps its pressure only when the relief valve is seated first. ".repeat(10) },
        { role: "assistant", text: "Understood." },
      ],
    });
    expect(c.episodeAsk("old-1", { turns: 9, bytes: 6_000 }).asked).toBe(true);
    c.boundary({ session: "old-1", scope: PROJ, kind: "session-end" });
    recordSession(storeDir, { sessionId: "old-1", scope: PROJ, phase: "end", at: at + 1_000 });
  } finally {
    c.close();
  }
}

interface Start {
  injection: string;
  ask: string;
  plain: number;
  wake: number;
  events: string[];
}

function start(sessionId: string, wakeBytes: number): Start {
  const a = adapter("unset");
  try {
    fixWake(a, wakeBytes);
    const input: HookInput = { sessionId, scope: PROJ, at: today() };
    const out = a.sessionStart(input);
    return {
      injection: out.injection ?? "",
      ask: out.ask ?? "",
      plain: out.plain?.length ?? 0,
      wake: wakeBytes,
      events: a.events().map((e) => `${e.name}${e.name === "adapter.envelope.gave-way" ? `:${String(e.data["part"])}` : ""}`),
    };
  } finally {
    a.counterpart.close();
  }
}

const bytes = (s: string): number => Buffer.byteLength(s, "utf8");

describe("SessionStart: one budget, and a crowded morning gives way in order", () => {
  test("pointer first, then the scope question, then plain reminders — the wake is never cut", () => {
    seed();
    const cap = TUNABLES.HOST_OUTPUT_CHARS;
    // A normal morning: everything fits.
    const roomy = start("s-roomy", 4_000);
    expect(roomy.plain).toBe(1);
    expect(roomy.ask).toContain(SCOPE_ASK);
    expect(roomy.ask).toContain(WRITE_UP_OPEN);
    const lead = bytes(roomy.injection) - roomy.wake;
    const pointer = bytes(roomy.ask) - bytes(SCOPE_ASK) + 2; // "\n\n" + pointer, as the adapter counts it
    expect(lead).toBeGreaterThan(0);
    expect(bytes(roomy.injection) + bytes(`\n\n${roomy.ask}`)).toBeLessThanOrEqual(cap);

    // 1. No room for the pointer: it defers, the question and the reminder stay.
    const w1 = cap - lead - SCOPE_ASK_BYTES - pointer + 20;
    const one = start("s-one", w1);
    expect(one.ask).toContain(SCOPE_ASK);
    expect(one.ask).not.toContain(WRITE_UP_OPEN);
    expect(one.plain).toBe(1);
    expect(one.events).toContain("adapter.writeup.deferred");

    // 2. Room for neither: both defer; the reminder stays. (With room for one
    // of the two, the question has first claim on it — case 1.)
    const w2 = cap - lead - Math.min(SCOPE_ASK_BYTES, pointer) + 20;
    const two = start("s-two", w2);
    expect(two.ask).toBe("");
    expect(two.plain).toBe(1);
    expect(two.events).toContain("adapter.scope.ask.deferred");

    // 3. No room for the reminder: it waits for the first prompt (unclaimed),
    // and the wake still goes whole.
    const w3 = cap - lead + 20;
    const three = start("s-three", w3);
    expect(three.plain).toBe(0);
    expect(three.injection).not.toContain("pay the quarterly estimate");
    expect(three.events).toContain("adapter.envelope.gave-way:plain");
    expect(bytes(three.injection)).toBeGreaterThanOrEqual(w3);

    // Every envelope that could fit, did.
    for (const s of [roomy, one, two]) {
      expect(bytes(s.injection) + (s.ask.length === 0 ? 0 : bytes(`\n\n${s.ask}`))).toBeLessThanOrEqual(cap);
    }
    // The reminder was not spent on the start that could not carry it: the
    // next prompt still has it to say.
    const a = adapter("on");
    try {
      expect(a.counterpart.plainDueToday({ at: today() })).toHaveLength(1);
    } finally {
      a.counterpart.close();
    }
  });
});

describe("UserPromptSubmit: the turn's recall is what gives way", () => {
  function prompt(stubLines: string | null): { injection: string; events: { name: string; data: Record<string, unknown> }[] } {
    const a = adapter("on");
    try {
      const c = a.counterpart;
      for (let i = 0; i < 12; i += 1) {
        c.store.put({
          type: "memory",
          kind: "fact",
          body: `The relief valve on loop ${String(i)} must be seated before the reservoir is filled, or it loses pressure.`,
          salience: { relevance: 0.9, emotional: 0.6, predictive: 0.9 },
          physics: { birthDay: c.store.livedDay(), lastUsedDay: c.store.livedDay() },
        });
      }
      if (stubLines !== null) {
        // What a crowded morning hands a prompt: a carried share and the
        // dream's lines, reserved before recall is sized. Stubbed here — the
        // dream module owns their words.
        (a as unknown as { dreamLines: () => unknown }).dreamLines = () => ({ text: stubLines, told: null, note: null });
      }
      const input: HookInput = { sessionId: "s-turn", scope: PROJ, at: today(), prompt: "how do I keep the reservoir loop's pressure up — the relief valve?" };
      recordSession(storeDir, { sessionId: "s-turn", scope: PROJ, phase: "start" });
      const out = a.userPromptSubmit(input);
      return { injection: out.injection ?? "", events: a.events().map((e) => ({ name: e.name, data: e.data })) };
    } finally {
      a.counterpart.close();
    }
  }

  test("a normal turn: recall gets its whole configured budget, and nothing gives way", () => {
    const turn = prompt(null);
    expect(turn.events.find((e) => e.name === "adapter.envelope.gave-way")).toBeUndefined();
    expect(turn.events.find((e) => e.name === "adapter.recall")?.data["budget"]).toBe(9_000);
  });

  test("a crowded turn: recall is sized to what the reserved lines leave, and the whole stays under the cap", () => {
    const share = `${"A morning share, carried whole, about the night's dream. ".repeat(140)}\n`;
    expect(bytes(share)).toBeGreaterThan(7_500);
    const turn = prompt(share);
    const gave = turn.events.find((e) => e.name === "adapter.envelope.gave-way");
    expect(gave?.data["part"]).toBe("recall");
    const budget = turn.events.find((e) => e.name === "adapter.recall")?.data["budget"] as number;
    expect(budget).toBe(gave?.data["budget"] as number);
    expect(budget).toBeLessThan(9_000);
    // The reserved line went out whole, and the envelope is under the cap.
    expect(turn.injection).toContain(share.trimEnd());
    expect(bytes(turn.injection)).toBeLessThanOrEqual(TUNABLES.HOST_OUTPUT_CHARS);
  });
});

describe("the plain-stdout fallback is checked", () => {
  test("past the host's cap the delivery says so; under it, nothing is said", () => {
    const over = hostDelivery("user-prompt-submit", { injection: "x".repeat(TUNABLES.HOST_OUTPUT_CHARS + 1), ask: null }, {});
    expect(over.overCap).toEqual({ chars: TUNABLES.HOST_OUTPUT_CHARS + 1, limitChars: TUNABLES.HOST_OUTPUT_CHARS });
    const under = hostDelivery("user-prompt-submit", { injection: "x".repeat(9_000), ask: null }, {});
    expect(under.overCap).toBeUndefined();
    // ...and the same when a notice had to be dropped to fall back to plain.
    const dropped = hostDelivery("session-start", { injection: "y".repeat(TUNABLES.HOST_OUTPUT_CHARS + 5), ask: null }, {}, ["a red doctor line"]);
    expect(dropped.dropped).not.toBeNull();
    expect(dropped.overCap?.chars).toBe(TUNABLES.HOST_OUTPUT_CHARS + 5);
  });
});

// The first-ask thresholds the seeding relies on (an asked session owes in full).
test("seeding assumption: a 9-turn ask is past the first-ask threshold", () => {
  expect(SELF_TUNABLES.FIRST_ASK_TURNS).toBeLessThanOrEqual(9);
});
