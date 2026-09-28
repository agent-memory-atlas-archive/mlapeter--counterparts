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
 * RANKED ACROSS THE THREE (2026-09-28, build B; held lightly): it was filled
 * in that fixed order, so five dated items hid every flagged pair and every
 * open loop. Now each item is scored — what is sooner, what was flagged more
 * lately, what was written more lately ranks higher — and the most pressing
 * `MAX_ITEMS` are shown; `mindRanked` says how many more there were. Only what
 * could surface in the session anyway (the caller's `showable`); a handoff is
 * words for context only, never an id a dream may change. `mindRanked` is a
 * read; `noteMindShown` records a flagged pair's habituation when a bundle
 * shows it. A pair is SETTLED awake the ordinary way: an `updates` mark (note
 * or session_end) that supersedes either memory takes it off the list.
 */
import { HANDOFF_LIFE_DAYS, daysLeft, liveHandoffRows, newestPerScope } from "../handoff/index.js";
import { lineOf } from "../fit/index.js";
import type { MemoryRow, Store } from "../store/index.js";
import { addDays, daysBetween, isDay } from "../time.js";

export const MIND_TUNABLES = {
  /** Most items in the section (the brief's "small, ~5"); the rest are counted. */
  MAX_ITEMS: 5,
  /** "Coming up": dated within this many calendar days from today. */
  COMING_UP_DAYS: 14,
  /** Bytes of each item's line. */
  TEXT_CHARS: 200,
  /** What a flagged pair weighs each time it was shown and nothing was done (0.5: half). CAL. */
  HABITUATION: 0.5,
} as const;

export interface MindItem {
  /** `coming-up`, `unsettled` or `open-loop`. */
  readonly kind: "coming-up" | "unsettled" | "open-loop";
  readonly text: string;
  /** The memories it names (a dated memory, a flagged pair) — shown, so they may be cited. */
  readonly ids: readonly string[];
  /** A dated memory's date, as said. */
  readonly date?: string;
  /** A flagged pair's address (`<dream>.<seq>`), for its habituation. */
  readonly pair?: string;
}

/** The meta prefix of a flagged pair's habituation: how often it was put on my mind, and the lived day last. */
export const MIND_SEEN_PREFIX = "mind.seen.";

function readMindSeen(store: Pick<Store, "getMeta">, pair: string): { times: number; day: number } | null {
  try {
    const raw = store.getMeta(`${MIND_SEEN_PREFIX}${pair}`);
    if (raw === undefined) return null;
    const v = JSON.parse(raw) as { times?: unknown; day?: unknown };
    return typeof v.times === "number" && typeof v.day === "number" ? { times: v.times, day: v.day } : null;
  } catch {
    return null;
  }
}

/**
 * RECORD WHAT WAS PUT ON MY MIND (a dream's or a reflection's bundle): each
 * flagged pair shown counts once more toward its habituation — reset when
 * either memory was used since it was last shown. Never throws.
 */
export function noteMindShown(store: Pick<Store, "getMeta" | "setMeta" | "physicsOf">, items: readonly MindItem[], day: number): void {
  for (const item of items) {
    if (item.pair === undefined) continue;
    try {
      const seen = readMindSeen(store, item.pair);
      let times = seen?.times ?? 0;
      if (seen !== null) {
        const used = Math.max(...item.ids.map((id) => store.physicsOf(id).lastUsedDay));
        if (used > seen.day) times = 0;
      }
      store.setMeta(`${MIND_SEEN_PREFIX}${item.pair}`, JSON.stringify({ times: times + 1, day }));
    } catch {
      /* bookkeeping only */
    }
  }
}

interface MindInput {
  readonly today: string;
  readonly day: number;
  /** Recall's gates for this session: could this row surface here? */
  readonly showable: (row: MemoryRow) => boolean;
  /** The owner's own session: a confidential handoff may be shown. */
  readonly owner: boolean;
}

/** The most pressing open things, ranked across the three kinds. */
export function onMyMind(store: Store, input: MindInput): MindItem[] {
  return mindRanked(store, input).items;
}

/**
 * Every open thing, scored, and the top `MAX_ITEMS` of them — with how many
 * more there were. Scores (working defaults): a dated memory 1–2 by how soon
 * (today highest); a flagged pair 1.5, the newest dream's first; an open loop
 * 1–2 by how much of its life is left.
 */
export function mindRanked(store: Store, input: MindInput): { items: MindItem[]; more: number } {
  const T = MIND_TUNABLES;
  const scored: { item: MindItem; score: number; order: number }[] = [];
  const push = (item: MindItem, score: number): void => {
    scored.push({ item, score, order: scored.length });
  };
  const words = (id: string): string | null => {
    const row = store.row(id);
    if (row === undefined || !input.showable(row)) return null;
    return lineOf({ title: row.title, body: row.body }, T.TEXT_CHARS);
  };

  // COMING UP.
  if (isDay(input.today)) {
    try {
      for (const d of store.datedMemories(input.today, addDays(input.today, T.COMING_UP_DAYS))) {
        const text = words(d.id);
        if (text === null) continue;
        const start = d.eventDate.slice(0, 10);
        let away: number = T.COMING_UP_DAYS;
        try {
          away = isDay(start) ? Math.max(0, daysBetween(input.today, start)) : T.COMING_UP_DAYS;
        } catch {
          away = T.COMING_UP_DAYS;
        }
        push({ kind: "coming-up", text, ids: [d.id], date: d.eventDate }, 1 + (1 - Math.min(away, T.COMING_UP_DAYS) / T.COMING_UP_DAYS));
      }
    } catch {
      /* a store without dates has nothing coming up */
    }
  }

  // UNSETTLED: flagged pairs, newest dream first, both still standing.
  try {
    let n = 0;
    // By open state (2026-09-28): every flagged pair of a dream that stands.
    for (const c of store.openDreamChanges("contradiction")) {
      if (c.ref === null || c.ref2 === null) continue;
      const a = words(c.ref);
      const b = words(c.ref2);
      if (a === null || b === null) continue;
      // HABITUATION (review of #278, held lightly): each time a pair is put
      // on my mind and nothing is done about it, it weighs less — half, each
      // time — the way the wake's hints habituate. Touched again (either
      // memory used since it was last shown), it rises back to full.
      const pair = `${c.dream_id}.${String(c.seq)}`;
      const seen = readMindSeen(store, pair);
      let times = seen?.times ?? 0;
      if (seen !== null) {
        try {
          const used = Math.max(store.physicsOf(c.ref).lastUsedDay, store.physicsOf(c.ref2).lastUsedDay);
          if (used > seen.day) times = 0;
        } catch {
          /* unreadable physics: keep the count */
        }
      }
      push({ kind: "unsettled", text: `"${a}" / "${b}"`, ids: [c.ref, c.ref2], pair }, 1.5 * T.HABITUATION ** times - n * 0.001);
      n += 1;
    }
  } catch {
    /* no dreams, nothing flagged */
  }

  // OPEN LOOPS: where the work stands, one per directory.
  try {
    for (const h of newestPerScope(liveHandoffRows(store)).values()) {
      if (h.writtenDay === null) continue;
      const left = daysLeft(h.writtenDay, input.day, HANDOFF_LIFE_DAYS);
      if (left <= 0) continue;
      const row = store.row(h.id);
      if (row === undefined || (row.confidential === 1 && !input.owner)) continue;
      const first = lineOf({ body: row.body }, T.TEXT_CHARS);
      if (first.length === 0) continue;
      push({ kind: "open-loop", text: first, ids: [] }, 1 + Math.min(left, HANDOFF_LIFE_DAYS) / HANDOFF_LIFE_DAYS);
    }
  } catch {
    /* no handoffs */
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return { items: scored.slice(0, T.MAX_ITEMS).map((s) => s.item), more: Math.max(0, scored.length - T.MAX_ITEMS) };
}
