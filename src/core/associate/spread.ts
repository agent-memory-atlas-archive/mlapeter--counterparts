/**
 * Spreading activation — a PURE traversal.
 *
 * Seeds plus edge data in, activation contributions out. It reads no store, calls
 * no model, and writes nothing: the graph arrives as two functions the caller
 * supplies (`edgesFrom`, `conducts`), which is what makes the erase test
 * expressible at all — "a removed id stops conducting" is a property of the
 * predicate, not of a deletion that has to be chased through a cache.
 *
 * `recall/` CAN consume this as a fourth channel beside cue, semantic and arrival
 * (its NOTES.md §7 already names the seam and says the gate does not change).
 * **It is not wired in here** — see INTERFACE-GAPS.md §1, which also records the
 * one real collision: a hop contribution can reach an UNCUED memory, and whether
 * that memory may become a candidate is recall's hard gate (a) to decide.
 *
 * Bounds, all three of them structural:
 *   - **depth** — `HOPS` hops, and a node is expanded once, at the shallowest
 *     depth it was reached;
 *   - **fan** — a node passes activation in proportion to each edge's ABSOLUTE
 *     weight against the homeostatic bound (`MAX_OUT_WEIGHT`), and never more
 *     than its whole outgoing weight allows, so a hub cannot flood
 *     (`FAN_NORMALIZATION`, NOTES.md §6, 2026-09-28);
 *   - **size** — `MAX_SPREAD_NODES` expansions, and the result says when it hit
 *     the ceiling instead of quietly returning less.
 *
 * ORDER (2026-09-28): seeds are expanded strongest first, and each hop's
 * frontier by the activation it carries — not in the order the caller happened
 * to list them. On a big store the node budget is spent before the seeds run
 * out, so insertion order decided which memories ever got to spread.
 */
import { conducts, edgeWeightAt } from "./edges.js";
import type { EdgeState } from "./edges.js";
import type { AssociateTunables } from "./tunables.js";

export interface Seed {
  readonly id: string;
  /** The activation this memory already has from the caller's own channels. */
  readonly activation: number;
}

export interface SpreadInput {
  readonly seeds: readonly Seed[];
  /** Lived day (scar E8) — edges are decayed to it before anything conducts. */
  readonly day: number;
  readonly edgesFrom: (id: string) => readonly EdgeState[];
  /**
   * Does this id conduct? FALSE for anything that is not live memory: removed
   * (deny-listed), archived, or superseded. Non-conducting nodes neither receive
   * a contribution nor pass one along, and they are not in the fan denominator
   * either — an erased id must not even shape the arithmetic between its former
   * neighbours (contract G8, scar §2.2).
   */
  readonly conducts: (id: string) => boolean;
}

export interface Contribution {
  readonly id: string;
  /** The added activation, summed over every path that reached it. */
  readonly activation: number;
  /** Shallowest hop at which it was reached. */
  readonly depth: number;
  readonly paths: number;
}

export type SpreadStop = "exhausted" | "hop-limit" | "node-limit";

export interface SpreadResult {
  readonly contributions: readonly Contribution[];
  /** Nodes whose edges were read. */
  readonly expanded: number;
  /** Seeds and destinations refused by `conducts`. */
  readonly blocked: number;
  readonly stop: SpreadStop;
  /** The deepest hop at which a node was EXPANDED (0: nothing was). Depth 1 is
   *  the seeds themselves; 2 means the traversal got past them. Measured
   *  2026-09-28, so a turn can say how far spreading actually reached. */
  readonly depth: number;
}

export function spread(input: SpreadInput, t: AssociateTunables): SpreadResult {
  const acc = new Map<string, { activation: number; depth: number; paths: number }>();
  const expandedAt = new Map<string, number>();
  /** Seeds receive NO contribution: their activation is the caller's own, and a
   *  round trip (a → b → a) would hand it back to them as new evidence. The
   *  contributions are what the graph ADDS, never an echo (NOTES.md §6). */
  const seedIds = new Set(input.seeds.map((s) => s.id));
  let blocked = 0;
  let expanded = 0;
  let reached = 0;
  let stop: SpreadStop = "exhausted";

  // One entry per seed id (a repeated seed carries its summed activation),
  // strongest first: the node budget goes to the loudest memories.
  const seedCarry = new Map<string, number>();
  for (const s of input.seeds) {
    if (!input.conducts(s.id)) {
      blocked += 1;
      continue;
    }
    if (s.activation > 0) seedCarry.set(s.id, (seedCarry.get(s.id) ?? 0) + s.activation);
  }
  let frontier = byCarried(seedCarry);

  for (let depth = 1; depth <= t.HOPS && frontier.length > 0; depth++) {
    /** The nodes reached at THIS depth, carrying what they received over every
     *  path — not whichever path happened to arrive first. */
    const reachedNow = new Map<string, number>();
    for (const node of frontier) {
      if (expandedAt.has(node.id)) continue;
      if (expanded >= t.MAX_SPREAD_NODES) {
        stop = "node-limit";
        return finish(acc, expanded, blocked, stop, reached);
      }
      expandedAt.set(node.id, depth);
      expanded += 1;
      reached = depth;

      const live: { dst: string; weight: number }[] = [];
      for (const e of input.edgesFrom(node.id)) {
        if (e.dst === node.id) continue;
        const w = edgeWeightAt(e, input.day, t);
        if (!conducts(w, t)) continue;
        if (!input.conducts(e.dst)) {
          blocked += 1;
          continue;
        }
        live.push({ dst: e.dst, weight: w });
      }
      if (live.length === 0) continue;

      // ABSOLUTE weight (2026-09-28): an edge passes `w / MAX_OUT_WEIGHT` of
      // what the node carries, before hop decay — a fresh 0.1 edge passes 2.5%
      // whether or not it has siblings. It used to be `w / (the node's live
      // sum)`, which let a lone 0.03 edge pass everything. The divisor never
      // drops below the node's own outgoing sum, so a node whose edges were
      // written outside homeostasis (a legacy dream gist) still passes at most
      // what it carries.
      const sum = live.reduce((total, e) => total + e.weight, 0);
      const fan = t.FAN_NORMALIZATION ? Math.max(t.MAX_OUT_WEIGHT, sum) : 1;
      if (!(fan > 0)) continue;
      for (const e of live) {
        if (seedIds.has(e.dst)) continue;
        const gain = node.carried * t.HOP_DECAY * (e.weight / fan);
        if (gain <= 0) continue;
        const have = acc.get(e.dst);
        if (have === undefined) acc.set(e.dst, { activation: gain, depth, paths: 1 });
        else {
          // Contributions SUM across paths — two co-active seeds pointing at the
          // same memory say more than one does — while `depth` keeps the
          // shallowest arrival (NOTES.md §6).
          have.activation += gain;
          have.paths += 1;
          if (depth < have.depth) have.depth = depth;
        }
        if (!expandedAt.has(e.dst)) reachedNow.set(e.dst, (reachedNow.get(e.dst) ?? 0) + gain);
      }
    }
    frontier = byCarried(reachedNow);
    if (frontier.length > 0 && depth === t.HOPS) stop = "hop-limit";
  }

  return finish(acc, expanded, blocked, stop, reached);
}

/** A frontier, strongest first; ties broken by id so a traversal is deterministic. */
function byCarried(m: ReadonlyMap<string, number>): { id: string; carried: number }[] {
  return [...m]
    .map(([id, carried]) => ({ id, carried }))
    .sort((a, b) => b.carried - a.carried || (a.id < b.id ? -1 : 1));
}

function finish(
  acc: ReadonlyMap<string, { activation: number; depth: number; paths: number }>,
  expanded: number,
  blocked: number,
  stop: SpreadStop,
  depth: number,
): SpreadResult {
  const contributions = [...acc]
    .map(([id, v]) => ({ id, activation: v.activation, depth: v.depth, paths: v.paths }))
    .sort((a, b) => b.activation - a.activation || (a.id < b.id ? -1 : 1));
  return { contributions, expanded, blocked, stop, depth };
}
