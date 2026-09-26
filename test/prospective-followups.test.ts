/**
 * Two follow-ups to the reminders work (#243), from its adversarial review
 * (docs/adversarial-review-pr243-2026-09-26.md):
 *
 *   - N7 — a revision (`updates:`) that leaves the date out no longer loses it.
 *     Field by field, what the author sent wins, `eventDate: null` drops the
 *     date, and anything left out carries over from the memory being revised.
 *     Because revising an ordinary memory is link-only (`revision.ts`), the old
 *     row would otherwise keep its date and come back beside the new one, so
 *     its date is cleared (kept in its version): one reminder, one memory.
 *   - N8 — a date that has already passed is accepted and kept, and the reply
 *     says so, told against the person's today in the store's zone.
 *
 * Hermetic (CLAUDE.md): a fresh temp dir per test, removed in `afterEach`, and
 * a pinned clock and zone wherever "today" matters, so UTC and Denver agree.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CUE_MODE_META } from "../src/core/prospective/index.js";
import { openServer } from "../src/adapters/mcp/index.js";
import type { McpServer } from "../src/adapters/mcp/index.js";

let dir: string;
const open: { close(): void }[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-prospective-followups-"));
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

const SESSION = "sess_followups";
/** Noon UTC on 2026-09-26: the same calendar day in UTC and in Denver. */
const NOON = Date.parse("2026-09-26T12:00:00Z");

function server(opts: { now?: number; timeZone?: string } = {}): McpServer {
  const s = openServer({
    dir,
    session: SESSION,
    scope: "/scope/one",
    owner: true,
    now: () => opts.now ?? NOON,
    timeZone: opts.timeZone ?? "UTC",
  });
  open.push(s.counterpart);
  return s;
}

async function note(s: McpServer, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body = (await s.call("note", args)).structuredContent;
  expect(body["stored"]).toBe(true);
  return body;
}

const TAXES = "Mike has to pay his quarterly estimated taxes before the deadline on the fifteenth.";

/** A dated original, as the model would first write it. */
async function taxes(s: McpServer, extra: Record<string, unknown> = {}): Promise<string> {
  const body = await note(s, { text: TAXES, eventDate: "2026-10-15", remind: "plain", ...extra });
  return body["id"] as string;
}

// ═══════════════════════════════════════════════════════════════════════════
// N7 — a revision carries the reminder, and owns it
// ═══════════════════════════════════════════════════════════════════════════

describe("N7: a revision that leaves the date out carries it over", () => {
  test("no eventDate, no remind: both carry over, and the old memory stops coming back", async () => {
    const s = server();
    const store = s.counterpart.store;
    const old = await taxes(s);
    const body = await note(s, {
      text: "Mike's quarterly estimated tax payment is now set up through the bank's bill pay.",
      updates: old,
    });
    const id = body["id"] as string;
    expect(body["reminder"]).toEqual({
      eventDate: "2026-10-15",
      remind: "plain",
      from: old,
      carriedOver: ["eventDate", "remind"],
    });
    // The successor carries the date on the column and the mode in meta.
    expect(store.row(id)?.event_date).toBe("2026-10-15");
    expect(store.readProse(id).meta[CUE_MODE_META]).toBe("plain");
    // The old row's date is cleared — and kept in the version that clear wrote.
    expect(store.row(old)?.event_date).toBeNull();
    const versions = store.versions(old);
    expect(versions.at(-1)?.event_date).toBe("2026-10-15");
    expect(versions.at(-1)?.reason).toBe("reminder-moved");
    // One reminder, on one memory — in the index, and in what is SAID on the day.
    expect(store.datedMemories("0001-01-01", "9999-12-31").map((d) => d.id)).toEqual([id]);
    expect(s.counterpart.prospective.plainDue({ at: "2026-10-15" }).map((d) => d.memoryId)).toEqual([id]);
  });

  test("a reschedule: the new date wins, a left-out remind carries, the old day stops", async () => {
    const s = server();
    const store = s.counterpart.store;
    const old = await taxes(s);
    const body = await note(s, {
      text: "The quarterly estimated tax deadline moved to the twentieth this year.",
      updates: old,
      eventDate: "2026-10-20",
    });
    expect(body["reminder"]).toEqual({
      eventDate: "2026-10-20",
      remind: "plain",
      from: old,
      carriedOver: ["remind"],
    });
    expect(store.row(old)?.event_date).toBeNull();
    expect(store.datedMemories("0001-01-01", "9999-12-31")).toEqual([
      { id: body["id"] as string, eventDate: "2026-10-20" },
    ]);
    // The old day says nothing; the new one says it once.
    expect(s.counterpart.prospective.plainDue({ at: "2026-10-15" })).toEqual([]);
    expect(s.counterpart.prospective.plainDue({ at: "2026-10-20" }).map((d) => d.memoryId)).toEqual([
      body["id"] as string,
    ]);
  });

  test("remind alone on a revision reshapes the carried date instead of being ignored", async () => {
    const s = server();
    const old = await taxes(s, { remind: "quiet" });
    const body = await note(s, {
      text: "Paying the quarterly estimated taxes on time really matters this quarter.",
      updates: old,
      remind: "plain",
    });
    expect(body["reminder"]).toEqual({
      eventDate: "2026-10-15",
      remind: "plain",
      from: old,
      carriedOver: ["eventDate"],
    });
    expect(s.counterpart.store.readProse(body["id"] as string).meta[CUE_MODE_META]).toBe("plain");
  });

  test("eventDate: null drops the date from both — the explicit cancel", async () => {
    const s = server();
    const store = s.counterpart.store;
    const old = await taxes(s);
    const body = await note(s, {
      text: "Mike already paid the quarterly estimated taxes early, so that is done.",
      updates: old,
      eventDate: null,
    });
    const id = body["id"] as string;
    expect(body["reminder"]).toMatchObject({ cleared: true, from: old });
    expect(store.row(id)?.event_date).toBeNull();
    expect(store.readProse(id).meta[CUE_MODE_META]).toBeUndefined();
    expect(store.row(old)?.event_date).toBeNull();
    expect(store.datedMemories("0001-01-01", "9999-12-31")).toEqual([]);
  });

  test("a session_end entry carries the same way", async () => {
    const s = server();
    const old = await taxes(s);
    const body = (
      await s.call("session_end", {
        session: SESSION,
        memories: [
          {
            content: "Mike set a calendar block to handle the estimated tax payment that week.",
            updates: old,
          },
        ],
      })
    ).structuredContent;
    const outcome = (body["outcomes"] as Record<string, unknown>[])[0] ?? {};
    expect(outcome["stored"]).toBe(true);
    expect(outcome["reminder"]).toMatchObject({ eventDate: "2026-10-15", remind: "plain", from: old });
    expect(s.counterpart.store.row(outcome["id"] as string)?.event_date).toBe("2026-10-15");
    expect(s.counterpart.store.row(old)?.event_date).toBeNull();
  });

  test("revising an UNDATED memory changes nothing about dates, and says nothing", async () => {
    const s = server();
    const old = (await note(s, { text: "Mike prefers paying bills by bank transfer rather than by card." }))[
      "id"
    ] as string;
    const body = await note(s, {
      text: "Mike now prefers paying bills through the bank's scheduled bill pay.",
      updates: old,
    });
    expect(body["reminder"]).toBeUndefined();
    expect(s.counterpart.store.row(body["id"] as string)?.event_date).toBeNull();
    expect(s.counterpart.store.versions(old)).toEqual([]);
  });

  test("a CONTENT-matched link is the engine's guess: nothing carries and nothing moves", async () => {
    const s = server();
    const store = s.counterpart.store;
    const old = await taxes(s);
    const deposit = await s.counterpart.submitJot(
      {
        content: "Mike has to pay his quarterly estimated taxes before the deadline on the fifteenth, by bank.",
        updates: "mem_this_id_does_not_exist",
      },
      { session: SESSION, scope: "/scope/one" },
    );
    expect(deposit.deposited).toBe(true);
    // The address fell back to content matching and landed on the dated row …
    expect(deposit.proposal?.updates?.method).toBe("content");
    expect(deposit.proposal?.updates?.resolved).toBe(old);
    // … which a guess does not get to move a date off.
    expect(deposit.reminder).toBeUndefined();
    expect(store.row(deposit.memoryId as string)?.event_date).toBeNull();
    expect(store.row(old)?.event_date).toBe("2026-10-15");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// N8 — a past date is kept, and said
// ═══════════════════════════════════════════════════════════════════════════

const PASSED = "That date has already passed — it won't come back as a reminder.";

describe("N8: a date that has already passed is accepted, and the reply says so", () => {
  test("a past day is stored as sent, with the notice", async () => {
    const s = server();
    const body = await note(s, {
      text: "The quarterly estimated tax payment was due on the fifteenth of last month.",
      eventDate: "2026-09-15",
    });
    expect(body["reminder"]).toEqual({ eventDate: "2026-09-15", remind: "quiet", note: PASSED });
    expect(s.counterpart.store.row(body["id"] as string)?.event_date).toBe("2026-09-15");
  });

  test("today, a month or a range still running, and a future day carry no notice", async () => {
    const s = server();
    const dates = ["2026-09-26", "2026-09", "2026-09-20..2026-09-30", "2026-10-15"];
    for (const [i, eventDate] of dates.entries()) {
      const body = await note(s, { text: `Dated plan number ${i + 1}, written with enough words to be a memory.`, eventDate });
      expect(body["reminder"]).toEqual({ eventDate, remind: "quiet" });
    }
  });

  test("a range or a month wholly before today gets it; a past year gets it instead of the year note", async () => {
    const s = server();
    const past = ["2026-09-01..2026-09-25", "2026-08", "2025"];
    for (const [i, eventDate] of past.entries()) {
      const body = await note(s, { text: `Past plan number ${i + 1}, written with enough words to be a memory.`, eventDate });
      expect((body["reminder"] as Record<string, unknown>)["note"]).toBe(PASSED);
    }
    const year = await note(s, { text: "Mike wants to run a marathon at some point during next year.", eventDate: "2027" });
    expect(String((year["reminder"] as Record<string, unknown>)["note"])).toContain("A year alone");
  });

  test("told against the PERSON's today: late evening in Denver is still yesterday in UTC terms", async () => {
    // 03:00 UTC on the 27th is 21:00 on the 26th in Denver.
    const at = Date.parse("2026-09-27T03:00:00Z");
    const text = "The quarterly estimated tax payment is due today, the twenty-sixth.";
    const denver = await note(server({ now: at, timeZone: "America/Denver" }), { text, eventDate: "2026-09-26" });
    expect(denver["reminder"]).toEqual({ eventDate: "2026-09-26", remind: "quiet" });
  });

  test("the same instant in UTC is already the 27th, so the 26th has passed", async () => {
    const at = Date.parse("2026-09-27T03:00:00Z");
    const text = "The quarterly estimated tax payment was due on the twenty-sixth.";
    const utc = await note(server({ now: at, timeZone: "UTC" }), { text, eventDate: "2026-09-26" });
    expect((utc["reminder"] as Record<string, unknown>)["note"]).toBe(PASSED);
  });

  test("session_end says it per entry", async () => {
    const s = server();
    const body = (
      await s.call("session_end", {
        session: SESSION,
        memories: [
          { content: "The venue walkthrough for the offsite already happened in early September.", eventDate: "2026-09-03" },
        ],
      })
    ).structuredContent;
    const outcome = (body["outcomes"] as Record<string, unknown>[])[0] ?? {};
    expect(outcome["stored"]).toBe(true);
    expect((outcome["reminder"] as Record<string, unknown>)["note"]).toBe(PASSED);
  });

  test("a revision carrying a date that has passed says so too", async () => {
    const s = server();
    const old = (await note(s, { text: TAXES, eventDate: "2026-09-15", remind: "plain" }))["id"] as string;
    const body = await note(s, { text: "Mike paid the estimated taxes a little late, with a small penalty.", updates: old });
    expect(body["reminder"]).toMatchObject({ eventDate: "2026-09-15", from: old, note: PASSED });
  });
});
