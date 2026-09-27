/**
 * THE ROAD TO THE CORE, asked of the engine and never re-derived here
 * (2026-09-27, home round 3 — a try, not a rule).
 *
 * Who is about me or about us is sleep's `aboutMe`; how far along each lane a
 * memory is, and whether a lane is met, is physics' `promotionEligibility`.
 * This file only reads the verdict. Core eligibility is being reworked (an
 * explicit "about me/us" mark, reflection as a return source), so this stays
 * thin on purpose: when the engine changes, the dashboard follows for free.
 *
 * Read-only, like everything in this directory.
 */
import { promotionEligibility } from "../../../../core/physics/index.js";
import type { PromotionVerdict } from "../../../../core/physics/index.js";
import { coreContextFor } from "../../../../core/sleep/index.js";
import { oneReturnAway } from "./mind.js";
import type { ReadOnlyStore } from "../../../../core/store/index.js";
import type { Kind } from "../../../../core/types.js";

export interface CoreRoad {
  readonly verdict: PromotionVerdict;
  /** A lane is met and nothing blocks it: it joins at the next consolidation (under the nightly cap). */
  readonly ready: boolean;
  /**
   * Felt strongly enough for the fast lane, and the ONLY thing missing is a
   * lane: one return after a gap would carry it (the spec's reading of the
   * verdict, 2026-09-27).
   */
  readonly oneReturnAway: boolean;
}

/**
 * The engine's verdict for one memory, or null when it is not about me or
 * about us (it can never become core, so it is not on the road at all), or
 * when its physics will not read.
 */
export function coreRoad(
  store: ReadOnlyStore,
  row: { readonly id: string; readonly kind: Kind; readonly about?: string | null },
  day: number,
): CoreRoad | null {
  // Exactly the context sleep's consolidate builds (`coreContextFor`, #262):
  // the about-mark, the owner's demotion, the reflected-feeling door and,
  // when it is closed, the last ordinary return.
  const ctx = coreContextFor(store, row, day);
  if (!ctx.aboutMe) return null;
  let verdict: PromotionVerdict;
  try {
    const physics = store.physicsOf(row.id);
    verdict = promotionEligibility(physics, ctx);
  } catch {
    return null;
  }
  // One reading of "one return away" for every tab: the Self tab's.
  return { verdict, ready: verdict.eligible, oneReturnAway: oneReturnAway(verdict) };
}
