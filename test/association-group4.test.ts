/**
 * Group 4 — association (2026-10-11, review 06 §5–6, bench item 5). Ants:
 * faint trails laid by co-activation, strengthened by use, evaporating
 * without it. Item 1 (drewOn deposits) is in `drewon.test.ts`; item 6 (lag 1
 * only) in `association-build2.test.ts` › "4.".
 *
 * Hermetic: every store is a fresh temp dir, removed after.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { TUNABLES as ASSOCIATE_TUNABLES, planAtWrite } from "../src/core/associate/index.js";
import { ASKED_KIND, askedTurn, freshGateState, loadGateState, saveGateState } from "../src/core/recall/index.js";
import type { GateState } from "../src/core/recall/index.js";
import { DREAM_TUNABLES } from "../src/core/dream/tunables.js";
import { findable } from "./store-fixture.js";

const ENV = "COUNTERPARTS_DATA_DIR";
let dir: string;
let priorEnv: string | undefined;
const brains: Counterpart[] = [];

beforeEach(() => {
  priorEnv = process.env[ENV];
  dir = mkdtempSync(join(tmpdir(), "counterparts-group4-"));
  process.env[ENV] = dir;
});

afterEach(() => {
  for (const c of brains.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
  if (priorEnv === undefined) delete process.env[ENV];
  else process.env[ENV] = priorEnv;
  rmSync(dir, { recursive: true, force: true });
});

const T = ASSOCIATE_TUNABLES;

function brainAt(clock: { now: number }, opts: { observer?: boolean } = {}): Counterpart {
  const c = Counterpart.open({ dir, owner: true, now: () => clock.now, ...(opts.observer === true ? { observer: true } : {}) });
  findable(c.store);
  brains.push(c);
  return c;
}

function memoryIn(c: Counterpart, session: string, body: string): string {
  return c.store.put({ type: "memory", kind: "fact", body, origin: { session } });
}

/** Record `ids` as shown to `sessionId` on `turn`, as recall's own save would. */
function shown(c: Counterpart, sessionId: string, turn: number, ids: readonly string[], over: Partial<GateState["surfaced"][string]> = {}): void {
  const prior = loadGateState(c.store, sessionId).state;
  const surfaced: GateState["surfaced"] = { ...prior.surfaced };
  for (const id of ids) surfaced[id] = { turn, tier: "footnoted", trains: true, ...over };
  saveGateState(c.store, { ...freshGateState(sessionId), ...prior, turn: Math.max(prior.turn, turn), lastDay: c.store.livedDay(), surfaced }, 200);
}

const DAY = 24 * 60 * 60_000;

// ═══════════════════════════════════════════════════════════════════════════
// 2. Write-time links: a new memory, faintly linked to what was in mind
// ═══════════════════════════════════════════════════════════════════════════
describe("2. write-time links to what was in mind (bench item 5)", () => {
  test("the planner: nearest in mind first, at most WRITE_LINK_MAX, never to itself or a memory of the same pass", () => {
    const inMind = ["x1", "new2", "x2", "x1", "new1", "x3", "x4", "x5", "x6"];
    const plan = planAtWrite(
      [
        { id: "new1", inMind },
        { id: "new2", inMind: ["x1"] },
      ],
      T,
    );
    const first = plan.pairs.filter((p) => p.a === "new1").map((p) => p.b);
    expect(first).toEqual(["x1", "x2", "x3", "x4"].slice(0, T.WRITE_LINK_MAX));
    expect(plan.pairs.filter((p) => p.a === "new2").map((p) => p.b)).toEqual(["x1"]);
    expect(plan.memories).toBe(2);
    expect(planAtWrite([{ id: "solo", inMind: ["solo"] }], T).pairs).toEqual([]);
  });

  test("the clinic pair (bench 73d42213): a memory written after recall showed an older one is linked to it, faintly", async () => {
    const clock = { now: Date.UTC(2026, 4, 20, 9) };
    const c = brainAt(clock);
    c.store.advanceClock("2026-05-20");
    for (const body of [
      "The bakery on the corner sells out of rye bread by noon on Saturdays.",
      "The library returns box is emptied twice a day, at nine and at four.",
      "The bus to the station runs every twenty minutes until midnight.",
    ]) memoryIn(c, "conv-0520", body);
    const left = memoryIn(c, "conv-0520", "I left home at 7 AM on Monday to get to the clinic appointment.");
    await c.sessionEnd({ date: "2026-05-20", budgetBytes: 9000, session: "conv-0520" });

    clock.now += 10 * DAY;
    c.store.advanceClock("2026-05-30");
    const out = c.recallForTurn({ sessionId: "conv-0530", text: "how long does the trip to the clinic take" });
    expect([...out.decision.surfaced, ...out.decision.footnotes]).toContain(left);
    clock.now += 60_000;
    const took = memoryIn(c, "conv-0530", "It took two hours to get to the clinic last time.");
    const report = await c.sessionEnd({ date: "2026-05-30", budgetBytes: 9000, session: "conv-0530" });

    expect(report.contiguity.atWrite?.reason).toBe("linked");
    expect(report.contiguity.atWrite?.landed).toBeGreaterThanOrEqual(1);
    const day = c.store.edgesFrom(took).find((e) => e.dst === left)?.last_day ?? -1;
    expect(c.associate.weightAt(took, left, day)).toBeCloseTo(T.WRITE_LINK_WEIGHT, 10);
    expect(c.associate.weightAt(left, took, day)).toBeCloseTo(T.WRITE_LINK_WEIGHT, 10);
    // Counted on the boundary's row.
    const rows = c.store.eventLog({ name: "associate.flush" });
    const last = JSON.parse(rows[rows.length - 1]?.payload ?? "{}") as { atWrite?: Record<string, unknown> };
    expect(last.atWrite?.["landed"]).toBe(report.contiguity.atWrite?.landed);
  });

  test("only the session's last WRITE_LINK_TURNS turns are in mind; an ambiguous handle and another session's showings are not", async () => {
    const clock = { now: Date.UTC(2026, 8, 1, 9) };
    const c = brainAt(clock);
    c.store.advanceClock("2026-09-01");
    const old = memoryIn(c, "s0", "Shown long ago in this session.");
    const recent = memoryIn(c, "s0", "Shown on the last turn.");
    const ambiguous = memoryIn(c, "s0", "Shown only through an ambiguous handle.");
    const elsewhere = memoryIn(c, "s0", "Shown to another session.");
    await c.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    clock.now += DAY;
    c.store.advanceClock("2026-09-02");
    shown(c, "s1", 1, [old]);
    shown(c, "s1", 1 + T.WRITE_LINK_TURNS, [recent]);
    shown(c, "s1", 1 + T.WRITE_LINK_TURNS, [ambiguous], { trains: false });
    shown(c, "s2", 1 + T.WRITE_LINK_TURNS, [elsewhere]);
    const fresh = memoryIn(c, "s1", "Written at the end of the session.");
    const report = await c.sessionEnd({ date: "2026-09-02", budgetBytes: 9000 });
    expect(report.contiguity.atWrite?.pairs).toBe(1);
    expect(c.associate.linked(fresh, recent)).toBe(true);
    for (const other of [old, ambiguous, elsewhere]) expect(c.associate.linked(fresh, other)).toBe(false);
  });

  test("what a deliberate question showed near the write is in mind, first; one asked long before is not", async () => {
    const clock = { now: Date.UTC(2026, 8, 1, 9) };
    const c = brainAt(clock);
    c.store.advanceClock("2026-09-01");
    const asked = memoryIn(c, "s0", "The answer to a deliberate question.");
    const stale = memoryIn(c, "s0", "Asked about hours before.");
    await c.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    clock.now += DAY;
    c.store.advanceClock("2026-09-02");
    const day = c.store.livedDay();
    c.store.setGateRecords([
      { sessionId: "s1", kind: ASKED_KIND, ref: stale, turn: askedTurn(clock.now - 3 * 60 * 60_000), lastDay: day, tier: "asked", trains: true },
      { sessionId: "s1", kind: ASKED_KIND, ref: asked, turn: askedTurn(clock.now - 60_000), lastDay: day, tier: "asked", trains: true },
    ]);
    const fresh = memoryIn(c, "s1", "Written just after asking.");
    await c.sessionEnd({ date: "2026-09-02", budgetBytes: 9000 });
    expect(c.associate.linked(fresh, asked)).toBe(true);
    expect(c.associate.linked(fresh, stale)).toBe(false);
  });

  test("room-only: a full node refuses the faint link and loses nothing it learned", async () => {
    const clock = { now: Date.UTC(2026, 8, 1, 9) };
    const c = brainAt(clock, {});
    c.store.advanceClock("2026-09-01");
    const hub = memoryIn(c, "s0", "A memory whose links are full.");
    const others = Array.from({ length: T.MAX_EDGES_PER_NODE }, (_, i) => memoryIn(c, "sx", `Neighbour number ${String(i)} of the hub.`));
    await c.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    const day = c.store.livedDay();
    c.store.linkMany(others.flatMap((o) => [
      { src: hub, dst: o, weight: 0.1, day },
      { src: o, dst: hub, weight: 0.1, day },
    ]));
    shown(c, "s1", 1, [hub]);
    const fresh = memoryIn(c, "s1", "Written while the hub was in mind.");
    const report = await c.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    expect(report.contiguity.atWrite?.noRoom).toBe(1);
    expect(c.associate.linked(fresh, hub)).toBe(false);
    expect(c.store.edgesFrom(hub).filter((e) => e.weight > T.EDGE_FLOOR).length).toBe(T.MAX_EDGES_PER_NODE);
  });

  test("an observer lays nothing at write time", async () => {
    const clock = { now: Date.UTC(2026, 8, 1, 9) };
    const owner = brainAt(clock);
    owner.store.advanceClock("2026-09-01");
    const before = memoryIn(owner, "s0", "Shown before the write.");
    await owner.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    shown(owner, "s1", 1, [before]);
    memoryIn(owner, "s1", "Written while it was in mind.");
    owner.close();
    brains.splice(0);
    const watcher = brainAt(clock, { observer: true });
    const report = await watcher.sessionEnd({ date: "2026-09-01", budgetBytes: 9000 });
    expect(report.contiguity.reason).toBe("observer");
    expect(watcher.store.edgesFrom(before)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Replay deposits: the bundle proposes faint links, no model call
// ═══════════════════════════════════════════════════════════════════════════
describe("3. replay deposits (review 06 C2)", () => {
  /** An older memory, ten lived days back, and two new ones today that share its words. */
  function night(c: Counterpart): { old: string; fresh: string[] } {
    c.store.advanceClock("2026-05-20");
    const old = c.store.put({
      type: "memory",
      kind: "fact",
      body: "I left home at seven on Monday morning to reach the clinic appointment in time.",
      origin: { session: "conv-0520" },
      salience: { relevance: 0.6, emotional: 0.3, predictive: 0.6 },
    });
    for (let d = 21; d <= 30; d += 1) c.store.advanceClock(`2026-05-${String(d)}`);
    const fresh = [
      "It took two hours to get to the clinic appointment last time.",
      "The clinic appointment moved to Thursday afternoon.",
    ].map((body) => c.store.put({ type: "memory", kind: "fact", body, origin: { session: "conv-0530" }, salience: { relevance: 0.6, emotional: 0.3, predictive: 0.6 } }));
    return { old, fresh };
  }

  test("opening a dream links each new memory to the older neighbours shown beside it, at REPLAY_LINK_WEIGHT, room-only", () => {
    const clock = { now: Date.UTC(2026, 4, 30, 22) };
    const c = brainAt(clock);
    const { old, fresh } = night(c);
    const out = c.dreams.begin({ session: "night" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const pairs = out.bundle.fresh.flatMap((f) => f.neighbours.map((n) => [f.id, n] as const));
    expect(pairs.some(([, n]) => n === old)).toBe(true);
    const day = c.store.livedDay();
    for (const [a, b] of pairs) {
      expect(c.associate.weightAt(a, b, day)).toBeCloseTo(DREAM_TUNABLES.REPLAY_LINK_WEIGHT, 10);
      expect(c.associate.weightAt(b, a, day)).toBeCloseTo(DREAM_TUNABLES.REPLAY_LINK_WEIGHT, 10);
    }
    expect(fresh.some((f) => c.associate.linked(f, old))).toBe(true);
    // Durable, on the dream's own row — and not a change the dream made.
    const begun = JSON.parse(c.store.eventLog({ name: "dream.begun" }).at(-1)?.payload ?? "{}") as Record<string, unknown>;
    expect(begun["replayPairs"]).toBe(pairs.length);
    expect(begun["replayLinks"]).toBe(pairs.length);
    expect(c.store.dreamChanges(out.bundle.dream)).toEqual([]);
  });

  test("a stronger link use already laid is never lowered by the replay", () => {
    const clock = { now: Date.UTC(2026, 4, 30, 22) };
    const c = brainAt(clock);
    const { old, fresh } = night(c);
    const day = c.store.livedDay();
    c.store.linkMany(fresh.flatMap((f) => [
      { src: f, dst: old, weight: 0.3, day },
      { src: old, dst: f, weight: 0.3, day },
    ]));
    expect(c.dreams.begin({ session: "night" }).ok).toBe(true);
    for (const f of fresh) expect(c.associate.weightAt(f, old, day)).toBeCloseTo(0.3, 10);
  });
});
