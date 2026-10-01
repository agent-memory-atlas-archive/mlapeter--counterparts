/**
 * CONTINUITY — can a new session pick up where the last one in this directory
 * left off? (2026-09-30, the continuity test.)
 *
 * Mike ended a ~/random session (an evening of reading: notes, a chapter,
 * session_end memories, NO handoff, because the work was finished), opened a
 * new one in the same directory two minutes later and asked "what do you
 * remember from our most recent session?". Nothing was lost; nothing pointed
 * at it. The wake's pointer moved only for a handoff, and the one that stood
 * (another session's, from 15:19) said "work here 16:01–17:53 since, not yet
 * written up" although a chapter had been written at 17:50.
 *
 * This file reproduces that afternoon on a temp store, through the same doors
 * the hooks and the MCP server use, and checks the wake half:
 *   1. B's wake says who was last here, when, the chapter's title and id, and
 *      its first sentence — spliced at delivery, so it shows two minutes
 *      later, not only after the next boundary;
 *   2. the handoff pointer says how far the work since is written up.
 *
 * Hermetic: every test makes its own temp directory and removes it. The clock
 * is pinned and the zone is UTC.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { sessionsHere } from "../src/core/coverage/index.js";
import {
  LAST_HERE_LIFE_DAYS,
  chaptersBySession,
  latestChapter,
  lastHereBlock,
  lastHereLadder,
} from "../src/core/handoff/last-here.js";
import type { LastHere } from "../src/core/handoff/last-here.js";
import { readSentinel } from "../src/core/self/index.js";
import { McpServer } from "../src/adapters/mcp/server.js";
import { recordSession } from "../src/adapters/sessions.js";

const MIN = 60_000;
const ZONE = "UTC";
/** 2026-09-30 00:00 UTC; the afternoon is counted from here. */
const DAY0 = Date.UTC(2026, 8, 30);
const at = (h: number, m: number): number => DAY0 + h * 60 * MIN + m * MIN;

/** Claude Code session ids are UUIDs; the wake prints the first eight. */
const A = "a1b2c3d4-0000-4000-8000-00000000000a";
const B = "b5b6b7b8-0000-4000-8000-00000000000b";
const C = "c9cacbcc-0000-4000-8000-00000000000c";

const TITLE = "An evening reading off the shelves: grief, anger, Job, and Montaigne at the table";
const CHAPTER =
  "We read four texts in a row and every one of them ended grief at a table. Karamazov first, then Iliad 24, then Job, then Montaigne's three meals.";

let root: string;
let storeDir: string;
let HERE: string;
let THERE: string;
const open: { close(): void }[] = [];

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-continuity-")));
  storeDir = join(root, "store");
  HERE = join(root, "random");
  THERE = join(root, "elsewhere");
  mkdirSync(HERE, { recursive: true });
  mkdirSync(THERE, { recursive: true });
});

afterEach(() => {
  for (const c of open.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(root, { recursive: true, force: true });
});

/** A counterpart on a clock the test turns, in UTC, and the MCP server a
 *  session in HERE would talk to. */
function afternoon(): {
  c: Counterpart;
  set(t: number): void;
  server(session: string, scope?: string): McpServer;
  talk(session: string, t: number, scope?: string): void;
} {
  let now = at(15, 0);
  const c = Counterpart.open({ dir: storeDir, owner: true, now: () => now, timeZone: ZONE });
  open.push(c);
  const turns = new Map<string, { role: "user" | "assistant"; text: string }[]>();
  return {
    c,
    set(t: number): void {
      now = t;
    },
    server(session: string, scope = HERE): McpServer {
      return new McpServer({ counterpart: c, session, scope, owner: true, registryDir: storeDir, now: () => now });
    },
    // One turn, as the Stop hook captures it: the transcript so far, then the
    // turn-end.
    talk(session: string, t: number, scope = HERE): void {
      now = t;
      const held = turns.get(session) ?? [];
      held.push({ role: "user", text: `(${session.slice(0, 4)} at ${String(t)}) the next passage, read aloud and talked over at some length.` });
      held.push({ role: "assistant", text: `(${session.slice(0, 4)}) understood, and here is what it made me think of.` });
      turns.set(session, held);
      c.captureSpans({ session, scope, turns: [...held] });
      c.boundary({ session, scope, kind: "stop" });
    },
  };
}

function wake(c: Counterpart, session: string, scope = HERE): string {
  return c.wake(9_000, { date: "2026-09-30" }, { scope, session }).text;
}

/** Mike's afternoon: C's handoff at 15:19, a boundary at 15:30, then A's
 *  evening — turns from 16:01, notes, a chapter at 17:50, session_end with no
 *  handoff, and three more turns to 17:53. */
async function mikesAfternoon(k: ReturnType<typeof afternoon>): Promise<{ episodeId: string }> {
  k.set(at(15, 19));
  k.c.writeHandoff("The release is cut; the tarball is in the backups folder. Mike publishes.", { scope: HERE, session: C });
  // The bundle is composed BEFORE session A exists: everything A leaves has
  // to arrive by the delivery splice, as it did two minutes apart.
  k.set(at(15, 30));
  k.c.rebrief({ budgetBytes: 9_000, at: "2026-09-30" });
  recordSession(storeDir, { sessionId: A, scope: HERE, phase: "start", at: at(16, 0), model: "claude-opus-5-5" });
  const s = k.server(A);
  // `at(16, 61)` is 17:01: minutes past the hour are counted from 16:00.
  for (let m = 1; m <= 101; m += 10) k.talk(A, at(16, m));
  k.set(at(17, 42));
  const noted = await s.call("note", { text: "Every text we read tonight ended grief at a table.", session: A });
  expect(noted.isError).not.toBe(true);
  k.talk(A, at(17, 44));
  k.set(at(17, 45));
  const ended = await s.call("session_end", {
    session: A,
    memories: [{ content: "Montaigne kept his memory on paper and his grief at three meals a day." }],
  });
  expect(ended.isError).not.toBe(true);
  k.talk(A, at(17, 48));
  k.set(at(17, 50));
  const ch = await s.call("chapter", { session: A, text: CHAPTER, title: TITLE });
  expect(ch.isError).not.toBe(true);
  const episodeId = (ch.structuredContent as Record<string, unknown>)["episodeId"] as string;
  expect(episodeId).toMatch(/^epi_/);
  // A keeps talking after the write-up.
  for (const m of [51, 52, 53]) k.talk(A, at(17, m));
  k.set(at(17, 55));
  return { episodeId };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("the next session here is told who was last here", () => {
  test("Mike's test, end to end: B's wake names A's chapter, and the pointer says how far it is written up", async () => {
    const k = afternoon();
    const { episodeId } = await mikesAfternoon(k);
    const text = wake(k.c, B);
    const lines = text.split("\n");
    const last = lines.find((l) => l.startsWith("Last here:"));
    expect(last).toBe(
      `Last here: session a1b2c3d4 on Opus 5.5, 09-30 16:01–17:53 — "${TITLE}" (${episodeId}). We read four texts in a row and every one of them ended grief at a table.`,
    );
    // The handoff C left stands, at the foot, and now says how much of A's
    // evening is written up instead of "not yet written up".
    const pointer = lines.find((l) => l.startsWith("Where I left off in this directory"));
    expect(pointer).toContain("by session c9cacbcc");
    expect(pointer).toContain("work here 16:01–17:53 since, written up to 17:50 (chapter), 3 pieces after");
    // Order: Last here above the pointer, both above the sentinel.
    expect(lines.indexOf(last as string)).toBeLessThan(lines.indexOf(pointer as string));
    // The sentinel states the delivered total.
    expect(readSentinel(text).intact).toBe(true);
  });

  test("with no handoff at all, a finished session still leaves the line", async () => {
    const k = afternoon();
    recordSession(storeDir, { sessionId: A, scope: HERE, phase: "start", at: at(16, 0), model: "claude-opus-5-5" });
    k.c.rebrief({ budgetBytes: 9_000, at: "2026-09-30" });
    const s = k.server(A);
    for (const m of [1, 20, 40]) k.talk(A, at(16, m));
    k.set(at(16, 45));
    await s.call("chapter", { session: A, text: CHAPTER, title: TITLE });
    k.set(at(16, 47));
    const text = wake(k.c, B);
    expect(text).toContain(`Last here: session a1b2c3d4 on Opus 5.5, 09-30 16:01–16:45 — "${TITLE}"`);
    expect(text).not.toContain("Where I left off");
  });

  test("the waking session's own chapter reads 'this session'; another directory is told nothing", async () => {
    const k = afternoon();
    await mikesAfternoon(k);
    expect(wake(k.c, A)).toContain("Last here: this session on Opus 5.5, 09-30 16:01");
    expect(wake(k.c, B, THERE)).not.toContain("Last here:");
  });

  test("a session that wrote no chapter here is not 'last here'", async () => {
    const k = afternoon();
    await mikesAfternoon(k);
    // B talks for a while in HERE and writes nothing; A is still the one named.
    for (const m of [56, 57, 58]) k.talk(B, at(17, m));
    expect(wake(k.c, "d0d0d0d0-0000-4000-8000-00000000000d")).toContain("Last here: session a1b2c3d4");
  });

  test("several sessions here that day: the newest two named, the rest by id", async () => {
    const k = afternoon();
    k.c.rebrief({ budgetBytes: 9_000, at: "2026-09-30" });
    const ids: string[] = [];
    const sessions = ["11111111", "22222222", "33333333", "44444444"].map((p) => `${p}-0000-4000-8000-000000000000`);
    for (const [i, sess] of sessions.entries()) {
      const s = k.server(sess);
      k.talk(sess, at(10 + i, 0));
      k.set(at(10 + i, 30));
      const ch = await s.call("chapter", { session: sess, text: `Session ${String(i)} did its part of the work and wrote it down here.`, title: `Part ${String(i)}` });
      ids.push((ch.structuredContent as Record<string, unknown>)["episodeId"] as string);
    }
    const text = wake(k.c, B);
    const lines = text.split("\n");
    expect(lines.find((l) => l.startsWith("Last here:"))).toContain(`"Part 3" (${ids[3] as string}). Session 3 did its part`);
    expect(lines.find((l) => l.startsWith("Before it:"))).toBe(`Before it: session 33333333, 09-30 12:00–12:30 — "Part 2" (${ids[2] as string}).`);
    expect(lines.find((l) => l.startsWith("+2 more here on 09-30:"))).toBe(`+2 more here on 09-30: ${ids[1] as string}, ${ids[0] as string}.`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("its room in the wake", () => {
  function fill(c: Counterpart): void {
    for (let i = 0; i < 60; i++) {
      c.store.put({
        type: "memory",
        kind: "self",
        body: `Placeholder identity element ${i}, written long enough to compete for the budget.`,
        band: "identity",
        learnedOn: c.store.today(),
        salience: { relevance: 0.9, emotional: 0.6, predictive: 0.6 },
        physics: { promotedIdentity: true },
      });
    }
  }

  test("a chapter here takes room at the next boundary, and a full store still carries the line inside the ceiling", async () => {
    const k = afternoon();
    fill(k.c);
    const before = k.c.rebrief({ budgetBytes: 4_000, at: "2026-09-30" });
    expect(before.composeBudget).toBe(4_000 - 160);
    await mikesAfternoon(k);
    const after = k.c.rebrief({ budgetBytes: 4_000, at: "2026-09-30" });
    expect(after.composeBudget).toBeLessThan(4_000 - 160);
    const woke = k.c.wake(4_000, { date: "2026-09-30" }, { scope: HERE, session: B });
    expect(woke.text).toContain("Last here:");
    expect(woke.text).toContain("Where I left off");
    expect(woke.bytes).toBeLessThanOrEqual(4_000);
  });

  test("when there is not room for both, the line goes first and the handoff stays", async () => {
    const k = afternoon();
    await mikesAfternoon(k);
    const full = k.c.wake(9_000, { date: "2026-09-30" }, { scope: HERE, session: B });
    const pointerOnly = full.text
      .split("\n")
      .filter((l) => !l.startsWith("Last here:"))
      .join("\n");
    // A ceiling just under the bundle with both: the line is given up.
    const tight = new TextEncoder().encode(pointerOnly).length + 20;
    const woke = k.c.wake(tight, { date: "2026-09-30" }, { scope: HERE, session: B });
    expect(woke.text).not.toContain("Last here:");
    expect(woke.text).toContain("Where I left off");
    expect(woke.bytes).toBeLessThanOrEqual(tight);
  });

  test("past the fortnight the line is gone, and so is its reserve", async () => {
    const k = afternoon();
    await mikesAfternoon(k);
    for (let i = 1; i <= LAST_HERE_LIFE_DAYS + 1; i++) k.c.store.advanceClock(`2026-10-${String(i).padStart(2, "0")}`);
    expect(wake(k.c, B)).not.toContain("Last here:");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("the pieces", () => {
  test("the sessions that ran here come from the turn-ends, newest first", () => {
    const k = afternoon();
    k.talk(A, at(16, 1));
    k.talk(B, at(16, 30));
    k.talk(A, at(17, 0));
    k.talk(C, at(16, 5), THERE);
    expect(sessionsHere(k.c.spans, HERE)).toEqual([
      { session: A, firstAt: at(16, 1), lastAt: at(17, 0) },
      { session: B, firstAt: at(16, 30), lastAt: at(16, 30) },
    ]);
    expect(sessionsHere(k.c.spans, `${HERE}/`).map((s) => s.session)).toEqual([A, B]);
  });

  test("an episode's latest chapter and its lived day are read off its last heading", () => {
    const body = "## chapter 1 — Tue 29 Sep 2026 · claude-opus-5-5 · lived day 8\n\nThe first one.\n\n## chapter 2 — Wed 30 Sep 2026 · lived day 9\n\nThe second one, which is the one shown.\n";
    expect(latestChapter(body)).toEqual({ text: "\n\nThe second one, which is the one shown.\n", day: 9 });
    expect(latestChapter("No heading at all.")).toEqual({ text: "No heading at all.", day: null });
  });

  test("an untitled chapter is named by its id; the narrowest rung drops the count", () => {
    const e = (n: number, title: string | null): LastHere => ({
      chapter: {
        id: `epi_00000000000${String(n)}`,
        session: `${String(n).repeat(8)}-0000`,
        model: null,
        title,
        excerpt: "It said something worth reading first.",
        writtenAt: n,
        writtenDay: 1,
      },
      when: "09-30 10:00–11:00",
      date: "09-30",
    });
    expect(lastHereBlock([e(3, null)])).toBe(
      "Last here: session 33333333, 09-30 10:00–11:00 — epi_000000000003. It said something worth reading first.",
    );
    const ladder = lastHereLadder([e(3, "Three"), e(2, "Two"), e(1, "One")]);
    expect(ladder).toHaveLength(3);
    expect(ladder[2]).not.toContain("\n");
    expect(ladder[1]).toContain("+2 more here on 09-30");
  });

  test("a store with no chapters names none", () => {
    const k = afternoon();
    expect(chaptersBySession(k.c.store).size).toBe(0);
  });
});
