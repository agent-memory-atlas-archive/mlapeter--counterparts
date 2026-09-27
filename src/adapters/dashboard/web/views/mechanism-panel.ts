/**
 * `/api/mechanism?id=<id>` — what the home page's mechanism panel shows for the
 * picked mechanism: its last few firings, narrated, and a small picture of THIS
 * store's real data where the site shows a demo.
 *
 *   decay            — the fade curves of a few real memories, from their last use
 *   retrieval        — the last turns that brought memories to mind, and whether
 *                      each one has been used since
 *   consolidation    — memories climbing toward the core, and how far each has to go
 *   salience         — recent memories and the score each was written with
 *   association      — the graph hubs: what the most is wired to
 *   reconsolidation  — recent corrections weighed against old memories
 *
 * A grey mechanism (not built) gets no picture and no activity: it has none.
 * Which rows count as a firing is `MECHANISM_PROOFS`, in `mechanisms.ts`.
 *
 * Read-only, like everything in this directory. Memory words go through
 * `reveal`, so a confidential row is withheld here exactly as everywhere else.
 */
import { TUNABLES, pruneVerdict, strength } from "../../../../core/physics/index.js";
import type { MemoryPhysics } from "../../../../core/types.js";
import { isJournal, ownerNames } from "../../../../core/sleep/index.js";
import type { EventRow } from "../../../../core/store/index.js";
import type { Band, Kind } from "../../../../core/types.js";
import type { DashboardSource } from "../../source.js";
import { narrateForPanel } from "../narrate.js";
import type { NarratedEvent } from "../narrate.js";
import { reveal, revealHere } from "../reveal.js";
import { coreRoad } from "./core-road.js";
import { MECHANISM_DAYS, MECHANISM_PROOFS, counted, payloadOf } from "./mechanisms.js";
import { LOG_CEILING, census } from "./shared.js";
import type { MemoryLine } from "./shared.js";

/** How many narrated firings the panel lists. */
export const PANEL_ACTIVITY = 4;
/** How far back, per event name, the panel looks for them. */
const ACTIVITY_LOOKBACK = 200;
/** How many lived days ahead a fade curve is drawn. */
export const FADE_AHEAD = 60;
/** How many lived days behind "now" a fade curve may start. */
export const FADE_BEHIND = 60;

interface Said {
  readonly id: string;
  readonly text: string;
  readonly confidential: boolean;
}

function said(src: DashboardSource, id: string, width = 72): Said {
  const r = reveal(src.store, id, width);
  return { id, text: r.text ?? r.label, confidential: r.confidential };
}

function saidLine(m: MemoryLine): Said {
  return { id: m.id, text: m.text, confidential: m.confidential };
}

export interface FadeCurve extends Said {
  readonly kind: Kind;
  readonly band: Band;
  readonly lastUsedDay: number;
  readonly now: number;
  /** [lived day, strength] pairs, one per day, from the curve's start. */
  readonly points: readonly (readonly [number, number])[];
  /** The first lived day ahead on which it falls below the archive line, if unused. */
  readonly archiveDay: number | null;
}

export type Picture =
  | {
      readonly kind: "decay";
      readonly day: number;
      readonly from: number;
      readonly to: number;
      /** Below this a memory drops out of the semantic band. */
      readonly semanticFloor: number;
      /** Below this a memory can be archived. */
      readonly archiveLine: number;
      readonly curves: readonly FadeCurve[];
    }
  | {
      readonly kind: "retrieval";
      readonly turns: readonly {
        readonly seq: number;
        readonly day: number;
        readonly turn: number;
        readonly memories: readonly (Said & { readonly said: boolean; readonly usedSince: boolean })[];
      }[];
      /** Of the memories brought to mind lately, how many got used (`recallUse`). */
      readonly use: RecallUse;
    }
  | {
      readonly kind: "consolidation";
      /** Fast lane: how strongly felt it must be. */
      readonly needFeeling: number;
      /** Slow lane: returns on this many separate lived days… */
      readonly requiredDays: number;
      /** …spanning this many lived days. */
      readonly needSpan: number;
      readonly climbing: readonly (Said & {
        readonly feeling: number;
        readonly days: number;
        readonly span: number;
        readonly returned: boolean;
        /** The engine's verdict: a lane is met, nothing blocks it (`core-road.ts`). */
        readonly ready: boolean;
        /** Felt enough, and one return after a gap is all it lacks (`core-road.ts`). */
        readonly oneReturnAway: boolean;
      })[];
      /**
       * Returns in the last `MECHANISM_DAYS` lived days, by source: `awake`
       * came back in conversation (the only kind the core lanes count),
       * `dream` was replayed in a dream. The upgrade's `legacy` rows are not
       * returns anyone saw and are not counted.
       */
      readonly returns: { readonly awake: number; readonly dream: number; readonly days: number };
      readonly promoted: readonly (Said & { readonly day: number; readonly lane: string | null })[];
      readonly core: number;
    }
  | {
      readonly kind: "salience";
      readonly memories: readonly (Said & { readonly salience: number; readonly bornDay: number; readonly memKind: Kind })[];
    }
  | {
      readonly kind: "association";
      readonly hubs: readonly (Said & { readonly weight: number; readonly degree: number })[];
      readonly links: number;
    }
  | {
      readonly kind: "reconsolidation";
      readonly revisions: readonly {
        readonly seq: number;
        readonly day: number;
        readonly target: Said;
        readonly challenger: Said;
        readonly pressure: number;
        readonly bar: number;
        readonly crossed: boolean;
      }[];
    };

export interface MechanismPanelView {
  readonly id: string;
  readonly found: boolean;
  readonly built: boolean;
  readonly livedDay: number;
  /** The newest few rows that count as this mechanism firing, narrated; a run
   *  of lines that read the same is one line with `repeats` (its newest row)
   *  and `fromDay` (its oldest row's day). */
  readonly activity: readonly Merged[];
  /** Null for a grey mechanism, and for a built one with no picture of its own. */
  readonly picture: Picture | null;
}

/** A narrated line standing for `repeats` neighbours that read the same. */
export type Merged = NarratedEvent & {
  repeats: number;
  /** The lived day of the OLDEST row it stands for; `day` is the newest's. */
  fromDay: number;
};

/**
 * "I wrote something down and every gate was clear" four times is one line,
 * ×4 (2026-09-26, an experiment). Only NEIGHBOURS that read the same merge, so
 * the order of what happened is kept; the merged line keeps its newest row, so
 * a click opens the latest record behind it. Lines arrive newest first, and
 * the run's span is kept (`fromDay`–`day`), so "×200" never hides that the 200
 * were spread over several days (2026-09-27).
 */
export function mergeRepeats(lines: readonly NarratedEvent[]): Merged[] {
  const out: Merged[] = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last !== undefined && last.text === line.text && last.name === line.name) {
      last.repeats += 1;
      last.fromDay = Math.min(last.fromDay, line.day);
    } else out.push({ ...line, repeats: 1, fromDay: line.day });
  }
  return out;
}

export function mechanismPanel(src: DashboardSource, id: string): MechanismPanelView {
  const store = src.store;
  const livedDay = store.livedDay();
  const proof = MECHANISM_PROOFS.find((m) => m.id === id);
  if (proof === undefined) return { id, found: false, built: false, livedDay, activity: [], picture: null };
  if (proof.build === "not") return { id, found: true, built: false, livedDay, activity: [], picture: null };

  const backing: EventRow[] = [];
  for (const p of proof.proofs) {
    for (const row of store.eventLog({ name: p.event, order: "desc", limit: ACTIVITY_LOOKBACK })) {
      if (counted(p, row, store) > 0) backing.push(row);
    }
  }
  const seen = new Set<number>();
  const ordered = backing
    .sort((a, b) => b.seq - a.seq)
    .filter((r) => (seen.has(r.seq) ? false : (seen.add(r.seq), true)));
  // Narrate newest first and stop once one line more than the panel shows has
  // begun: every shown line's count is then whole (within the lookback).
  const lines: NarratedEvent[] = [];
  let groups = 0;
  let lastText: string | null = null;
  for (const row of ordered) {
    const line = narrateForPanel(id, store, row);
    if (line.text !== lastText) {
      groups += 1;
      lastText = line.text;
      if (groups > PANEL_ACTIVITY) break;
    }
    lines.push(line);
  }
  const activity = mergeRepeats(lines).slice(0, PANEL_ACTIVITY);

  return { id, found: true, built: true, livedDay, activity, picture: pictureOf(src, id, livedDay) };
}

function pictureOf(src: DashboardSource, id: string, day: number): Picture | null {
  switch (id) {
    case "decay":
      return decayPicture(src, day);
    case "retrieval":
      return retrievalPicture(src, day);
    case "consolidation":
      return consolidationPicture(src, day);
    case "salience":
      return saliencePicture(src);
    case "association":
      return associationPicture(src);
    case "reconsolidation":
      return reconsolidationPicture(src);
    default:
      return null;
  }
}

// ── forgetting ──────────────────────────────────────────────────────────────

/**
 * Up to four real memories, spread across how strong they are today — the
 * strongest one that can still fade, the faintest, and two between — each drawn
 * from its last use to sixty lived days ahead, as the physics computes it. The
 * core identity band does not fade, so it is left out rather than drawn flat.
 */
function decayPicture(src: DashboardSource, day: number): Picture {
  const store = src.store;
  const fading = census(src).filter((m) => !m.schema && !m.promoted && !m.unreadable);
  const picks: MemoryLine[] = [];
  if (fading.length <= 4) picks.push(...fading);
  else {
    for (const q of [0, 0.35, 0.7, 1]) {
      const m = fading[Math.round(q * (fading.length - 1))];
      if (m !== undefined && !picks.includes(m)) picks.push(m);
    }
  }
  const to = day + FADE_AHEAD;
  let from = day;
  const curves: FadeCurve[] = picks.map((m) => {
    const physics = store.physicsOf(m.id);
    const curve = fadeCurve(physics, day);
    from = Math.min(from, curve.from);
    return { ...saidLine(m), kind: m.kind, band: m.band, lastUsedDay: physics.lastUsedDay, now: round(m.strength), points: curve.points, archiveDay: curve.archiveDay };
  });
  return {
    kind: "decay",
    day,
    from,
    to,
    semanticFloor: TUNABLES.THETA_SEM,
    archiveLine: TUNABLES.PHI_PRUNE,
    curves,
  };
}

// ── retrieval ───────────────────────────────────────────────────────────────

function idsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") out.push(item);
    else if (item !== null && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
      out.push((item as { id: string }).id);
    }
  }
  return out;
}

/**
 * The last few turns that brought anything to mind: what was said out loud and
 * what was kept as a footnote, and whether each memory has been USED since —
 * read off the memory's own physics (its last credited use is on or after that
 * turn's day, and after its birth), not guessed from the turn.
 */
function retrievalPicture(src: DashboardSource, day: number): Picture {
  const store = src.store;
  const turns: Extract<Picture, { kind: "retrieval" }>["turns"][number][] = [];
  for (const row of store.eventLog({ name: "recall.decision", order: "desc", limit: ACTIVITY_LOOKBACK })) {
    const p = payloadOf(row);
    const surfaced = idsOf(p["surfaced"]);
    const footnotes = idsOf(p["footnotes"]);
    if (surfaced.length + footnotes.length === 0) continue;
    const memories = [
      ...surfaced.map((id) => ({ id, said: true })),
      ...footnotes.map((id) => ({ id, said: false })),
    ].slice(0, 6).map(({ id, said: aloud }) => ({ ...said(src, id, 64), said: aloud, usedSince: usedSince(src, id, row.day) }));
    const turn = typeof p["turn"] === "number" ? p["turn"] : 0;
    turns.push({ seq: row.seq, day: row.day, turn, memories });
    if (turns.length >= 3) break;
  }
  return { kind: "retrieval", turns, use: recallUse(src, day) };
}

/**
 * THE "USED SINCE" TEST, one copy: a memory brought to mind on `day` counts as
 * used when its last credited use is on or after that day, and after its
 * birth — read off the memory's own physics, not guessed from the turn.
 */
function usedSince(src: DashboardSource, id: string, day: number): boolean {
  try {
    const physics = src.store.physicsOf(id);
    return physics.lastUsedDay >= day && physics.lastUsedDay > physics.birthDay;
  } catch {
    return false;
  }
}

export interface UseCount {
  /** Memories brought to mind. */
  readonly brought: number;
  /** Of them, used since (`usedSince`). */
  readonly used: number;
}

export interface RecallUse extends UseCount {
  /** Lived days looked at, today included. */
  readonly days: number;
  readonly said: UseCount;
  readonly footnote: UseCount;
  /** One entry per lived day of the window, oldest first. */
  readonly perDay: readonly (UseCount & { readonly day: number })[];
}

/**
 * OF THE MEMORIES BROUGHT TO MIND LATELY, HOW MANY GOT USED (2026-09-27, home
 * round 3 — a try): every `recall.decision` of the last `MECHANISM_DAYS` lived
 * days, surfaced (said out loud) and footnotes apart. A memory counts ONCE PER
 * DAY — brought to mind on five turns of one day is one memory that day, said
 * out loud if any of those turns said it — and "used" is `usedSince` above,
 * the same test the turns' rows show.
 */
export function recallUse(src: DashboardSource, day: number, span = MECHANISM_DAYS): RecallUse {
  const from = Math.max(0, day - (span - 1));
  const byDay = new Map<number, Map<string, boolean>>();
  for (const row of src.store.eventLog({ name: "recall.decision", sinceDay: from, order: "desc", limit: LOG_CEILING })) {
    const p = payloadOf(row);
    let seen = byDay.get(row.day);
    if (seen === undefined) {
      seen = new Map();
      byDay.set(row.day, seen);
    }
    for (const id of idsOf(p["surfaced"])) seen.set(id, true);
    for (const id of idsOf(p["footnotes"])) if (!seen.has(id)) seen.set(id, false);
  }
  const tally = { brought: 0, used: 0 };
  const saidT = { brought: 0, used: 0 };
  const footT = { brought: 0, used: 0 };
  const perDay: (UseCount & { day: number })[] = [];
  for (let d = from; d <= day; d++) {
    const seen = byDay.get(d);
    let brought = 0;
    let used = 0;
    for (const [id, aloud] of seen ?? []) {
      const u = usedSince(src, id, d);
      brought += 1;
      if (u) used += 1;
      const t = aloud ? saidT : footT;
      t.brought += 1;
      if (u) t.used += 1;
    }
    tally.brought += brought;
    tally.used += used;
    perDay.push({ day: d, brought, used });
  }
  return { ...tally, days: day - from + 1, said: saidT, footnote: footT, perDay };
}

// ── consolidation ───────────────────────────────────────────────────────────

/**
 * Becoming core (2026-09-26): only memories about me or about us, by one of two
 * lanes — strongly felt and come back once after a gap (fast), or come back on
 * several separate days over weeks (slow). Each climber shows how far along
 * both lanes it is; the nearest six are listed, with the last few that made it
 * and the lane that carried them.
 */
function consolidationPicture(src: DashboardSource, day: number): Picture {
  const store = src.store;
  const rows = census(src).filter((m) => !m.schema && !m.unreadable);
  const core = rows.filter((m) => m.promoted).length;
  const owner = ownerNames(store);
  const climbing = rows
    .filter((m) => !m.promoted)
    .flatMap((m) => {
      // The engine's verdict, asked the one way (`core-road.ts`); null = not
      // about me or about us, so never on the road.
      const road = coreRoad(store, { id: m.id, kind: m.kind }, owner, day);
      if (road === null) return [];
      const v = road.verdict;
      const fast = Math.min(1, v.fast.intensity / v.fast.needIntensity) + (v.fast.gap !== null && v.fast.gap >= v.fast.needGap ? 1 : 0);
      const slow = Math.min(1, v.slow.days / v.slow.needDays) + Math.min(1, v.slow.span / v.slow.needSpan);
      const returned = v.fast.gap !== null && v.fast.gap >= v.fast.needGap;
      return [{ m, road, feeling: v.fast.intensity, days: v.slow.days, span: v.slow.span, returned, progress: Math.max(fast, slow) }];
    })
    .sort((a, b) => Number(b.road.ready) - Number(a.road.ready) || b.progress - a.progress || (a.m.id < b.m.id ? -1 : 1))
    .slice(0, 6)
    .map((c) => ({
      ...saidLine(c.m),
      feeling: round(c.feeling),
      days: c.days,
      span: c.span,
      returned: c.returned,
      ready: c.road.ready,
      oneReturnAway: c.road.oneReturnAway,
    }));
  const sinceDay = Math.max(0, day - (MECHANISM_DAYS - 1));
  const counts = store.returnCounts({ sinceDay });
  const promoted = store
    .eventLog({ name: "band.promoted", order: "desc", limit: 3 })
    .filter((r) => r.ref !== null)
    .map((r) => {
      const lane = payloadOf(r)["lane"];
      return { ...said(src, r.ref as string), day: r.day, lane: typeof lane === "string" ? lane : null };
    });
  return {
    kind: "consolidation",
    needFeeling: TUNABLES.CORE_FAST_FEELING,
    requiredDays: TUNABLES.CORE_SLOW_DAYS,
    needSpan: TUNABLES.CORE_SLOW_SPAN_DAYS,
    climbing,
    promoted,
    core,
    returns: { awake: counts.awake, dream: counts.dream, days: MECHANISM_DAYS },
  };
}

// ── salience ────────────────────────────────────────────────────────────────

/** The most recent memories, newest first, with the score each was written with. */
function saliencePicture(src: DashboardSource): Picture {
  const memories = census(src)
    .filter((m) => !m.schema && !m.unreadable)
    .sort((a, b) => b.bornDay - a.bornDay || (a.id < b.id ? -1 : 1))
    .slice(0, 8)
    .map((m) => ({ ...saidLine(m), salience: round(m.salience), bornDay: m.bornDay, memKind: m.kind }));
  return { kind: "salience", memories };
}

// ── association ─────────────────────────────────────────────────────────────

/** The graph hubs: what the most is wired to, by summed link weight. */
function associationPicture(src: DashboardSource): Picture {
  const store = src.store;
  const weight = new Map<string, { w: number; d: number }>();
  let links = 0;
  for (const id of store.list({ archived: false })) {
    const row = store.row(id);
    if (row === undefined || isJournal(row)) continue;
    for (const edge of store.edgesFrom(id)) {
      links += 1;
      for (const end of [id, edge.dst]) {
        const cur = weight.get(end) ?? { w: 0, d: 0 };
        cur.w += edge.weight;
        cur.d += 1;
        weight.set(end, cur);
      }
    }
  }
  const hubs = [...weight.entries()]
    .sort((a, b) => b[1].w - a[1].w || (a[0] < b[0] ? -1 : 1))
    .slice(0, 6)
    .map(([id, v]) => ({ ...said(src, id), weight: round(v.w), degree: v.d }));
  return { kind: "association", hubs, links };
}

// ── reconsolidation ─────────────────────────────────────────────────────────

/**
 * The last few corrections weighed against an old memory: which memory argued,
 * with which one, and how far the pressure is toward the bar it would take to
 * change it. The target is read AS IT STOOD (unfollowed), like the feed does.
 */
function reconsolidationPicture(src: DashboardSource): Picture {
  const store = src.store;
  const revisions = store.eventLog({ name: "revision.pressure", order: "desc", limit: 5 }).map((row) => {
    const p = payloadOf(row);
    const targetId = typeof p["targetId"] === "string" ? p["targetId"] : (row.ref ?? "");
    const challengerId = typeof p["challengerId"] === "string" ? p["challengerId"] : "";
    const here = revealHere(store, targetId, 72);
    const pressure = typeof p["pressureAfter"] === "number" ? p["pressureAfter"] : 0;
    const bar = typeof p["bar"] === "number" ? p["bar"] : 0;
    return {
      seq: row.seq,
      day: row.day,
      target: { id: targetId, text: here.text ?? here.label, confidential: here.confidential },
      challenger: said(src, challengerId),
      pressure: round(pressure),
      bar: round(bar),
      crossed: bar > 0 && pressure >= bar,
    };
  });
  return { kind: "reconsolidation", revisions };
}

/**
 * One memory's fade, as the physics computes it: from its last use (at most
 * `FADE_BEHIND` lived days back) to `FADE_AHEAD` days past `day`, one
 * [lived day, strength] pair per day, and the first day ahead on which it falls
 * below the archive line if nobody uses it. The Forgetting panel draws a few of
 * these; the memory card draws its own one (`memory.ts`).
 */
export function fadeCurve(
  physics: MemoryPhysics,
  day: number,
): { from: number; to: number; points: [number, number][]; archiveDay: number | null } {
  const from = Math.max(physics.lastUsedDay, day - FADE_BEHIND);
  const to = day + FADE_AHEAD;
  const points: [number, number][] = [];
  let archiveDay: number | null = null;
  for (let d = from; d <= to; d++) {
    const s = strength(physics, d);
    points.push([d, round(s)]);
    if (archiveDay === null && d > day && s < TUNABLES.PHI_PRUNE) archiveDay = d;
  }
  return { from, to, points, archiveDay };
}

/**
 * The first lived day within `horizon` days ahead on which prune's own verdict
 * (`physics#pruneVerdict`: under the floor, long enough unused, episodic, not
 * protected) would let this memory go if nobody used it — or null. The
 * revision-chain gate is not checked here (it needs the store), so this can
 * only say "sooner than it will be", never "later".
 */
export function letGoDay(physics: MemoryPhysics, day: number, horizon: number): number | null {
  // Unused, strength only falls: still over the floor at the horizon means never inside it.
  if (strength(physics, day + horizon) >= TUNABLES.PHI_PRUNE) return null;
  for (let d = day; d <= day + horizon; d++) {
    if (pruneVerdict(physics, d, { inLiveRevisionChain: false }).prune) return d;
  }
  return null;
}

function round(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : 0;
}

