/**
 * Schema v8 (2026-09-26, dreaming + consolidation): the returns aggregate and
 * history, what the wake's hints lane showed, dreams and their changes, the
 * dream ask, the core's history — and the upgrade from a REAL v7 file (the
 * 0.3.2 / 0.3.3 shape), which must lose nothing and move nothing down.
 *
 * Hermetic: a fresh temp data dir per test, removed after.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { band, TUNABLES as PHYSICS } from "../src/core/physics/index.js";
import type { MemoryPhysics } from "../src/core/physics/index.js";
import { V8_CENSUS_KEY, projectedPruneDay, runCycle } from "../src/core/sleep/index.js";
import type { UpgradeCensus } from "../src/core/sleep/index.js";
import {
  SCHEMA_VERSION,
  Store,
  V8_UPGRADE_KEY,
  isStoreError,
  paths,
  rowToPhysics,
} from "../src/core/store/index.js";
import type { FeelingPeak, MemoryRow, StoreOptions } from "../src/core/store/index.js";
import { chaseRemoved } from "../src/core/store/owner-op-seam.js";
import { stripToV7 } from "./v7-fixture.js";

let root: string;
let dir: string;
const open: Store[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "counterparts-v8-"));
  dir = join(root, "store");
});

afterEach(() => {
  for (const s of open.splice(0)) {
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(root, { recursive: true, force: true });
});

function store(opts: Omit<StoreOptions, "dir"> = {}): Store {
  const s = Store.open({ dir, ...opts });
  open.push(s);
  return s;
}

function code(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return isStoreError(err) ? err.code : String(err);
  }
}

function schemaOf(path: string): string[] {
  const d = new Database(path, { readonly: true });
  const out: string[] = [];
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[];
  for (const { name } of tables) {
    if (name === "sqlite_sequence") continue;
    const cols = d.prepare(`PRAGMA table_info(${name})`).all() as {
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }[];
    for (const c of cols) out.push(`${name}.${c.name} ${c.type} ${c.notnull} ${String(c.dflt_value)} ${c.pk}`);
    const idx = d.prepare(`PRAGMA index_list(${name})`).all() as { name: string }[];
    for (const i of idx) out.push(`${name} index ${i.name}`);
  }
  d.close();
  return out.sort();
}

/** Every memory row of a (possibly v7) file, as physics reads it, feelings joined. */
function rawPhysics(path: string): Map<string, MemoryPhysics> {
  const d = new Database(path, { readonly: true });
  const rows = d
    .prepare(
      `SELECT m.*, (SELECT MAX(f.strength) FROM feelings f WHERE f.memory_id = m.id) AS feeling_peak
         FROM memories m WHERE m.archived = 0 AND m.type != 'episode'`,
    )
    .all() as (MemoryRow & FeelingPeak)[];
  d.close();
  return new Map(rows.map((r) => [r.id, rowToPhysics(r)]));
}

/** A varied v7 store: consolidated and not, felt and not, used and not, identity, protected. */
function seedV7(): Record<string, string> {
  const s = Store.open({ dir });
  s.advanceClock("2026-09-01");
  const ids: Record<string, string> = {};
  const put = (name: string, over: Parameters<Store["put"]>[0]): void => {
    ids[name] = s.put(over);
  };
  put("consolidatedFact", {
    type: "memory",
    kind: "fact",
    body: "A fact that consolidated under the old rule.",
    salience: { relevance: 0.6, emotional: 0.4, predictive: 0.6, claimed: 0.55 },
    physics: { birthDay: 0, lastUsedDay: 0, consolidated: true },
  });
  put("eligibleUnmarked", {
    type: "memory",
    kind: "fact",
    body: "Semantic, a day old, and not yet marked: the next sleep would have marked it.",
    salience: { relevance: 0.7, emotional: 0.5, predictive: 0.7 },
    physics: { birthDay: 0, lastUsedDay: 0 },
  });
  put("felt", {
    type: "memory",
    kind: "person",
    body: "A conversation that carried strong feeling.",
    salience: { relevance: 0.5, emotional: 0.3, predictive: 0.4 },
    physics: { birthDay: 0, lastUsedDay: 0 },
  });
  put("used", {
    type: "memory",
    kind: "skill",
    body: "A technique used on several days.",
    salience: { relevance: 0.3, emotional: 0, predictive: 0.3 },
    physics: { birthDay: 0, lastUsedDay: 0, uses: 4, reinforcedDays: 4 },
  });
  put("faint", {
    type: "memory",
    kind: "fact",
    body: "A faint note nobody came back to.",
    salience: { relevance: 0.1, emotional: 0, predictive: 0.1 },
    physics: { birthDay: 0, lastUsedDay: 0 },
  });
  put("identity", {
    type: "memory",
    kind: "self",
    body: "I work best when I say what I do not know.",
    salience: { relevance: 0.9, emotional: 0.6, predictive: 0.9 },
    physics: { birthDay: 0, lastUsedDay: 0, consolidated: true, promotedIdentity: true },
    band: "identity",
  });
  put("protected", {
    type: "memory",
    kind: "fact",
    body: "Something the owner protected.",
    salience: { relevance: 0.2, emotional: 0, predictive: 0.2 },
    physics: { birthDay: 0, lastUsedDay: 0, protected: true },
  });
  s.addFeelings(ids["felt"] as string, [
    { whose: "owner", core: "happy", emotion: "grateful", strength: 0.9, carriedBy: "what he said" },
  ]);
  s.advanceClock("2026-09-02");
  s.close();
  stripToV7(dir);
  return ids;
}

describe("the v7 → v8 migration", () => {
  test("a real v7 file: copied first, migrated in place, rows intact, schema identical to a fresh v8", () => {
    const ids = seedV7();
    const snaps = join(root, "snaps");
    // An instrument meets a v7 store as not-yet-migrated: v8 is its read floor.
    expect(code(() => store({ observer: true }))).toBe("STORE_UNINITIALIZED");
    open.splice(0);

    const s = store({ snapshotsDir: snaps });
    expect(SCHEMA_VERSION).toBe(8);
    expect(s.getMeta("schemaVersion")).toBe("8");
    expect(s.migration?.from).toBe("7");
    expect(s.migration?.to).toBe(8);
    expect(existsSync(snaps)).toBe(true);
    expect(readdirSync(snaps).length).toBe(1);

    // Nothing lost: every row reads back with its words and its physics.
    for (const id of Object.values(ids)) expect(s.readProse(id).body.length).toBeGreaterThan(0);
    expect(s.physicsOf(ids["consolidatedFact"] as string).consolidated).toBe(true);
    expect(s.physicsOf(ids["identity"] as string).promotedIdentity).toBe(true);
    expect(s.physicsOf(ids["used"] as string).uses).toBe(4);
    expect(s.feelingsFor(ids["felt"] as string).length).toBe(1);

    // Every row the upgrade found is legacy, with no returns yet.
    for (const id of Object.values(ids)) {
      const p = s.physicsOf(id);
      expect(p.legacy).toBe(true);
      expect(p.returns).toBe(0);
      expect(p.returnDays).toBe(0);
    }
    const upgrade = JSON.parse(s.getMeta(V8_UPGRADE_KEY) ?? "{}") as Record<string, number | string>;
    expect(upgrade).toMatchObject({ from: "7", rows: Object.keys(ids).length, consolidated: 2, identity: 1 });

    // A fresh v8 and a migrated v8 are the same schema.
    s.close();
    open.splice(0);
    const freshDir = join(root, "fresh");
    Store.open({ dir: freshDir }).close();
    expect(schemaOf(paths.operational(dir))).toEqual(schemaOf(paths.operational(freshDir)));
  });

  test("no memory changes band or prunes sooner at the upgrade — measured row by row", () => {
    seedV7();
    const before = rawPhysics(paths.operational(dir));
    const s = store({ snapshotsDir: join(root, "snaps") });
    const day = s.livedDay();
    const table: string[] = [];
    for (const [id, old] of before) {
      const now = s.physicsOf(id);
      expect({ id, band: band(now, day) }).toEqual({ id, band: band(old, day) });
      expect({ id, prune: projectedPruneDay(now) }).toEqual({ id, prune: projectedPruneDay(old) });
      table.push(`${now.kind} ${band(old, day)}->${band(now, day)} prune ${projectedPruneDay(old)}->${projectedPruneDay(now)}`);
    }
    expect(table.length).toBe(before.size);
  });

  test("the first sleep after the upgrade records the census, and it reads zero down", () => {
    const ids = seedV7();
    const s = store({ snapshotsDir: join(root, "snaps") });
    runCycle({ store: s, date: "2026-09-03" });
    const census = JSON.parse(s.getMeta(V8_CENSUS_KEY) ?? "null") as UpgradeCensus | null;
    expect(census).not.toBeNull();
    expect(census).toMatchObject({ bandDown: 0, weaker: 0, pruneSooner: 0 });
    expect(census?.checked).toBe(Object.keys(ids).length);
    expect(s.eventLog({ name: "physics.upgrade.census", limit: 5 }).length).toBe(1);
    // Once: a second cycle does not measure again.
    runCycle({ store: s, date: "2026-09-04" });
    expect(s.eventLog({ name: "physics.upgrade.census", limit: 5 }).length).toBe(1);
  });

  test("the legacy consolidation path stays open for old rows and closed for new ones", () => {
    const ids = seedV7();
    const s = store({ snapshotsDir: join(root, "snaps") });
    const fresh = s.put({
      type: "memory",
      kind: "fact",
      body: "Made after the upgrade, just as strong.",
      salience: { relevance: 0.7, emotional: 0.5, predictive: 0.7 },
      physics: { birthDay: s.livedDay(), lastUsedDay: s.livedDay() },
    });
    runCycle({ store: s, date: "2026-09-04", cadence: { consolidate: 1 } });
    // The old row the next sleep would have marked IS marked — nothing waits
    // longer for its bonus than it would have.
    expect(s.physicsOf(ids["eligibleUnmarked"] as string).consolidated).toBe(true);
    // The new one is refused `not-legacy`: returns are its road.
    expect(s.physicsOf(fresh).consolidated).toBe(false);
    expect(s.physicsOf(fresh).legacy).toBe(false);
  });
});

describe("returns — the history and the aggregate", () => {
  test("a spaced referenced use is a return; the aggregate is recomputed from the table", () => {
    const s = store();
    const id = s.put({ type: "memory", kind: "fact", body: "x", physics: { birthDay: 0, lastUsedDay: 0 } });
    const a = s.reinforce(id, 7, "referenced");
    expect(a.ret).toMatchObject({ counted: true, gap: 7 });
    expect(a.ret?.weight).toBeCloseTo(1 - Math.exp(-1), 10);
    const b = s.reinforce(id, 8, "referenced");
    expect(b.ret?.weight).toBeCloseTo(1 - Math.exp(-1 / 7), 10); // close together: counts less
    const p = s.physicsOf(id);
    expect(p.uses).toBe(2); // never against: the use credits in full
    expect(p.returnDays).toBe(2);
    expect(p.firstReturnDay).toBe(7);
    expect(p.lastReturnDay).toBe(8);
    expect(p.returns).toBeCloseTo((a.ret?.weight ?? 0) + (b.ret?.weight ?? 0), 10);
    expect(s.returnsOf(id).length).toBe(2);
    // A surfaced-but-unused credit is not a return.
    expect(s.reinforce(id, 12, "surfaced").ret).toMatchObject({ counted: false, reason: "not-referenced" });
  });

  test("a dream replay is half a return, never a use, once a day, and undone with its dream", () => {
    const s = store();
    const id = s.put({ type: "memory", kind: "fact", body: "x", physics: { birthDay: 0, lastUsedDay: 0 } });
    s.openDream({ id: "drm_a", day: 21 });
    const r = s.replayReturn(id, 21, "drm_a");
    expect(r.counted).toBe(true);
    expect(r.weight).toBeCloseTo(PHYSICS.DREAM_RETURN_WEIGHT * (1 - Math.exp(-3)), 10);
    expect(s.replayReturn(id, 21, "drm_a")).toMatchObject({ counted: false, reason: "already-returned-today" });
    const p = s.physicsOf(id);
    expect(p.uses).toBe(0);
    expect(p.returnDays).toBe(0); // the lanes do not count a dream
    expect(p.lastDreamDay).toBe(21);
    expect(s.retractDreamReturns("drm_a")).toBe(1);
    expect(s.physicsOf(id)).toMatchObject({ returns: 0, lastDreamDay: null });
  });

  test("the owner's removal takes the return history, the display rows and the core history with it", () => {
    const s = store();
    const id = s.put({ type: "memory", kind: "self", body: "x", physics: { birthDay: 0, lastUsedDay: 0 } });
    s.reinforce(id, 5, "referenced");
    s.recordHintDisplay(6, [{ id, load: 1 }]);
    s.appendCoreEvent({ memoryId: id, action: "nominated", day: 6, reason: "it keeps coming up" });
    s.appendRemovalRecord({ memoryId: id, stage: "requested", actor: "owner", reason: "test" });
    s.appendRemovalRecord({ memoryId: id, stage: "dark", actor: "owner", reason: "test" });
    chaseRemoved(s, id);
    const db = new Database(paths.operational(dir), { readonly: true });
    const count = (sql: string): number => (db.prepare(sql).get(id) as { n: number }).n;
    expect(count("SELECT COUNT(*) AS n FROM returns WHERE memory_id = ?")).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM wake_display WHERE memory_id = ?")).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM core_events WHERE memory_id = ?")).toBe(0);
    db.close();
  });
});
