/**
 * HOW I ACT (2026-09-27, a try): the seven trait axes as spectrum bars on the
 * self tab. The store records nudges at write time and computes no profile
 * (`core/store/traits.ts`); the balance is drawn here.
 *
 * THE BALANCE of one axis is a firmness-weighted mean of its nudges: each
 * counts `strength × firmness`, signed −1 toward `poles[0]` (roughly where
 * training puts me) and +1 toward `poles[1]`, and the balance is
 * Σ signed / Σ unsigned — so −1..+1, 0 in the middle, and `null` (no marker,
 * never a centred one) when nothing on the axis weighs anything.
 *
 * FIRMNESS is the memory's strength on today's lived day, the number the
 * memories tab brightens on; a core memory counts fully (1), since `strength`
 * for a promoted memory is its base, which can sit below 1. A faded memory
 * pulls less; that is the point.
 *
 * A WEEK AGO is the same sum over the nudges recorded seven or more calendar
 * days ago (the person's local calendar, `store.zone()`). It uses TODAY's
 * firmness, not the firmness of seven lived days ago: a row keeps only its
 * current physics (last use, uses, returns), so `strength(physics, day − 7)`
 * would be wrong for anything used since, and replaying the history is not
 * cheap. It also reads today's live set: a merge carries each original's
 * nudges onto the merged memory with their own moment, so those still count
 * on their old dates, but a memory archived since last week drops out of both
 * markers.
 *
 * Read-only, like everything in this directory. Nudges come from
 * `traitsAll()` (live memories only, so a merged original and its merge are
 * not both counted) and never with `includeConfidential`: a confidential
 * memory's nudge moves the bar, and its words stay withheld.
 */
import { strength } from "../../../../core/physics/index.js";
import { TRAIT_AXES } from "../../../../core/store/index.js";
import type { TraitRead } from "../../../../core/store/index.js";
import { localDate } from "../../../../core/time.js";
import type { DashboardSource } from "../../source.js";
import { reveal } from "../reveal.js";

/** How many calendar days back the faint marker looks. */
export const WEEK_AGO_DAYS = 7;

/** How many nudges an axis's list carries at most (the weightiest first). */
export const TRAIT_ROWS_MAX = 40;

/** One nudge, weighed: what `balanceOf` needs. */
export interface WeighedNudge {
  readonly toward: string;
  /** 0..1, as recorded. */
  readonly strength: number;
  /** 0..1: how firmly its memory is held today (1 for a core memory). */
  readonly firmness: number;
}

/**
 * THE BALANCE, pure: −1 (all toward `poles[0]`) .. +1 (all toward
 * `poles[1]`), or null when nothing weighs anything (no nudges, or every one
 * at zero strength or on a fully faded memory). A nudge toward neither pole
 * is not counted.
 */
export function balanceOf(nudges: readonly WeighedNudge[], poles: readonly [string, string]): number | null {
  let signed = 0;
  let unsigned = 0;
  for (const n of nudges) {
    const sign = n.toward === poles[1] ? 1 : n.toward === poles[0] ? -1 : 0;
    if (sign === 0) continue;
    const w = clamp01(n.strength) * clamp01(n.firmness);
    signed += sign * w;
    unsigned += w;
  }
  if (!(unsigned > 0)) return null;
  return round(signed / unsigned);
}

/** One nudge behind an axis, as its list shows it. */
export interface TraitNudgeRow {
  /** The memory, for its card. */
  readonly id: string;
  /** Its words (a first line), or the withholding. */
  readonly text: string;
  readonly confidential: boolean;
  /** The pole it pulled toward. */
  readonly toward: string;
  readonly strength: number;
  readonly firmness: number;
  /** What in the moment showed it; empty when withheld or never said. */
  readonly carriedBy: string;
  /** The moment's words are withheld (a confidential memory). */
  readonly withheld: boolean;
  /** When it was recorded (the store's clock, ms). */
  readonly at: number;
}

export interface TraitAxisView {
  readonly id: string;
  readonly poles: readonly [string, string];
  /** Where present, what the axis means; empty otherwise. */
  readonly gloss: string;
  /** −1..+1, or null: no marker. */
  readonly balance: number | null;
  /** The same, from the nudges recorded a week or more ago; null: no faint marker. */
  readonly weekAgo: number | null;
  /** Distinct memories carrying a nudge on this axis. */
  readonly memories: number;
  readonly nudges: number;
  /** The weightiest first, at most `TRAIT_ROWS_MAX`. */
  readonly rows: TraitNudgeRow[];
  /** Nudges left off the list. */
  readonly more: number;
}

export interface TraitsView {
  readonly axes: TraitAxisView[];
  /** Distinct live memories carrying any nudge. */
  readonly memories: number;
  readonly nudges: number;
  /** The local date the faint marker reads up to (inclusive). */
  readonly weekAgoDate: string;
}

/** The self tab's "How I act": every axis, in `TRAIT_AXES` order. */
export function traitsView(src: DashboardSource): TraitsView {
  const store = src.store;
  const day = store.livedDay();
  const zone = store.zone();
  const weekAgoDate = localDate(store.now() - WEEK_AGO_DAYS * 86_400_000, zone);
  let all: TraitRead[];
  try {
    all = store.traitsAll();
  } catch {
    all = [];
  }

  // Each memory read once: its firmness and its words.
  const memo = new Map<string, { firmness: number; text: string; confidential: boolean }>();
  const about = (id: string): { firmness: number; text: string; confidential: boolean } => {
    const seen = memo.get(id);
    if (seen !== undefined) return seen;
    let firmness = 0;
    try {
      firmness = store.row(id)?.promoted_identity === 1 ? 1 : strength(store.physicsOf(id), day);
    } catch {
      /* a row whose physics will not read weighs nothing, and is still listed */
    }
    const r = reveal(store, id, 110);
    const out = { firmness: round(clamp01(firmness)), text: r.text ?? r.label, confidential: r.confidential };
    memo.set(id, out);
    return out;
  };

  const known = new Set<string>();
  const axes = TRAIT_AXES.map((axis): TraitAxisView => {
    const poles = axis.poles as unknown as readonly [string, string];
    const on = all.filter((n) => n.axis === axis.id && poles.includes(n.toward));
    const rows = on.map((n): TraitNudgeRow => {
      known.add(n.memory_id);
      const m = about(n.memory_id);
      // Withheld when EITHER says so: the nudge follows the memory's column,
      // `reveal` its prose; the two agree unless a write is mid-flight.
      const withheld = n.withheld || n.confidential || m.confidential;
      return {
        id: n.memory_id,
        text: m.text,
        confidential: m.confidential || n.confidential,
        toward: n.toward,
        strength: round(clamp01(n.strength)),
        firmness: m.firmness,
        carriedBy: withheld ? "" : n.carried_by,
        withheld,
        at: n.created_at,
      };
    });
    const old = rows.filter((r) => localDate(r.at, zone) <= weekAgoDate);
    const sorted = [...rows].sort(
      (a, b) => b.strength * b.firmness - a.strength * a.firmness || b.at - a.at || (a.id < b.id ? -1 : 1),
    );
    return {
      id: axis.id,
      poles,
      gloss: axis.gloss,
      balance: balanceOf(rows, poles),
      weekAgo: old.length === 0 ? null : balanceOf(old, poles),
      memories: new Set(rows.map((r) => r.id)).size,
      nudges: rows.length,
      rows: sorted.slice(0, TRAIT_ROWS_MAX),
      more: Math.max(0, sorted.length - TRAIT_ROWS_MAX),
    };
  });
  return {
    axes,
    memories: known.size,
    nudges: axes.reduce((s, a) => s + a.nudges, 0),
    weekAgoDate,
  };
}

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const round = (x: number): number => Math.round(x * 1000) / 1000;
