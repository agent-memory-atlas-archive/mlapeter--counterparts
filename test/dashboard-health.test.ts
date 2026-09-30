/**
 * The health tab (2026-09-25 redesign): doctor as a checklist through the
 * actions seam, the last cycle as one line, and where archived memories went
 * as one picture.
 *
 * What this file proves:
 *
 *   1. `doctor` is an action that builds `doctor --dir <store> [--config] --json`
 *      and nothing else; opened on a bare store it arms the explicit-dir guard
 *      for that run, so the console grades the store alone and says so in its
 *      `config` line rather than reading a default configuration.
 *   2. Running it leaves the store byte-identical, and its output is the JSON
 *      the page draws.
 *   3. Every `archived_reason` the core writes has a plain phrase, the archive
 *      counts add up to the archived rows, and a reason nobody mapped still
 *      gets a segment.
 *   4. The cycle line on a store that has never slept says so.
 *
 * Hermetic (CLAUDE.md): every store and configuration lives in a fresh temp
 * dir removed afterwards; `home` is a temp dir too, so the host reading never
 * looks at a real `~/.claude`.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { Dashboard } from "../src/adapters/dashboard/index.js";
import { NO_CONFIG_HOME, buildArgv, runAction } from "../src/adapters/dashboard/web/actions.js";
import { ARCHIVE_PHRASES } from "../src/adapters/dashboard/web/views/archive-words.js";
import { healthView } from "../src/adapters/dashboard/web/views/health.js";
import { CORRECTED_REASON } from "../src/core/contradictions.js";
import { DREAM_MERGE_REASON, DREAM_UNDONE_REASON } from "../src/core/dream/index.js";
import { TUNABLES as SCHEMA_TUNABLES } from "../src/core/schemas/index.js";
import { MERGE_ARCHIVE_REASON, PRUNE_ARCHIVE_REASON, markerKey } from "../src/core/sleep/index.js";
import { PHASES } from "../src/core/sleep/types.js";
import { Store } from "../src/core/store/index.js";
import { REMOVED_REASON } from "../src/core/store/owner-op-seam.js";
import { seedDemo, seedEmpty } from "../tools/demo/seed.js";

let temps: string[] = [];
function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}
beforeEach(() => {
  temps = [];
});
afterEach(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      const rel = relative(dir, full);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      // As in dashboard-actions: box 3 is rewritten on every open, and `-shm`
      // takes read-marks from every WAL reader.
      if (rel.startsWith("cache") || entry.name.endsWith("-shm")) continue;
      if (!entry.isFile()) continue;
      out.set(rel, `${statSync(full).size}:${createHash("sha256").update(readFileSync(full)).digest("hex")}`);
    }
  };
  walk(dir);
  return out;
}

describe("doctor through the actions seam", () => {
  test("builds doctor --json on the dashboard's own store, and nothing from the body", () => {
    expect(buildArgv("doctor", { dir: "/elsewhere", config: "/x.json" }, { dir: "/tmp/s", config: "/tmp/c.json" })).toEqual({
      argv: ["doctor", "--dir", "/tmp/s", "--config", "/tmp/c.json", "--json"],
    });
  });

  test("opened on a bare store, every action arms the guard and names no configuration", () => {
    const bare = { dir: "/tmp/s" };
    const built = buildArgv("doctor", {}, bare);
    expect(built.argv).toEqual(["doctor", "--dir", "/tmp/s", "--json"]);
    expect(built.env).toEqual({ COUNTERPARTS_REQUIRE_EXPLICIT_DIR: "1", COUNTERPARTS_CONFIG: undefined });
    // doctor keeps the real home (its host reading is ~/.claude); the rest get one with no configuration.
    expect(built.home).toBeUndefined();
    const bodies: Record<string, Record<string, unknown>> = {
      ask: { question: "what is on the rota?" },
      note: { text: "The allotment rota is pinned inside the shed door." },
      remove: { id: "mem_0123456789ab" },
      backup: { out: "/tmp/out" },
      export: { out: "/tmp/out" },
      rebrief: {},
      verify: {},
    };
    for (const [name, body] of Object.entries(bodies)) {
      const b = buildArgv(name as Parameters<typeof buildArgv>[0], body, bare);
      expect(`${name}: ${b.home}`).toBe(`${name}: ${NO_CONFIG_HOME}`);
      expect(b.env?.["COUNTERPARTS_REQUIRE_EXPLICIT_DIR"]).toBe("1");
      expect("COUNTERPARTS_CONFIG" in (b.env ?? {})).toBe(true);
      expect(b.argv).not.toContain("--config");
    }
    // scope still refuses outright without one.
    expect(() => buildArgv("scope", { list: true }, bare)).toThrow("without one");
    // And with a configuration nothing is laid over the console.
    const withConfig = buildArgv("rebrief", {}, { dir: "/tmp/s", config: "/tmp/c.json" });
    expect(withConfig.env).toBeUndefined();
    expect(withConfig.home).toBeUndefined();
  });

  /**
   * THE HOLE THIS CLOSES (found by the Self builder, 2026-09-25): `rebrief`
   * from a dashboard opened on a bare `--dir` took its budget from the
   * owner's live `~/.counterparts/claude-code.json`. Here the "live" file is a
   * marker in a fake home the console is pointed at — both as `home` and as
   * `HOME` — with a budget no default would ever produce, and naming a store
   * that does not exist. Neither rebrief nor note may show a trace of it.
   */
  test("a bare-store dashboard's rebrief and note never read the default configuration", async () => {
    const root = tempDir("counterparts-health-nohome-");
    const seeded = seedEmpty({ dir: join(root, "store") });
    const home = join(root, "home");
    const live = join(home, ".counterparts", "claude-code.json");
    mkdirSync(join(home, ".counterparts"), { recursive: true });
    writeFileSync(live, JSON.stringify({ dataDir: join(root, "LIVE-STORE"), injectionBudgetBytes: 4321 }));
    const ctx = { dir: seeded.dir, home, env: { HOME: home, COUNTERPARTS_CONFIG: live } };

    const rebrief = await runAction("rebrief", {}, ctx);
    expect(rebrief.status).toBe(200);
    const said = [...(rebrief.body.out ?? []), ...(rebrief.body.err ?? [])].join("\n");
    expect(said).not.toContain("4321");
    expect(said).not.toContain(live);
    expect(said).not.toContain("LIVE-STORE");
    // With no configuration to take a budget from, rebrief refuses in its own
    // words ("Pass --budget …") rather than borrowing the live one's.
    expect(rebrief.body.exit).toBe(2);
    expect(said).toContain("--budget");
    // Given one on the page, it composes under exactly that.
    const budgeted = await runAction("rebrief", { budget: 9000 }, ctx);
    const saidB = [...(budgeted.body.out ?? []), ...(budgeted.body.err ?? [])].join("\n");
    expect(budgeted.body.exit).toBe(0);
    expect(saidB).toContain("9000");
    expect(saidB).not.toContain("4321");

    const note = await runAction("note", { text: "The boiler service is booked for the first Tuesday in March." }, ctx);
    expect(note.status).toBe(200);
    const noted = [...(note.body.out ?? []), ...(note.body.err ?? [])].join("\n");
    expect(note.body.exit).toBe(0);
    expect(noted).not.toContain(live);
    expect(noted).not.toContain("LIVE-STORE");
    // The note landed in the dashboard's store, and nothing appeared beside the marker.
    expect(noted).toContain(seeded.dir);
    expect(readdirSync(join(home, ".counterparts"))).toEqual(["claude-code.json"]);
    expect(existsSync(join(root, "LIVE-STORE"))).toBe(false);
  }, 60_000);

  test("a doctor run leaves the store byte-identical and answers in JSON", async () => {
    const root = tempDir("counterparts-health-doctor-");
    const dir = join(root, "store");
    await seedDemo({ dir });
    const config = join(root, "claude-code.json");
    writeFileSync(config, JSON.stringify({ dataDir: dir, injectionBudgetBytes: 9000, embedder: { enabled: false } }));
    const home = join(root, "home");
    const before = snapshot(dir);
    const r = await runAction("doctor", {}, { dir, config, home, env: { HOME: home } });
    expect(r.status).toBe(200);
    // 0, or doctor's red exit — a red store is a reading, not a refusal.
    expect(typeof r.body.exit).toBe("number");
    const report = JSON.parse((r.body.out ?? []).join("\n")) as {
      findings: { key: string; severity: string; title: string; detail: string }[];
    };
    expect(report.findings.length).toBeGreaterThan(5);
    const store = report.findings.find((f) => f.key === "store");
    expect(store?.severity).toBe("green");
    expect(snapshot(dir)).toEqual(before);
  }, 60_000);

  test("without a configuration, doctor grades the store and names the config as not read", async () => {
    const root = tempDir("counterparts-health-bare-");
    const seeded = seedEmpty({ dir: join(root, "store") });
    const home = join(root, "home");
    const before = snapshot(seeded.dir);
    const r = await runAction("doctor", {}, { dir: seeded.dir, home, env: { HOME: home } });
    expect(r.status).toBe(200);
    const report = JSON.parse((r.body.out ?? []).join("\n")) as {
      findings: { key: string; data: Record<string, unknown> }[];
    };
    const config = report.findings.find((f) => f.key === "config");
    expect(config?.data["reason"]).toBe("not-read");
    expect(report.findings.some((f) => f.key === "store")).toBe(true);
    expect(snapshot(seeded.dir)).toEqual(before);
  }, 60_000);
});

describe("where archived memories went", () => {
  test("every archived_reason the core names has a plain phrase", () => {
    const mapped = new Set(ARCHIVE_PHRASES.map(([reason]) => reason));
    for (const reason of [
      PRUNE_ARCHIVE_REASON,
      MERGE_ARCHIVE_REASON,
      DREAM_MERGE_REASON,
      DREAM_UNDONE_REASON,
      SCHEMA_TUNABLES.FADE_REASON,
      SCHEMA_TUNABLES.REVISED_REASON,
      SCHEMA_TUNABLES.REPLACED_REASON,
      CORRECTED_REASON,
      REMOVED_REASON,
      "handoff-cleared",
      "handoff-duplicate",
      "episode-regrown",
      "supersede",
    ]) {
      expect(`${reason}: ${mapped.has(reason)}`).toBe(`${reason}: true`);
    }
    // And every reason the code hands the store's three archiving writers
    // today — `archive(id, reason)`, `supersede(old, input, reason = "supersede")`
    // and `supersedeInto(old, successor, reason)` — read off the call sites.
    // The first version of this check matched only `.archive(x, "literal")`
    // on one line, so a reason passed as a named constant, or to
    // `supersedeInto`, got past it: the health tab showed
    // "archived (dream-merge)" after 0.3.5 (2026-09-28).
    const written = archiveReasonsWritten(join(import.meta.dir, "..", "src"));
    expect(written.unresolved).toEqual([]);
    for (const reason of [DREAM_MERGE_REASON, DREAM_UNDONE_REASON, SCHEMA_TUNABLES.FADE_REASON, "revised-by-pressure"]) {
      expect(`${reason}: ${written.found.has(reason)}`).toBe(`${reason}: true`);
    }
    for (const reason of written.found) expect(`${reason}: ${mapped.has(reason)}`).toBe(`${reason}: true`);
  });

  test("the reason reader sees the call shapes the first check missed", () => {
    const dir = tempDir("counterparts-archive-reasons-");
    mkdirSync(join(dir, "core", "x"), { recursive: true });
    writeFileSync(
      join(dir, "core", "x", "a.ts"),
      [
        'export const SOME_REASON = "some-reason";',
        "export const TUNABLES = {",
        '  TUNED_REASON: "tuned-reason" as const,',
        "};",
        "store.archive(id, SOME_REASON);",
        'this.store.supersedeInto(a, b, "into-reason", { carryReturns: true });',
        "store.supersede(",
        "  old,",
        '  { type: "memory", body: f(x, y) },',
        '  "multi-line-reason",',
        ");",
        "store.supersede(old, { body });",
        "store.archive(id, TUNABLES.TUNED_REASON);",
        "store.archive(id, someVariable);",
      ].join("\n"),
    );
    const read = archiveReasonsWritten(dir);
    expect([...read.found].sort()).toEqual(["into-reason", "multi-line-reason", "some-reason", "supersede", "tuned-reason"]);
    expect(read.unresolved).toEqual([`${join("core", "x", "a.ts")}: someVariable`]);
  });

  test("the counts add up to the archived rows, and an unknown reason still gets a segment", async () => {
    const dir = join(tempDir("counterparts-health-archive-"), "store");
    await seedDemo({ dir });
    const w = Store.open({ dir });
    let target = "";
    try {
      target = w.list().find((id) => w.row(id)?.archived === 0 && id.startsWith("mem_")) ?? "";
      expect(target).not.toBe("");
      w.archive(target, "a-reason-nobody-mapped");
    } finally {
      w.close();
    }
    const dash = Dashboard.open({ dir });
    try {
      const store = dash.source.store;
      const archived = store.list().filter((id) => store.row(id)?.archived === 1).length;
      const h = healthView(dash.source);
      expect(h.archive.total).toBe(archived);
      const unknown = h.archive.reasons.find((r) => r.reason === "a-reason-nobody-mapped");
      expect(unknown?.known).toBe(false);
      expect(unknown?.phrase).toContain("a-reason-nobody-mapped");
      expect(unknown?.items.map((i) => i.id)).toEqual([target]);
      // The three ways out by design are always on the legend, even at zero.
      for (const r of [PRUNE_ARCHIVE_REASON, MERGE_ARCHIVE_REASON, REMOVED_REASON]) {
        expect(h.archive.reasons.some((x) => x.reason === r)).toBe(true);
      }
    } finally {
      dash.close();
    }
  }, 60_000);

  test("a phase that simply was not due by its cadence is waiting, not behind (2026-09-27)", () => {
    const dir = join(tempDir("counterparts-health-cadence-"), "store");
    seedEmpty({ dir });
    const w = Store.open({ dir });
    try {
      for (const date of ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]) w.advanceClock(date);
      const today = w.livedDay();
      for (const phase of PHASES) w.setMeta(markerKey(phase), String(today));
      w.setMeta(markerKey("consolidate"), String(today - 1)); // every 3 lived days: not due at the last cycle
      w.setMeta(markerKey("prune"), String(today - 2)); // every lived day: it was due and did not run
    } finally {
      w.close();
    }
    const dash = Dashboard.open({ dir });
    try {
      const h = healthView(dash.source);
      const by = new Map(h.cycle.phases.map((p) => [p.phase, p]));
      expect(by.get("consolidate")?.state).toBe("waiting");
      expect(by.get("consolidate")?.nextInDays).toBe(2);
      expect(by.get("prune")?.state).toBe("behind");
      expect(by.get("decay")?.state).toBe("ran");
      expect(h.cycle.waiting).toBe(1);
      expect(h.cycle.ran).toBe(PHASES.length - 2);
    } finally {
      dash.close();
    }
  });

  test("a sparse store reads calmly: nothing archived, sleep has not run", () => {
    const seeded = seedEmpty({ dir: join(tempDir("counterparts-health-sparse-"), "store") });
    const dash = Dashboard.open({ dir: seeded.dir });
    try {
      const h = healthView(dash.source);
      expect(h.archive.total).toBe(0);
      expect(h.cycle.day).toBeNull();
      expect(h.cycle.ran).toBe(0);
      expect(h.cycle.phases.every((p) => p.state === "never")).toBe(true);
    } finally {
      dash.close();
    }
  });
});

/**
 * Every `archived_reason` the source under `root` hands the store's archiving
 * writers, read from the call sites. The reason argument — the second of
 * `.archive(`, the third of `.supersede(` and `.supersedeInto(` — is a string
 * literal, a named constant (`export const NAME = "…"` anywhere under `root`),
 * a `TUNABLES.NAME` (`NAME: "…"`), or `supersede`'s own default when it is left
 * off. Anything else is `unresolved` unless it is a pass-through named below,
 * so a new call shape fails the test instead of slipping by.
 */
function archiveReasonsWritten(root: string): { found: Set<string>; unresolved: string[] } {
  const files: { path: string; text: string }[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) files.push({ path: relative(root, full), text: readFileSync(full, "utf8") });
    }
  };
  walk(root);
  const consts = new Map<string, string>();
  for (const f of files) {
    for (const m of f.text.matchAll(/export const ([A-Z][A-Z0-9_]*) = "([^"]+)"/g)) consts.set(m[1] as string, m[2] as string);
    for (const m of f.text.matchAll(/^\s+([A-Z][A-Z0-9_]*): "([^"]+)"(?: as const)?,/gm)) consts.set(`.${m[1] as string}`, m[2] as string);
  }
  // Reasons a caller forwards: `schemas/` revises under pressure and replaces
  // by declaration through one helper that hands `spec.reason` on, set from
  // TUNABLES.REVISED_REASON and TUNABLES.REPLACED_REASON — both checked by name
  // in the fixed list.
  const PASS_THROUGH = new Set([`${join("core", "schemas", "index.ts")}: spec.reason`]);
  const found = new Set<string>();
  const unresolved: string[] = [];
  for (const f of files) {
    if (f.path.startsWith(join("core", "store"))) continue; // the writers themselves
    for (const m of f.text.matchAll(/\.(archive|supersede|supersedeInto)\(/g)) {
      const args = topLevelArgs(f.text, (m.index as number) + m[0].length);
      if (args === null) continue;
      const method = m[1] as string;
      const arg = args[method === "archive" ? 1 : 2];
      if (arg === undefined) {
        if (method === "supersede" && args.length === 2) found.add("supersede");
        else unresolved.push(`${f.path}: .${method}(${args.join(", ").slice(0, 60)})`);
        continue;
      }
      const lit = /^"([^"]+)"$/.exec(arg);
      const member = /^[A-Za-z_]+(\.[A-Z][A-Z0-9_]*)$/.exec(arg);
      if (lit !== null) found.add(lit[1] as string);
      else if (consts.has(arg)) found.add(consts.get(arg) as string);
      else if (member !== null && consts.has(member[1] as string)) found.add(consts.get(member[1] as string) as string);
      else if (!PASS_THROUGH.has(`${f.path}: ${arg}`)) unresolved.push(`${f.path}: ${arg}`);
    }
  }
  return { found, unresolved };
}

/** The top-level arguments of a call whose `(` ends just before `from`; null when it never closes. */
function topLevelArgs(text: string, from: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = from;
  for (let i = from; i < text.length; i++) {
    const c = text[i] as string;
    if (quote !== null) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "{" || c === "[") depth += 1;
    else if (c === ")" || c === "}" || c === "]") {
      if (depth === 0) {
        const last = text.slice(start, i).trim();
        if (last.length > 0) args.push(last);
        return args;
      }
      depth -= 1;
    } else if (c === "," && depth === 0) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return null;
}
