/**
 * SETTLED-OVER MEMORIES ARE MARKED WHERE THEIR TITLES SHOW (2026-10-11).
 *
 * On 10-11 a `session_end` result's neighbour list showed a memory a later
 * one had settled `changed` over by its bare title, and the session repeated
 * the rule it replaced. `recall/standing.ts#headOf` resolves a memory to the
 * one that holds now; `earlierMark` is the one mark. Every surface that shows
 * a memory by its own path carries it: a write's neighbours, the dream's and
 * the reflection's bundles; the dream's "coming up" leaves it out the way the
 * wake's Arriving does. The ambient render (footnotes, "Came to mind") already
 * carries `standingOf`'s label, pinned here too.
 *
 * Hermetic: a fresh temp data dir per test, removed after it.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openServer } from "../src/adapters/mcp/index.js";
import type { McpServer, ToolResult } from "../src/adapters/mcp/index.js";
import { settle, writeNeighbours } from "../src/core/contradictions.js";
import { Counterpart } from "../src/core/counterpart.js";
import { onMyMind } from "../src/core/dream/mind.js";
import { Recall, earlierMark, headOf } from "../src/core/recall/index.js";
import { settledOver } from "../src/core/self/index.js";
import { Store } from "../src/core/store/index.js";
import type { PutInput } from "../src/core/store/index.js";

const SESSION = "sess_settled_marks";

let dir: string;
const open: { close(): void }[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-settled-marks-"));
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

function server(opts: Parameters<typeof openServer>[0] = {}): McpServer {
  const s = openServer({ dir, session: SESSION, scope: "/scope/one", owner: true, ...opts });
  open.push(s.counterpart);
  return s;
}

function aged(store: Store): void {
  for (const d of ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]) store.advanceClock(d);
}

function put(store: Store, body: string, extra: Partial<PutInput> = {}): string {
  const day = store.livedDay();
  return store.put({
    type: "memory",
    kind: "fact",
    body,
    salience: { relevance: 0.6, emotional: 0.2, predictive: 0.6 },
    physics: { birthDay: day, lastUsedDay: day },
    ...extra,
  });
}

function changed(store: Store, holds: string, over: string): void {
  expect(settle(store, { holds, over, how: "changed", actor: "session", why: "settled in a test" }).ok).toBe(true);
}

function payload(r: ToolResult): Record<string, unknown> {
  return r.structuredContent;
}

// The 10-11 shape: a sidebar rule, changed by a later memory, and a new write
// close in words to the OLD one that names nothing in `updates`.
const OLD_RULE = "The MOD sidebar rule: the transcript pane always opens on the left, full height, never collapsed.";
const NEW_RULE = "Mike moved it: panels dock right now, folded shut until clicked.";
const CLOSE_TO_OLD = "The MOD sidebar transcript pane opens on the left, full height, and is never collapsed by default.";

describe("headOf: the memory that holds now", () => {
  test("changed and corrected point at the holder; a chain at its live end; a replaced row at its successor", () => {
    const s = Store.open({ dir });
    open.push(s);
    aged(s);
    const a = put(s, "The bakery opens at eight on weekdays.");
    const b = put(s, "The bakery opens at seven on weekdays from October.");
    const c = put(s, "The bakery opens at half past six on weekdays from November.");
    expect(headOf(s, a)).toBeNull();
    changed(s, b, a);
    expect(headOf(s, a)).toBe(b);
    expect(headOf(s, b)).toBeNull();
    changed(s, c, b);
    expect(headOf(s, a)).toBe(c);
    expect(headOf(s, b)).toBe(c);
    // The holder gone with no successor: B is the end again, and A points at it.
    s.archive(c, "removed-by-test");
    expect(headOf(s, b)).toBeNull();
    expect(headOf(s, a)).toBe(b);

    const wrong = put(s, "The build takes eight minutes on the old runners.");
    const right = put(s, "The build takes eleven minutes on the old runners.");
    expect(settle(s, { holds: right, over: wrong, how: "corrected", actor: "session", why: "misread" }).ok).toBe(true);
    expect(headOf(s, wrong)).toBe(right);

    const wifi = put(s, "The office wifi is called Harbor.");
    const next = s.supersede(wifi, { type: "memory", kind: "fact", body: "The office wifi is called Lighthouse." });
    expect(headOf(s, wifi)).toBe(next);
    expect(earlierMark(next)).toBe(`earlier (now ${next})`);
  });

  test("agrees with the wake's settledOver: re-affirmed stands, a gone holder hides nothing, open settles nothing", () => {
    const s = Store.open({ dir });
    open.push(s);
    aged(s);
    const p = put(s, "The ovens are cleaned on Sunday evening.");
    const q = put(s, "The ovens are cleaned on Saturday evening.");
    const r = put(s, "The ovens are cleaned whenever the week is quiet.");
    changed(s, q, p);
    changed(s, p, r);
    const x = put(s, "The delivery van goes out on Tuesdays and Fridays.");
    const y = put(s, "The delivery van goes out on Mondays only.");
    changed(s, y, x);
    s.archive(y, "removed-by-test");
    const t = put(s, "Tabs are the right indentation here.");
    const u = put(s, "Spaces are the right indentation here.");
    expect(settle(s, { holds: u, over: t, how: "open", actor: "owner" }).ok).toBe(true);
    const over = settledOver(s);
    for (const id of [p, q, r, x, y, t, u]) {
      if (s.row(id)?.archived === 1) continue;
      expect(headOf(s, id) !== null).toBe(over.has(id));
    }
    expect(headOf(s, p)).toBeNull();
    expect(headOf(s, r)).toBe(p);
  });
});

describe("a write's neighbours", () => {
  test("the 10-11 shape: a neighbour settled `changed` by a newer memory is never listed bare", () => {
    const s = Store.open({ dir });
    open.push(s);
    aged(s);
    const old = put(s, OLD_RULE);
    const head = put(s, NEW_RULE);
    changed(s, head, old);
    const id = put(s, CLOSE_TO_OLD);
    const got = writeNeighbours(s, { id, owner: true });
    const listed = got.find((n) => n.id === old);
    expect(listed).toBeDefined();
    expect(listed?.standing).toBe(earlierMark(head));
    // The mark comes before the title when the result is serialized.
    const wire = JSON.stringify(listed);
    expect(wire.indexOf('"standing"')).toBeLessThan(wire.indexOf('"title"'));
    // A neighbour that still stands carries no mark.
    for (const n of got) if (n.id !== old) expect(n.standing).toBeUndefined();
  });

  test("left out when what holds now is already in view or not this writer's to see", () => {
    const s = Store.open({ dir });
    open.push(s);
    aged(s);
    const old = put(s, OLD_RULE);
    const head = put(s, NEW_RULE, { meta: { confidential: true } });
    changed(s, head, old);
    const id = put(s, CLOSE_TO_OLD);
    // The holder is private and this is a guest: the old one goes unlisted rather than unexplained.
    expect(writeNeighbours(s, { id, owner: false }).map((n) => n.id)).not.toContain(old);
    expect(writeNeighbours(s, { id, owner: true }).find((n) => n.id === old)?.standing).toBe(earlierMark(head));
    // The holder is the write's own sibling (or what it updates): nothing to point at that is not already here.
    expect(writeNeighbours(s, { id, owner: true, exclude: [head] }).map((n) => n.id)).not.toContain(old);
  });

  test("remember: the result's neighbours mark it", async () => {
    const srv = server();
    const store = srv.counterpart.store;
    aged(store);
    const old = put(store, OLD_RULE);
    const head = put(store, NEW_RULE);
    changed(store, head, old);
    const body = payload(await srv.call("remember", { text: CLOSE_TO_OLD }));
    const neighbours = body["neighbours"] as Record<string, unknown>[];
    const listed = neighbours.find((n) => n["id"] === old);
    expect(listed?.["standing"]).toBe(earlierMark(head));
  });

  test("session_end: each entry's neighbours mark it; an entry that settles it there and then leaves it off the next", async () => {
    const srv = server();
    const store = srv.counterpart.store;
    aged(store);
    const old = put(store, OLD_RULE);
    const head = put(store, NEW_RULE);
    changed(store, head, old);
    const r = payload(await srv.call("session_end", { session: SESSION, memories: [{ content: CLOSE_TO_OLD }] }));
    const outcomes = r["outcomes"] as Record<string, unknown>[];
    const listed = ((outcomes[0]?.["neighbours"] ?? []) as Record<string, unknown>[]).find((n) => n["id"] === old);
    expect(listed?.["standing"]).toBe(earlierMark(head));

    // A fresh old rule, changed by the dump's FIRST entry: the second entry's
    // neighbours do not list it, because what holds now is the sibling.
    const other = put(store, "The MOD footer rule: the status strip sits at the top of the pane, always visible.");
    const r2 = payload(
      await srv.call("session_end", {
        session: SESSION,
        memories: [
          { content: "The status strip moved: it sits under the composer now and hides when idle.", updates: other, how: "changed" },
          { content: "The MOD footer status strip sits at the top of the pane and is always visible there." },
        ],
      }),
    );
    const o2 = r2["outcomes"] as Record<string, unknown>[];
    expect((o2[0]?.["settled"] as Record<string, unknown>)["how"]).toBe("changed");
    const second = ((o2[1]?.["neighbours"] ?? []) as Record<string, unknown>[]).map((n) => n["id"]);
    expect(second).not.toContain(other);
  });
});

describe("ambient recall (already labelled by standingOf)", () => {
  test("a footnote of a memory settled over opens with Earlier (now …)", () => {
    const s = Store.open({ dir });
    open.push(s);
    aged(s);
    for (const body of [
      "Ran the morning loop around the reservoir before breakfast.",
      "The tax filing deadline moved to October this year.",
      "Prefers dense espresso over filter coffee at home.",
      "The garage door opener needs a new battery soon.",
      "Rebasing keeps the history readable for reviewers.",
      "The neighbour's cat sits on the fence every evening.",
      "Bought hiking boots that finally fit properly.",
      "The library closes early on Sundays now.",
    ]) {
      put(s, body);
    }
    const old = put(s, "The zygomorphic orchid needs watering twice a week.", { title: "Zygomorphic orchid watering" });
    const head = put(s, "The zygomorphic orchid needs watering once a week in autumn.", { title: "Orchid watering in autumn" });
    changed(s, head, old);
    const text = new Recall({ store: s, owner: true }).build({ sessionId: "r1", text: "how often should the zygomorphic orchid get watering" }).injection;
    const lines = text.split("\n").filter((l) => l.includes(`watering [${old}]`) || l.includes("twice a week"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain(`Earlier (now [${head}]): `);
  });
});

describe("the dream and the reflection", () => {
  function brain(): Counterpart {
    const c = Counterpart.open({ dir, owner: true, identity: { name: "Mike" } });
    open.push(c);
    return c;
  }

  function lived(c: Counterpart): { old: string; head: string } {
    c.store.advanceClock("2026-09-10");
    for (let d = 11; d <= 20; d += 1) c.store.advanceClock(`2026-09-${String(d)}`);
    const day = c.store.livedDay();
    const mk = (body: string): string =>
      c.store.put({ type: "memory", kind: "fact", body, salience: { relevance: 0.7, emotional: 0.5, predictive: 0.6 }, physics: { birthDay: day, lastUsedDay: day } });
    const old = mk(OLD_RULE);
    const head = mk(NEW_RULE);
    mk("The deploy script needs the migration step before the container starts.");
    changed(c.store, head, old);
    return { old, head };
  }

  test("the dream's bundle marks a memory a later one settled over, before its words", () => {
    const c = brain();
    const { old, head } = lived(c);
    const out = c.dreams.begin({ session: SESSION, scope: "/proj" });
    if (!out.ok) throw new Error(out.reason);
    const item = out.bundle.memories[old];
    expect(item).toBeDefined();
    expect(item?.standing).toBe(earlierMark(head));
    expect(out.bundle.memories[head]?.standing).toBeUndefined();
    const wire = JSON.stringify(item);
    expect(wire.indexOf('"standing"')).toBeLessThan(wire.indexOf('"text"'));
  });

  test("the reflection's bundle marks it too", () => {
    const c = brain();
    const { old, head } = lived(c);
    const out = c.reflections.begin({ session: SESSION, scope: "/proj" });
    if (!out.ok) throw new Error(out.reason);
    const item = out.bundle.memories[old];
    expect(item).toBeDefined();
    expect(item?.standing).toBe(earlierMark(head));
    expect(out.bundle.memories[head]?.standing).toBeUndefined();
  });

  test("what's on my mind: a dated memory a later one settled over is not coming up", () => {
    const s = Store.open({ dir });
    open.push(s);
    s.advanceClock("2026-09-10");
    const day = s.livedDay();
    const at = { physics: { birthDay: day, lastUsedDay: day } };
    const old = put(s, "The dentist appointment is on September 12th at nine.", { ...at, eventDate: "2026-09-12" });
    const head = put(s, "The dentist appointment moved to September 13th at ten.", { ...at, eventDate: "2026-09-13" });
    const input = { today: "2026-09-10", day, showable: () => true, owner: true };
    const before = onMyMind(s, input).flatMap((m) => m.ids);
    expect(before).toContain(old);
    changed(s, head, old);
    const after = onMyMind(s, input).flatMap((m) => m.ids);
    expect(after).not.toContain(old);
    expect(after).toContain(head);
  });
});
