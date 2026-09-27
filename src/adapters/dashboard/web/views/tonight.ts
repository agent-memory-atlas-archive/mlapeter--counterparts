/**
 * TONIGHT — a few short lines about the next sleep (2026-09-27, home round 3 —
 * a try, not a rule). Dreams and sleep are being redesigned, so this is kept
 * small and every answer is the engine's own:
 *
 *   phases       — which sleep phases are due at the next sleep, with their
 *                  cadence: `sleep/markers.ts` (`readMarker`, `markerDue`,
 *                  `cadenceFor`), read-only.
 *   core         — ready for the core, and one return away: `core-road.ts`
 *                  (sleep's `aboutMe`, physics' `promotionEligibility`).
 *   letGo        — memories near the let-go line: physics' `pruneVerdict`
 *                  (through `letGoDay`) and sleep's `inLiveRevisionChain`.
 *   dream        — memories new since the last dream. Whether an ASK is likely
 *                  is the dream gate's call (`Dreams.status`), which answers
 *                  "observer" to a dashboard, so it is not guessed here.
 *   nominations  — what the last dream suggested for the core. Nothing acts on
 *                  these yet (only `counterparts core` lists them).
 *
 * THE NEXT SLEEP'S DAY: once the clock phase has run for today, the next sleep
 * is tomorrow's (`livedDay + 1`); before that it is today's. The same reading
 * as the consolidation light's "next run in N days" (`mechanism-evidence.ts`).
 *
 * Read-only, like everything in this directory.
 */
import { DREAM_TUNABLES } from "../../../../core/dream/index.js";
import { MARKER_UNSET, PHASES, cadenceFor, inLiveRevisionChain, isEntityCard, isJournal, markerDue, ownerNames, readMarker } from "../../../../core/sleep/index.js";
import type { Phase } from "../../../../core/sleep/index.js";
import type { DashboardSource } from "../../source.js";
import { reveal } from "../reveal.js";
import { coreRoad } from "./core-road.js";
import { letGoDay } from "./mechanism-panel.js";

/** How many lived days ahead "near the let-go line" looks. */
export const LET_GO_HORIZON = 7;
/** How many names a line carries; the rest are counted. */
const NAMED = 3;

export interface TonightName {
  readonly id: string;
  readonly text: string;
  readonly confidential: boolean;
}

export interface TonightPhase {
  readonly phase: Phase;
  readonly cadence: number;
  readonly due: boolean;
  /** Lived days until it is due, 0 when due at the next sleep. */
  readonly inDays: number;
}

export interface TonightView {
  /** The lived day the next sleep runs on. */
  readonly day: number;
  readonly phases: readonly TonightPhase[];
  readonly core: {
    readonly ready: number;
    readonly oneReturnAway: number;
    /** The first few of each, named (ready first). */
    readonly readyNames: readonly TonightName[];
    readonly oneAwayNames: readonly TonightName[];
  };
  readonly letGo: {
    /** Could be let go at the next sleep, if unused until then. */
    readonly tonight: number;
    /** Could be let go within `horizon` lived days, if unused (tonight's included). */
    readonly near: number;
    readonly horizon: number;
  };
  readonly dream: {
    /** The newest dream that stands: its date, or "lived day N". Null when never. */
    readonly last: string | null;
    /** Memories new since then (never dreamed: in the first-dream window). */
    readonly newSince: number;
  };
  readonly nominations: {
    readonly count: number;
    readonly names: readonly TonightName[];
  };
}

function name(src: DashboardSource, id: string): TonightName {
  const r = reveal(src.store, id, 72);
  return { id, text: r.text ?? r.label, confidential: r.confidential };
}

/** The lived day the next sleep runs on. */
export function nextSleepDay(src: DashboardSource): number {
  const today = src.store.livedDay();
  const clock = readMarker(src.store, "clock");
  return clock.health === "ok" && clock.day !== MARKER_UNSET && clock.day >= today ? today + 1 : today;
}

export function tonightView(src: DashboardSource): TonightView {
  const store = src.store;
  const day = nextSleepDay(src);

  const phases: TonightPhase[] = PHASES.filter((p) => p !== "clock").map((phase) => {
    const cadence = cadenceFor(phase);
    const m = readMarker(store, phase);
    const marker = m.health === "ok" ? m.day : MARKER_UNSET;
    const due = markerDue(marker, day, cadence) === "due";
    const inDays = due || marker === MARKER_UNSET ? 0 : Math.max(0, marker + cadence - day);
    return { phase, cadence, due, inDays };
  });

  const owner = ownerNames(store);
  const denied = new Set(store.deniedIds());
  const ready: string[] = [];
  const oneAway: string[] = [];
  let letTonight = 0;
  let letNear = 0;
  for (const id of store.list({ archived: false })) {
    if (denied.has(id)) continue;
    const row = store.row(id);
    if (row === undefined || isJournal(row)) continue;
    // Schema rows (the page, the identity core, beliefs) are not memories and
    // are left off the road, as the self tab's settling list leaves them.
    const road = row.type === "schema" ? null : coreRoad(store, row, owner, day);
    if (road !== null) {
      if (road.ready) ready.push(id);
      else if (road.oneReturnAway) oneAway.push(id);
    }
    // Prune reaches memories only: not the journal, not an entity card, not a schema row.
    if (row.type !== "memory" || isEntityCard(row)) continue;
    let physics;
    try {
      physics = store.physicsOf(id);
    } catch {
      continue;
    }
    const at = letGoDay(physics, day, LET_GO_HORIZON - 1);
    if (at === null || inLiveRevisionChain(store, id, row, physics, at)) continue;
    letNear += 1;
    if (at === day) letTonight += 1;
  }

  const last = store.dreams({ limit: 20 }).find((d) => d.state !== "undone") ?? null;
  const today = store.livedDay();
  const fresh = store
    .newMemoryIds(
      last === null
        ? { sinceAt: null, sinceDay: today - DREAM_TUNABLES.FIRST_DREAM_DAYS, limit: 1000 }
        : { sinceAt: last.started_at, sinceDay: last.day, limit: 1000 },
    )
    .filter((id) => !denied.has(id));
  const nominated =
    last === null ? [] : store.dreamChanges(last.id).filter((c) => c.action === "nominate-core" && c.undone === 0 && c.ref !== null);

  return {
    day,
    phases,
    core: {
      ready: ready.length,
      oneReturnAway: oneAway.length,
      readyNames: ready.slice(0, NAMED).map((id) => name(src, id)),
      oneAwayNames: oneAway.slice(0, NAMED).map((id) => name(src, id)),
    },
    letGo: { tonight: letTonight, near: letNear, horizon: LET_GO_HORIZON },
    dream: { last: last === null ? null : (last.date ?? `lived day ${String(last.day)}`), newSince: fresh.length },
    nominations: { count: nominated.length, names: nominated.slice(0, NAMED).map((c) => name(src, c.ref as string)) },
  };
}
