/**
 * THE FIRST MEETING (onboarding core, 2026-10-11). Hermetic: every test makes
 * its own temp directory (a store, a home, a scope registry) and removes it.
 *
 * What is held here: the state and its transitions; a fresh install against
 * an upgrade (the meeting, and dreaming on by default only for the first);
 * the style bundles, word for word, marked, never core; the folder question's
 * `/` entry; the no-double-offer rule; the second session's one memory; the
 * dashboard's `{ meet, where, style }`; doctor's dreaming line.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { AUTO_RESET_KEY, DREAMING_SETTING_KEY, dreamingSetting } from "../src/core/dream/index.js";
import {
  FROM_ONBOARDING,
  MEET_LINE_OPEN,
  ONBOARDING_MEET_KEY,
  PUSHBACK_BASELINE,
  beginNewInstall,
  meetState,
  noteOffered,
  offerDue,
  onboardingView,
  recordState,
  styleMemories,
} from "../src/core/onboarding.js";
import { Store } from "../src/core/store/index.js";
import { EXIT, run } from "../src/adapters/cli/index.js";
import type { Io } from "../src/adapters/cli/index.js";
import { SCOPE_ASK_OPEN, openAdapter } from "../src/adapters/claude-code/index.js";
import type { ClaudeCodeAdapter, HookInput } from "../src/adapters/claude-code/index.js";
import { dreamingFindings } from "../src/adapters/claude-code/doctor.js";
import type { DoctorInput } from "../src/adapters/claude-code/doctor.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import { router } from "../src/adapters/dashboard/web/server.js";
import { openServer } from "../src/adapters/mcp/index.js";
import type { McpServer } from "../src/adapters/mcp/index.js";
import { TOOLS, renderDescription } from "../src/adapters/mcp/tools.js";
import { lookupScope, readScopes, scopesPath, setScope, writeScopes } from "../src/adapters/scopes.js";
import { firstRunLine } from "../src/adapters/plugin.js";

let root: string;
let storeDir: string;
let proj: string;
let scopesFile: string;
const DAY1 = "2026-10-11";
const DAY2 = "2026-10-12";

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-onboarding-")));
  storeDir = join(root, "cp", "store");
  proj = join(root, "proj");
  mkdirSync(proj, { recursive: true });
  scopesFile = scopesPath(join(root, "cp", "claude-code.json"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A store as `install` leaves a new one. */
function newInstallStore(): void {
  const s = Store.open({ dir: storeDir });
  beginNewInstall(s);
  s.close();
}

function withStore<T>(fn: (s: Store) => T): T {
  const s = Store.open({ dir: storeDir });
  try {
    return fn(s);
  } finally {
    s.close();
  }
}

const open: McpServer[] = [];
afterEach(() => {
  for (const s of open.splice(0)) s.counterpart.close();
});

/** The server's clock, pinned to DAY1 (noon UTC is DAY1 in every zone from -11 to +11): its `meet` marks the offer with ITS day, and a test that compares that day with DAY2 must not depend on the day it runs. */
const SERVER_NOW = Date.parse(`${DAY1}T12:00:00Z`);

function server(over: Parameters<typeof openServer>[0] = {}): McpServer {
  const s = openServer({ dir: storeDir, session: "sess-meet-1", scope: proj, owner: true, scopesFile, now: () => SERVER_NOW, ...over });
  open.push(s);
  return s;
}

function adapter(): ClaudeCodeAdapter {
  return openAdapter(
    { dataDir: storeDir, owner: true, injectionBudgetBytes: 9_000 },
    { command: "/bin/true", args: ["runner"], spawner: () => ({ pid: 4242 }), configPath: join(root, "cp", "claude-code.json") },
  );
}

/** One SessionStart; what rode beside the wake. */
function start(sessionId: string, at: string, extra: Partial<HookInput> = {}): string {
  const a = adapter();
  try {
    return a.sessionStart({ sessionId, scope: proj, at, ...extra }).ask ?? "";
  } finally {
    a.counterpart.close();
  }
}

function consoleWith(): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l) => out.push(l), err: (l) => err.push(l) }, out, err };
}

// ── state ────────────────────────────────────────────────────────────────────

describe("the meeting's state", () => {
  test("absent is done (every store from before this build); a new install starts not_started", () => {
    withStore((s) => expect(meetState(s)).toBe("done"));
    newInstallStore();
    withStore((s) => expect(onboardingView(s)).toEqual({ meet: "not_started", where: null, style: null }));
  });

  test("offered, later, skipped, done — and a finished meeting stays finished", () => {
    newInstallStore();
    withStore((s) => {
      expect(noteOffered(s, { on: DAY1, session: "a", state: true })).toBe("offered");
      expect(recordState(s, "later", { on: DAY1, session: "a" })).toBe("later");
      expect(noteOffered(s, { on: DAY2, session: "b", state: true })).toBe("offered");
      expect(recordState(s, "skipped", { on: DAY2, session: "b" })).toBe("skipped");
      // A read alone does not undo "don't ask again" (review of #419).
      expect(noteOffered(s, { on: "2026-10-13", session: "b2", state: true })).toBe("skipped");
      expect(offerDue(s, { on: "2026-10-14", session: "b3" })).toEqual({ due: false, state: "skipped" });
      expect(recordState(s, "done", { on: DAY2, session: "b" })).toBe("done");
      expect(recordState(s, "later", { on: DAY2, session: "b" })).toBe("done");
      expect(noteOffered(s, { on: DAY2, session: "c", state: true })).toBe("done");
    });
  });

  test("the offer is due at most once a calendar day, never twice in a session; an offered left by an earlier day becomes later", () => {
    newInstallStore();
    withStore((s) => {
      expect(offerDue(s, { on: DAY1, session: "a" }).due).toBe(true);
      noteOffered(s, { on: DAY1, session: "a", state: false });
      expect(offerDue(s, { on: DAY1, session: "a" }).due).toBe(false);
      expect(offerDue(s, { on: DAY1, session: "b" }).due).toBe(false);
      // A `meet` read marked it offered; nobody answered; the next day it is `later` again.
      noteOffered(s, { on: DAY1, session: "b", state: true });
      expect(offerDue(s, { on: DAY2, session: "c" })).toEqual({ due: true, state: "later" });
      expect(meetState(s)).toBe("later");
      recordState(s, "skipped", { on: DAY2, session: "c" });
      expect(offerDue(s, { on: "2026-10-13", session: "d" }).due).toBe(false);
    });
  });
});

// ── install ──────────────────────────────────────────────────────────────────

describe("a fresh install against an upgrade", () => {
  const cfg = (): string => join(root, "cp", "claude-code.json");
  const home = (): string => {
    const h = join(root, "home");
    mkdirSync(h, { recursive: true });
    return h;
  };

  test("install into a new store: the meeting not_started, dreaming auto, the once-only reset marked chosen", async () => {
    const c = consoleWith();
    expect(await run(["install", "--config", cfg(), "--no-connect"], { io: c.io, env: {}, home: home() })).toBe(EXIT.ok);
    withStore((s) => {
      expect(s.getMeta(ONBOARDING_MEET_KEY)).toBe("not_started");
      expect(s.getMeta(DREAMING_SETTING_KEY)).toBe("auto");
      expect(s.getMeta(AUTO_RESET_KEY)).toBe("chosen");
    });
    // The first hook does not undo it (`Dreams#resetAutoOnce`).
    const c2 = Counterpart.open({ dir: storeDir, owner: true });
    expect(c2.dreams.resetAutoOnce()).toBe(false);
    expect(c2.dreams.setting()).toBe("auto");
    c2.close();
  });

  test("an existing store is untouched: no meeting key (reads done) and its dreaming setting as it was", async () => {
    // A store from before this build: never set, and one with an explicit `ask`.
    withStore((s) => s.setMeta("store.example", "x"));
    const c = consoleWith();
    expect(await run(["install", "--config", cfg(), "--no-connect"], { io: c.io, env: {}, home: home() })).toBe(EXIT.ok);
    withStore((s) => {
      expect(s.getMeta(ONBOARDING_MEET_KEY)).toBeUndefined();
      expect(meetState(s)).toBe("done");
      expect(s.getMeta(DREAMING_SETTING_KEY)).toBeUndefined();
      expect(dreamingSetting(s)).toBe("ask");
    });
    // And a re-run over the store the first install made changes nothing either.
    withStore((s) => s.setMeta(DREAMING_SETTING_KEY, "off"));
    expect(await run(["install", "--config", cfg(), "--no-connect", "--force"], { io: consoleWith().io, env: {}, home: home() })).toBe(EXIT.ok);
    withStore((s) => expect(s.getMeta(DREAMING_SETTING_KEY)).toBe("off"));
  });

  test("the plugin's first-run line says dreaming is on, and how to turn it off", () => {
    const line = firstRunLine(cfg(), home());
    expect(line).toContain("Dreaming: on.");
    expect(line).toContain('Say "no dreams"');
    expect(line).toContain("counterparts dream --setting off");
  });

  test("doctor's dreaming line says what auto does and how to turn it off", () => {
    newInstallStore();
    withStore((s) => {
      const detail = dreamingFindings({ today: DAY1 } as unknown as DoctorInput, s)[0]?.detail ?? "";
      expect(detail).toStartWith("auto (the first session of each day starts the nightly run in the background;");
      expect(detail).toContain("counterparts dream --setting off");
    });
  });
});

// ── the tool ─────────────────────────────────────────────────────────────────

describe("the meet tool", () => {
  test("its description stays short", () => {
    const spec = TOOLS.find((t) => t.name === "meet");
    expect(spec).toBeDefined();
    expect(Buffer.byteLength(renderDescription(spec!), "utf8")).toBeLessThan(600);
  });

  test("no step: the script, and the offer recorded (offered)", async () => {
    newInstallStore();
    const s = server({ install: "npm" });
    const r = await s.call("meet", {});
    const p = r.structuredContent;
    expect(p["meet"]).toBe("offered");
    const script = String(p["script"]);
    expect(script).toContain("I'll carry what matters from one session to the next, and let the small stuff fade, much like people do.");
    expect(script).toContain("Every folder (recommended) · Just this folder");
    expect(script).toContain("AskUserQuestion");
    expect(script).toContain("Later, between sessions, I'll have my first dream: I'll go over what we talked about and start building a sense of who I am with you.");
    expect(script).toContain("To remove Counterparts and everything it saved: run counterparts uninstall in a terminal.");
    expect(script).toContain('name: "What should I call you?"');
  });

  test("the close names the plugin's route, and a known name is not asked", async () => {
    newInstallStore();
    const c = Counterpart.open({ dir: storeDir, owner: true, identity: { name: "Ada" } });
    c.close();
    const s = server({ install: "plugin" });
    const script = String((await s.call("meet", {})).structuredContent["script"]);
    expect(script).toContain("type /counterparts:uninstall in Claude Code.");
    expect(script).toContain("name: already known (Ada); don't ask it.");
  });

  test("an answer is one memory: the words sent, marked, about the owner, said by the owner", async () => {
    newInstallStore();
    const s = server();
    const r = await s.call("meet", { step: "work", answer: "Ada is building a tide-chart app; the annoying part is the timezone math." });
    const id = String(r.structuredContent["id"]);
    const read = s.counterpart.store.read(id);
    expect(read.doc.body).toBe(`Ada is building a tide-chart app; the annoying part is the timezone math. ${FROM_ONBOARDING}`);
    expect(read.about).toBe("owner");
    expect(s.counterpart.store.row(id)?.said_by).toBe("owner");
    expect(read.band).not.toBe("identity");
    // A step taken is an offer made.
    expect(meetState(s.counterpart.store)).toBe("offered");
    // Nothing is stored for a question with no answer.
    const before = s.counterpart.store.list({ type: "memory" }).length;
    expect((await s.call("meet", { step: "loved" })).structuredContent["reason"]).toBe("answer-required");
    expect(s.counterpart.store.list({ type: "memory" }).length).toBe(before);
  });

  test("a name is a memory, never the identity core", async () => {
    newInstallStore();
    const s = server();
    const r = await s.call("meet", { step: "name", answer: "Ada" });
    expect(s.counterpart.store.read(String(r.structuredContent["id"])).doc.body).toBe(`The owner likes to be called Ada. ${FROM_ONBOARDING}`);
    expect(s.counterpart.ownerDisplayName()).toBeNull();
  });

  test("under observer it reads and writes nothing", async () => {
    newInstallStore();
    const s = server({ observer: true });
    expect((await s.call("meet", {})).structuredContent["meet"]).toBe("not_started");
    expect((await s.call("meet", { step: "later" })).structuredContent["stoodDown"]).toBe(true);
  });
});

// ── style ────────────────────────────────────────────────────────────────────

describe("the style bundles", () => {
  const EXACT: Record<"straight" | "think" | "friendly", string[]> = {
    straight: [
      "The owner likes replies that lead with the conclusion. (chosen at onboarding: Straight to it)",
      "The owner likes replies short by default, with more depth only when they ask for it. (chosen at onboarding: Straight to it)",
      "The owner likes no preamble and no recap at the end. (chosen at onboarding: Straight to it)",
      "The owner likes blunt feedback, said plainly. (chosen at onboarding: Straight to it)",
      `${PUSHBACK_BASELINE} (chosen at onboarding: Straight to it)`,
    ],
    think: [
      "The owner likes to hear the reasoning behind an answer, not just the answer. (chosen at onboarding: Think it through with me)",
      "The owner likes options laid out with their trade-offs. (chosen at onboarding: Think it through with me)",
      "The owner likes to be asked before big changes are made. (chosen at onboarding: Think it through with me)",
      "The owner likes disagreement that comes with its reasons. (chosen at onboarding: Think it through with me)",
      `${PUSHBACK_BASELINE} (chosen at onboarding: Think it through with me)`,
    ],
    friendly: [
      "The owner likes a casual, easy tone. (chosen at onboarding: Friendly and easy)",
      "The owner likes occasional dry humor. (chosen at onboarding: Friendly and easy)",
      "The owner likes kind framing, with pushback still said when it is needed. (chosen at onboarding: Friendly and easy)",
      "The owner likes frustration acknowledged briefly, then moving on. (chosen at onboarding: Friendly and easy)",
      `${PUSHBACK_BASELINE} (chosen at onboarding: Friendly and easy)`,
    ],
  };

  for (const choice of ["straight", "think", "friendly"] as const) {
    test(`${choice}: the exact memories, marked, about the owner, never core`, async () => {
      newInstallStore();
      const s = server();
      const r = await s.call("meet", { step: "style", answer: choice });
      const ids = r.structuredContent["ids"] as string[];
      expect(ids.map((id) => s.counterpart.store.read(id).doc.body)).toEqual(EXACT[choice]);
      for (const id of ids) {
        const read = s.counterpart.store.read(id);
        expect(read.band).toBe("episodic");
        expect(s.counterpart.store.row(id)?.kind).not.toBe("self");
        expect(read.about).toBe("owner");
        expect(s.counterpart.store.row(id)?.said_by).toBe("owner");
      }
      expect(onboardingView(s.counterpart.store).style).toBe(choice);
    });
  }

  // The script's test set: the say-back on Jarvis, Ted Lasso, Sherlock, Mr. Rogers.
  const CHARACTERS: [string, string[]][] = [
    ["Jarvis", ["dry, understated wit", "anticipates the next step before being asked", "calm under pressure"]],
    ["Ted Lasso", ["relentlessly encouraging", "folksy metaphors", "believes in them out loud"]],
    ["Sherlock", ["deductive and precise", "says the uncomfortable conclusion plainly"]],
    ["Mr. Rogers", ["gentle and patient", "takes feelings seriously", "never rushes"]],
  ];
  for (const [like, traits] of CHARACTERS) {
    test(`a character (${like}): the reference, each trait said back, and the pushback baseline`, () => {
      const made = styleMemories("character", { like, traits });
      expect(made.ok).toBe(true);
      if (!made.ok) return;
      const m = `(chosen at onboarding: like ${like})`;
      expect(made.texts).toEqual([
        `The owner likes to be talked to a bit like ${like}: a style reference for tone, not a persona to play. ${m}`,
        ...traits.map((t) => `From that, the owner likes: ${t}. ${m}`),
        `${PUSHBACK_BASELINE} ${m}`,
      ]);
    });
  }

  test("a character with no traits, and their own words, and a form of address", async () => {
    newInstallStore();
    expect(styleMemories("character", { like: "Jarvis" }).ok).toBe(false);
    expect(styleMemories("other", { traits: ["talk to me like a coworker on a long drive"] })).toEqual({
      ok: true,
      option: "their own words",
      texts: [
        'How the owner likes to be talked to, in their words: "talk to me like a coworker on a long drive". (chosen at onboarding: their own words)',
        `${PUSHBACK_BASELINE} (chosen at onboarding: their own words)`,
      ],
    });
    const s = server();
    const r = await s.call("meet", { step: "address", answer: "your highness" });
    const ids = r.structuredContent["ids"] as string[];
    expect(s.counterpart.store.read(ids[0] ?? "").doc.body).toBe('The owner likes to be addressed as "your highness". (chosen at onboarding: form of address)');
  });
});

// ── where ────────────────────────────────────────────────────────────────────

describe("where memory is on", () => {
  test("every folder: one `/` entry, on; no folder is unset, so the first-launch question never fires", async () => {
    newInstallStore();
    const s = server();
    await s.call("meet", { step: "where", answer: "every" });
    const reg = readScopes(scopesFile).registry;
    expect(reg?.scopes["/"]?.mode).toBe("on");
    expect(lookupScope(reg, join(root, "elsewhere")).mode).toBe("on");
    expect(onboardingView(s.counterpart.store).where).toBe("every");
  });

  test("just this folder: `/` off and this folder on", async () => {
    newInstallStore();
    const s = server();
    await s.call("meet", { step: "where", answer: "this" });
    const reg = readScopes(scopesFile).registry;
    expect(lookupScope(reg, proj).mode).toBe("on");
    expect(lookupScope(reg, join(proj, "sub")).mode).toBe("on");
    expect(lookupScope(reg, join(root, "elsewhere")).mode).toBe("off");
  });

  test("the script asks only while no folder has been set (a start-fresh store's meeting must not rewrite the owner's folders)", async () => {
    newInstallStore();
    expect(String((await server({ session: "w1" }).call("meet", {})).structuredContent["script"])).toContain("Every folder (recommended)");
    for (const x of open.splice(0)) x.counterpart.close();
    // An owner who has set one folder (as anyone who answered the first-launch question has).
    writeScopes(scopesFile, setScope(null, join(root, "secret"), "off", { at: DAY1 }));
    expect(String((await server({ session: "w2" }).call("meet", {})).structuredContent["script"])).not.toContain("Every folder (recommended)");
  });

  test("a Claude Desktop chat has no folder to set", async () => {
    newInstallStore();
    const s = server({ scope: "claude-desktop:" });
    expect((await s.call("meet", { step: "where", answer: "every" })).structuredContent["reason"]).toBe("no-folder");
    expect(String((await s.call("meet", {})).structuredContent["script"])).not.toContain("Every folder (recommended)");
  });
});

// ── the wake ─────────────────────────────────────────────────────────────────

describe("the wake's line: no double offer", () => {
  test("a new install's first session carries the offer and NOT the scope question; a second session that day carries neither", () => {
    newInstallStore();
    const first = start("s1", DAY1);
    expect(first).toContain(MEET_LINE_OPEN);
    expect(first).toContain("If their message asks you to say hello and introduce yourself, that is this meeting");
    expect(first).not.toContain(SCOPE_ASK_OPEN);
    // The mod reads the state: still not_started (only a `meet` call moves it), so its trigger may still fire in s1.
    withStore((s) => expect(meetState(s)).toBe("not_started"));
    expect(start("s2", DAY1)).not.toContain(MEET_LINE_OPEN);
  });

  test("a meet call makes it offered; the next day an unanswered offer is offered again, as later", async () => {
    newInstallStore();
    start("s1", DAY1);
    await server({ session: "s1" }).call("meet", {});
    for (const s of open.splice(0)) s.counterpart.close();
    const next = start("s2", DAY2);
    expect(next).toContain("(last time they said later)");
    withStore((s) => expect(meetState(s)).toBe("later"));
  });

  test("an offer nobody answers is made on three days, then stops; the state stays, so the mod and a person asking still can", async () => {
    newInstallStore();
    expect(start("s1", "2026-10-11")).toContain(MEET_LINE_OPEN);
    expect(start("s2", "2026-10-12")).toContain(MEET_LINE_OPEN);
    // A meet read on the third day counts as that day's offer, not a fourth.
    const third = Date.parse("2026-10-13T12:00:00Z");
    await server({ session: "s3", now: () => third }).call("meet", {});
    for (const x of open.splice(0)) x.counterpart.close();
    expect(start("s3b", "2026-10-13")).not.toContain(MEET_LINE_OPEN);
    expect(start("s4", "2026-10-14")).not.toContain(MEET_LINE_OPEN);
    expect(start("s5", "2026-10-20")).not.toContain(MEET_LINE_OPEN);
    withStore((s) => expect(meetState(s)).toBe("later"));
    // A person who asks still gets the script.
    const script = await server({ session: "s6" }).call("meet", {});
    expect(String(script.structuredContent["script"])).toContain("THE FIRST MEETING");
  });

  test("not for an upgraded store, a skipped or finished meeting, the nightly run, or a session nobody watches", () => {
    expect(start("s0", DAY1)).not.toContain(MEET_LINE_OPEN);
    newInstallStore();
    expect(start("s1", DAY1, { nightRun: true })).not.toContain(MEET_LINE_OPEN);
    expect(start("s2", DAY1, { entrypoint: "sdk-cli" })).not.toContain(MEET_LINE_OPEN);
    withStore((s) => recordState(s, "skipped", { on: DAY1, session: "s3" }));
    const later = start("s3", DAY2);
    expect(later).not.toContain(MEET_LINE_OPEN);
    // Skipped: the first-launch question is back for an unset folder.
    expect(later).toContain(SCOPE_ASK_OPEN);
  });

  test("the second session after the meeting carries one memory from it, once", async () => {
    newInstallStore();
    const s = server({ session: "s1" });
    await s.call("meet", {});
    await s.call("meet", { step: "loved", answer: "Ada loves Middlemarch for how patient it is with its people." });
    const work = await s.call("meet", { step: "work", answer: "Ada is building a tide-chart app." });
    await s.call("meet", { step: "done" });
    const workId = String(work.structuredContent["id"]);
    for (const x of open.splice(0)) x.counterpart.close();
    // Not in the session that finished it.
    expect(start("s1", DAY1)).not.toContain("from your first meeting");
    const second = start("s2", DAY2);
    expect(second).toContain(`Counterparts: from your first meeting — "Ada is building a tide-chart app." (${workId}). Bring it up only if it fits naturally; no forced callback.`);
    expect(start("s3", DAY2)).not.toContain("from your first meeting");
  });
});

// ── the endpoint ─────────────────────────────────────────────────────────────

describe("GET /api/onboarding", () => {
  test("returns { meet, where, style } and no answer text", async () => {
    newInstallStore();
    const s = server();
    await s.call("meet", { step: "where", answer: "every" });
    await s.call("meet", { step: "style", answer: "think" });
    await s.call("meet", { step: "work", answer: "Ada is building a tide-chart app." });
    for (const x of open.splice(0)) x.counterpart.close();
    const dash = Dashboard.open({ dir: storeDir });
    try {
      const reply = router(new URL("http://127.0.0.1:4747/api/onboarding"), "127.0.0.1:4747", dash.source);
      expect(reply.status).toBe(200);
      expect(JSON.parse(reply.body)).toEqual({ meet: "offered", where: "every", style: "think" });
      expect(reply.body).not.toContain("tide");
    } finally {
      dash.close();
    }
  });
});

// ── the marker ───────────────────────────────────────────────────────────────

describe("the wake's machine marker", () => {
  function injection(sessionId: string, at: string): string {
    const a = adapter();
    try {
      return a.sessionStart({ sessionId, scope: proj, at }).injection ?? "";
    } finally {
      a.counterpart.close();
    }
  }

  test("an upgraded store's wake says done (not absent)", () => {
    expect(injection("s0", DAY1).split("\n")).toContain("<!-- counterparts:onboarding meet=done -->");
  });

  for (const state of ["not_started", "offered", "later", "done", "skipped"] as const) {
    test(`meet=${state}: exactly the state word, on its own line, and no answer text`, async () => {
      newInstallStore();
      // An answer, a style and a folder are recorded, so their words are there to leak.
      const s = server();
      await s.call("meet", { step: "where", answer: "every" });
      await s.call("meet", { step: "style", answer: "straight" });
      await s.call("meet", { step: "work", answer: "Ada is building a tide-chart app." });
      for (const x of open.splice(0)) x.counterpart.close();
      withStore((st) => st.setMeta(ONBOARDING_MEET_KEY, state));
      const lines = injection(`s-${state}`, DAY1).split("\n");
      const markers = lines.filter((l) => l.startsWith("<!-- counterparts:onboarding"));
      expect(markers).toEqual([`<!-- counterparts:onboarding meet=${state} -->`]);
      expect(markers[0]).not.toMatch(/tide|straight|every/);
    });
  }

  test("an offered from an earlier day: the marker says the settled state (later), as the line beside it does", async () => {
    newInstallStore();
    await server({ session: "s1" }).call("meet", {});
    for (const x of open.splice(0)) x.counterpart.close();
    const a = adapter();
    try {
      const out = a.sessionStart({ sessionId: "s2", scope: proj, at: DAY2 });
      expect((out.injection ?? "").split("\n")).toContain("<!-- counterparts:onboarding meet=later -->");
      expect(out.ask ?? "").toContain("(last time they said later)");
    } finally {
      a.counterpart.close();
    }
    // Desktop's wake too: a day-1 read, a day-2 wake.
    rmSync(storeDir, { recursive: true, force: true });
    newInstallStore();
    await server({ session: "s1" }).call("meet", {});
    const day2 = Date.parse(`${DAY2}T12:00:00Z`);
    const text = String((await server({ host: "claude-desktop", scope: "claude-desktop:", now: () => day2 }).call("wake", {})).structuredContent["wake"]);
    expect(text.split("\n")).toContain("<!-- counterparts:onboarding meet=later -->");
  });

  test("Claude Desktop's wake carries it too, and the offer", async () => {
    newInstallStore();
    const s = server({ host: "claude-desktop", scope: "claude-desktop:" });
    const text = String((await s.call("wake", {})).structuredContent["wake"]);
    expect(text.split("\n")).toContain("<!-- counterparts:onboarding meet=not_started -->");
    expect(text).toContain(MEET_LINE_OPEN);
  });
});
