/**
 * Adversarial review of #256 (reflection, the morning share, core by meaning;
 * 2026-09-27). Each test here failed on the PR head (69a6138) or checks a
 * claim the PR's own tests left open; `docs/adversarial-review-pr256-2026-09-27.md`
 * names each one.
 *
 * Hermetic: a fresh temp data dir per test, removed after. No model is called.
 */
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openServer } from "../src/adapters/mcp/index.js";
import { run } from "../src/adapters/cli/index.js";
import { recordSession } from "../src/adapters/sessions.js";
import { Counterpart } from "../src/core/counterpart.js";
import { REFLECTED_FEELING_KEY, TUNABLES as SLEEP, aboutMe, promotionRecordKey, runCycle } from "../src/core/sleep/index.js";
import { V9_UPGRADE_KEY, paths } from "../src/core/store/index.js";
import type { PutInput } from "../src/core/store/index.js";

let dir: string;
const open: Counterpart[] = [];
const SESSION = "s-review";

beforeEach(() => {
  dateN = 0;
  dir = mkdtempSync(join(tmpdir(), "counterparts-reflect-review-"));
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

function brain(opts: { owner?: boolean; observer?: boolean } = {}): Counterpart {
  const c = Counterpart.open({
    dir,
    owner: opts.owner ?? true,
    ...(opts.observer === true ? { observer: true } : { identity: { name: "Mike" } }),
  });
  open.push(c);
  return c;
}

function mem(c: Counterpart, body: string, over: Partial<PutInput> = {}): string {
  const day = c.store.livedDay();
  return c.store.put({
    type: "memory",
    kind: "fact",
    body,
    salience: { relevance: 0.6, emotional: 0.3, predictive: 0.6 },
    physics: { birthDay: day, lastUsedDay: day },
    ...over,
  });
}

let dateN = 0;
function date(n: number): string {
  return new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString().slice(0, 10);
}
function nextDay(c: Counterpart): number {
  dateN += 1;
  c.store.advanceClock(date(dateN));
  return c.store.livedDay();
}
function sleepNow(c: Counterpart): ReturnType<typeof runCycle> {
  dateN += 1;
  return runCycle({ store: c.store, date: date(dateN), cadence: { consolidate: 1 } });
}

function reflect(c: Counterpart, cites: string[], extra: Record<string, unknown> = {}, session = SESSION) {
  const begun = c.reflections.begin({ session });
  if (!begun.ok) throw new Error(`begin refused: ${begun.reason}`);
  const done = c.reflections.finish({
    reflection: begun.bundle.reflection,
    session,
    entry: "Looking back over the last few days, a few things stand out.",
    cites,
    ...extra,
  });
  if (!done.ok) throw new Error(`finish refused: ${done.reason}`);
  return { bundle: begun.bundle, outcome: done.outcome };
}

/** A dream today that wrote one gist (kind self) from two memories. */
function dreamWithGist(c: Counterpart): { dream: string; gist: string; felt: string; plain: string } {
  nextDay(c);
  for (let i = 0; i < 3; i += 1) nextDay(c);
  const felt = mem(c, "I felt proud when Mike said the dashboard finally reads like a person.", {
    kind: "self",
    about: "me",
    salience: { relevance: 0.8, emotional: 0.8, predictive: 0.5 },
  });
  const plain = mem(c, "The dashboard's memory list sorts by lived day now.");
  mem(c, "The dashboard deploys when main is pushed.");
  const begun = c.dreams.begin({ session: SESSION });
  if (!begun.ok) throw new Error(`dream refused: ${begun.reason}`);
  const g = c.dreams.propose({
    dream: begun.bundle.dream,
    session: SESSION,
    changes: [
      {
        action: "gist",
        kind: "self",
        text: "Underneath all the dashboard work I want to be seen as a person and not a tool.",
        sources: [felt, plain],
      },
    ],
  });
  if (!g.ok || g.results[0]?.ok !== true) throw new Error("gist refused");
  const j = c.dreams.journal({ dream: begun.bundle.dream, session: SESSION, title: "the window", text: "I dreamed the dashboard was a window." });
  if (!j.ok) throw new Error("journal refused");
  return { dream: begun.bundle.dream, gist: g.results[0].id as string, felt, plain };
}

// ---------------------------------------------------------------------------
// B1 — dream words into the core through the reflection
// ---------------------------------------------------------------------------

describe("B1: a dreamed gist cannot be felt later or marked about me by a reflection", () => {
  test("the reflection's feeling and mark on a gist are refused, so one organic use cannot carry the gist into the core", () => {
    const c = brain();
    const d = dreamWithGist(c);
    const begun = c.reflections.begin({ session: SESSION, dream: d.dream });
    if (!begun.ok) throw new Error(begun.reason);
    expect(Object.keys(begun.bundle.memories)).toContain(d.gist);
    const done = c.reflections.finish({
      reflection: begun.bundle.reflection,
      session: SESSION,
      entry: "The dream's pattern rings true.",
      cites: [d.felt],
      feelings: [{ id: d.gist, core: "happy", emotion: "hopeful", strength: 0.9 }],
      about: [{ id: d.gist, about: "me", why: "it is who I am" }],
    });
    if (!done.ok) throw new Error(String(done.reason));
    expect(done.outcome.feelings[0]).toMatchObject({ id: d.gist, ok: false });
    expect(done.outcome.about[0]).toMatchObject({ id: d.gist, ok: false });
    expect(c.store.feelingsFor(d.gist)).toEqual([]);
    // Marking a gist `work` or `world` — out of the candidates — is still allowed.
    nextDay(c);
    const again = c.reflections.begin({ session: SESSION });
    if (!again.ok) throw new Error(again.reason);
    // (Not shown on a dreamless night: nothing to mark. The main pass keeps gists out.)
    expect(Object.keys(again.bundle.memories)).not.toContain(d.gist);
    c.reflections.finish({ reflection: again.bundle.reflection, session: SESSION, entry: "quiet", cites: [] });

    // One organic use two days after it was written, then sleep: the gist stays out of the core.
    nextDay(c);
    nextDay(c);
    c.store.reinforce(d.gist, c.store.livedDay(), "referenced", { cued: true });
    const report = sleepNow(c);
    expect(report.promoted.map((p) => p.id)).not.toContain(d.gist);
    expect(c.store.row(d.gist)?.promoted_identity).toBe(0);
  });

  test("a gist may still be marked work (the safer direction)", () => {
    const c = brain();
    const d = dreamWithGist(c);
    const begun = c.reflections.begin({ session: SESSION, dream: d.dream });
    if (!begun.ok) throw new Error(begun.reason);
    const done = c.reflections.finish({
      reflection: begun.bundle.reflection,
      session: SESSION,
      entry: "Not about me after all.",
      cites: [d.felt],
      about: [{ id: d.gist, about: "work" }],
    });
    if (!done.ok) throw new Error(String(done.reason));
    expect(done.outcome.about[0]).toMatchObject({ id: d.gist, ok: true });
    expect(c.store.read(d.gist).about).toBe("work");
  });

  test("a reflection's own entry, nominated by the next dream, is not handed back to a reflection as a memory to mark or feel", () => {
    const c = brain();
    nextDay(c);
    for (let i = 0; i < 3; i += 1) nextDay(c);
    const felt = mem(c, "I felt proud when Mike trusted me with the release.", {
      kind: "self",
      about: "me",
      salience: { relevance: 0.8, emotional: 0.8, predictive: 0.5 },
    });
    for (let i = 0; i < 3; i += 1) mem(c, `A fresh memory about the release, number ${String(i)}.`);
    const first = reflect(c, [felt]);
    const entry = first.outcome.entryId as string;
    expect(c.store.row(entry)?.source).toBe("reflection");
    nextDay(c);
    const dream = c.dreams.begin({ session: SESSION });
    if (!dream.ok) throw new Error(dream.reason);
    expect(Object.keys(dream.bundle.memories)).toContain(entry);
    const p = c.dreams.propose({ dream: dream.bundle.dream, session: SESSION, changes: [{ action: "nominate-core", id: entry, why: "it sounds like me" }] });
    if (!p.ok) throw new Error("propose refused");
    expect(p.results[0]?.ok).toBe(true);
    c.dreams.journal({ dream: dream.bundle.dream, session: SESSION, text: "I dreamed of the release." });
    const begun = c.reflections.begin({ session: SESSION, dream: dream.bundle.dream });
    if (!begun.ok) throw new Error(begun.reason);
    expect(Object.keys(begun.bundle.memories)).not.toContain(entry);
    const done = c.reflections.finish({
      reflection: begun.bundle.reflection,
      session: SESSION,
      entry: "Again.",
      cites: [felt],
      feelings: [{ id: entry, core: "happy", emotion: "proud", strength: 0.9 }],
      about: [{ id: entry, about: "me" }],
    });
    if (!done.ok) throw new Error(String(done.reason));
    expect(done.outcome.feelings[0]?.ok).toBe(false);
    expect(done.outcome.about[0]?.ok).toBe(false);
    expect(c.store.read(entry).about).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// S1 — the page carries no dream's words, from any dream
// ---------------------------------------------------------------------------

describe("S1: a gist's words stay off the page whichever dream wrote it", () => {
  test("a reflection on its own, the day after a dream, cannot reword that dream's gist onto the page", () => {
    const c = brain();
    const d = dreamWithGist(c);
    reflect(c, [d.felt], {}, SESSION);
    nextDay(c);
    const gistWords = c.store.row(d.gist)?.body ?? "";
    const { outcome } = reflect(c, [d.felt], { page: { text: `## Core\n\n${gistWords}`, cites: [d.felt] } });
    expect(outcome.page).toMatchObject({ written: false, reason: "dreamed-words-on-the-page" });
  });
});

// ---------------------------------------------------------------------------
// S3 — the v9 upgrade carries the old rule onto every row it read
// ---------------------------------------------------------------------------

describe("S3: the v9 upgrade marks a person-kind schema row naming the owner, as the old rule read it", () => {
  test("a belief about the owner (schema, person) is a candidate the morning after, and the record counts it", () => {
    const root = dir;
    dir = join(root, "store");
    try {
      const c = brain();
      nextDay(c);
      const day = c.store.livedDay();
      const belief = c.store.put({
        type: "schema",
        kind: "person",
        body: "Mike prefers to talk a decision through out loud before he commits to it.",
        salience: { relevance: 0.7, emotional: 0.3, predictive: 0.7 },
        physics: { birthDay: day, lastUsedDay: day },
        meta: { role: "belief" },
      });
      const self = mem(c, "I say what I do not know before I guess.", { kind: "self" });
      c.close();
      open.splice(0);
      const db = new Database(paths.operational(dir));
      db.run("UPDATE memories SET about = NULL, about_by = NULL");
      db.run("UPDATE meta SET value = '8' WHERE key = 'schemaVersion'");
      db.close();
      const after = Counterpart.open({ dir, owner: true, snapshotsDir: join(root, "snaps") });
      open.push(after);
      expect(after.store.read(belief)).toMatchObject({ about: "owner", aboutBy: "upgrade" });
      expect(aboutMe(after.store, after.store.row(belief)!)).toBe(true);
      expect(aboutMe(after.store, after.store.row(self)!)).toBe(true);
      const record = JSON.parse(after.store.getMeta(V9_UPGRADE_KEY) ?? "{}") as Record<string, unknown>;
      // The identity core (a self schema row) was a candidate by the old rule too.
      expect(record["candidates"]).toBe(3);
    } finally {
      dir = root;
    }
  });
});

// ---------------------------------------------------------------------------
// S4 — the open door is shown, whichever half of the lane the reflection gave
// ---------------------------------------------------------------------------

describe("S4: a promotion that needed a feeling recorded later is shown like one on reflection alone", () => {
  test("organic return + a feeling only the reflection recorded: the record says so, doctor counts it, the next share names it", async () => {
    const { reflectionFindings } = await import("../src/adapters/claude-code/doctor.js");
    const c = brain();
    nextDay(c);
    const id = mem(c, "Mike lets an AI act for itself.", { kind: "person", about: "us", salience: { relevance: 0.7, emotional: 0, predictive: 0.5 } });
    nextDay(c);
    nextDay(c);
    // The feeling comes from a reflection that cites something else.
    const other = mem(c, "A quiet day of tests.", { kind: "fact" });
    nextDay(c);
    const begun = c.reflections.begin({ session: SESSION });
    if (!begun.ok) throw new Error(begun.reason);
    c.reflections.finish({
      reflection: begun.bundle.reflection,
      session: SESSION,
      entry: "It matters that he trusts me.",
      cites: [other],
      feelings: [{ id, core: "happy", emotion: "hopeful", strength: 0.8 }],
    });
    nextDay(c);
    // The return is ORGANIC.
    expect(c.store.reinforce(id, c.store.livedDay(), "referenced", { cued: true }).ret?.counted).toBe(true);
    const report = sleepNow(c);
    expect(report.promoted.map((p) => p.id)).toEqual([id]);
    const record = JSON.parse(c.store.getMeta(promotionRecordKey(id)) ?? "{}") as Record<string, unknown>;
    expect(record["reflectionOnly"]).toBe(false);
    expect(record["feelingRecordedLater"]).toBe(true);
    const line = reflectionFindings({ today: c.store.today() } as never, c.store)[0];
    expect(line?.detail).toContain("on a feeling a reflection recorded later");
    nextDay(c);
    const next = reflect(c, []);
    expect(next.bundle.becameCore).toEqual([id]);
    expect(next.outcome.share.offered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S5 — a carried share is claimed once, even by two sessions racing
// ---------------------------------------------------------------------------

describe("S5: carrying a share is a claim, not a read then a write", () => {
  test("a second session that read the share as still offered does not carry it again", () => {
    const a = brain();
    nextDay(a);
    nextDay(a);
    const id = mem(a, "I felt proud of the release.", { kind: "self", about: "me" });
    const { bundle } = reflect(a, [id], { share: { text: "I've been thinking about the release.", cites: [id] } });
    const b = brain();
    const stale = b.store.reflection(bundle.reflection);
    expect(stale?.share_state).toBe("offered");
    // Session A carries it.
    expect(a.reflections.carryLine({ session: "s-a", reflection: bundle.reflection })).not.toBe(null);
    // Session B had read it as offered in the same instant.
    const reflection = b.store.reflection.bind(b.store);
    b.store.reflection = (x: string) => (x === bundle.reflection ? stale : reflection(x));
    expect(b.reflections.carryLine({ session: "s-b", reflection: bundle.reflection })).toBe(null);
    expect(a.store.reflection(bundle.reflection)?.share_session).toBe("s-a");
  });
});

