/**
 * The dream ask, previewed (2026-09-27, `Dreams.previewAsk`): the dashboard's
 * Tonight box asks the core whether a dream ask is likely, instead of counting
 * "new since the last dream" itself — a count that skipped the gate's
 * confidential filter and its cap, and so could read higher than the gate.
 *
 * What it keeps: the preview and the real gate (`status`, and `askLine`, which
 * claims the day) agree in every case — due, nothing new, dreamed today,
 * declined, asked today, confidential rows, the cap — from a live session and
 * from an observer over the same store; and the preview writes nothing.
 *
 * Hermetic: a fresh temp data dir per test, removed after.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import type { CounterpartEvent } from "../src/core/counterpart.js";
import { DREAM_TUNABLES } from "../src/core/dream/index.js";
import type { DreamPreview } from "../src/core/dream/index.js";
import type { PutInput } from "../src/core/store/index.js";

let dir: string;
const open: Counterpart[] = [];
const SESSION = "s-preview";
const AT = "2026-09-26";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-dream-preview-"));
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

function brain(owner: boolean, onEvent?: (e: CounterpartEvent) => void): Counterpart {
  const c = Counterpart.open({ dir, owner, identity: { name: "Mike" }, ...(onEvent === undefined ? {} : { onEvent }) });
  open.push(c);
  return c;
}

/** An observer over the same store — the dashboard's stance. */
function observed<T>(fn: (o: Counterpart) => T, onEvent?: (e: CounterpartEvent) => void): T {
  const o = Counterpart.open({ dir, observer: true, ...(onEvent === undefined ? {} : { onEvent }) });
  try {
    return fn(o);
  } finally {
    o.close();
  }
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

/** A store with lived days behind it (clock at `AT`), and nothing new yet. */
function days(c: Counterpart): void {
  for (let d = 10; d <= 26; d += 1) c.store.advanceClock(`2026-09-${String(d)}`);
}

/** `n` new, plain memories today. */
function fresh(c: Counterpart, n: number, label = "plain"): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) out.push(mem(c, `A ${label} memory, number ${String(i)}, about the migration that runs before the container boots.`));
  return out;
}

/**
 * THE AGREEMENT: the live session's gate (`status`), its preview, and an
 * observer's preview in the same stance, all say the same thing. `newSince`
 * agrees wherever the gate itself counts.
 */
function agree(c: Counterpart, owner: boolean): DreamPreview {
  const s = c.dreams.status(AT);
  const live = c.dreams.previewAsk({ at: AT });
  expect(live.wouldAsk).toBe(s.due);
  expect(live.reason).toBe(s.reason as DreamPreview["reason"]);
  if (s.reason === "due" || s.reason === "too-little-new") expect(live.newSince).toBe(s.newSince);
  const seen = observed((o) => {
    // The observer's own gate stands down, as it always did.
    expect(o.dreams.status(AT).reason).toBe("observer");
    return o.dreams.previewAsk({ at: AT, ...(owner ? { owner: true } : {}) });
  });
  expect(seen).toEqual(live);
  return live;
}

/** The real ask: `askLine` raises a line exactly when the preview said it would. */
function realAsk(c: Counterpart, preview: DreamPreview): void {
  const line = c.dreams.askLine({ at: AT, session: SESSION });
  expect(line !== null).toBe(preview.wouldAsk);
  if (line !== null) expect(line).toContain(`(${String(preview.newSince)} new memories)`);
}

describe("the preview and the real gate agree", () => {
  test("due: enough new memory, nothing dreamed, nothing asked", () => {
    const c = brain(false);
    days(c);
    fresh(c, 4);
    const p = agree(c, false);
    expect(p).toEqual({ wouldAsk: true, reason: "due", newSince: 4 });
    realAsk(c, p);
  });

  test("nothing new, and too little new", () => {
    const c = brain(false);
    days(c);
    const none = agree(c, false);
    expect(none).toEqual({ wouldAsk: false, reason: "too-little-new", newSince: 0 });
    realAsk(c, none);
    fresh(c, DREAM_TUNABLES.MIN_NEW - 1);
    const few = agree(c, false);
    expect(few).toEqual({ wouldAsk: false, reason: "too-little-new", newSince: DREAM_TUNABLES.MIN_NEW - 1 });
    realAsk(c, few);
  });

  test("a store's first lived day has no night behind it", () => {
    const c = brain(false);
    fresh(c, 4);
    const p = agree(c, false);
    expect(p.wouldAsk).toBe(false);
    expect(p.reason).toBe("first-day");
    realAsk(c, p);
  });

  test("dreamed today: not asked again, and new since counts from that dream", () => {
    const c = brain(false);
    days(c);
    fresh(c, 4);
    const begun = c.dreams.begin({ session: SESSION, at: AT });
    if (!begun.ok) throw new Error(`begin refused: ${begun.reason}`);
    expect(c.dreams.journal({ dream: begun.bundle.dream, session: SESSION, text: "A dream." }).ok).toBe(true);
    const p = agree(c, false);
    expect(p).toEqual({ wouldAsk: false, reason: "dreamed-today", newSince: 0 });
    realAsk(c, p);
  });

  test("declined today: snoozed, while new since is still counted", () => {
    const c = brain(false);
    days(c);
    fresh(c, 4);
    c.dreams.decline({ at: AT, session: SESSION });
    const p = agree(c, false);
    // The gate stops before counting; the preview counts anyway.
    expect(c.dreams.status(AT).newSince).toBe(0);
    expect(p).toEqual({ wouldAsk: false, reason: "declined-today", newSince: 4 });
    realAsk(c, p);
  });

  test("asked today: the day's ask was claimed, so no second one", () => {
    const c = brain(false);
    days(c);
    fresh(c, 4);
    expect(c.dreams.askLine({ at: AT, session: "s-first" })).not.toBeNull();
    const p = agree(c, false);
    expect(p).toEqual({ wouldAsk: false, reason: "asked-today", newSince: 4 });
    realAsk(c, p);
  });

  test("confidential memories count only toward the owner's own gate", () => {
    // Two plain and three confidential new memories: a guest's gate sees two
    // (too little), the owner's sees five (due).
    const guest = brain(false);
    days(guest);
    fresh(guest, 2);
    for (let i = 0; i < 3; i += 1) mem(guest, `A confidential memory, number ${String(i)}, about the deploy.`, { meta: { confidential: true } });
    const g = agree(guest, false);
    expect(g).toEqual({ wouldAsk: false, reason: "too-little-new", newSince: 2 });
    // A live session previews its own gate, whatever it asks for.
    expect(guest.dreams.previewAsk({ at: AT, owner: true })).toEqual(g);
    // An observer previews a guest's gate unless it names the owner's.
    expect(observed((o) => o.dreams.previewAsk({ at: AT }))).toEqual(g);
    realAsk(guest, g);
    guest.close();
    open.splice(0);

    const owner = brain(true);
    const o = agree(owner, true);
    expect(o).toEqual({ wouldAsk: true, reason: "due", newSince: 5 });
    realAsk(owner, o);
  });

  test("the cap: new since never reads past MAX_NEW", () => {
    const c = brain(false);
    days(c);
    fresh(c, DREAM_TUNABLES.MAX_NEW + 5);
    const p = agree(c, false);
    expect(p).toEqual({ wouldAsk: true, reason: "due", newSince: DREAM_TUNABLES.MAX_NEW });
    realAsk(c, p);
  });
});

// ---------------------------------------------------------------------------
// the preview writes nothing
// ---------------------------------------------------------------------------

/** Every file under `at`, by content hash. */
function snapshot(at: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (p: string): void => {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.set(relative(at, full), createHash("sha256").update(readFileSync(full)).digest("hex"));
    }
  };
  walk(at);
  return out;
}

function counts(c: Counterpart): Record<string, unknown> {
  return {
    rows: c.store.list({}).length,
    events: c.store.eventLog({ limit: 1_000_000 }).length,
    dreams: c.store.dreams({ limit: 1_000 }).length,
    ask: c.store.dreamAsk(AT) ?? null,
  };
}

describe("the preview writes nothing", () => {
  test("from a live session: no ask claimed, no event, no row — in every state", () => {
    const emitted: string[] = [];
    const c = brain(false, (e) => emitted.push(e.name));
    days(c);
    fresh(c, 4);
    const check = (): void => {
      const before = counts(c);
      const heard = emitted.length;
      c.dreams.previewAsk({ at: AT });
      c.dreams.previewAsk({ at: AT, owner: true });
      expect(counts(c)).toEqual(before);
      expect(emitted.length).toBe(heard);
    };
    check(); // due
    expect(c.store.dreamAsk(AT)).toBeUndefined();
    // The preview said "due" and claimed nothing: the real ask still gets the day.
    expect(c.dreams.askLine({ at: AT, session: SESSION })).not.toBeNull();
    check(); // asked today
  });

  test("from an observer: the store is byte-identical, and nothing is emitted", () => {
    const c = brain(true);
    days(c);
    fresh(c, 4);
    c.close();
    open.splice(0);
    const before = snapshot(dir);
    const emitted: string[] = [];
    const p = observed((o) => {
      const r = o.dreams.previewAsk({ at: AT, owner: true });
      o.dreams.previewAsk({ at: AT });
      o.dreams.previewAsk();
      return r;
    }, (e) => emitted.push(e.name));
    expect(p).toEqual({ wouldAsk: true, reason: "due", newSince: 4 });
    expect(snapshot(dir)).toEqual(before);
    expect(emitted.filter((n) => n.startsWith("dream."))).toEqual([]);
  });
});
