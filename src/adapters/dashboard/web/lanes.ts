/**
 * Which feed a durable event belongs in, and the small icon it carries there
 * (2026-09-26, an experiment).
 *
 * The home page's "Live activity" shows MEMORY events only: something
 * remembered; a memory got stronger, was replaced or was let go; a chapter was
 * written; a session was handed off; the night's sleep, as one line; a reminder
 * fired. Everything else — embed backfills, cursor moves, cue plumbing, the
 * clock, the worker, the copies — is housekeeping, and belongs to the flow tab's
 * feed, which keeps showing the whole durable log.
 *
 * One table, EXHAUSTIVE BY TYPE: a durable event added to the core fails `tsc`
 * here until someone has said which feed it belongs in.
 */
import type { DurableEventName } from "../registries.js";

export type Lane = "home" | "flow";

/** The icon a home line carries, so the feed can be scanned. */
export type Icon = "remembered" | "stronger" | "replaced" | "faded" | "chapter" | "sleep" | "reminder" | "handoff";

type Payload = Record<string, unknown>;

/** A lane, or a rule over the payload for the two names whose rows are only
 *  sometimes about a memory. */
type LaneRule = Lane | ((p: Payload) => Lane);

const n = (p: Payload, k: string): number => (typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : 0);

export const LANES = {
  // ── memory events: home ──
  "gate.deposit": "home",
  "gate.chunk": "home",
  "band.promoted": "home",
  "band.transition": "home",
  "memory.pruned": "home",
  "memory.merged": "home",
  "memory.unmerged": "home",
  "revision.pressure": "home",
  // A session end that strengthened nothing is housekeeping — unless the credit
  // itself failed, which is a real problem about memories and stays home.
  "recall.credit": (p) =>
    n(p, "credited") > 0 || p["reason"] === "failed" || p["reason"] === "budget-exceeded" ? "home" : "flow",
  "journal.copy.written": "home",
  "journal.copy.failed": "home",
  "handoff.written": "home",
  "handoff.cleared": "home",
  "sleep.cycle": "home",
  "prospective.fire": "home",
  "prospective.plain": "home",
  // Dreaming and the core (2026-09-26): a dream that wrote its journal, what
  // it changed, and the owner sending a memory back out of the core are
  // things that happened to memories.
  "dream.journaled": "home",
  "dream.changed": "home",
  "dream.undone": "home",
  "band.demoted": "home",
  // ── housekeeping: flow ──
  "dream.begun": "flow",
  "dream.ask": "flow",
  "physics.upgrade.census": "flow",
  "adapter.ask": "flow",
  "adapter.authorship.ask": "flow",
  "adapter.boundary": "flow",
  "adapter.checkout": "flow",
  "adapter.embed.backfill": "flow",
  "adapter.episode.ask": "flow",
  "adapter.primacy.deliver": "flow",
  "adapter.primacy.standdown": "flow",
  "adapter.recall": "flow",
  "adapter.runner.failed": "flow",
  "adapter.semantic.lag": "flow",
  "adapter.spawn.failed": "flow",
  "adapter.spawn.refused": "flow",
  "adapter.spawn.started": "flow",
  "adapter.wake.delivered": "flow",
  "adapter.wake.injected": "flow",
  "associate.flush": "flow",
  "handoff.refused": "flow",
  "handoff.shown": "flow",
  "mcp.recall": "flow",
  "prospective.fire.refused": "flow",
  "recall.decision": "flow",
  "remember.prune": "flow",
  "self.briefing": "flow",
  "self.page.refused": "flow",
  "self.page.revised": "flow",
  "self.page.writer.ran": "flow",
  "snapshot.failed": "flow",
  "snapshot.rotated": "flow",
  "snapshot.taken": "flow",
  "store.embedder.reconciled": "flow",
  "store.export": "flow",
  "sweep.gate": "flow",
  "sweep.wake": "flow",
} as const satisfies Record<DurableEventName, LaneRule>;

/** The feed a row belongs in. A name nobody mapped goes to flow. */
export function laneOf(name: string, p: Payload): Lane {
  const rule = (LANES as Record<string, LaneRule | undefined>)[name];
  if (rule === undefined) return "flow";
  return typeof rule === "function" ? rule(p) : rule;
}

/** The icon a row carries, or null for a housekeeping line. */
export function iconOf(name: string, p: Payload): Icon | null {
  switch (name) {
    case "gate.deposit":
    case "gate.chunk":
      return "remembered";
    case "band.promoted":
    case "recall.credit":
      return "stronger";
    case "band.transition":
      return p["direction"] === "up" ? "stronger" : "faded";
    case "memory.pruned":
      return "faded";
    case "memory.merged":
    case "memory.unmerged":
    case "revision.pressure":
      return "replaced";
    case "journal.copy.written":
    case "journal.copy.failed":
      return "chapter";
    case "handoff.written":
    case "handoff.cleared":
      return "handoff";
    case "sleep.cycle":
    case "dream.journaled":
    case "dream.changed":
    case "dream.undone":
      return "sleep";
    case "band.demoted":
      return "faded";
    case "prospective.fire":
    case "prospective.plain":
      return "reminder";
    default:
      return null;
  }
}
