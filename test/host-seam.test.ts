/**
 * THE HOST SEAM (2026-09-30) — the two on-disk shape changes it makes, and the
 * seam itself.
 *
 *   - **The neutral config name.** `counterparts.json` is read when it exists,
 *     `claude-code.json` otherwise, at every place a default configuration is
 *     resolved — and nobody's file is renamed.
 *   - **`host` on registry records.** Written by the lifecycle; a record with no
 *     `host` (every record before this) reads as Claude Code's.
 *   - **Per-host wording**, and the lifecycle being a thing a second host can
 *     construct without Claude Code's adapter.
 *
 * Every test runs in a fresh temp dir it creates and removes; no real home, no
 * real store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import {
  CONFIG_FILE_NAME,
  NEUTRAL_CONFIG_FILE_NAME,
  configFileIn,
  defaultConfigPath,
  isNamed,
  resolveConfigPath,
} from "../src/adapters/config-path.js";
import { installLayout, throwawayDefaultRefusal } from "../src/adapters/cli/install.js";
import { snapshotsDirBeside, zoneBeside } from "../src/adapters/cli/commands.js";
import { DEFAULT_HOST, HOST_WORDING, isHostName, wordingFor } from "../src/adapters/hosts.js";
import { Lifecycle } from "../src/adapters/lifecycle.js";
import type { HostLifecycle } from "../src/adapters/lifecycle.js";
import { RECONNECT_REMEDY, hostOf, readSession, recordSession, sessionPath } from "../src/adapters/sessions.js";
import {
  SCHEMA_UNREADABLE_REFUSAL,
  STALE_SERVER_REFUSAL,
  schemaUnreadableRefusal,
  staleServerRefusal,
} from "../src/adapters/mcp/server.js";
import { ClaudeCodeAdapter, openAdapter } from "../src/adapters/claude-code/index.js";

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-host-seam-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const T0 = 1_800_000_000_000;

/** A fake home with `~/.counterparts/` and whichever of the two files are named. */
function home(files: readonly string[]): { home: string; base: string } {
  const h = join(root, "home");
  const base = join(h, ".counterparts");
  mkdirSync(base, { recursive: true });
  for (const f of files) writeFileSync(join(base, f), "{}\n");
  return { home: h, base };
}

describe("the neutral config name — counterparts.json if present, else claude-code.json", () => {
  test("no file at all: the default is claude-code.json, exactly as before", () => {
    const { home: h, base } = home([]);
    expect(defaultConfigPath(h)).toBe(join(base, CONFIG_FILE_NAME));
    expect(resolveConfigPath([], {}, h)).toEqual({ path: join(base, CONFIG_FILE_NAME), source: "default", refusal: null });
    expect(installLayout(undefined, {}, h).config).toBe(join(base, CONFIG_FILE_NAME));
  });

  test("only claude-code.json: it is read, and nothing is renamed", () => {
    const { home: h, base } = home([CONFIG_FILE_NAME]);
    expect(defaultConfigPath(h)).toBe(join(base, CONFIG_FILE_NAME));
    expect(installLayout(undefined, {}, h).config).toBe(join(base, CONFIG_FILE_NAME));
    expect(existsSync(join(base, CONFIG_FILE_NAME))).toBe(true);
    expect(existsSync(join(base, NEUTRAL_CONFIG_FILE_NAME))).toBe(false);
  });

  test("counterparts.json present: it wins, beside a claude-code.json or alone — and neither file moves", () => {
    for (const files of [[NEUTRAL_CONFIG_FILE_NAME], [CONFIG_FILE_NAME, NEUTRAL_CONFIG_FILE_NAME]]) {
      rmSync(join(root, "home"), { recursive: true, force: true });
      const { home: h, base } = home(files);
      const neutral = join(base, NEUTRAL_CONFIG_FILE_NAME);
      expect(defaultConfigPath(h)).toBe(neutral);
      expect(resolveConfigPath([], {}, h).path).toBe(neutral);
      expect(resolveConfigPath([], {}, h).source).toBe("default");
      // The pin a worker gets is the resolved default, so it is not "named".
      expect(isNamed({ path: neutral, source: "COUNTERPARTS_CONFIG", refusal: null }, h)).toBe(false);
      // An install writes the file the readers will read.
      expect(installLayout(undefined, {}, h).config).toBe(neutral);
      for (const f of files) expect(existsSync(join(base, f))).toBe(true);
    }
  });

  test("the throwaway-default guard compares against the same default the readers resolve", () => {
    const { home: h } = home([NEUTRAL_CONFIG_FILE_NAME]);
    const layout = installLayout(undefined, {}, h);
    expect(layout.config).toBe(defaultConfigPath(h));
    // A store outside every temp root is not a throwaway, so the guard is silent.
    expect(throwawayDefaultRefusal({ ...layout, store: "/var/permanent/store" }, {}, h)).toBeNull();
  });

  test("the console's beside-the-store reads follow the same rule", () => {
    const base = join(root, "install");
    const store = join(base, "store");
    mkdirSync(store, { recursive: true });
    writeFileSync(join(base, CONFIG_FILE_NAME), JSON.stringify({ timeZone: "America/Denver", snapshots: { dir: join(base, "old") } }));
    expect(configFileIn(base)).toBe(join(base, CONFIG_FILE_NAME));
    expect(zoneBeside(store)).toBe("America/Denver");
    expect(snapshotsDirBeside(store)).toBe(join(base, "old"));
    writeFileSync(join(base, NEUTRAL_CONFIG_FILE_NAME), JSON.stringify({ timeZone: "Europe/Paris", snapshots: { dir: join(base, "new") } }));
    expect(configFileIn(base)).toBe(join(base, NEUTRAL_CONFIG_FILE_NAME));
    expect(zoneBeside(store)).toBe("Europe/Paris");
    expect(snapshotsDirBeside(store)).toBe(join(base, "new"));
  });

  test("the rule is one stat, injectable", () => {
    const seen: string[] = [];
    const path = configFileIn("/nowhere", (p) => {
      seen.push(p);
      return false;
    });
    expect(path).toBe(join("/nowhere", CONFIG_FILE_NAME));
    expect(seen).toEqual([join("/nowhere", NEUTRAL_CONFIG_FILE_NAME)]);
  });
});

describe("host on registry records — absent reads as claude-code", () => {
  test("a record written with no host has no host key on disk, and reads as claude-code", () => {
    const dir = join(root, "store");
    const written = recordSession(dir, { sessionId: "s1", scope: "/proj/a", phase: "start", at: T0 });
    expect(written).not.toBeNull();
    const raw = JSON.parse(readFileSync(sessionPath(dir, "s1") as string, "utf8")) as Record<string, unknown>;
    expect("host" in raw).toBe(false);
    const read = readSession(dir, "s1");
    expect(read?.host).toBeUndefined();
    expect(hostOf(read as NonNullable<typeof read>)).toBe("claude-code");
    expect(DEFAULT_HOST).toBe("claude-code");
  });

  test("a hand-written record from before the field reads as claude-code", () => {
    const dir = join(root, "store");
    mkdirSync(join(dir, "sessions"), { recursive: true });
    writeFileSync(
      sessionPath(dir, "old") as string,
      JSON.stringify({ sessionId: "old", scope: "/proj/a", startedAt: T0, lastBoundaryAt: T0, endedAt: null }),
    );
    const read = readSession(dir, "old");
    expect(read).not.toBeNull();
    expect(hostOf(read as NonNullable<typeof read>)).toBe("claude-code");
  });

  test("a named host is kept, carried through a phase that names none, and a malformed one is no mark", () => {
    const dir = join(root, "store");
    recordSession(dir, { sessionId: "d1", scope: "/proj/a", phase: "start", at: T0, host: "claude-desktop" });
    recordSession(dir, { sessionId: "d1", scope: "/proj/a", phase: "boundary", at: T0 + 1 });
    expect(readSession(dir, "d1")?.host).toBe("claude-desktop");
    recordSession(dir, { sessionId: "bad", scope: "/proj/a", phase: "start", at: T0, host: "Not A Host!" });
    expect(readSession(dir, "bad")?.host).toBeUndefined();
    expect(isHostName("claude-desktop")).toBe(true);
    expect(isHostName("../etc")).toBe(false);
  });

  test("the Claude Code adapter writes host: claude-code on the records it writes", () => {
    const store = join(root, "store");
    const proj = join(root, "proj");
    mkdirSync(proj, { recursive: true });
    const a = openAdapter(
      { dataDir: store, owner: true },
      { command: "/bin/true", args: ["runner"], spawner: () => ({ pid: 4242 }), scope: { mode: "on", matched: proj, entry: null } },
    );
    try {
      expect(a).toBeInstanceOf(Lifecycle);
      expect(a.host).toBe("claude-code");
      a.sessionStart({ sessionId: "cc-1", scope: proj });
      expect(readSession(store, "cc-1")?.host).toBe("claude-code");
    } finally {
      a.counterpart.close();
    }
  });
});

describe("the lifecycle, without Claude Code's adapter", () => {
  test("a second host constructs it directly, and its registry writes carry that host", () => {
    const store = join(root, "store");
    const proj = join(root, "proj");
    mkdirSync(proj, { recursive: true });
    const c = Counterpart.open({ dir: store, owner: true });
    try {
      const life: HostLifecycle = new Lifecycle({ counterpart: c, config: { dataDir: store }, host: "claude-desktop" });
      expect(life).not.toBeInstanceOf(ClaudeCodeAdapter);
      life.noteSession("start", { sessionId: "desk-1", scope: proj });
      const rec = readSession(store, "desk-1");
      expect(rec?.host).toBe("claude-desktop");
      expect(hostOf(rec as NonNullable<typeof rec>)).toBe("claude-desktop");
      // A boundary with nothing said captures nothing and fails nothing.
      const b = life.captureBoundary("desk-boundary", "stop", { sessionId: "desk-1", scope: proj, turns: [] });
      expect(b.spansAppended).toBe(0);
      expect(life.events("adapter.session.registry").length).toBeGreaterThan(0);
    } finally {
      c.close();
    }
  });
});

describe("per-host wording", () => {
  test("Claude Code's words are exactly the words it had", () => {
    expect(RECONNECT_REMEDY).toBe("Run /mcp and Reconnect to load it.");
    expect(staleServerRefusal()).toBe(STALE_SERVER_REFUSAL);
    expect(staleServerRefusal("claude-code")).toBe(STALE_SERVER_REFUSAL);
    expect(schemaUnreadableRefusal("claude-code")).toBe(SCHEMA_UNREADABLE_REFUSAL);
    expect(SCHEMA_UNREADABLE_REFUSAL).toBe(
      "This server could not read which version the memory store is at, so this tool did nothing. Run /mcp and Reconnect; if that does not help, run `counterparts doctor`.",
    );
  });

  test("a host with no entry of its own speaks with the default host's words", () => {
    expect(HOST_WORDING["no-such-host"]).toBeUndefined();
    expect(wordingFor("no-such-host")).toEqual(wordingFor(DEFAULT_HOST));
  });
});
