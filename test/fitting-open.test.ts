/**
 * BUILD B, part 2 (2026-09-28): the sleep scans resume where they stopped, and
 * small "open" lists are read by open state rather than through a window of
 * the newest N — a flagged pair past the newest ten dreams, an offered share
 * past the newest five reflections, a cite past the night's returns.
 *
 * Hermetic: a fresh temp data dir per test, removed after.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { onMyMind } from "../src/core/dream/index.js";
import { readCursor, runDecay, runPrune } from "../src/core/sleep/index.js";
import type { PhaseCtx } from "../src/core/sleep/index.js";
import type { PutInput } from "../src/core/store/index.js";

let dir: string;
const open: Counterpart[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-fit-open-"));
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

function brain(): Counterpart {
  const c = Counterpart.open({ dir, owner: true, identity: { name: "Mike" } });
  open.push(c);
  return c;
}

function mem(c: Counterpart, body: string, over: Partial<PutInput> = {}): string {
  return c.store.put({ type: "memory", kind: "fact", body, salience: { relevance: 0.6, emotional: 0.3, predictive: 0.6 }, ...over });
}

function ctx(c: Counterpart, budget: number): PhaseCtx {
  return { store: c.store as never, day: c.store.livedDay(), apply: true, budget, step: () => {}, event: () => {} };
}

describe("prune and decay resume where they stopped (the audit's #4)", () => {
  test("a prune budget smaller than the store reaches the tail on a later night — a cursor, wrapping", () => {
    const c = brain();
    for (const d of ["2026-09-01", "2026-09-02"]) c.store.advanceClock(d);
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) ids.push(mem(c, `A live memory, number ${String(i)}.`));
    const sorted = c.store.list().filter((id) => ids.includes(id)).sort();
    expect(sorted.length).toBe(6);
    // Budget 2: each night examines the next two, not the same first two.
    runPrune(ctx(c, 2));
    const first = readCursor(c.store, "prune");
    runPrune(ctx(c, 2));
    const second = readCursor(c.store, "prune");
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect((second ?? "") > (first ?? "")).toBe(true);
    // An observer's read-only pass does not move it.
    runPrune({ ...ctx(c, 2), apply: false });
    expect(readCursor(c.store, "prune")).toBe(second);
  });

  test("decay keeps its own cursor the same way", () => {
    const c = brain();
    for (let i = 0; i < 5; i += 1) mem(c, `Memory ${String(i)}.`);
    runDecay(ctx(c, 2), null);
    const a = readCursor(c.store, "decay");
    runDecay(ctx(c, 2), null);
    const b = readCursor(c.store, "decay");
    expect(a).not.toBeNull();
    expect(b).not.toBe(a);
  });
});

describe("open lists read by open state, not through the newest N", () => {
  function dreamRow(c: Counterpart, id: string, date: string, i: number): void {
    c.store.openDream({ id, session: "s", day: c.store.livedDay(), date, shown: [] });
    c.store.updateDream(id, { state: "journaled", startedAt: 1_000 + i });
  }

  test("a pair flagged eleven dreams ago is still raised awake, and still on my mind", () => {
    const c = brain();
    c.store.advanceClock("2026-09-01");
    const a = mem(c, "The deploy runs the migration first.");
    const b = mem(c, "The deploy runs the migration last.");
    dreamRow(c, "drm_old", "2026-09-01", 0);
    c.store.recordDreamChange("drm_old", { action: "contradiction", ref: a, ref2: b, detail: {} });
    for (let i = 1; i <= 11; i += 1) dreamRow(c, `drm_${String(i).padStart(3, "0")}`, "2026-09-02", i);
    expect(c.store.dreams({ limit: 10 }).some((d) => d.id === "drm_old")).toBe(false);
    const mind = onMyMind(c.store, { today: "2026-09-12", day: c.store.livedDay(), showable: () => true, owner: true });
    expect(mind.some((m) => m.kind === "unsettled" && m.ids.includes(a))).toBe(true);
    const lines = c.dreams.raiseLines({ session: "s-now" });
    expect(lines.some((l) => l.includes(a) && l.includes(b))).toBe(true);
    // Raised once.
    expect(c.dreams.raiseLines({ session: "s-now" })).toEqual([]);
  });

  test("an offered share older than the newest five reflections is still carried", () => {
    const c = brain();
    c.store.openReflection({ id: "rfl_old", session: "s-old", day: 1, date: "2026-09-01", questions: [], shown: [] });
    c.store.updateReflection("rfl_old", { state: "reflected", entry: "e", share: "Last night I dreamed of the release.", shareState: "offered" });
    for (let i = 0; i < 6; i += 1) {
      c.store.openReflection({ id: `rfl_${String(i)}`, session: "s-old", day: 2 + i, date: `2026-09-0${String(2 + i)}`, questions: [], shown: [] });
      c.store.updateReflection(`rfl_${String(i)}`, { state: "reflected", entry: "e" });
    }
    const row = c.reflections.pendingShare({ session: "s-new" });
    expect(row?.id).toBe("rfl_old");
  });

  test("cites past the night's returns are listed with why, not left out", () => {
    const c = brain();
    for (const d of ["2026-09-01", "2026-09-02"]) c.store.advanceClock(d);
    const ids: string[] = [];
    for (let i = 0; i < 14; i += 1) ids.push(mem(c, `A thing lived today, number ${String(i)}.`, { physics: { birthDay: c.store.livedDay(), lastUsedDay: c.store.livedDay() } }));
    const r = c.reflections.begin({ session: "s-r" });
    if (!r.ok) throw new Error(r.reason);
    const o = c.reflections.finish({ reflection: r.bundle.reflection, session: "s-r", entry: "A full day.", cites: ids });
    if (!o.ok) throw new Error(o.reason);
    expect(o.outcome.returned.length).toBe(14);
    expect(o.outcome.returned.slice(12).map((x) => x.reason)).toEqual(["returns-limit-reached", "returns-limit-reached"]);
  });
});
