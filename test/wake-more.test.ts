/**
 * THE WAKE SAYS WHAT IT LEFT OUT (2026-09-29, audit item 5).
 *
 * A lane that loses elements — to its cap, the identity share or the budget
 * trim — gets at most one short line: how many more, and ids the `recall` tool
 * reads whole. The line is furniture (no count, no element), lives inside the
 * wake's byte budget, and is dropped without a word when it does not fit.
 *
 * Hermetic (CLAUDE.md): a fresh temp data dir per test, removed afterwards.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { FRAMING, MORE_LINE_IDS, Self, SELF_TUNABLES, moreLine, readSentinel, render } from "../src/core/self/index.js";
import type { Lanes, Ranked, Resolve } from "../src/core/self/index.js";
import { McpServer } from "../src/adapters/mcp/index.js";
import { recordSession } from "../src/adapters/sessions.js";

let dir: string;
const open: { close(): void }[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-wake-more-"));
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

function thread(id: string): Ranked {
  return { id, lane: "threads", kind: "fact", band: "semantic", strength: 0.9, protected: false, bornDay: 0, personScoped: false, lastRendered: -1 };
}

function lanes(threads: number, overflow: number): Lanes {
  const ids = Array.from({ length: threads + overflow }, (_, i) => `mem_t${String(i).padStart(2, "0")}`);
  return {
    identity: [],
    craft: [],
    threads: ids.slice(0, threads).map(thread),
    hints: [],
    horizon: [],
    overflow: { identity: [], craft: [], threads: ids.slice(threads), hints: [], horizon: [] },
  };
}

const resolve: Resolve = (id) => ({ statement: `The open question numbered ${id}.`, learnedOn: "2026-09-01" });

describe("the line", () => {
  test("a lane past its cap says how many more and names their ids — furniture, so counts and the sentinel stay true", () => {
    const out = render(lanes(12, 3), { budgetBytes: 100_000, day: 5 }, resolve, SELF_TUNABLES);
    expect(out.text).toContain(`${FRAMING.threads}\n`);
    expect(out.text).toContain("(3 more still open; recall ids: mem_t12, mem_t13, mem_t14)");
    expect(out.more).toEqual({ threads: 3 });
    expect(out.counts.threads).toBe(12);
    expect(out.elements).toBe(12);
    expect(readSentinel(out.text).intact).toBe(true);
    expect(out.bytes).toBeLessThanOrEqual(100_000);
  });

  test("more than it names: the count is whole, the ids are the first few, and it says so", () => {
    const out = render(lanes(12, 8), { budgetBytes: 100_000, day: 5 }, resolve, SELF_TUNABLES);
    expect(out.text).toContain(`(8 more still open; recall ids (the first ${String(MORE_LINE_IDS)}): mem_t12, mem_t13, mem_t14, mem_t15, mem_t16)`);
  });

  test("a lane that lost nothing gets no line", () => {
    const out = render(lanes(4, 0), { budgetBytes: 100_000, day: 5 }, resolve, SELF_TUNABLES);
    expect(out.text).not.toContain(" more still open");
    expect(out.more).toEqual({});
  });

  test("INSIDE THE BUDGET: with no room for the line it is left out without a word, and nothing else moves", () => {
    const without = render(lanes(12, 0), { budgetBytes: 100_000, day: 5 }, resolve, SELF_TUNABLES);
    // Exactly the room the wake needs without the line.
    const tight = render(lanes(12, 3), { budgetBytes: without.bytes, day: 5 }, resolve, SELF_TUNABLES);
    expect(tight.text).toBe(without.text);
    expect(tight.more).toEqual({});
    expect(tight.trimmed).toEqual([]);
    // And one line's worth more room is enough for it.
    const line = moreLine("threads", ["mem_t12", "mem_t13", "mem_t14"]);
    const roomy = render(lanes(12, 3), { budgetBytes: without.bytes + Buffer.byteLength(`${line}\n`, "utf8"), day: 5 }, resolve, SELF_TUNABLES);
    expect(roomy.more).toEqual({ threads: 3 });
    expect(roomy.bytes).toBeLessThanOrEqual(without.bytes + Buffer.byteLength(`${line}\n`, "utf8"));
  });

  test("what the BUDGET trimmed is named too, in the lane's own order, ahead of what the cap left out", () => {
    // Long statements, so one trimmed element frees more room than the line needs.
    const long: Resolve = (id) => ({ statement: `The open question numbered ${id}. ${"More words about it. ".repeat(8)}`, learnedOn: "2026-09-01" });
    const full = render(lanes(12, 2), { budgetBytes: 100_000, day: 5 }, long, SELF_TUNABLES);
    const out = render(lanes(12, 2), { budgetBytes: full.bytes - 60, day: 5 }, long, SELF_TUNABLES);
    const cut = out.trimmed.filter((t) => t.lane === "threads").map((t) => t.id);
    expect(cut.length).toBeGreaterThan(0);
    const n = cut.length + 2;
    const expected = [...cut].reverse().concat(["mem_t12", "mem_t13"]).slice(0, MORE_LINE_IDS);
    expect(out.text).toContain(`(${String(n)} more still open; recall ids${n > MORE_LINE_IDS ? ` (the first ${String(MORE_LINE_IDS)})` : ""}: ${expected.join(", ")})`);
    expect(out.bytes).toBeLessThanOrEqual(full.bytes - 60);
  });
});

describe("the ids work through the recall tool", () => {
  test("a real store past the threads cap: every id the wake names comes back from `recall ids`", async () => {
    const c = Counterpart.open({ dir, owner: true });
    open.push(c);
    const extra = 4;
    const total = SELF_TUNABLES.THREADS_MAX + extra;
    for (let i = 0; i < total; i += 1) {
      c.store.put({
        type: "memory",
        kind: "fact",
        body: `An open question, number ${String(i)}, about the move that is still not settled.`,
        meta: { unresolved: true },
        salience: { relevance: 0.9, emotional: 0.5, predictive: 0.5 },
      });
    }
    const out = new Self({ store: c.store }).build({ budgetBytes: 100_000, day: c.store.livedDay() });
    expect(out.more.threads).toBe(extra);
    const m = /\((\d+) more still open; recall ids: ([^)]+)\)/.exec(out.text);
    expect(m).not.toBeNull();
    const ids = (m?.[2] ?? "").split(", ");
    expect(ids).toHaveLength(extra);
    // None of them is one the wake already carries.
    for (const id of ids) expect(out.kept.threads).not.toContain(id);

    recordSession(dir, { sessionId: "s-more", scope: "/proj", phase: "start" });
    const server = new McpServer({ counterpart: c, scope: "/proj", owner: true, registryDir: dir });
    const r = await server.call("recall", { ids });
    expect(r.isError ?? false).toBe(false);
    const got = (r.structuredContent["memories"] as { id: string }[]).map((x) => x.id);
    expect(got.sort()).toEqual([...ids].sort());
  });
});
