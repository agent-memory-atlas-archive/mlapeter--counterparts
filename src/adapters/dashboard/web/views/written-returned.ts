/**
 * "WRITTEN VS CAME BACK", per lived day (2026-09-27, home round 3 — a try, not
 * a rule): how many memories were written on each of the last few lived days,
 * and how many older ones came back that day — in conversation (an awake
 * return) or replayed in a dream.
 *
 * Read from the `returns` table by its source tag (`store.returnCounts`, a
 * read). `legacy` rows — the history the v8 upgrade credited at invented day
 * positions — are not returns anyone saw happen, and are never counted here.
 * Returns began at that upgrade, so days before it honestly show none; `since`
 * says which day that was (null on a store born at v8, where there is no
 * "before").
 *
 * Read-only, like everything in this directory. Counts only; no row text.
 */
import { V8_UPGRADE_KEY, isJournal } from "../../../../core/sleep/index.js";
import type { DashboardSource } from "../../source.js";

/** How many lived days the chart carries, today included. */
export const WRITTEN_DAYS = 21;

export interface WrittenReturnedDay {
  readonly day: number;
  /** Memories born that lived day (archived since included: they were written). */
  readonly written: number;
  /** Older memories that came back that day in conversation. */
  readonly awake: number;
  /** Memories a dream replayed that day. */
  readonly dream: number;
}

export interface WrittenReturnedView {
  /** Oldest first, ending on today. Empty before the first lived day. */
  readonly days: readonly WrittenReturnedDay[];
  readonly today: WrittenReturnedDay | null;
  /** The lived day returns began to be recorded (the v8 upgrade), or null when always. */
  readonly since: number | null;
}

/** The lived day of the v8 upgrade, from its own meta record; null when this store never needed one. */
export function upgradeDay(src: DashboardSource): number | null {
  const raw = src.store.getMeta(V8_UPGRADE_KEY);
  if (raw === undefined) return null;
  try {
    const v: unknown = JSON.parse(raw);
    const day = v !== null && typeof v === "object" ? (v as { day?: unknown }).day : undefined;
    return typeof day === "number" && Number.isFinite(day) ? day : null;
  } catch {
    return null;
  }
}

export function writtenReturned(src: DashboardSource, span = WRITTEN_DAYS): WrittenReturnedView {
  const store = src.store;
  const today = store.livedDay();
  const since = upgradeDay(src);
  if (today < 1 && store.list().length === 0) return { days: [], today: null, since };
  const from = Math.max(0, today - (span - 1));

  const written = new Map<number, number>();
  for (const id of store.list()) {
    const row = store.row(id);
    if (row === undefined || row.type !== "memory" || isJournal(row)) continue;
    if (row.birth_day < from || row.birth_day > today) continue;
    written.set(row.birth_day, (written.get(row.birth_day) ?? 0) + 1);
  }

  // `returnCounts` counts rows ON OR AFTER a day, by source; one day's rows are
  // the difference between two neighbours. One aggregate read per day.
  const after = new Map<number, { awake: number; dream: number }>();
  const countFrom = (d: number): { awake: number; dream: number } => {
    let c = after.get(d);
    if (c === undefined) {
      const r = store.returnCounts({ sinceDay: d });
      c = { awake: r.awake, dream: r.dream };
      after.set(d, c);
    }
    return c;
  };

  const days: WrittenReturnedDay[] = [];
  for (let d = from; d <= today; d++) {
    const on = countFrom(d);
    const next = countFrom(d + 1);
    days.push({
      day: d,
      written: written.get(d) ?? 0,
      awake: Math.max(0, on.awake - next.awake),
      dream: Math.max(0, on.dream - next.dream),
    });
  }
  return { days, today: days[days.length - 1] ?? null, since };
}
