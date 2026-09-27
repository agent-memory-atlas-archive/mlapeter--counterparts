/**
 * `/api/mechanisms` — the eleven memory mechanisms the site names, each with a
 * light:
 *
 *   - grey: not built;
 *   - green: built, and fired in the last 7 LIVED days;
 *   - waiting: built, and not due — a scheduled phase that ran on time and
 *     comes round again in N days, or a mechanism holding nothing to act on;
 *   - amber: built, and quiet when it should not be.
 *
 * The list, its order and its four families are the site's
 * (`counterparts-site/features/home-v2/content/regions.ts`, minus the two it
 * parks). WHICH ROWS COUNT AS A FIRING, and how much of each is built, is
 * `adapters/mechanism-evidence.ts` — shared with `counterparts mechanisms`, so
 * the two cannot judge a mechanism differently. This file owns only the window
 * (lived days) and the dashboard's words. What each one says about Counterparts
 * lives beside the page, in `web/mechanisms/<id>/index.js`.
 *
 * Read-only, like everything in this directory. Rules 1–4 of `views.ts` apply;
 * no row text is emitted, only counts and event `seq`s the page can open with
 * `/api/event`.
 */
import {
  FAMILIES,
  MECHANISM_EVIDENCE,
  RECENT_IDS,
  amount,
  builtCount,
  mechanismEvidence,
  payloadOf,
} from "../../../mechanism-evidence.js";
import type { Build, Family, MechanismEvidence, Payload, Proof, Verdict } from "../../../mechanism-evidence.js";
import type { DashboardSource } from "../../source.js";

export { FAMILIES, RECENT_IDS, amount, builtCount, payloadOf };
export type { Build, Family, Payload, Proof };

/** The one table, under the name this directory has always read it by. */
export const MECHANISM_PROOFS: readonly MechanismEvidence[] = MECHANISM_EVIDENCE;

/** The window: today's lived day and the six before it. */
export const MECHANISM_DAYS = 7;

export type MechanismStatus = "grey" | "green" | "waiting" | "amber";

export interface MechanismLight {
  readonly id: string;
  readonly family: Family;
  /** How much of it is built: the pill's tag (none / "partly built"). */
  readonly build: Build;
  readonly status: MechanismStatus;
  /** One plain-English line. */
  readonly evidence: string;
  /** The newest few event `seq`s that back a green light. Empty otherwise. */
  readonly events: readonly number[];
  /** A scheduled mechanism's next run, in lived days (0 = at the next session's end). */
  readonly nextInDays: number | null;
}

export interface MechanismsView {
  readonly livedDay: number;
  /** The first lived day inside the window. */
  readonly fromDay: number;
  readonly days: number;
  readonly mechanisms: readonly MechanismLight[];
  /** A read hit its ceiling, so some counts are floors. */
  readonly truncated: boolean;
}

const plural = (n: number, says: readonly [string, string]): string => `${n} ${n === 1 ? says[0] : says[1]}`;

/** "in 2 lived days" / "at the next session's end". */
export function nextRunWords(nextInDays: number): string {
  if (nextInDays <= 0) return "at the next session's end";
  return `in ${nextInDays} lived ${nextInDays === 1 ? "day" : "days"}`;
}

/** One verdict → one light, in the dashboard's words. */
export function lightOf(v: Verdict): MechanismLight {
  const row = MECHANISM_EVIDENCE.find((m) => m.id === v.id);
  const base = { id: v.id, family: v.family, build: v.build, nextInDays: v.schedule?.nextInDays ?? null };
  if (v.build === "not" || row === undefined) {
    return { ...base, status: "grey", evidence: row?.grey ?? "Not built yet.", events: [] };
  }
  const heldLine = row.held === undefined || v.held === null ? "" : ` ${plural(v.held, row.held.says)}.`;
  if (v.fired) {
    const said = v.parts.filter((p) => p.count > 0).map((p) => plural(p.count, p.says));
    const todayLine = v.today === null ? "" : ` ${v.today} today.`;
    return {
      ...base,
      status: "green",
      evidence: `${said.join(", ")} in the last ${MECHANISM_DAYS} lived days.${todayLine}${heldLine}`,
      events: v.events,
    };
  }
  if (row.held !== undefined && v.held === 0) {
    return { ...base, status: "waiting", evidence: row.held.none, events: [] };
  }
  if (v.schedule !== null && v.schedule.onTime && v.schedule.lastRanDay !== null) {
    return {
      ...base,
      status: "waiting",
      evidence:
        `Ran on schedule on lived day ${v.schedule.lastRanDay} with nothing to change; ` +
        `next run ${nextRunWords(v.schedule.nextInDays)}.`,
      events: [],
    };
  }
  const evidence =
    v.lastFiredDay === null
      ? `Built, and no record of it firing yet.`
      : `Built, but quiet for ${MECHANISM_DAYS} lived days (last fired on lived day ${v.lastFiredDay}).`;
  return { ...base, status: "amber", evidence: `${evidence}${heldLine}`, events: [] };
}

export function mechanismsView(src: DashboardSource): MechanismsView {
  const store = src.store;
  let livedDay = 0;
  try {
    livedDay = store.livedDay();
  } catch {
    livedDay = 0;
  }
  const fromDay = Math.max(0, livedDay - (MECHANISM_DAYS - 1));
  const { verdicts, truncated } = mechanismEvidence(store, { sinceDay: fromDay, today: livedDay });
  return { livedDay, fromDay, days: MECHANISM_DAYS, mechanisms: verdicts.map(lightOf), truncated };
}
