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
 *                  Counts only since round 3b: the names live on the Self tab.
 *   letGo        — memories near the let-go line: physics' `pruneVerdict`
 *                  (through `letGoDay`) and sleep's `inLiveRevisionChain`.
 *   dream        — memories new since the last dream. Whether an ASK is likely
 *                  is the dream gate's call (`Dreams.status`), which answers
 *                  "observer" to a dashboard, so it is not guessed here.
 *   nominations  — how many memories the last dream suggested for the core.
 *                  Nothing acts on these yet (only `counterparts core` lists
 *                  them); which ones is the dream journal's, on the Self tab.
 *
 * THE NEXT SLEEP'S DAY: once the clock phase has run for today, the next sleep
 * is tomorrow's (`livedDay + 1`); before that it is today's. The same reading
 * as the consolidation light's "next run in N days" (`mechanism-evidence.ts`).
 *
 * Read-only, like everything in this directory.
 */
import { DREAM_TUNABLES } from "../../../../core/dream/index.js";
import { MARKER_UNSET, PHASES, cadenceFor, inLiveRevisionChain, isEntityCard, isJournal, markerDue, readMarker } from "../../../../core/sleep/index.js";
import type { Phase } from "../../../../core/sleep/index.js";
import type { DashboardSource } from "../../source.js";
import { coreRoad } from "./core-road.js";
import { letGoDay } from "./mechanism-panel.js";

/** How many lived days ahead "near the let-go line" looks. */
export const LET_GO_HORIZON = 7;
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
    /** Memories new since then (never dreamed: in the first-dream window). The gate's own count when it answered. */
    readonly newSince: number;
    /**
     * The dream gate's own preview (`Dreams.previewAsk`, #262) as the owner's
     * live session would meet it: whether the day's ask would be raised now,
     * and the gate's reason. Null when the source carries no gate.
     */
    readonly ask: { readonly wouldAsk: boolean; readonly reason: string } | null;
  };
  readonly nominations: {
    readonly count: number;
  };
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

  const denied = new Set(store.deniedIds());
  let ready = 0;
  let oneAway = 0;
  let letTonight = 0;
  let letNear = 0;
  for (const id of store.list({ archived: false })) {
    if (denied.has(id)) continue;
    const row = store.row(id);
    if (row === undefined || isJournal(row)) continue;
    // Schema rows (the page, the identity core, beliefs) are not memories and
    // are left off the road, as the self tab's settling list leaves them.
    const road = row.type === "schema" ? null : coreRoad(store, row, day);
    if (road !== null) {
      if (road.ready) ready += 1;
      else if (road.oneReturnAway) oneAway += 1;
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
  // The gate itself, read-only, as the OWNER's session meets it (the dashboard
  // is the owner's window): its confidential filter and cap included.
  let preview: { wouldAsk: boolean; reason: string; newSince: number } | null = null;
  try {
    preview = src.dreams?.previewAsk({ owner: true }) ?? null;
  } catch {
    preview = null;
  }
  const nominated =
    last === null ? [] : store.dreamChanges(last.id).filter((c) => c.action === "nominate-core" && c.undone === 0 && c.ref !== null);

  return {
    day,
    phases,
    core: { ready, oneReturnAway: oneAway },
    letGo: { tonight: letTonight, near: letNear, horizon: LET_GO_HORIZON },
    dream: {
      last: last === null ? null : (last.date ?? `lived day ${String(last.day)}`),
      newSince: preview?.newSince ?? fresh.length,
      ask: preview === null ? null : { wouldAsk: preview.wouldAsk, reason: preview.reason },
    },
    nominations: { count: nominated.length },
  };
}
