/**
 * THE "ARRIVING:" ORDER AS THE WAKE IS HANDED IT (review of #393): plain first,
 * then nearest date, read through `horizonFor` — the lane's own items, their
 * `plainDue` / `past` / `every` marks, and the "+N more" ids in order. Cases the
 * prospective tests do not reach: two plain items due the reading morning beside
 * a quiet one due today, a yearly plain date, and a missed plain date against
 * upcoming ones.
 *
 * Hermetic: a fresh temp data dir per test, removed afterwards.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Store, RECURRING_META } from "../src/core/store/index.js";
import type { PutInput } from "../src/core/store/index.js";
import { CUE_MODE_META, Prospective } from "../src/core/prospective/index.js";
import { horizonFor } from "../src/core/briefing.js";

let dir: string;
const opened: Store[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-r393-"));
});
afterEach(() => {
  for (const s of opened.splice(0)) s.close();
  rmSync(dir, { recursive: true, force: true });
});
function store(): Store {
  const s = Store.open({ dir });
  opened.push(s);
  return s;
}
const SAL = { relevance: 0.7, emotional: 0.7, predictive: 0.7 };
const PLAIN = { [CUE_MODE_META]: "plain" };
function dated(s: Store, date: string, body: string, input: Partial<PutInput> = {}): string {
  return s.put({ type: "memory", kind: "fact", body: `The Portland move lands and the truck is booked. ${body}`, learnedOn: "2026-08-25", salience: SAL, eventDate: date, ...input });
}

test("two plain due the reading morning + one quiet due today: both plain listed, quiet in more", () => {
  const s = store();
  const q = dated(s, "2026-10-13", "quiet today");
  const p1 = dated(s, "2026-10-14", "plain one", { meta: PLAIN });
  const p2 = dated(s, "2026-10-14", "plain two", { meta: PLAIN });
  const p = new Prospective({ store: s });
  const h = horizonFor(p, "2026-10-13", 5);
  expect(h.items.map((i) => i.id).sort()).toEqual([p1, p2].sort());
  expect(h.items.every((i) => i.plainDue === true)).toBe(true);
  expect(h.more).toEqual([q]);
});

test("yearly plain birthday beats two quiet due sooner", () => {
  const s = store();
  const q1 = dated(s, "2026-10-14", "quiet a");
  const q2 = dated(s, "2026-10-14", "quiet b");
  const bday = dated(s, "1990-10-15", "birthday of Sam", { meta: { ...PLAIN, [RECURRING_META]: "yearly" } });
  const h = horizonFor(new Prospective({ store: s }), "2026-10-13", 5);
  expect(h.items[0]?.id).toBe(bday);
  expect(h.items[0]?.due).toBe("2026-10-15");
  expect(h.more.length).toBe(1);
  expect([h.items[1]?.id, ...h.more].sort()).toEqual([q1, q2].sort());
});

test("was-due vs upcoming, mixed tiers; more names the rest in order", () => {
  const s = store();
  const qPast2 = dated(s, "2026-10-11", "quiet past two");
  const qNext1 = dated(s, "2026-10-14", "quiet next one");
  const pPast1 = dated(s, "2026-10-12", "plain past one", { meta: PLAIN });
  const pNext3 = dated(s, "2026-10-16", "plain next three", { meta: PLAIN });
  const h = horizonFor(new Prospective({ store: s }), "2026-10-13", 5);
  expect(h.items.map((i) => i.id)).toEqual([pPast1, pNext3]);
  expect(h.items[0]?.past).toBe(true);
  expect(h.more).toEqual([qNext1, qPast2]);
});
