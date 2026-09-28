/**
 * Association build 2 (2026-09-28): links change what comes to mind.
 *
 * One describe per item of the build, in the build's order, so a behaviour and
 * the commit that introduced it read side by side. Hermetic: every test opens a
 * fresh temp data dir and removes it; nothing here can reach a live store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Store } from "../src/core/store/index.js";
import {
  Associate,
  DeltaBuffer,
  TUNABLES as ASSOCIATE_TUNABLES,
  appendPendingDeltas,
  claimPending,
  planContiguity,
  planFlush,
  spread,
  withTunables as withAssociate,
} from "../src/core/associate/index.js";
import type { EdgeState } from "../src/core/associate/index.js";
import { Recall, activate, freshGateState, gate, withTunables } from "../src/core/recall/index.js";
import type { Candidate } from "../src/core/recall/index.js";
import { recallTurn } from "../src/core/retrieval.js";
import { CONTIGUITY_CURSOR_META, Counterpart } from "../src/core/counterpart.js";

let dir: string;
const stores: Store[] = [];
const brains: Counterpart[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-assoc2-"));
});

afterEach(() => {
  for (const c of brains.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
  for (const s of stores.splice(0)) {
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

function store(opts: Parameters<typeof Store.open>[0] = {}): Store {
  const s = Store.open({ dir, ...opts });
  stores.push(s);
  return s;
}

/** Ordinary background, so rarity can discriminate (recall §9 G4). */
const FILLER = [
  "The garage door opener needs a new battery soon.",
  "Rebasing keeps the history readable for reviewers.",
  "The library closes early on Sundays now.",
  "The kitchen tap drips when the pressure is high.",
  "The bus route changed and adds ten minutes.",
  "Planted three tomato seedlings in the planter.",
  "Fixed the wobbling chair leg with a shim.",
  "Started keeping receipts in one envelope.",
  "The printer jams on heavy paper stock.",
  "Set up a standing desk in the spare bedroom.",
  "Wrote a short letter to an old teacher.",
  "Bought hiking boots that finally fit properly.",
  "The neighbour's cat sits on the fence every evening.",
  "Replaced the smoke alarm batteries in the hall.",
  "Booked the dentist for a routine cleaning.",
  "The sourdough starter needs feeding twice a week.",
];

const CUED = "The sourdough starter died after two weeks of neglect.";
const TURN = "my sourdough starter died";

/** Words no turn in this file uses: a memory made of them is reachable only by a link. */
const FOREIGN = [
  "Vellichor quixotry zygomorphic ephemera.",
  "Petrichor sonder apricity hiraeth.",
  "Saudade vorfreude hygge komorebi.",
  "Tsundoku wabi mamihlapinatapai.",
  "Eunoia defenestration borborygmus.",
];

/** Link two memories as `uses` fully-credited co-activations would. */
function coUse(associate: Associate, a: string, b: string, uses: number): void {
  for (let i = 0; i < uses; i++) {
    associate.coactivate([
      { id: a, tier: "referenced" },
      { id: b, tier: "referenced" },
    ]);
    associate.flush();
  }
}

function seeded(): { s: Store; associate: Associate; cued: string } {
  const s = store();
  for (const body of FILLER) s.put({ type: "memory", kind: "fact", body });
  const cued = s.put({ type: "memory", kind: "fact", body: CUED, physics: { birthDay: 0, lastUsedDay: 0 } });
  return { s, associate: new Associate({ store: s }), cued };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Links may add QUIET POINTERS (pattern completion)
// ═══════════════════════════════════════════════════════════════════════════
describe("1. quiet pointers: a few per turn, footnote tier only, over a threshold, never loud", () => {
  test("bounded per turn: four well-linked memories, LINK_POINTERS_MAX shown, the rest counted", () => {
    const { s, associate, cued } = seeded();
    const behind = FOREIGN.slice(0, 4).map((body) => s.put({ type: "memory", kind: "fact", body }));
    for (const id of behind) coUse(associate, cued, id, 6);
    const r = new Recall({ store: s, owner: true });
    const d = recallTurn(r, { sessionId: "s1", text: TURN }, { associate }).decision;
    const max = r.tunables.LINK_POINTERS_MAX;
    const shown = d.footnotes.filter((id) => behind.includes(id));
    expect(shown.length).toBe(max);
    expect(d.spread?.linkOnly).toBe(4);
    expect(d.spread?.pointerCandidates).toBe(4);
    expect(d.spread?.pointersShown).toBe(max);
    expect(d.spread?.pointersUnanchored).toBe(0);
    // Past the cap: recorded by name, never silently gone.
    expect(d.verdicts.filter((v) => v.via === "link" && v.verdict === "capped").length).toBe(4 - max);
    expect([...d.surfaced, ...d.footnotes]).toContain(cued);
    // Only the quiet tier, and each says how it came.
    for (const id of shown) {
      const v = d.verdicts.find((x) => x.id === id);
      expect(v?.verdict).toBe("footnoted");
      expect(v?.via).toBe("link");
    }
    expect(d.surfaced.some((id) => behind.includes(id))).toBe(false);
  });

  /** A bare candidate for driving the gate directly. */
  function candidate(s: Store, id: string, over: Partial<Candidate>): Candidate {
    return {
      id,
      kind: "fact",
      doc: s.readProse(id),
      physics: { kind: "fact", salience: { novelty: null, relevance: 0.5, emotional: 0, predictive: 0.5 } } as never,
      strength: 1,
      sal: 0.5,
      mood: 0,
      cue: 0,
      temporal: 0,
      semantic: 0,
      arrival: 0,
      hops: 0,
      activation: 0,
      cueFraction: 0,
      matched: 0,
      trains: true,
      maxTier: "surfaced",
      confidential: false,
      ...over,
    };
  }

  test("NEVER LOUD: an anchored pointer with any activation at all is footnoted, never surfaced", () => {
    const { s, cued } = seeded();
    const id = s.put({ type: "memory", kind: "fact", body: FOREIGN[0] as string });
    // Thin background (one cued candidate): the absolute regime, whose floor
    // a cue of 50 clears — so the anchor is shown.
    const anchor = candidate(s, cued, { cue: 50, activation: 50, cueFraction: 1 });
    const pointer = candidate(s, id, { hops: 1_000, activation: 1_000, maxTier: "footnoted", linkOnly: true, linkedFrom: { [cued]: 1_000 } });
    const out = gate(
      { candidates: [anchor, pointer], state: freshGateState("g"), storeSize: 500, owner: true, affectStated: false, turn: 1 },
      withTunables(),
    );
    expect(out.surfaced.map((c) => c.id)).not.toContain(id);
    expect(out.footnotes.map((c) => c.id)).toContain(id);
    const v = out.verdicts.find((x) => x.id === id);
    expect(v?.verdict).toBe("footnoted");
    expect(v?.via).toBe("link");
    // A pointer is no cue: it is outside the background the bar is built from.
    expect(out.background.n).toBe(1);
  });

  test("THE ANCHOR: a pointer carried only by a memory the gate turned away is not shown, and says why", () => {
    const { s, cued } = seeded();
    const id = s.put({ type: "memory", kind: "fact", body: FOREIGN[0] as string });
    // The only memory that passed it anything sits under the absolute floor.
    const turnedAway = candidate(s, cued, { cue: 0.0001, activation: 0.0001, cueFraction: 1 });
    const pointer = candidate(s, id, { hops: 1, activation: 1, maxTier: "footnoted", linkOnly: true, linkedFrom: { [cued]: 1 } });
    const out = gate(
      { candidates: [turnedAway, pointer], state: freshGateState("g"), storeSize: 500, owner: true, affectStated: false, turn: 1 },
      withTunables(),
    );
    expect(out.verdicts.find((x) => x.id === cued)?.verdict).toBe("below-floor");
    expect(out.footnotes).toEqual([]);
    const v = out.verdicts.find((x) => x.id === id);
    expect(v?.verdict).toBe("dark-uncued");
    expect(v?.via).toBe("link");
  });

  test("a pointer never displaces a memory the words found: its own slots, after the cued footnotes", () => {
    const { s, associate, cued } = seeded();
    const behind = s.put({ type: "memory", kind: "fact", body: FOREIGN[0] as string });
    coUse(associate, cued, behind, 6);
    const without = recallTurn(new Recall({ store: s, owner: true }), { sessionId: "a", text: TURN }, {}).decision;
    const withLinks = recallTurn(new Recall({ store: s, owner: true }), { sessionId: "b", text: TURN }, { associate }).decision;
    // Every memory the conversation brought is still there, in the same order,
    // and the pointer comes after them.
    expect(withLinks.surfaced).toEqual(without.surfaced);
    expect(withLinks.footnotes.slice(0, without.footnotes.length)).toEqual(without.footnotes);
    expect(withLinks.footnotes[withLinks.footnotes.length - 1]).toBe(behind);
  });

  test("the boundary gates hold for pointers: withheld when confidential in a non-owner session, deduped within a session", () => {
    const { s, associate, cued } = seeded();
    const secret = s.put({
      type: "memory",
      kind: "fact",
      body: FOREIGN[1] as string,
      meta: { confidential: true },
    });
    coUse(associate, cued, secret, 6);
    const stranger = recallTurn(new Recall({ store: s, owner: false }), { sessionId: "x", text: TURN }, { associate }).decision;
    expect(stranger.verdicts.find((v) => v.id === secret)?.verdict).toBe("confidential-withheld");
    expect(stranger.footnotes).not.toContain(secret);

    const owner = new Recall({ store: s, owner: true });
    const first = recallTurn(owner, { sessionId: "o", text: TURN }, { associate }).decision;
    expect(first.footnotes).toContain(secret);
    const second = recallTurn(owner, { sessionId: "o", text: TURN }, { associate }).decision;
    expect(second.verdicts.find((v) => v.id === secret)?.verdict).toBe("dedup-suppressed");
  });

  test("a pointer the reply expands is COUNTED as used, and the expansion credits it (trains)", () => {
    const c = Counterpart.open({ dir, owner: true });
    brains.push(c);
    for (const body of FILLER) c.store.put({ type: "memory", kind: "fact", body });
    const cued = c.store.put({ type: "memory", kind: "fact", body: CUED, physics: { birthDay: 0, lastUsedDay: 0 } });
    const behind = c.store.put({ type: "memory", kind: "fact", body: FOREIGN[2] as string, physics: { birthDay: 0, lastUsedDay: 0 } });
    coUse(c.associate, cued, behind, 6);
    c.store.advanceClock("2026-09-28");
    const d = c.recallForTurn({ sessionId: "s1", text: TURN }).decision;
    expect(d.footnotes).toContain(behind);
    const summary = c.creditReferences("s1", { assistantTurns: [], expansions: [behind] });
    expect(summary.pointersExpanded).toBe(1);
    expect(summary.credited).toBe(1);
    expect(summary.ids).toContain(behind);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Best-first spread across depths, with a threshold; seeds from the top-K
// ═══════════════════════════════════════════════════════════════════════════
describe("2. best-first across depths, a threshold stop, the node budget recorded, seeds from the top-K", () => {
  /** A graph from a list of directed edges, all written on day 0. */
  function graph(edges: readonly [string, string, number][]): (id: string) => EdgeState[] {
    return (id) => edges.filter(([src]) => src === id).map(([src, dst, weight]) => ({ src, dst, weight, lastDay: 0 }));
  }
  const ALL = (): boolean => true;

  test("a strong first-hop node is expanded before a weak seed", () => {
    // S carries 10; its link to M passes 10 · 0.5 · 1/4 = 1.25 — more than the
    // weak seed W's own 0.5. With room for two expansions, S then M go first.
    const out = spread(
      {
        seeds: [
          { id: "W", activation: 0.5 },
          { id: "S", activation: 10 },
        ],
        day: 0,
        edgesFrom: graph([
          ["S", "M", 1],
          ["M", "Z", 1],
          ["W", "V", 1],
        ]),
        conducts: ALL,
      },
      withAssociate({ MAX_SPREAD_NODES: 2 }),
    );
    const ids = out.contributions.map((c) => c.id);
    expect(ids).toContain("Z");
    expect(ids).not.toContain("V");
    expect(out.stop).toBe("node-limit");
    expect(out.depth).toBe(2);
    // The budget bound with the weak seed still waiting over the threshold.
    expect(out.waiting).toBe(1);
  });

  test("the walk stops at the first node under the threshold, and says so", () => {
    // One fresh co-use (0.1) passes 1.25% of the seed: under the 2% threshold,
    // so b is reached (a contribution) but never expanded (c is out of reach).
    const out = spread(
      {
        seeds: [{ id: "a", activation: 1 }],
        day: 0,
        edgesFrom: graph([
          ["a", "b", 0.1],
          ["b", "c", 1],
        ]),
        conducts: ALL,
      },
      withAssociate(),
    );
    expect(out.stop).toBe("threshold");
    expect(out.expanded).toBe(1);
    expect(out.contributions.map((c) => c.id)).toEqual(["b"]);
    expect(out.waiting).toBe(0);
  });

  test("the hop ceiling holds under best-first: nothing past HOPS is expanded, and the stop says hop-limit", () => {
    const out = spread(
      {
        seeds: [{ id: "a", activation: 1 }],
        day: 0,
        edgesFrom: graph([
          ["a", "b", 1],
          ["b", "c", 1],
          ["c", "d", 1],
        ]),
        conducts: ALL,
      },
      withAssociate({ SPREAD_MIN_FRACTION: 0 }),
    );
    expect(out.contributions.map((c) => c.id).sort()).toEqual(["b", "c"]);
    expect(out.stop).toBe("hop-limit");
    expect(out.depth).toBe(ASSOCIATE_TUNABLES.HOPS);
  });

  test("seeds are the strongest SPREAD_SEEDS candidates, and a candidate past them is lifted by a link", () => {
    const { s, associate, cued } = seeded();
    // A second, weaker cued candidate: one word of the turn.
    const weaker = s.put({ type: "memory", kind: "fact", body: "Neglect is the usual cause, the forum said.", physics: { birthDay: 0, lastUsedDay: 0 } });
    coUse(associate, cued, weaker, 6);
    const turn = { sessionId: "s1", text: "my sourdough starter died of neglect" };
    const one = recallTurn(new Recall({ store: s, owner: true, tunables: { SPREAD_SEEDS: 1 } }), turn, { associate }).decision;
    const all = recallTurn(new Recall({ store: s, owner: true }), { ...turn, sessionId: "s2" }, { associate }).decision;
    expect(one.spread?.seeds).toBe(1);
    // With one seed, the weaker candidate is not a seed and the link lifts it.
    expect(one.verdicts.find((v) => v.id === weaker)?.hops).toBeGreaterThan(0);
    expect(one.spread?.landed).toBeGreaterThanOrEqual(1);
    // With the default, both are seeds, and inside the seeds links reorder nothing.
    expect(all.verdicts.find((v) => v.id === weaker)?.hops).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Temporal contiguity — adjacent memories of one session, weakly linked
// ═══════════════════════════════════════════════════════════════════════════
describe("4. temporal contiguity: adjacent only, lag-weighted, forward where the order is real, flat in a batch", () => {
  const T = ASSOCIATE_TUNABLES;
  const rate = T.CONTIGUITY_RATE;
  const flat = (1 + T.CONTIGUITY_BACKWARD) / 2;

  test("the planner: lag 1 and lag 2 only, never all pairs; forward bias when the order is real", () => {
    const minute = 60_000;
    // Five memories, each written two minutes after the last: a real order.
    const rows = ["m1", "m2", "m3", "m4", "m5"].map((id, i) => ({ id, at: i * 2 * minute, fresh: true }));
    const plan = planContiguity(rows, T);
    // 4 at lag 1 + 3 at lag 2 = 7, not the 10 of every pair.
    expect(plan.pairs).toBe(7);
    expect(plan.timed).toBe(7);
    expect(plan.batch).toBe(0);
    const d12 = plan.deltas.find((d) => d.a === "m1" && d.b === "m2");
    expect(d12?.delta).toBeCloseTo(rate, 12);
    expect(d12?.back).toBeCloseTo(rate * T.CONTIGUITY_BACKWARD, 12);
    const d13 = plan.deltas.find((d) => d.a === "m1" && d.b === "m3");
    expect(d13?.delta).toBeCloseTo(rate * T.CONTIGUITY_LAG_DECAY, 12);
    expect(plan.deltas.find((d) => d.a === "m1" && d.b === "m4")).toBeUndefined();
  });

  test("the planner: inside one batch the two directions get the same delta, the mean of forward and back", () => {
    const rows = ["b1", "b2", "b3"].map((id, i) => ({ id, at: 1_000 + i, fresh: true }));
    const plan = planContiguity(rows, T);
    expect(plan.batch).toBe(3);
    expect(plan.timed).toBe(0);
    const d12 = plan.deltas.find((d) => d.a === "b1" && d.b === "b2");
    expect(d12?.delta).toBeCloseTo(rate * flat, 12);
    expect(d12?.back).toBeUndefined();
  });

  test("the planner: only pairs that touch a NEW memory — a re-read session re-credits nothing", () => {
    const rows = [
      { id: "old1", at: 0, fresh: false },
      { id: "old2", at: 1, fresh: false },
      { id: "new1", at: 2, fresh: true },
    ];
    const plan = planContiguity(rows, T);
    const keys = plan.deltas.map((d) => `${d.a}>${d.b}`).sort();
    expect(keys).toEqual(["old1>new1", "old2>new1"]);
  });

  test("a directed delta stays directed through the buffer (either argument order) and the pending file", () => {
    const buf = new DeltaBuffer();
    buf.add("z", "a", 0.06, 0.03); // z → a forward, a → z back
    buf.add("a", "z", 0.01); // a symmetric co-use on the same pair
    const [d] = buf.pending();
    expect(d?.a).toBe("a");
    expect(d?.b).toBe("z");
    expect(d?.delta).toBeCloseTo(0.04, 12); // a → z: 0.03 + 0.01
    expect(d?.back).toBeCloseTo(0.07, 12); // z → a: 0.06 + 0.01
    const plan = planFlush(buf.drain(), 3, () => [], ASSOCIATE_TUNABLES);
    expect(plan.rows.find((r) => r.src === "a" && r.dst === "z")?.weight).toBeCloseTo(0.04, 12);
    expect(plan.rows.find((r) => r.src === "z" && r.dst === "a")?.weight).toBeCloseTo(0.07, 12);

    const append = appendPendingDeltas(dir, [{ a: "a", b: "z", delta: 0.04, back: 0.07 }, { a: "b", b: "c", delta: 0.1 }], { day: 3, at: 1 });
    expect(append.ok).toBe(true);
    const [claim] = claimPending(dir, { now: 2 });
    expect(claim?.deltas).toEqual([{ a: "a", b: "z", delta: 0.04, back: 0.07 }, { a: "b", b: "c", delta: 0.1 }]);
  });

  function brainAt(clock: { now: number }, opts: { observer?: boolean } = {}): Counterpart {
    const c = Counterpart.open({ dir, owner: true, now: () => clock.now, ...(opts.observer === true ? { observer: true } : {}) });
    brains.push(c);
    return c;
  }
  function memoryIn(c: Counterpart, session: string, body: string): string {
    return c.store.put({ type: "memory", kind: "fact", body, origin: { session } });
  }

  test("at the boundary: neighbours linked through the flush, forward over back, counted on the associate.flush row", async () => {
    const clock = { now: Date.UTC(2026, 8, 28, 12) };
    const c = brainAt(clock);
    const a = memoryIn(c, "s1", "A note made early in the session about the kiln.");
    clock.now += 10 * 60_000;
    const b = memoryIn(c, "s1", "A note made later in the session about the glaze.");
    clock.now += 10 * 60_000;
    const other = memoryIn(c, "s2", "Another session's memory entirely.");
    const day = c.store.livedDay();
    const report = await c.sessionEnd({ date: "2026-09-28", budgetBytes: 9000 });
    expect(report.contiguity.reason).toBe("buffered");
    expect(report.contiguity.memories).toBe(3);
    expect(report.contiguity.sessions).toBe(2);
    expect(report.contiguity.pairs).toBe(1);
    expect(report.contiguity.timed).toBe(1);
    // Stored weights, as the flush wrote them (the boundary's cycle then moves the clock).
    const w = (src: string, dst: string): number => c.store.edgesFrom(src).find((e) => e.dst === dst)?.weight ?? 0;
    expect(w(a, b)).toBeCloseTo(rate, 10);
    expect(w(b, a)).toBeCloseTo(rate * T.CONTIGUITY_BACKWARD, 10);
    expect(w(a, other)).toBe(0);
    expect(day).toBeGreaterThanOrEqual(0);
    const rows = c.store.eventLog({ name: "associate.flush" });
    const last = JSON.parse(rows[rows.length - 1]?.payload ?? "{}") as Record<string, unknown>;
    expect(last["source"]).toBe("boundary");
    expect((last["contiguity"] as Record<string, unknown>)["pairs"]).toBe(1);
    expect(last["rows"]).toBe(2);

    // The cursor moved: a second boundary re-credits nothing.
    const again = await c.sessionEnd({ date: "2026-09-29", budgetBytes: 9000 });
    expect(again.contiguity.reason).toBe("nothing-new");
    expect(again.contiguity.pairs).toBe(0);

    // A later memory in the same session links to its older neighbours only.
    clock.now += 10 * 60_000;
    const later = memoryIn(c, "s1", "The last note of the session, about firing.");
    const third = await c.sessionEnd({ date: "2026-09-30", budgetBytes: 9000 });
    expect(third.contiguity.memories).toBe(1);
    expect(third.contiguity.pairs).toBe(2);
    expect(w(b, later)).toBeCloseTo(rate, 10);
    expect(w(a, later)).toBeCloseTo(rate * T.CONTIGUITY_LAG_DECAY, 10);
  });

  test("a first pass on a store with history links only what was born today — never the whole past", async () => {
    const clock = { now: Date.UTC(2026, 8, 20, 12) };
    const c = brainAt(clock);
    const old1 = memoryIn(c, "s0", "An old memory from a past session.");
    const old2 = memoryIn(c, "s0", "Another old memory from that past session.");
    c.store.advanceClock("2026-09-21");
    c.store.advanceClock("2026-09-22");
    clock.now = Date.UTC(2026, 8, 22, 12);
    const fresh1 = memoryIn(c, "s9", "Today's first memory.");
    const fresh2 = memoryIn(c, "s9", "Today's second memory.");
    const report = await c.sessionEnd({ date: "2026-09-22", budgetBytes: 9000 });
    expect(report.contiguity.memories).toBe(2);
    const day = c.store.livedDay();
    expect(c.associate.weightAt(old1, old2, day)).toBe(0);
    expect(c.associate.weightAt(fresh1, fresh2, day)).toBeGreaterThan(0);
  });

  test("homeostasis applies: a node already at its bound is renormalized, not pushed past it", async () => {
    const clock = { now: Date.UTC(2026, 8, 28, 12) };
    const c = brainAt(clock);
    const hub = memoryIn(c, "s1", "The hub memory everything already links to.");
    const next = memoryIn(c, "s1", "The memory written right after the hub.");
    const day = c.store.livedDay();
    // One edge short of the count cap, and the outgoing bound already full.
    const n = T.MAX_EDGES_PER_NODE - 1;
    const others = Array.from({ length: n }, (_, i) =>
      c.store.put({ type: "memory", kind: "fact", body: `Filler neighbour ${String(i)} of the hub.` }),
    );
    c.store.linkMany(others.map((o) => ({ src: hub, dst: o, weight: T.MAX_OUT_WEIGHT / n, day })));
    const report = await c.sessionEnd({ date: "2026-09-28", budgetBytes: 9000 });
    expect(report.edges.renormalized).toBeGreaterThanOrEqual(1);
    const live = c.store.edgesFrom(hub).filter((e) => e.weight > T.EDGE_FLOOR);
    expect(live.length).toBeLessThanOrEqual(T.MAX_EDGES_PER_NODE);
    expect(live.reduce((s, e) => s + e.weight, 0)).toBeLessThanOrEqual(T.MAX_OUT_WEIGHT + 1e-9);
    // The new link landed, scaled with its siblings rather than on top of them.
    const toNext = live.find((e) => e.dst === next);
    expect(toNext).toBeDefined();
    expect(toNext?.weight ?? 1).toBeLessThan(rate);
  });

  test("the count cap applies too: at a full node the weakest link is evicted — here, the new one — and counted", async () => {
    const clock = { now: Date.UTC(2026, 8, 28, 12) };
    const c = brainAt(clock);
    const hub = memoryIn(c, "s1", "The hub memory everything already links to.");
    const next = memoryIn(c, "s1", "The memory written right after the hub.");
    const day = c.store.livedDay();
    const others = Array.from({ length: T.MAX_EDGES_PER_NODE }, (_, i) =>
      c.store.put({ type: "memory", kind: "fact", body: `Filler neighbour ${String(i)} of the hub.` }),
    );
    c.store.linkMany(others.map((o) => ({ src: hub, dst: o, weight: T.MAX_OUT_WEIGHT / T.MAX_EDGES_PER_NODE, day })));
    const report = await c.sessionEnd({ date: "2026-09-28", budgetBytes: 9000 });
    expect(report.edges.evictions.some((e) => e.src === hub && e.dst === next)).toBe(true);
    expect(c.store.edgesFrom(hub).filter((e) => e.weight > T.EDGE_FLOOR).length).toBe(T.MAX_EDGES_PER_NODE);
  });

  test("an observer plans nothing, buffers nothing, and moves no cursor", async () => {
    const clock = { now: Date.UTC(2026, 8, 28, 12) };
    const writer = brainAt(clock);
    memoryIn(writer, "s1", "First memory of the session.");
    memoryIn(writer, "s1", "Second memory of the session.");
    writer.close();
    const watcher = brainAt(clock, { observer: true });
    expect(watcher.contiguityPass().reason).toBe("observer");
    expect(watcher.associate.pendingDeltas()).toEqual([]);
    expect(watcher.store.getMeta(CONTIGUITY_CURSOR_META)).toBeUndefined();
  });

  test("a pinned memory is frozen both ways: contiguity refuses the pair and counts it", async () => {
    const clock = { now: Date.UTC(2026, 8, 28, 12) };
    const c = brainAt(clock);
    const pinned = c.store.put({ type: "memory", kind: "fact", body: "A pinned memory.", origin: { session: "s1" }, physics: { protected: true } as never });
    const plain = memoryIn(c, "s1", "An ordinary memory after it.");
    const report = await c.sessionEnd({ date: "2026-09-28", budgetBytes: 9000 });
    expect(report.contiguity.frozen).toBe(1);
    expect(c.associate.weightAt(pinned, plain)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. A ceiling on the hop score: links suggest, they don't take over
// ═══════════════════════════════════════════════════════════════════════════
describe("3. the hop ceiling: at most HOP_CEILING × the candidate's own cue + semantic; pointers held lower", () => {
  function scoredTurn(tunables: Partial<Parameters<typeof withTunables>[0]>, contribution: number) {
    const { s, cued } = seeded();
    const t = withTunables({ SPREAD_SEEDS: 0, ...tunables });
    const turn = { text: TURN, day: 0, selfFelt: false, maxCandidates: 24, storeSize: 18 };
    const plain = activate(s, turn, t).candidates.find((c) => c.id === cued);
    const out = activate(s, { ...turn, spread: () => ({ contributions: [{ id: cued, activation: contribution }] }) }, t);
    return { plain, hopped: out.candidates.find((c) => c.id === cued), spread: out.spread };
  }

  test("a contribution bigger than the candidate's own evidence is capped at it, and the cap is counted", () => {
    const { plain, hopped, spread: stats } = scoredTurn({}, 1_000);
    const own = (plain?.cue ?? 0) + (plain?.semantic ?? 0);
    expect(own).toBeGreaterThan(0);
    expect(hopped?.hops).toBeCloseTo(own * withTunables().HOP_CEILING, 10);
    expect(hopped?.activation).toBeCloseTo((plain?.activation ?? 0) + own, 10);
    expect(stats?.hopsCapped).toBe(1);
  });

  test("a contribution under the ceiling lands whole, and nothing is counted as capped", () => {
    const { plain, hopped, spread: stats } = scoredTurn({}, 0.001);
    expect(hopped?.hops).toBeCloseTo(0.001, 12);
    expect(hopped?.activation).toBeCloseTo((plain?.activation ?? 0) + 0.001, 12);
    expect(stats?.hopsCapped).toBe(0);
  });

  test("a pointer carries at most LINK_POINTER_CAP_FRACTION of the strongest seed, however many paths reach it", () => {
    const { s, cued } = seeded();
    const behind = s.put({ type: "memory", kind: "fact", body: FOREIGN[3] as string });
    const t = withTunables();
    const turn = { text: TURN, day: 0, selfFelt: false, maxCandidates: 24, storeSize: 18 };
    const out = activate(s, { ...turn, spread: () => ({ contributions: [{ id: behind, activation: 1_000 }] }) }, t);
    const strongest = Math.max(...out.candidates.filter((c) => c.linkOnly !== true).map((c) => c.activation));
    const p = out.candidates.find((c) => c.id === behind);
    expect(p?.linkOnly).toBe(true);
    expect(p?.activation).toBeCloseTo(strongest * t.LINK_POINTER_CAP_FRACTION, 10);
    expect(out.spread?.pointersCapped).toBe(1);
    expect(out.candidates.some((c) => c.id === cued)).toBe(true);
  });
});
