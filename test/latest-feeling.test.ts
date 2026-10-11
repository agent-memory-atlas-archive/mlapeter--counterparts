/**
 * A MEMORY'S WEIGHT FOLLOWS ITS LATEST FEELING (2026-10-11, Group 2, Mike):
 * the curve reads the strongest feeling of the newest moment any were
 * recorded at — a later feeling-now (a dream's, a reflection's, an awake
 * one) is how the memory sits now. The first is never rewritten, the fast
 * lane's lived peak is still the strongest felt at the time, and a settle
 * over a felt memory asks how it sits now. Hermetic: a fresh temp data dir
 * per test, removed after it.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { emotionalIntensity, stability, strength } from "../src/core/physics/index.js";
import { settle } from "../src/core/reconsolidation.js";
import { Store } from "../src/core/store/index.js";

let dir: string;
let clock = 1_790_000_000_000;
const open: { close(): void }[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-latest-feeling-"));
  clock = 1_790_000_000_000;
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

function setup(): Store {
  const store = Store.open({ dir, now: () => clock });
  open.push(store);
  for (const d of ["2026-09-01", "2026-09-02", "2026-09-03"]) store.advanceClock(d);
  return store;
}

function put(store: Store, body: string): string {
  const day = store.livedDay();
  return store.put({ type: "memory", kind: "person", body, about: "owner", salience: { relevance: 0.6, emotional: 0, predictive: 0.6 }, physics: { birthDay: day, lastUsedDay: day } });
}

describe("the latest feeling", () => {
  test("a later, softer feeling lowers the weight; the first stays recorded; the lived peak is the first", () => {
    const store = setup();
    const id = put(store, "Ada was frustrated that the kite string snapped on the first run.");
    // At the write: her frustration and my regret, one moment.
    store.addFeelings(id, [
      { whose: "owner", core: "angry", emotion: "frustrated", strength: 0.55 },
      { whose: "self", core: "sad", emotion: "regretful", strength: 0.35 },
    ]);
    expect(store.row(id)?.feeling_peak).toBe(0.55);
    const day = store.livedDay();
    const before = store.physicsOf(id);
    // Later, the sting turned to clarity: a reflection records how it sits now.
    clock += 86_400_000;
    store.addFeelings(id, [{ whose: "self", core: "calm", emotion: "clear", strength: 0.15 }], { source: "reflection" });
    const after = store.physicsOf(id);
    expect(store.row(id)?.feeling_peak).toBe(0.15);
    expect(emotionalIntensity(after)).toBe(0.15);
    expect(stability(after)).toBeLessThan(stability(before));
    expect(strength(after, day + 5)).toBeLessThan(strength(before, day + 5));
    // The first is never rewritten.
    expect(store.feelingsFor(id).map((f) => f.strength).sort()).toEqual([0.15, 0.35, 0.55]);
    // The core's fast lane still reads what was felt at the time.
    expect(store.row(id)?.feeling_peak_lived).toBe(0.55);
  });

  test("a later, stronger feeling raises it the same way", () => {
    const store = setup();
    const id = put(store, "Ada mentioned the boat trip in passing.");
    store.addFeelings(id, [{ whose: "owner", core: "calm", emotion: "content", strength: 0.2 }]);
    clock += 86_400_000;
    // A feeling-now (recorded later, awake): how it sits now.
    store.addFeelings(id, [{ whose: "owner", core: "happy", emotion: "excited", strength: 0.7 }], { source: "awake" });
    expect(store.row(id)?.feeling_peak).toBe(0.7);
  });

  test("a settle over a felt memory asks how it sits now; over an unfelt one it does not", () => {
    const store = setup();
    const felt = put(store, "Ada was hurt that the picnic was called off.");
    store.addFeelings(felt, [{ whose: "owner", core: "sad", emotion: "hurt", strength: 0.5 }]);
    const newer = put(store, "Ada and I talked it through: the picnic moved to Sunday instead.");
    const out = settle(store, { holds: newer, over: felt, how: "changed", actor: "session" });
    expect(out.ok && out.note).toContain(`feeling-now on ${felt}`);
    const plain = put(store, "The tea shop opens at nine.");
    const plainer = put(store, "The tea shop opens at eight now.");
    const quiet = settle(store, { holds: plainer, over: plain, how: "changed", actor: "session" });
    expect(quiet.ok && quiet.note).toBeFalsy();
  });
});
