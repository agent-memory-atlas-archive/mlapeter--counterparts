/**
 * The self tab's "How I act" (2026-09-27, a try): the seven trait axes as
 * spectrum bars, each with a firmness-weighted balance and a faint week-ago
 * marker (`views/traits.ts`, `pages/self/sections/traits.js`). Hermetic: fresh
 * temp stores, removed after.
 *
 * The dashboard reads with the wall clock, so the store is written on today's
 * date and a nudge is backdated through `provenance.createdAt`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { TRAIT_AXES } from "../src/core/store/index.js";
import { localDate } from "../src/core/time.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import type { DashboardSource } from "../src/adapters/dashboard/index.js";
import { balanceOf, mindView, traitsView } from "../src/adapters/dashboard/web/views.js";
import type { TraitAxisView, TraitsView } from "../src/adapters/dashboard/web/views.js";
// @ts-expect-error — a plain browser module, no declarations
import { EMPTY, countWords, leanWords, markerAt } from "../src/adapters/dashboard/web/pages/self/sections/traits.js";

const DAY = 86_400_000;
const SECRET = "the thing only he and I know about the lake house";
const dirs: string[] = [];
let at: string;
const ids: Record<string, string> = {};

function withSource<T>(dir: string, fn: (src: DashboardSource) => T): T {
  const dash = Dashboard.open({ dir });
  try {
    return fn(dash.source);
  } finally {
    dash.close();
  }
}

function fresh(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

const axis = (v: TraitsView, id: string): TraitAxisView => {
  const a = v.axes.find((x) => x.id === id);
  if (a === undefined) throw new Error("no axis " + id);
  return a;
};

beforeAll(() => {
  at = fresh("counterparts-self-traits-");
  Counterpart.open({ dir: at, owner: true, identity: { name: "Mike" } }).close();
  const c = Counterpart.open({ dir: at, owner: true });
  try {
    c.store.advanceClock(localDate(Date.now(), c.store.zone()));
    const d = c.store.livedDay();
    const put = (body: string, emotional: number, extra: Record<string, unknown> = {}): string =>
      c.store.put({
        type: "memory",
        kind: "self",
        body,
        about: "me",
        salience: { relevance: 0.6, emotional, predictive: 0.6 },
        physics: { birthDay: d, lastUsedDay: d },
        ...extra,
      });
    ids["firm"] = put("I shipped the risky refactor without asking first.", 0.95);
    ids["faint"] = put("I double-checked the migration before running it.", 0.1);
    ids["core"] = put("I tell him when I think he is wrong.", 0.5, { physics: { birthDay: d, lastUsedDay: d, promotedIdentity: true } });
    ids["secret"] = put("A private conversation, answered honestly.", 0.6, { meta: { confidential: true } });
    ids["old"] = put("I kept to the one task all afternoon.", 0.6);
    ids["new"] = put("I went down the rabbit hole on sqlite page sizes.", 0.6);
    ids["original"] = put("I made a joke about the build breaking again.", 0.6);
    ids["merged"] = put("I made a joke about the build breaking, twice now.", 0.6);

    // careful-bold: one toward each pole, on memories held differently.
    c.store.addTraits(ids["firm"] as string, [{ axis: "careful-bold", toward: "bold", strength: 1, carriedBy: "went ahead" }]);
    c.store.addTraits(ids["faint"] as string, [{ axis: "careful-bold", toward: "careful", strength: 1, carriedBy: "checked twice" }]);
    // agreeable-candid: a core memory, and a confidential one.
    c.store.addTraits(ids["core"] as string, [{ axis: "agreeable-candid", toward: "candid", strength: 0.5, carriedBy: "said so" }]);
    c.store.addTraits(ids["secret"] as string, [{ axis: "agreeable-candid", toward: "agreeable", strength: 0.8, carriedBy: SECRET }]);
    // focused-curious: one recorded ten days ago, one today.
    const tenDaysAgo = Date.now() - 10 * DAY;
    c.store.addTraits(
      ids["old"] as string,
      [{ axis: "focused-curious", toward: "focused", strength: 0.7, carriedBy: "stayed on it" }],
      { provenance: [{ createdAt: tenDaysAgo }] },
    );
    c.store.addTraits(ids["new"] as string, [{ axis: "focused-curious", toward: "curious", strength: 0.7, carriedBy: "wandered off" }]);
    // serious-playful: a merge carries the original's nudge onto the merged
    // memory with its own moment; the original is then superseded.
    c.store.addTraits(ids["original"] as string, [{ axis: "serious-playful", toward: "playful", strength: 0.6, carriedBy: "a joke" }]);
    c.store.addTraits(
      ids["merged"] as string,
      [{ axis: "serious-playful", toward: "playful", strength: 0.6, carriedBy: "a joke" }],
      { provenance: [{ source: "session", createdAt: Date.now() }] },
    );
    c.store.supersedeInto(ids["original"] as string, ids["merged"] as string, "merged");
  } finally {
    c.close();
  }
});

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("the balance, pure", () => {
  const poles = ["careful", "bold"] as const;

  test("signed −1 toward the first pole, +1 toward the second", () => {
    expect(balanceOf([{ toward: "bold", strength: 1, firmness: 1 }], poles)).toBe(1);
    expect(balanceOf([{ toward: "careful", strength: 0.4, firmness: 0.5 }], poles)).toBe(-1);
    expect(balanceOf([{ toward: "careful", strength: 1, firmness: 1 }, { toward: "bold", strength: 1, firmness: 1 }], poles)).toBe(0);
  });

  test("each nudge weighs strength × firmness: a faded memory pulls less", () => {
    // (1·1 − 1·0.25) / (1·1 + 1·0.25) = 0.6
    expect(balanceOf([{ toward: "bold", strength: 1, firmness: 1 }, { toward: "careful", strength: 1, firmness: 0.25 }], poles)).toBe(0.6);
    // (0.5·1 − 1·0.5) / 1 = 0
    expect(balanceOf([{ toward: "bold", strength: 0.5, firmness: 1 }, { toward: "careful", strength: 1, firmness: 0.5 }], poles)).toBe(0);
  });

  test("nothing weighing anything is null (no marker), never NaN or a centred 0", () => {
    expect(balanceOf([], poles)).toBeNull();
    expect(balanceOf([{ toward: "bold", strength: 1, firmness: 0 }], poles)).toBeNull();
    expect(balanceOf([{ toward: "careful", strength: 0, firmness: 1 }], poles)).toBeNull();
    // A pole from another axis is not counted.
    expect(balanceOf([{ toward: "playful", strength: 1, firmness: 1 }], poles)).toBeNull();
  });
});

describe("the view, on a store", () => {
  test("every axis, in TRAIT_AXES order, with its poles and gloss", () => {
    const v = withSource(at, (src) => traitsView(src));
    expect(v.axes.map((a) => a.id)).toEqual(TRAIT_AXES.map((a) => a.id));
    expect(axis(v, "guarded-open").gloss).toBe("about my inner life");
    expect(axis(v, "careful-bold").poles).toEqual(["careful", "bold"]);
  });

  test("careful-bold: weighted by firmness, and the firmer memory wins", () => {
    const v = withSource(at, (src) => traitsView(src));
    const a = axis(v, "careful-bold");
    expect(a.memories).toBe(2);
    expect(a.nudges).toBe(2);
    const firm = a.rows.find((r) => r.id === ids["firm"]);
    const faint = a.rows.find((r) => r.id === ids["faint"]);
    expect(firm?.firmness).toBeGreaterThan(faint?.firmness as number);
    const f1 = firm?.firmness as number;
    const f2 = faint?.firmness as number;
    expect(a.balance).toBeCloseTo((f1 - f2) / (f1 + f2), 2);
    expect(a.balance as number).toBeGreaterThan(0);
    // The weightiest first.
    expect(a.rows[0]?.id).toBe(ids["firm"]);
    expect(a.rows[0]?.carriedBy).toBe("went ahead");
  });

  test("a core memory counts fully", () => {
    const v = withSource(at, (src) => traitsView(src));
    const core = axis(v, "agreeable-candid").rows.find((r) => r.id === ids["core"]);
    expect(core?.firmness).toBe(1);
  });

  test("a confidential memory's nudge moves the bar and its words are withheld", () => {
    const v = withSource(at, (src) => mindView(src));
    const a = axis(v.traits, "agreeable-candid");
    expect(a.memories).toBe(2);
    const secret = a.rows.find((r) => r.id === ids["secret"]);
    expect(secret).toMatchObject({ toward: "agreeable", withheld: true, confidential: true, carriedBy: "" });
    expect(secret?.text).not.toContain("private conversation");
    // It pulls toward "agreeable": the balance is not what the core one alone gives (+1).
    expect(a.balance as number).toBeLessThan(1);
    // Nowhere in the self tab's payload.
    expect(JSON.stringify(v)).not.toContain(SECRET);
  });

  test("a merged original and its merge are counted once", () => {
    const v = withSource(at, (src) => traitsView(src));
    const a = axis(v, "serious-playful");
    expect(a.memories).toBe(1);
    expect(a.nudges).toBe(1);
    expect(a.rows.map((r) => r.id)).toEqual([ids["merged"] as string]);
    expect(a.balance).toBe(1);
  });

  test("an axis with no nudges: no marker, no week-ago marker, no rows", () => {
    const v = withSource(at, (src) => traitsView(src));
    for (const id of ["guarded-open", "following-initiating", "inward-outward"]) {
      expect(axis(v, id)).toMatchObject({ balance: null, weekAgo: null, memories: 0, nudges: 0, rows: [], more: 0 });
    }
    expect(v.memories).toBe(7);
    expect(v.nudges).toBe(7);
  });

  test("a week ago: only the nudges recorded seven or more calendar days back", () => {
    const v = withSource(at, (src) => traitsView(src));
    const a = axis(v, "focused-curious");
    // Now: one each way, on equally held memories.
    expect(a.balance as number).toBeCloseTo(0, 1);
    // Then: only the old one, toward "focused".
    expect(a.weekAgo).toBe(-1);
    // Axes whose nudges are all newer than a week have no faint marker.
    expect(axis(v, "careful-bold").weekAgo).toBeNull();
    expect(axis(v, "serious-playful").weekAgo).toBeNull();
  });

  test("a store no trait was ever written on reads as the calm empty state", () => {
    const dir = fresh("counterparts-self-traits-empty-");
    Counterpart.open({ dir, owner: true }).close();
    const v = withSource(dir, (src) => traitsView(src));
    expect(v.nudges).toBe(0);
    expect(v.memories).toBe(0);
    expect(v.axes.every((a) => a.balance === null && a.weekAgo === null)).toBe(true);
    expect(EMPTY).toBe("No memory carries a trait yet. They're recorded as memories are written.");
  });
});

describe("the bars, as the page draws them", () => {
  test("a balance is a place on the track; null draws nothing", () => {
    expect(markerAt(-1)).toBe(0);
    expect(markerAt(0)).toBe(50);
    expect(markerAt(1)).toBe(100);
    expect(markerAt(0.5)).toBe(75);
    expect(markerAt(null)).toBeNull();
    expect(markerAt(Number.NaN)).toBeNull();
  });

  test("the count and the row in words", () => {
    expect(countWords(0)).toBe("none yet");
    expect(countWords(1)).toBe("1 memory");
    expect(countWords(4)).toBe("4 memories");
    const a = { poles: ["careful", "bold"], balance: 0.7, weekAgo: -0.4, memories: 4 };
    expect(leanWords(a)).toBe("careful to bold: strongly bold (4 memories); a week ago toward careful");
    expect(leanWords({ ...a, balance: 0.05, weekAgo: null })).toBe("careful to bold: about even (4 memories)");
    expect(leanWords({ ...a, balance: null, memories: 0 })).toBe("careful to bold: no memory carries it yet");
  });
});
