/**
 * MOOD-MATCHING — recall G18 (emotion part A, owner decision 4, 2026-09-26).
 *
 * When a person's current feeling is known, memories that carried a matching
 * feeling FOR THAT SAME PERSON come up more easily; a matching feeling of the
 * OTHER person gives a smaller lift. The brain analog is mood-congruent recall.
 *
 * **"Current" is only what was recorded.** There is no classifier: a person's
 * mood is the cores of the feelings recorded for them in the last
 * `MOOD_WINDOW_HOURS` of the store's clock, at `MOOD_MIN_STRENGTH` or above. A
 * turn nobody recorded a feeling near has no mood, and this whole module costs
 * one indexed query that returns nothing.
 *
 * **It is a modulation, never an admission.** The lift is added to the
 * candidate's `sal` — the number the gate reads AFTER hard gate (a) (an uncued
 * memory is dark before salience is evaluated) and AFTER hard gate (b) (the
 * absolute floor, checked before any salience adjustment). It never touches
 * `activation`, so it cannot change which memories become candidates, and in
 * the absolute regimes `modulate` ignores `sal` entirely. `activate.ts` does
 * not even compute a mood for an uncued candidate.
 *
 * **A blend counts under both of its cores** (`coresOfFeeling`): a tender
 * memory matches a sad mood and a happy one.
 *
 * **Past, not present.** A feeling recorded INSIDE the window is part of the
 * mood, not a memory that matches it — otherwise the note written five minutes
 * ago would match its own feeling, and session dedup would not stop it (it was
 * never surfaced). Matching reads the feeling SOFTENED by its age
 * (`physics.softenedFeeling`): an old match lifts less than a fresh one.
 */
import { coresOfFeeling } from "../feelings-wheel.js";
import type { CoreEmotion } from "../feelings-wheel.js";
import { softenedFeeling } from "../physics/index.js";
import type { FeelingRow, Store } from "../store/index.js";
import type { RecallTunables } from "./tunables.js";

export interface Mood {
  /** Per person (`whose`), the cores they feel now. Empty map: no mood. */
  readonly byPerson: ReadonlyMap<string, ReadonlySet<CoreEmotion>>;
  /** Feelings recorded at or after this instant are the mood itself, never a match. */
  readonly sinceMs: number;
}

export const NO_MOOD: Mood = { byPerson: new Map(), sinceMs: Number.POSITIVE_INFINITY };

const HOUR_MS = 3_600_000;

/** How each person feels now, from the feelings recorded in the window. */
export function currentMood(
  store: Pick<Store, "feelingsSince">,
  nowMs: number,
  t: Pick<RecallTunables, "MOOD_WINDOW_HOURS" | "MOOD_MIN_STRENGTH">,
): Mood {
  const sinceMs = nowMs - t.MOOD_WINDOW_HOURS * HOUR_MS;
  const byPerson = new Map<string, Set<CoreEmotion>>();
  let rows: FeelingRow[];
  try {
    rows = store.feelingsSince(sinceMs);
  } catch {
    // A store without the table cannot have a mood; recall goes on without one.
    return NO_MOOD;
  }
  for (const r of rows) {
    if (!(r.strength >= t.MOOD_MIN_STRENGTH)) continue;
    const set = byPerson.get(r.whose) ?? new Set<CoreEmotion>();
    for (const c of coresOfFeeling(r.core, r.emotion)) set.add(c);
    if (set.size > 0) byPerson.set(r.whose, set);
  }
  return { byPerson, sinceMs };
}

/** True when there is anything to match against. */
export function hasMood(mood: Mood): boolean {
  return mood.byPerson.size > 0;
}

/**
 * The salience lift ONE memory gets from the current mood: the largest of
 * `weight x softened strength` over its past feelings that share a core with
 * someone's mood — `MOOD_SAME_WEIGHT` when the feeling was that person's own,
 * `MOOD_CROSS_WEIGHT` when it was the other's. 0 when nothing matches.
 */
export function moodLift(
  feelings: readonly (FeelingRow & { birth_day: number })[] | undefined,
  mood: Mood,
  day: number,
  t: Pick<RecallTunables, "MOOD_SAME_WEIGHT" | "MOOD_CROSS_WEIGHT">,
): number {
  if (feelings === undefined || feelings.length === 0 || !hasMood(mood)) return 0;
  let best = 0;
  for (const f of feelings) {
    if (f.created_at >= mood.sinceMs) continue; // the mood itself, not a memory of one
    const cores = coresOfFeeling(f.core, f.emotion);
    const felt = softenedFeeling(f.strength, day - f.birth_day);
    for (const [person, now] of mood.byPerson) {
      if (!cores.some((c) => now.has(c))) continue;
      const w = f.whose === person ? t.MOOD_SAME_WEIGHT : t.MOOD_CROSS_WEIGHT;
      if (w * felt > best) best = w * felt;
    }
  }
  return best;
}
