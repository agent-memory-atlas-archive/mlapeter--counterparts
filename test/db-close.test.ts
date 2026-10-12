/**
 * `Db.close()` really closes (2026-10-11, after #434). bun:sqlite's `close()`
 * leaves a connection open until garbage collection while any of its prepared
 * statements is still alive, and `db.ts` used to drop its statement cache
 * without finalizing it. What must hold now:
 *
 *   - after `close()`, the file is free at once: another connection can take it
 *     out of WAL with no wait, which SQLite refuses while any other connection
 *     is open ("database is locked"; measured against the old close);
 *   - that holds for statements run once, statements a caller kept, and
 *     statements dropped from the cache at its cap or by a table change;
 *   - a kept statement survives its cache entry being dropped;
 *   - anything run on a closed handle throws `DB_CLOSED`, and a second close
 *     does nothing.
 *
 * Hermetic: a fresh temp dir per test, removed after.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDb, type Db } from "../src/core/store/db.js";
import { isStoreError } from "../src/core/store/errors.js";
import { Store } from "../src/core/store/index.js";
import { paths } from "../src/core/store/paths.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-db-close-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * True when no other connection has `path` open: switching a WAL file to
 * DELETE needs every other connection gone, and with a zero busy timeout it
 * answers at once either way.
 */
function nobodyElseHasItOpen(path: string): boolean {
  const probe = openDb(path);
  try {
    probe.exec("PRAGMA busy_timeout = 0");
    try {
      return probe.get<{ journal_mode: string }>("PRAGMA journal_mode = DELETE")?.journal_mode === "delete";
    } catch {
      return false;
    }
  } finally {
    probe.close();
  }
}

function walDb(name: string): Db {
  const db = openDb(join(dir, name), { wal: true });
  db.exec("CREATE TABLE t (k INTEGER PRIMARY KEY, v TEXT)");
  for (let i = 1; i <= 5; i += 1) db.run("INSERT INTO t (k, v) VALUES (?, ?)", i, `v${String(i)}`);
  return db;
}

describe("close() releases the file at once", () => {
  test("the probe can tell: while a connection is open, the file cannot leave WAL", () => {
    const db = walDb("open.sqlite");
    expect(nobodyElseHasItOpen(db.path)).toBe(false);
    db.close();
    expect(nobodyElseHasItOpen(db.path)).toBe(true);
  });

  test("after statements run once, and one a caller kept", () => {
    const db = walDb("kept.sqlite");
    db.get("SELECT v FROM t WHERE k = ?", 1);
    db.all("SELECT v FROM t ORDER BY k");
    const kept = db.prepare("SELECT COUNT(*) AS n FROM t");
    expect(kept.get<{ n: number }>()?.n).toBe(5);
    db.close();
    expect(nobodyElseHasItOpen(db.path)).toBe(true);
  });

  test("after statements dropped at the cache's cap", () => {
    const db = walDb("cap.sqlite");
    for (let w = 1; w <= 1200; w += 1) {
      expect(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM t WHERE ${String(w)} = ${String(w)}`)?.n).toBe(5);
    }
    db.close();
    expect(nobodyElseHasItOpen(db.path)).toBe(true);
  });

  test("after statements dropped by a table change", () => {
    const db = walDb("alter.sqlite");
    db.all("SELECT * FROM t");
    db.exec("ALTER TABLE t ADD COLUMN w TEXT");
    db.all("SELECT * FROM t");
    db.run("ALTER TABLE t ADD COLUMN x TEXT");
    db.all("SELECT * FROM t");
    db.close();
    expect(nobodyElseHasItOpen(db.path)).toBe(true);
  });

  test("a Store that wrote, then closed, leaves both of its boxes free", () => {
    const store = Store.open({ dir });
    store.put({ type: "memory", kind: "fact", body: "the kettle is on the left" });
    expect(store.list().length).toBe(1);
    store.close();
    expect(nobodyElseHasItOpen(paths.operational(dir))).toBe(true);
    expect(nobodyElseHasItOpen(paths.cache(dir))).toBe(true);
  });
});

describe("a kept statement outlives its cache entry", () => {
  test("past the cap, and past a table change, it still answers", () => {
    const db = walDb("survive.sqlite");
    const count = db.prepare("SELECT COUNT(*) AS n FROM t");
    const insert = db.prepare("INSERT INTO t (v) VALUES (?)");
    for (let w = 1; w <= 600; w += 1) db.get(`SELECT ${String(w)} AS w`);
    insert.run("after the cap");
    expect(count.get<{ n: number }>()?.n).toBe(6);
    const all = db.prepare("SELECT * FROM t WHERE k = 1");
    expect(all.all()).toEqual([{ k: 1, v: "v1" }]);
    db.exec("ALTER TABLE t ADD COLUMN w TEXT DEFAULT 'dub'");
    // Prepared again against the table as it is now: the new column, by name.
    expect(all.all()).toEqual([{ k: 1, v: "v1", w: "dub" }]);
    expect(count.get<{ n: number }>()?.n).toBe(6);
    db.close();
  });
});

describe("a closed handle refuses, loudly", () => {
  test("every entry point throws DB_CLOSED; a second close does nothing", () => {
    const db = walDb("refuse.sqlite");
    const kept = db.prepare("SELECT COUNT(*) AS n FROM t");
    kept.get();
    db.close();
    const calls: [string, () => unknown][] = [
      ["exec", () => db.exec("SELECT 1")],
      ["prepare", () => db.prepare("SELECT 1")],
      ["get", () => db.get("SELECT 1")],
      ["all", () => db.all("SELECT 1")],
      ["run", () => db.run("INSERT INTO t (v) VALUES ('late')")],
      ["transaction", () => db.transaction(() => 1)],
      ["kept.get", () => kept.get()],
      ["kept.all", () => kept.all()],
      ["kept.run", () => kept.run()],
    ];
    for (const [name, call] of calls) {
      let caught: unknown;
      try {
        call();
      } catch (err) {
        caught = err;
      }
      expect({ name, closed: isStoreError(caught, "DB_CLOSED") }).toEqual({ name, closed: true });
    }
    expect(() => db.close()).not.toThrow();
    // Nothing reopened it behind the refusal.
    expect(nobodyElseHasItOpen(db.path)).toBe(true);
  });
});
