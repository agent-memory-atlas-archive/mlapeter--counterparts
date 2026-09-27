/**
 * WHAT'S ON MY MIND (2026-09-27) — a small section beside the day's events in
 * the dream's bundle, and in the reflection's: what is still open, not what is
 * new. People dream mostly about the day, but also about worries and what is
 * coming. Working default, held lightly.
 *
 * Three sources, the ones the store already keeps (goals are left out of v1:
 * nothing records one yet):
 *
 *   - COMING UP — a memory dated in the next `COMING_UP_DAYS` calendar days
 *     (a reminder `prospective/` will raise);
 *   - UNSETTLED — a pair a dream flagged as disagreeing, both still standing;
 *   - OPEN LOOPS — where the work stands in a directory (its handoff's first
 *     line), while the pointer is still showing.
 *
 * At most `MAX_ITEMS`, in that order. Only what could surface in the session
 * anyway (the caller's `showable`); a handoff is words for context only, never
 * an id a dream may change. A read: nothing here writes.
 */
import { HANDOFF_LIFE_DAYS, daysLeft, liveHandoffRows, newestPerScope } from "../handoff/index.js";
import type { MemoryRow, Store } from "../store/index.js";
import { addDays, isDay } from "../time.js";

export const MIND_TUNABLES = {
  /** Most items in the section (the brief's "small, ~5"). */
  MAX_ITEMS: 5,
  /** "Coming up": dated within this many calendar days from today. */
  COMING_UP_DAYS: 14,
  /** How much of each item's words the section carries. */
  TEXT_CHARS: 200,
} as const;

export interface MindItem {
  /** `coming-up`, `unsettled` or `open-loop`. */
  readonly kind: "coming-up" | "unsettled" | "open-loop";
  readonly text: string;
  /** The memories it names (a dated memory, a flagged pair) — shown, so they may be cited. */
  readonly ids: readonly string[];
  /** A dated memory's date, as said. */
  readonly date?: string;
}

export function onMyMind(
  store: Store,
  input: {
    today: string;
    day: number;
    /** Recall's gates for this session: could this row surface here? */
    showable: (row: MemoryRow) => boolean;
    /** The owner's own session: a confidential handoff may be shown. */
    owner: boolean;
  },
): MindItem[] {
  const T = MIND_TUNABLES;
  const out: MindItem[] = [];
  const words = (id: string): string | null => {
    const row = store.row(id);
    if (row === undefined || !input.showable(row)) return null;
    const line = ((row.title ?? "").trim() || (row.body.split("\n").find((l) => l.trim().length > 0) ?? "")).replace(/\s+/g, " ").trim();
    return line.length > T.TEXT_CHARS ? `${line.slice(0, T.TEXT_CHARS - 1)}…` : line;
  };

  // COMING UP.
  if (isDay(input.today)) {
    try {
      for (const d of store.datedMemories(input.today, addDays(input.today, T.COMING_UP_DAYS))) {
        if (out.length >= T.MAX_ITEMS) break;
        const text = words(d.id);
        if (text === null) continue;
        out.push({ kind: "coming-up", text, ids: [d.id], date: d.eventDate });
      }
    } catch {
      /* a store without dates has nothing coming up */
    }
  }

  // UNSETTLED: flagged pairs, newest dream first, both still standing.
  try {
    for (const dream of store.dreams({ limit: 10 })) {
      if (dream.state === "undone") continue;
      for (const c of store.dreamChanges(dream.id)) {
        if (out.length >= T.MAX_ITEMS) break;
        if (c.action !== "contradiction" || c.undone === 1 || c.ref === null || c.ref2 === null) continue;
        const a = words(c.ref);
        const b = words(c.ref2);
        if (a === null || b === null) continue;
        out.push({ kind: "unsettled", text: `"${a}" / "${b}"`, ids: [c.ref, c.ref2] });
      }
    }
  } catch {
    /* no dreams, nothing flagged */
  }

  // OPEN LOOPS: where the work stands, one per directory, newest first.
  try {
    const newest = [...newestPerScope(liveHandoffRows(store)).values()].sort((x, y) => (y.writtenDay ?? -1) - (x.writtenDay ?? -1));
    for (const h of newest) {
      if (out.length >= T.MAX_ITEMS) break;
      if (h.writtenDay === null || daysLeft(h.writtenDay, input.day, HANDOFF_LIFE_DAYS) <= 0) continue;
      const row = store.row(h.id);
      if (row === undefined || (row.confidential === 1 && !input.owner)) continue;
      const first = (row.body.split("\n").find((l) => l.trim().length > 0) ?? "").replace(/\s+/g, " ").trim();
      if (first.length === 0) continue;
      out.push({ kind: "open-loop", text: first.length > T.TEXT_CHARS ? `${first.slice(0, T.TEXT_CHARS - 1)}…` : first, ids: [] });
    }
  } catch {
    /* no handoffs */
  }
  return out.slice(0, T.MAX_ITEMS);
}
