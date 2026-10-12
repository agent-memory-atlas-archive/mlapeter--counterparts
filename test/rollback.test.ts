/**
 * `counterparts rollback` (`adapters/cli/rollback.ts`) and the hold it leaves
 * (`store/rollback-hold.ts`).
 *
 * The upgrade is simulated the way `pre-migration.test.ts` does it: a store
 * written by this build has its stamp lowered one version by hand, and the
 * next writer open runs the real migrate-at-open transaction, copy first.
 *
 * Hermetic: a fresh temp root per test, the store one level down as
 * `~/.counterparts/store` is, the snapshots folder beside it; removed in
 * `afterEach`. The process table is injected, never read.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { EXIT, run } from "../src/adapters/cli/index.js";
import { planRollback, sha256File } from "../src/adapters/cli/rollback.js";
import type { Io } from "../src/adapters/cli/index.js";
import type { ProcessLister } from "../src/adapters/cli/wire.js";
import { describeFault } from "../src/adapters/claude-code/standdown.js";
import {
  DATABASE_FILE,
  SCHEMA_VERSION,
  Store,
  assertLayoutClassified,
  isStoreError,
  paths,
  readRollbackHold,
  rollbackHoldPath,
  writeRollbackHold,
} from "../src/core/store/index.js";

const OLD = String(SCHEMA_VERSION - 1);
const NEW = String(SCHEMA_VERSION);

let root: string;
let dir: string;
let snaps: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-rollback-")));
  dir = join(root, "store");
  snaps = join(root, "snapshots");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const NOTHING_RUNNING: ProcessLister = () => ({ looked: true, processes: [] });

interface Console_ {
  io: Io;
  out: string[];
  err: string[];
}

function consoleWith(answers: readonly string[] | null = null): Console_ {
  const out: string[] = [];
  const err: string[] = [];
  const queue = answers === null ? [] : [...answers];
  const io: Io = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...(answers === null ? {} : { prompt: async (): Promise<string> => queue.shift() ?? "" }),
  };
  return { io, out, err };
}

async function cli(
  args: readonly string[],
  opts: { answers?: readonly string[] | null; processes?: ProcessLister } = {},
): Promise<{ code: number; out: string; err: string }> {
  const c = consoleWith(opts.answers ?? null);
  const code = await run([...args], {
    io: c.io,
    env: { COUNTERPARTS_REQUIRE_EXPLICIT_DIR: "1" },
    home: root,
    processes: opts.processes ?? NOTHING_RUNNING,
  });
  return { code, out: c.out.join("\n"), err: c.err.join("\n") };
}

function stampOf(path: string): string | undefined {
  const db = new Database(path, { readonly: true });
  try {
    return db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'schemaVersion'").get()?.value;
  } finally {
    db.close();
  }
}

function idsIn(path: string): string[] {
  const db = new Database(path, { readonly: true });
  try {
    return db
      .query<{ id: string }, []>("SELECT id FROM memories WHERE type = 'memory' ORDER BY id")
      .all()
      .map((r) => r.id);
  } finally {
    db.close();
  }
}

/**
 * A database that has MOVED is read in a child process, as the older build or
 * the next session would read it. In this process the store's own handles
 * linger after `close()` (`db.ts`: statements are never finalized, so the
 * driver defers the real close), and SQLite then refuses the moved file with
 * SQLITE_IOERR_VNODE — a fact about one process holding a file across its
 * rename, not about the file.
 */
const STORE_INDEX = new URL("../src/core/store/index.ts", import.meta.url).pathname;

function probe(path: string): { stamp: string; ids: string[] } {
  const script = join(root, "probe.ts");
  writeFileSync(
    script,
    `import { Database } from "bun:sqlite";\n` +
      `const db = new Database(process.argv[2], { readonly: true });\n` +
      `const stamp = db.query("SELECT value FROM meta WHERE key = 'schemaVersion'").get().value;\n` +
      `const ids = db.query("SELECT id FROM memories WHERE type = 'memory' ORDER BY id").all().map((r) => r.id);\n` +
      `console.log(JSON.stringify({ stamp, ids }));\n`,
  );
  const r = Bun.spawnSync([process.execPath, script, path], { env: { ...process.env } });
  expect(r.stderr.toString()).toBe("");
  return JSON.parse(r.stdout.toString()) as { stamp: string; ids: string[] };
}

function openInChild(): { ok: boolean; code: string | null; migrated: boolean } {
  const script = join(root, "open.ts");
  writeFileSync(
    script,
    `import { Store } from ${JSON.stringify(STORE_INDEX)};\n` +
      `try { const s = Store.open({ dir: process.argv[2] }); console.log(JSON.stringify({ ok: true, code: null, migrated: s.migration !== null })); s.close(); }\n` +
      `catch (e) { console.log(JSON.stringify({ ok: false, code: e.code ?? String(e), migrated: false })); }\n`,
  );
  const r = Bun.spawnSync([process.execPath, script, dir], { env: { ...process.env } });
  return JSON.parse(r.stdout.toString()) as { ok: boolean; code: string | null; migrated: boolean };
}

function cacheFiles(): string[] {
  try {
    return readdirSync(join(dir, "cache")).filter((n) => n.startsWith("cache.sqlite"));
  } catch {
    return [];
  }
}

function preMigrationCopies(): string[] {
  return readdirSync(snaps).filter((n) => n.includes("-pre-migration-"));
}

/**
 * A store on the older schema with two memories, upgraded by this build (which
 * takes its copy), with one more memory written after the upgrade. Returns the
 * ids: `before` are in the copy, `after` is not.
 */
function upgradedStore(): { before: string[]; after: string } {
  const s = Store.open({ dir });
  const before = [
    s.put({ type: "memory", kind: "fact", title: "One", body: "Written before the upgrade." }),
    s.put({ type: "memory", kind: "fact", title: "Two", body: "Also written before it." }),
  ];
  s.close();
  const raw = new Database(paths.operational(dir));
  raw.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schemaVersion', ?)", [OLD]);
  raw.close();
  const upgraded = Store.open({ dir });
  expect(upgraded.migration?.from).toBe(OLD);
  const after = upgraded.put({ type: "memory", kind: "fact", title: "Three", body: "Written after the upgrade." });
  upgraded.close();
  expect(stampOf(paths.operational(dir))).toBe(NEW);
  expect(cacheFiles().length).toBeGreaterThan(0);
  return { before, after };
}

function asideDir(): string {
  const found = readdirSync(root).filter((n) => n.startsWith("rollback-aside-v"));
  expect(found.length).toBe(1);
  return join(root, found[0] ?? "");
}

describe("rollback", () => {
  test("puts the copy back, sets the upgraded store and its cache aside, and the hold keeps this build off it", async () => {
    const { before, after } = upgradedStore();

    const dry = await cli(["rollback", "--dir", dir, "--dry-run"]);
    expect(dry.code).toBe(EXIT.ok);
    expect(dry.out).toContain(`-pre-migration-v${OLD}-to-v${NEW}`);
    expect(dry.out).toContain("What is lost: 1 memory");
    expect(dry.out).toContain("Dry run. Nothing has changed.");
    expect(stampOf(paths.operational(dir))).toBe(NEW);

    const done = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(done.err).toBe("");
    expect(done.code).toBe(EXIT.ok);
    expect(done.out).toContain(`Rolled back to schema v${OLD}`);
    expect(done.out).toContain("counterparts disconnect");

    // The copy's contents, at the copy's version; the later memory is not there.
    expect(stampOf(paths.operational(dir))).toBe(OLD);
    expect(idsIn(paths.operational(dir))).toEqual([...before].sort());
    expect(idsIn(paths.operational(dir))).not.toContain(after);
    // The cache went with the upgraded store; nothing of it is left in the store.
    expect(cacheFiles()).toEqual([]);
    // The upgraded store is set aside, whole, and nothing was deleted.
    const aside = asideDir();
    const setAside = probe(join(aside, DATABASE_FILE));
    expect(setAside.stamp).toBe(NEW);
    expect(setAside.ids).toContain(after);
    expect(readdirSync(join(aside, "cache")).some((n) => n.startsWith("cache.sqlite"))).toBe(true);
    // The copy itself is untouched and still there.
    expect(preMigrationCopies().length).toBe(1);
    // The hold is INSIDE sessions/, so the store's layout is what an older build accepts.
    expect(existsSync(rollbackHoldPath(dir))).toBe(true);
    expect(() => assertLayoutClassified(readdirSync(dir))).not.toThrow();

    // Every open by this build refuses, writer and observer alike, and builds no cache.
    for (const observer of [false, true]) {
      let caught: unknown = null;
      try {
        Store.open({ dir, observer }).close();
      } catch (err) {
        caught = err;
      }
      expect(isStoreError(caught, "STORE_ROLLED_BACK")).toBe(true);
      expect(describeFault(caught).reason).toContain("rolled back");
    }
    expect(cacheFiles()).toEqual([]);
    expect(stampOf(paths.operational(dir))).toBe(OLD);

    // Doctor says it in one line, and does not claim a session will upgrade it.
    const doc = await cli(["doctor", "--dir", dir]);
    expect(doc.out).toContain("Rollback");
    expect(doc.out).toContain(`rolled back from v${NEW} to v${OLD}`);
    expect(doc.out).not.toContain(`upgrades it to v${NEW}`);
    expect(cacheFiles()).toEqual([]);

    // A second rollback refuses while the hold is there.
    const twice = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(twice.code).toBe(EXIT.refused);
    expect(twice.err).toContain("already rolled back");
  });

  test("--undo puts the upgraded store back, cache and all, and removes the hold", async () => {
    const { after } = upgradedStore();
    expect((await cli(["rollback", "--dir", dir, "--yes"])).code).toBe(EXIT.ok);
    const aside = asideDir();

    const undo = await cli(["rollback", "--dir", dir, "--undo"]);
    expect(undo.err).toBe("");
    expect(undo.code).toBe(EXIT.ok);
    const back = probe(paths.operational(dir));
    expect(back.stamp).toBe(NEW);
    expect(back.ids).toContain(after);
    expect(cacheFiles().length).toBeGreaterThan(0);
    expect(existsSync(rollbackHoldPath(dir))).toBe(false);
    expect(existsSync(aside)).toBe(false);
    // The copy is still in the snapshots folder; the restored duplicate of it went.
    expect(preMigrationCopies().length).toBe(1);
    expect(openInChild()).toEqual({ ok: true, code: null, migrated: false });
  });

  test("--undo refuses once the restored store has been written; --upgrade-again upgrades it from a NEW copy", async () => {
    upgradedStore();
    expect((await cli(["rollback", "--dir", dir, "--yes"])).code).toBe(EXIT.ok);
    // The older version, writing to the restored store (simulated: this build will not open it).
    const raw = new Database(paths.operational(dir));
    raw.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('test.older-build-wrote', '1')");
    raw.close();

    const undo = await cli(["rollback", "--dir", dir, "--undo"]);
    expect(undo.code).toBe(EXIT.refused);
    expect(undo.err).toContain("written to since the rollback");
    expect(stampOf(paths.operational(dir))).toBe(OLD);

    const copiesBefore = preMigrationCopies();
    const allow = await cli(["rollback", "--dir", dir, "--upgrade-again"]);
    expect(allow.err).toBe("");
    expect(allow.code).toBe(EXIT.ok);
    expect(allow.out).toContain(`Upgraded v${OLD} -> v${NEW}`);
    expect(stampOf(paths.operational(dir))).toBe(NEW);
    expect(existsSync(rollbackHoldPath(dir))).toBe(false);
    // Same UTC day, and still a NEW copy: the first one would lose what the older build wrote.
    const copiesAfter = preMigrationCopies();
    expect(copiesAfter.length).toBe(copiesBefore.length + 1);
    const fresh = copiesAfter.find((n) => !copiesBefore.includes(n)) ?? "";
    const db = new Database(join(snaps, fresh, DATABASE_FILE), { readonly: true });
    expect(db.query("SELECT value FROM meta WHERE key = 'test.older-build-wrote'").get()).not.toBeNull();
    db.close();
    Store.open({ dir }).close();
  });

  test("a rollback killed before its copy went in: doctor says so, --upgrade-again refuses, --undo puts the newer store back whole", async () => {
    const { after } = upgradedStore();
    expect((await cli(["rollback", "--dir", dir, "--yes"])).code).toBe(EXIT.ok);
    const aside = asideDir();
    // The ground a kill between "set aside" and "rename the copy into place"
    // leaves: the hold, the copy under its temporary name, no database — and,
    // killed one rename earlier still, the newer store's -wal not yet moved.
    const tmp = join(dir, `${DATABASE_FILE}.rollback-99999`);
    renameSync(paths.operational(dir), tmp);
    const walLeft = existsSync(join(aside, `${DATABASE_FILE}-wal`));
    if (walLeft) renameSync(join(aside, `${DATABASE_FILE}-wal`), `${paths.operational(dir)}-wal`);
    expect(existsSync(paths.operational(dir))).toBe(false);
    // And the cache only partly moved: a sidecar of the newer cache still in place.
    // Whether the cache HAS sidecars once its last connection closed is the SQLite
    // build's (Apple's keeps them; bun's own on Linux deletes them, since
    // `Db.close()` really closes, 2026-10-11). Where it has none, an empty `-wal`,
    // which is what Apple's leaves, stands in for one.
    if (!readdirSync(join(aside, "cache")).some((n) => n.startsWith("cache.sqlite-"))) {
      writeFileSync(join(aside, "cache", "cache.sqlite-wal"), "");
    }
    const cacheBefore = readdirSync(join(aside, "cache")).sort();
    const cacheSidecar = cacheBefore.find((n) => n.startsWith("cache.sqlite-")) ?? "";
    expect(cacheSidecar).not.toBe("");
    renameSync(join(aside, "cache", cacheSidecar), join(dir, "cache", cacheSidecar));

    // This build still refuses the store, and its words are not "install the older version".
    let caught: unknown = null;
    try {
      Store.open({ dir, observer: true }).close();
    } catch (err) {
      caught = err;
    }
    expect(isStoreError(caught, "STORE_ROLLED_BACK")).toBe(true);
    expect(describeFault(caught).reason).toContain("rollback --undo");
    expect(existsSync(paths.operational(dir))).toBe(false);

    const doc = await cli(["doctor", "--dir", dir]);
    expect(doc.out).toContain("stopped before its copy went in");
    expect(doc.out).toContain("--undo");
    expect(doc.out).not.toContain("Run: counterparts install");

    // Past the hold, an open with no database would mint a blank store. Refused.
    const allow = await cli(["rollback", "--dir", dir, "--upgrade-again"]);
    expect(allow.code).toBe(EXIT.refused);
    expect(allow.err).toContain("rollback --undo");
    expect(existsSync(paths.operational(dir))).toBe(false);
    expect(existsSync(rollbackHoldPath(dir))).toBe(true);

    // Rolling back again points at --undo, not at "nothing to roll back".
    const again = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(again.code).toBe(EXIT.refused);
    expect(again.err).toContain("Use --undo");

    const undo = await cli(["rollback", "--dir", dir, "--undo"]);
    expect(undo.err).toBe("");
    expect(undo.code).toBe(EXIT.ok);
    const back = probe(paths.operational(dir));
    expect(back.stamp).toBe(NEW);
    expect(back.ids).toContain(after);
    expect(existsSync(rollbackHoldPath(dir))).toBe(false);
    // The cache came back whole: the sidecar that never moved was not deleted.
    expect(cacheFiles().sort()).toEqual(cacheBefore);
    // The temporary copy was a duplicate of the snapshot, which stays; the aside folder is gone.
    expect(existsSync(tmp)).toBe(false);
    expect(preMigrationCopies().length).toBe(1);
    expect(existsSync(aside)).toBe(false);
    expect(openInChild()).toEqual({ ok: true, code: null, migrated: false });
  });

  test("a rollback killed after its hold went down but before anything moved: the store opens as before, and --upgrade-again tidies up", async () => {
    const { after } = upgradedStore();
    // The ground a kill right after `performRollback`'s step 2 (the hold, in
    // its final form: it is written once, before anything moves) and the aside
    // folder's mkdir leaves: the copy under its temporary name, and the newer
    // store and its cache still where they were. Made by the same steps, so
    // nothing in this process holds a file across a rename.
    const plan = planRollback({ storeDir: dir, snapshotsDir: snaps, configPath: join(root, ".counterparts", "claude-code.json"), home: root, now: Date.now() });
    expect(plan.refusal).toBeNull();
    if (plan.copy === null || plan.current === null) throw new Error("no plan");
    const tmp = join(dir, `${DATABASE_FILE}.rollback-99999`);
    copyFileSync(plan.copy.db, tmp);
    writeRollbackHold(dir, {
      version: 1,
      at: Date.now(),
      from: plan.current,
      to: plan.copy.from,
      snapshot: plan.copy.name,
      snapshotsDir: snaps,
      aside: plan.aside,
      restoredSha256: sha256File(tmp),
      build: null,
    });
    mkdirSync(join(plan.aside, "cache"), { recursive: true });
    const aside = asideDir();
    expect(readRollbackHold(dir)).not.toBeNull();

    // The hold holds nothing over a store on this build's schema: this build opens it, unchanged.
    expect(openInChild()).toEqual({ ok: true, code: null, migrated: false });
    expect(probe(paths.operational(dir)).ids).toContain(after);

    const doc = await cli(["doctor", "--dir", dir]);
    expect(doc.out).toContain("holds nothing");
    expect(doc.out).toContain("--upgrade-again");

    // --undo has no set-aside store to bring back, and says so without touching anything.
    const undo = await cli(["rollback", "--dir", dir, "--undo"]);
    expect(undo.code).toBe(EXIT.refused);
    expect(undo.err).toContain("holds no store database to put back");
    expect(probe(paths.operational(dir)).ids).toContain(after);

    // A second rollback names both ways out.
    const again = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(again.code).toBe(EXIT.refused);
    expect(again.err).toContain("--upgrade-again");

    const allow = await cli(["rollback", "--dir", dir, "--upgrade-again"]);
    expect(allow.err).toBe("");
    expect(allow.code).toBe(EXIT.ok);
    expect(existsSync(rollbackHoldPath(dir))).toBe(false);
    expect(probe(paths.operational(dir)).ids).toContain(after);
    // The orphan copy is a duplicate of the snapshot, which stays: removed. The empty aside folder goes too.
    expect(existsSync(tmp)).toBe(false);
    expect(preMigrationCopies().length).toBe(1);
    expect(existsSync(aside)).toBe(false);
    expect(() => assertLayoutClassified(readdirSync(dir))).not.toThrow();
  });

  test("folds the database's -wal into it before anything moves, and stops, changing nothing, while a reader holds it", async () => {
    upgradedStore();
    const db = paths.operational(dir);
    // A writer that committed and has not folded: the row is only in the -wal.
    const writer = new Database(db);
    writer.exec("PRAGMA wal_autocheckpoint = 0");
    writer.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('test.in-the-wal', '1')");
    expect(statSync(`${db}-wal`).size).toBeGreaterThan(0);
    // A reader inside a transaction: the log cannot be reset under it.
    const reader = new Database(db);
    reader.exec("BEGIN");
    reader.query("SELECT count(*) FROM memories").get();

    const busy = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(busy.code).toBe(EXIT.failed);
    expect(busy.err).toContain("could not be folded into it first");
    expect(busy.err).toContain("Nothing has changed");
    expect(existsSync(rollbackHoldPath(dir))).toBe(false);
    expect(readdirSync(root).filter((n) => n.startsWith("rollback-aside-v"))).toEqual([]);
    expect(readdirSync(dir).filter((n) => n.includes(".rollback-"))).toEqual([]);
    expect(stampOf(db)).toBe(NEW);
    reader.exec("COMMIT");
    reader.close();

    const done = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(done.err).toBe("");
    expect(done.code).toBe(EXIT.ok);
    const aside = asideDir();
    const asideWal = join(aside, `${DATABASE_FILE}-wal`);
    expect(!existsSync(asideWal) || statSync(asideWal).size === 0).toBe(true);
    // The kill this guards against — the database moved, its -wal not yet:
    // the set-aside database file ALONE holds the row.
    mkdirSync(join(root, "alone"));
    const alone = join(root, "alone", DATABASE_FILE);
    copyFileSync(join(aside, DATABASE_FILE), alone);
    const lone = new Database(alone);
    expect(lone.query("SELECT value FROM meta WHERE key = 'test.in-the-wal'").get()).toEqual({ value: "1" });
    lone.close();
    writer.close();
  });

  test("asks for the word at a terminal, refuses --yes there, and refuses a pipe without --yes", async () => {
    upgradedStore();
    const word = `rollback-to-v${OLD}`;

    const wrong = await cli(["rollback", "--dir", dir], { answers: ["yes"] });
    expect(wrong.code).toBe(EXIT.refused);
    expect(stampOf(paths.operational(dir))).toBe(NEW);

    const yesAtTerminal = await cli(["rollback", "--dir", dir, "--yes"], { answers: [word] });
    expect(yesAtTerminal.code).toBe(EXIT.refused);
    expect(yesAtTerminal.err).toContain("--yes at a terminal");

    const pipe = await cli(["rollback", "--dir", dir]);
    expect(pipe.code).toBe(EXIT.refused);
    expect(stampOf(paths.operational(dir))).toBe(NEW);

    const cancelled = await cli(["rollback", "--dir", dir], { answers: ["cancel"] });
    expect(cancelled.code).toBe(EXIT.ok);
    expect(cancelled.out).toContain("Cancelled");
    expect(stampOf(paths.operational(dir))).toBe(NEW);

    const typed = await cli(["rollback", "--dir", dir], { answers: [word] });
    expect(typed.code).toBe(EXIT.ok);
    expect(stampOf(paths.operational(dir))).toBe(OLD);
    expect(readRollbackHold(dir)).not.toBeNull();
  });

  test("refuses while a session is live or a dashboard on this store runs, and says which", async () => {
    upgradedStore();
    mkdirSync(join(dir, "sessions"), { recursive: true });
    writeFileSync(
      join(dir, "sessions", "sess-live.json"),
      JSON.stringify({ sessionId: "sess-live", scope: "/work/here", startedAt: Date.now(), lastBoundaryAt: Date.now(), endedAt: null }),
    );
    const live = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(live.code).toBe(EXIT.refused);
    expect(live.err).toContain("a Claude Code session (session sess-live)");
    expect(stampOf(paths.operational(dir))).toBe(NEW);
    rmSync(join(dir, "sessions", "sess-live.json"));

    const dashboard: ProcessLister = () => ({
      looked: true,
      processes: [{ pid: 4242, ppid: 1, what: "a dashboard", command: `bun dashboard/bin/dashboard.ts serve --dir ${dir}` }],
    });
    const held = await cli(["rollback", "--dir", dir, "--yes"], { processes: dashboard });
    expect(held.code).toBe(EXIT.refused);
    expect(held.err).toContain("a dashboard — pid 4242");

    // One that names no store may be another's: said, not refused.
    const elsewhere: ProcessLister = () => ({
      looked: true,
      processes: [{ pid: 4343, ppid: 1, what: "a dashboard", command: "counterparts dashboard" }],
    });
    const maybe = await cli(["rollback", "--dir", dir, "--yes"], { processes: elsewhere });
    expect(maybe.code).toBe(EXIT.ok);
    expect(maybe.out).toContain("maybe on this store");
  });

  test("refuses a store this build has not upgraded, and names the copies when none fits", async () => {
    const s = Store.open({ dir });
    s.put({ type: "memory", kind: "fact", title: "One", body: "Never upgraded." });
    s.close();
    const none = await cli(["rollback", "--dir", dir, "--yes"]);
    expect(none.code).toBe(EXIT.refused);
    expect(none.err).toContain("no copy taken before the upgrade");

    const bad = await cli(["rollback", "--dir", dir, "--to", "../../etc", "--yes"]);
    expect(bad.code).toBe(EXIT.refused);
    expect(bad.err).toContain("--to takes the name of a pre-migration copy");

    // A copy inside a live store is not read, by name (`homedir()` is the preload's temp home).
    const live = join(homedir(), ".bansai", "snapshots", `2026-10-11T07-25-00-000Z-pre-migration-v${OLD}-to-v${NEW}`);
    const forbidden = await cli(["rollback", "--dir", dir, "--to", live, "--yes"]);
    expect(forbidden.code).toBe(EXIT.refused);
    expect(forbidden.err).toContain("refused by name");
  });
});
