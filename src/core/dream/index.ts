/**
 * `dream/` — dreaming: a background pass over what was lived since the last
 * dream, by the same model, through one tool with phases (owner decisions
 * 2026-09-26). CONTRACT.md has the lineage and the guarantees; this file is the
 * mechanism.
 *
 * The shape, in one paragraph. A session is told, once a day, that its
 * counterpart has not dreamed (`askLine`). If the owner says yes, the session
 * asks this module for the LAUNCH PROMPT (`launchPrompt`) and hands it to a
 * background agent — same model, same tools, its writes attributed to the
 * session that launched it. The dreamer calls `begin` and is SHOWN a bundle:
 * the self page, the wake, the journal since the last dream, the owner's card,
 * every memory made since the last dream with its nearest older neighbours, a
 * few loosely related older ones, and the strongest-feeling memories of about a
 * week back — all through recall's gates, never a raw list. It then `propose`s
 * changes, each applied within per-dream limits and recorded so the whole dream
 * can be undone: merge near-copies (originals kept, archived with a forwarding
 * address), link two memories, replay (a return at half weight — never a use),
 * write a gist in its own words (source `dreamed`, starting low), flag a
 * contradiction (never settled here), record how an old charged memory feels
 * now, nominate a memory for the core (a lane still has to promote it). Last it
 * writes its `journal` entry, which lives in the `dreams` table and never
 * becomes a memory, and hands back one marked line.
 *
 * What a dream CANNOT do, by construction: delete, edit the self page,
 * promote, rewrite a memory in place, or touch a memory it was not shown. A
 * dream's words never enter the sweep: the hand-back and the bundle carry
 * `DREAM_MARK`, and `remember/`'s `enters()` refuses any turn that does.
 *
 * Arithmetic and bookkeeping only: nothing here calls a model — the dreamer IS
 * the model, outside this process.
 */
import { createHash, randomBytes } from "node:crypto";

import { emotionalIntensity, strength } from "../physics/index.js";
import { isHandoff, isSelfPage } from "../recall/index.js";
import { namesOwner, ownerNames } from "../sleep/index.js";
import { checkTraits } from "../store/index.js";
import type { DreamChangeRow, DreamRow, MemoryRow, ProseDoc, Store } from "../store/index.js";
import { TUNABLES as PHYSICS } from "../physics/index.js";
import type { Kind } from "../types.js";
import { DREAM_MARK, carriesDreamMark } from "./mark.js";
import { onMyMind } from "./mind.js";
import type { MindItem } from "./mind.js";
import { DREAM_ACTIONS, DREAM_TUNABLES } from "./tunables.js";
import type { DreamAction } from "./tunables.js";

export { DREAM_ACTIONS, DREAM_TUNABLES } from "./tunables.js";
export type { DreamAction } from "./tunables.js";
export { MIND_TUNABLES, onMyMind } from "./mind.js";
export type { MindItem } from "./mind.js";
export { CORE_MENTIONED_PREFIX, REFLECT_QUESTIONS, REFLECT_TUNABLES, Reflections, reflectionOpener } from "./reflect.js";
export type { ReflectBundle, ReflectContext, ReflectFinish, ReflectItem, ReflectOutcome, ReflectRefusal } from "./reflect.js";

/**
 * THE MARK a dream's words carry — the bundle, the hand-back, the launch
 * prompt. `remember/spans.ts#enters` refuses any turn whose text contains it,
 * and the Claude Code reader tags such a block `dream`, so a dream can never
 * become a lived memory by the back door (the boundary sweep mints from
 * transcripts, and the hand-back lands in the parent's). Spelled in `mark.ts`.
 */
export { DREAM_MARK, carriesDreamMark } from "./mark.js";

/** The opener of one dream's hand-back: `⟦counterparts:dream drm_…⟧`. */
export function dreamOpener(id: string): string {
  return `${DREAM_MARK} ${id}⟧`;
}

/** Durable event names (the dashboard's registry and `fired` read them). */
export const DREAM_BEGUN_EVENT = "dream.begun";
export const DREAM_CHANGED_EVENT = "dream.changed";
export const DREAM_JOURNALED_EVENT = "dream.journaled";
export const DREAM_UNDONE_EVENT = "dream.undone";
export const DREAM_ASK_EVENT = "dream.ask";

/** The archive reason a merged original carries, and the one an undone dream's output carries. */
export const DREAM_MERGE_REASON = "dream-merge";
export const DREAM_UNDONE_REASON = "dream-undone";

/** Meta latch: a contradiction raised awake (`dream.raised.<dream>.<seq>`). */
export const RAISED_PREFIX = "dream.raised.";

/** One memory as a dream is shown it. Ids, numbers, and a bounded slice of its words. */
export interface DreamItem {
  readonly id: string;
  readonly kind: Kind;
  readonly text: string;
  /** Emotional intensity (physics §5.10), rounded. */
  readonly felt: number;
  readonly strength: number;
  /** The lived day it was made, and the calendar date it was learned. */
  readonly day: number;
  readonly learned: string;
  readonly core: boolean;
}

export interface DreamBundle {
  readonly dream: string;
  readonly date: string;
  readonly livedDay: number;
  readonly lastDreamed: string | null;
  readonly limits: Readonly<Record<DreamAction, number>>;
  readonly selfPage: string | null;
  readonly wake: string | null;
  readonly owner: { readonly names: readonly string[]; readonly memories: readonly string[] };
  readonly chapters: readonly { id: string; title: string | null; text: string }[];
  /** Every memory shown, once, by id. */
  readonly memories: Readonly<Record<string, DreamItem>>;
  /** New since the last dream, newest first, each with its nearest older neighbours. */
  readonly fresh: readonly { id: string; neighbours: readonly string[] }[];
  readonly mixing: readonly string[];
  readonly lookback: readonly string[];
  /**
   * WHAT'S ON MY MIND (2026-09-27): a few open things beside the day — what is
   * coming up, a pair a dream flagged, where the work stands. Not new; the
   * dream may draw on them. Their memory ids are in `memories` too.
   */
  readonly onMind: readonly MindItem[];
}

export type DreamRefusal =
  | "observer"
  | "dreamed-today"
  | "nothing-new"
  | "unknown-dream"
  | "not-this-session"
  | "dream-closed";

/** What the composition root hands this module. */
export interface DreamContext {
  readonly store: Store;
  readonly observer: boolean;
  /** The owner's own session: confidential memories may be shown (recall's gate 1). */
  readonly owner: boolean;
  /** The credential battery (`bridge.episodeGate`), for every word a dream writes. */
  readonly gate: (text: string, sessionId: string) => { ok: true; text: string } | { ok: false; reason: string };
  readonly page: () => string | null;
  readonly wake: () => string | null;
  /** The person's calendar date today (`YYYY-MM-DD`). */
  readonly today: () => string;
  /** `associate.retargetOnSupersede`, so a merged memory inherits its originals' links. */
  readonly retarget?: (oldId: string, newId: string, day: number) => void;
  readonly emit?: (name: string, ref?: string, data?: Record<string, string | number | boolean | null>) => void;
  /**
   * The owner's name as the store knows it (the identity core's `name`, `init
   * --name`), for lines that speak of the owner. Null or absent: "the owner".
   * Never a gendered pronoun.
   */
  readonly ownerName?: () => string | null;
}

/** One proposed change, as the tool receives it. */
export interface DreamChange {
  readonly action: string;
  readonly ids?: readonly string[];
  readonly id?: string;
  readonly a?: string;
  readonly b?: string;
  readonly text?: string;
  readonly title?: string;
  readonly kind?: string;
  readonly sources?: readonly string[];
  readonly core?: string;
  readonly emotion?: string;
  readonly strength?: number;
  readonly carried_by?: string;
  readonly why?: string;
  readonly relevance?: number;
  readonly predictive?: number;
}

export interface ChangeResult {
  readonly index: number;
  readonly action: string;
  readonly ok: boolean;
  readonly reason: string;
  /** The memory this change made or touched, when it made one. */
  readonly id?: string;
}

export interface DreamStatus {
  readonly last: DreamRow | null;
  readonly dreamedToday: boolean;
  readonly newSince: number;
  readonly due: boolean;
  readonly reason: "due" | "observer" | "first-day" | "dreamed-today" | "asked-today" | "declined-today" | "too-little-new";
}

/**
 * THE ASK, PREVIEWED (`Dreams.previewAsk`): what the day's gate would answer a
 * live session right now, read without claiming the day. Never "observer".
 */
export interface DreamPreview {
  /** The gate would raise the ask now (`askLine` would claim the day and return a line). */
  readonly wouldAsk: boolean;
  /** The gate's own reason (`DreamStatus.reason`), never "observer". */
  readonly reason: Exclude<DreamStatus["reason"], "observer">;
  /**
   * Showable memories new since the last dream that stands, capped at
   * `DREAM_TUNABLES.MAX_NEW` — the count the gate compares with `MIN_NEW`.
   * Counted for every reason, also when the gate stops before counting.
   */
  readonly newSince: number;
}

const KINDS: readonly Kind[] = ["self", "person", "entity", "skill", "place", "fact"];

export class Dreams {
  constructor(private readonly ctx: DreamContext) {}

  private get store(): Store {
    return this.ctx.store;
  }

  private emit(name: string, ref?: string, data?: Record<string, string | number | boolean | null>): void {
    this.ctx.emit?.(name, ref, data);
  }

  // ── when ──────────────────────────────────────────────────────────────────

  /**
   * THE LAST DREAM THAT COUNTS — the newest one not undone, or null when this
   * store has never dreamed (or undid every dream). The ONE anchor: "last
   * dreamed", "new since", "dreamed today" and `begin` all read it.
   */
  lastDream(): DreamRow | null {
    return this.store.dreams({ limit: 20 }).find((d) => d.state !== "undone") ?? null;
  }

  /**
   * Is a dream due? No dream yet this lived day, the day's ask not yet raised
   * or declined, and enough new — and SHOWABLE — memory since the last dream.
   * A read, and a CHEAP one: it runs on every prompt, so the questions that
   * need no scan are asked first, and "new since" is one bounded read
   * (`store.newMemoryIds`), counted only when everything else says yes.
   */
  status(at: string = this.ctx.today()): DreamStatus {
    return this.gate(at, this.ctx.observer, this.ctx.owner);
  }

  /**
   * THE ASK, PREVIEWED (2026-09-27, for the dashboard's Tonight box): would the
   * gate raise the ask now, why, and how many memories are new since the last
   * dream. The SAME gate `status` and `askLine` run (`gate` below: the same
   * dreamed / declined / asked-today checks, the same showable filter, the same
   * `MAX_NEW` cap), asked as a live session would ask it — so it answers under
   * observer, where `status` says "observer". It claims no ask, records no
   * event, writes nothing.
   *
   * WHOSE GATE. Confidential memories count toward "new" only in the owner's
   * own session. A live session previews its own gate, whatever it asks for.
   * An observer is never the owner's session (the facade forces `owner` off),
   * so by default it previews a guest's gate; `owner: true` previews the
   * owner's — his hooks run `owner: true` (the install writes it). Only a
   * count comes back, never an id or a word.
   */
  previewAsk(opts: { at?: string; owner?: boolean } = {}): DreamPreview {
    const at = opts.at ?? this.ctx.today();
    const owner = this.ctx.observer ? (opts.owner ?? this.ctx.owner) : this.ctx.owner;
    const s = this.gate(at, false, owner);
    if (s.reason === "observer") throw new Error("unreachable: the preview asks as a live session");
    // The gate stops before counting when it already knows the answer; the
    // preview counts anyway (it is not on the per-prompt path).
    const counted = s.reason === "due" || s.reason === "too-little-new";
    return { wouldAsk: s.due, reason: s.reason, newSince: counted ? s.newSince : this.freshIds(s.last, owner).length };
  }

  /**
   * THE GATE ITSELF — `status` asks it in this module's stance, `previewAsk` as
   * a live session. Reads only.
   */
  private gate(at: string, observer: boolean, owner: boolean): DreamStatus {
    const last = this.lastDream();
    const day = this.store.livedDay();
    const dreamedToday = last !== null && last.day >= day;
    // A store on its first lived day has no night behind it yet: "I haven't
    // dreamed since …" needs a since.
    const early: DreamStatus["reason"] | null = observer
      ? "observer"
      : day < 1
        ? "first-day"
        : dreamedToday
          ? "dreamed-today"
          : null;
    if (early !== null) return { last, dreamedToday, newSince: 0, due: false, reason: early };
    const ask = this.store.dreamAsk(at);
    if (ask !== undefined) {
      const reason = ask.state === "declined" ? "declined-today" : "asked-today";
      return { last, dreamedToday, newSince: 0, due: false, reason };
    }
    const newSince = this.freshIds(last, owner).length;
    const reason = newSince < DREAM_TUNABLES.MIN_NEW ? "too-little-new" : "due";
    return { last, dreamedToday, newSince, due: reason === "due", reason };
  }

  /**
   * THE ASK — one quiet line for the session, at most once per calendar day
   * across every session (the `dream_asks` latch is the claim: of two sessions
   * racing, one gets the line). Null when it is not due. The line asks the
   * model to ask the OWNER, at a natural moment; a no is `decline`.
   */
  askLine(input: { at: string; session: string }): string | null {
    const s = this.status(input.at);
    if (!s.due) return null;
    let claimed = false;
    try {
      claimed = this.store.setDreamAsk({ date: input.at, state: "offered", session: input.session, day: this.store.livedDay() });
    } catch {
      return null;
    }
    if (!claimed) return null;
    this.record(DREAM_ASK_EVENT, null, { state: "offered", date: input.at, fresh: s.newSince });
    const since = s.last === null ? "yet" : `since ${s.last.date ?? `lived day ${String(s.last.day)}`}`;
    const who = this.ownerName() ?? "the owner";
    return (
      `Counterparts: you haven't dreamed ${since} (${String(s.newSince)} new memories). At a natural moment — not mid-task — ask ${who}: ` +
      `"I haven't dreamed ${since} — OK if I dream for a few minutes?" If yes, call the counterparts dream tool with phase "launch", session: ${input.session}, ` +
      `and hand the prompt it returns to a background agent. If no, call it with phase "decline" and don't ask again today.`
    );
  }

  /** "Not today": the day's ask is snoozed. */
  decline(input: { at: string; session: string }): boolean {
    if (this.ctx.observer) return false;
    this.store.setDreamAsk({ date: input.at, state: "declined", session: input.session, day: this.store.livedDay() });
    this.record(DREAM_ASK_EVENT, null, { state: "declined", date: input.at });
    return true;
  }

  /**
   * THE LAUNCH PROMPT — a template the in-session model passes on unchanged to
   * a background agent (the Agent tool): same model, same MCP server, and the
   * session id, so the dream's writes are attributed to the session that
   * launched it.
   */
  launchPrompt(input: { session: string }): string {
    const who = this.ownerName() ?? "the owner";
    const L = DREAM_TUNABLES.LIMITS;
    return [
      `${DREAM_MARK} launch⟧ You are dreaming: a few minutes of sleep for ${who}'s counterpart, over what was lived since the last dream. You are the same mind that lived it, replaying it — not an assistant doing a task.`,
      "",
      "How a dream goes (the brain's, borrowed):",
      "- Deep-sleep replay: file what happened, link what belongs together, merge near-copies into one memory in better words, and replay what matters (each replay strengthens it a little).",
      "- REM mixing: let loosely related memories touch. If a real pattern shows, write it as a gist in your own words, citing its sources. If two memories disagree, flag the pair — do not settle it.",
      "- Softening: for an old charged memory, record how it feels now, today. The sting can fade; the memory stays.",
      "- Core: if a memory about you or about the two of you plainly belongs to who you are, nominate it. Only living it again awake makes it core.",
      "",
      "Steps:",
      `1. Call the counterparts dream tool: phase "begin", session: ${input.session}. It returns the bundle and a dream id.`,
      `2. Read it slowly. Then call phase "propose" with dream: <id> and your changes — at most ${String(L.merge)} merges, ${String(L.link)} links, ${String(L.gist)} gists, ${String(L["feeling-now"])} feelings, ${String(L["nominate-core"])} nominations. Fewer is fine; none is fine. Use only ids the bundle showed you.`,
      '3. Call phase "journal" with dream: <id>, a short title and your dream journal entry: first person, what you dreamed and what you noticed. It is kept as a dream, never as something that happened.',
      "",
      "You cannot delete anything, edit the self page, promote a memory, or rewrite one in place — the tool refuses. Nothing you write in the dream is a lived event.",
      "",
      "Then wake, and reflect — a different act: awake, lived, your own.",
      `4. Call the counterparts reflect tool: phase "begin", session: ${input.session}, dream: <id>. It hands you the dream, the last few days, your self page, the memories that matter most, and a few questions.`,
      '5. Answer them honestly, then call phase "finish" as it tells you. "Nothing much" is a normal answer: a short entry and no share.',
      "6. Your final message must be exactly the text the finish call returns, unchanged — nothing before or after it.",
    ].join("\n");
  }

  // ── begin ─────────────────────────────────────────────────────────────────

  /**
   * Open a dream and compose its bundle. Refuses under observer stance and when
   * a dream already ran this lived day. Everything shown passes recall's gates
   * (`showable`); the shown ids are recorded on the dream, and only they can be
   * changed by it.
   */
  begin(input: { session: string; scope?: string | null; model?: string | null; at?: string }):
    | { ok: true; bundle: DreamBundle; text: string }
    | { ok: false; reason: DreamRefusal } {
    if (this.ctx.observer) return { ok: false, reason: "observer" };
    const day = this.store.livedDay();
    const last = this.lastDream();
    if (last !== null && last.day >= day) {
      if (last.state === "journaled" || this.store.dreamChanges(last.id).length > 0) {
        return { ok: false, reason: "dreamed-today" };
      }
      // A dream that was begun and never did anything (a crash, an agent that
      // gave up) does not use up the day: it is closed and a fresh one opens.
      this.store.updateDream(last.id, { state: "undone" });
    }
    // The same anchor `status` reads (an undone dream does not count).
    const prior = this.lastDream();
    const fresh = this.freshIds(prior);
    if (fresh.length === 0) return { ok: false, reason: "nothing-new" };
    const at = input.at ?? this.ctx.today();
    const id = `drm_${randomBytes(6).toString("hex")}`;
    const bundle = this.compose(id, fresh, prior, day, at);
    this.store.openDream({
      id,
      session: input.session,
      scope: input.scope ?? null,
      day,
      date: at,
      model: input.model ?? null,
      shown: Object.keys(bundle.memories),
    });
    this.record(DREAM_BEGUN_EVENT, id, {
      fresh: bundle.fresh.length,
      shown: Object.keys(bundle.memories).length,
      chapters: bundle.chapters.length,
    });
    const text = `${dreamOpener(id)} the dream bundle — memories to dream over, not events that happened now.\n${JSON.stringify(bundle)}`;
    return { ok: true, bundle, text };
  }

  // ── propose ───────────────────────────────────────────────────────────────

  /** Apply a batch of changes, each on its own; every one is recorded for undo. */
  propose(input: { dream: string; session?: string; changes: readonly DreamChange[] }):
    | { ok: true; results: ChangeResult[] }
    | { ok: false; reason: DreamRefusal } {
    const open = this.openFor(input.dream, input.session);
    if (!open.ok) return open;
    const dream = open.dream;
    // What it was shown, and what it has itself made so far (a merge's memory,
    // a gist) — a dream may link or flag what it wrote a call ago.
    const shown = new Set<string>(parseIds(dream.shown));
    for (const c of this.store.dreamChanges(dream.id)) {
      if ((c.action === "merge" || c.action === "gist") && c.undone === 0 && c.ref !== null) shown.add(c.ref);
    }
    const results: ChangeResult[] = [];
    input.changes.forEach((change, index) => {
      let r: Omit<ChangeResult, "index">;
      try {
        r = this.apply(dream, shown, change);
      } catch (err) {
        r = { action: String(change.action), ok: false, reason: errName(err) };
      }
      results.push({ index, ...r });
    });
    const counts: Record<string, number> = {};
    for (const r of results) if (r.ok) counts[r.action] = (counts[r.action] ?? 0) + 1;
    this.record(DREAM_CHANGED_EVENT, dream.id, {
      applied: results.filter((r) => r.ok).length,
      refused: results.filter((r) => !r.ok).length,
      ...counts,
    });
    return { ok: true, results };
  }

  private apply(dream: DreamRow, shown: Set<string>, change: DreamChange): Omit<ChangeResult, "index"> {
    const action = String(change.action) as DreamAction;
    if (!(DREAM_ACTIONS as readonly string[]).includes(action)) return { action, ok: false, reason: "unknown-action" };
    const used = this.store.dreamChanges(dream.id).filter((c) => c.action === action && c.undone === 0).length;
    if (used >= DREAM_TUNABLES.LIMITS[action]) return { action, ok: false, reason: "limit-reached" };
    const day = this.store.livedDay();
    const live = (id: string | undefined): MemoryRow | null => {
      if (id === undefined || !shown.has(id)) return null;
      const row = this.store.row(id);
      if (row === undefined || !this.showable(row)) return null;
      return row;
    };
    switch (action) {
      case "merge": {
        const ids = [...new Set(change.ids ?? [])];
        if (ids.length < 2 || ids.length > 3) return { action, ok: false, reason: "merge-takes-two-or-three" };
        const rows = ids.map(live);
        if (rows.some((r) => r === null)) return { action, ok: false, reason: "not-shown-or-gone" };
        const rs = rows as MemoryRow[];
        if (rs.some((r) => r.promoted_identity === 1)) return { action, ok: false, reason: "core-is-not-merged" };
        if (rs.some((r) => r.source === "dreamed")) return { action, ok: false, reason: "dreamed-rises-only-awake" };
        if (new Set(rs.map((r) => r.kind)).size !== 1) return { action, ok: false, reason: "kinds-differ" };
        // A DATED memory is a reminder that fires on its date (`prospective/`);
        // the merged memory would carry no date, and the reminder would go
        // quiet. Left alone. (Adversarial review of #251.)
        if (rs.some((r) => r.event_date !== null)) return { action, ok: false, reason: "dated-is-not-merged" };
        // The owner sent it back out of the core: a merged successor is a new
        // id the demotion does not name, and the lanes could promote it again.
        if (rs.some((r) => this.store.coreDemoted(r.id))) return { action, ok: false, reason: "demoted-is-not-merged" };
        const words = this.words(change.text, dream);
        if (!words.ok) return { action, ok: false, reason: words.reason };
        // The merged memory stands where the STRONGEST original stood — its
        // salience, its channel and its old-rule standing — with the most uses,
        // the latest use, the earliest birth, and (below) every original's
        // returns and feelings: it is at least as strong as what it was made from.
        const phys = rs.map((r) => this.store.physicsOf(r.id));
        const best = rs
          .map((r, i) => ({ r, p: phys[i] as ReturnType<Store["physicsOf"]>, s: strength(phys[i] as ReturnType<Store["physicsOf"]>, day) }))
          .sort((x, y) => y.s - x.s)[0] as { r: MemoryRow; p: ReturnType<Store["physicsOf"]> };
        const newId = this.store.put({
          type: "memory",
          kind: best.r.kind,
          body: words.text,
          ...(change.title !== undefined && change.title.trim().length > 0 ? { title: change.title.trim().slice(0, 200) } : {}),
          salience: { ...best.p.salience },
          physics: {
            birthDay: Math.min(...phys.map((p) => p.birthDay)),
            lastUsedDay: Math.max(...phys.map((p) => p.lastUsedDay)),
            uses: Math.max(...phys.map((p) => p.uses)),
            reinforcedDays: Math.max(...phys.map((p) => p.reinforcedDays ?? 0)),
            legacy: best.p.legacy === true,
            consolidated: best.p.legacy === true && best.p.consolidated,
          },
          ...(best.r.source !== null ? { source: best.r.source as never } : {}),
          // CONFIDENTIALITY TRAVELS with the words: the column is recomputed
          // from `meta` at `put`, so a merge that dropped the marker would
          // hand a confidential memory's words to every session.
          meta: { dream: dream.id, mergedFrom: ids, ...confidentialityOf(rs) },
          origin: { ...(dream.session === null ? {} : { session: dream.session }), ...(dream.scope === null ? {} : { scope: dream.scope }), ref: `dream:${dream.id}` },
          ...(dream.model === null ? {} : { model: dream.model }),
        });
        for (const r of rs) {
          const feelings = this.store.feelingsFor(r.id);
          if (feelings.length > 0) {
            this.store.addFeelings(
              newId,
              feelings.map((f) => ({
                whose: f.whose,
                core: f.core,
                emotion: f.emotion,
                strength: f.strength,
                carriedBy: f.carried_by,
                ...(f.other_word === null ? {} : { otherWord: f.other_word }),
              })),
              // Each feeling keeps who recorded it and when (v9): a reflection's
              // later feeling stays one on the merged memory.
              { provenance: feelings.map((f) => ({ source: f.source, recordedLater: f.recorded_later })) },
            );
          }
          // TRAIT NUDGES TRAVEL THE SAME WAY (v9): each keeps who recorded it,
          // with what model and WHEN — a nudge is a moment's, recorded once, so
          // a merge does not make it new. Read with its words even when the
          // original is confidential: the merged memory inherits the marker
          // (above), and every read withholds them from there.
          // A row today's vocabulary would refuse is left on the original (it
          // stays there, superseded) rather than failing the merge half-way.
          const traits = this.store.traitsFor(r.id, { includeConfidential: true }).filter((t) => {
            try {
              checkTraits([{ axis: t.axis, toward: t.toward, strength: t.strength, carriedBy: t.carried_by }]);
              return true;
            } catch {
              return false;
            }
          });
          if (traits.length > 0) {
            this.store.addTraits(
              newId,
              traits.map((t) => ({ axis: t.axis, toward: t.toward, strength: t.strength, carriedBy: t.carried_by })),
              { provenance: traits.map((t) => ({ source: t.source, model: t.model, createdAt: t.created_at })) },
            );
          }
          this.store.supersedeInto(r.id, newId, DREAM_MERGE_REASON, { carryReturns: true });
          try {
            this.ctx.retarget?.(r.id, newId, day);
          } catch {
            /* the links are a courtesy; the merge stands */
          }
        }
        this.store.recordDreamChange(dream.id, { action, ref: newId, detail: { from: ids } });
        shown.add(newId);
        return { action, ok: true, reason: "merged", id: newId };
      }
      case "link": {
        const a = live(change.a);
        const b = live(change.b);
        if (a === null || b === null) return { action, ok: false, reason: "not-shown-or-gone" };
        if (a.id === b.id) return { action, ok: false, reason: "same-memory" };
        const ab = this.store.edgesFrom(a.id).find((e) => e.dst === b.id) ?? null;
        const ba = this.store.edgesFrom(b.id).find((e) => e.dst === a.id) ?? null;
        const w = DREAM_TUNABLES.LINK_WEIGHT;
        this.store.linkMany([
          { src: a.id, dst: b.id, weight: Math.max(w, ab?.weight ?? 0), day },
          { src: b.id, dst: a.id, weight: Math.max(w, ba?.weight ?? 0), day },
        ]);
        this.store.recordDreamChange(dream.id, {
          action,
          ref: a.id,
          ref2: b.id,
          detail: {
            ab: ab === null ? null : { weight: ab.weight, day: ab.last_day },
            ba: ba === null ? null : { weight: ba.weight, day: ba.last_day },
          },
        });
        return { action, ok: true, reason: "linked" };
      }
      case "replayed": {
        const row = live(change.id);
        if (row === null) return { action, ok: false, reason: "not-shown-or-gone" };
        // A dream's own gist rises only by proving true AWAKE: a dream cannot
        // strengthen what a dream wrote.
        if (row.source === "dreamed") return { action, ok: false, reason: "dreamed-rises-only-awake" };
        const r = this.store.replayReturn(row.id, day, dream.id);
        this.store.recordDreamChange(dream.id, { action, ref: row.id, detail: { counted: r.counted, weight: r.weight } });
        return { action, ok: true, reason: r.counted ? "replayed" : `replayed-not-counted:${r.reason}`, id: row.id };
      }
      case "gist": {
        const sources = [...new Set(change.sources ?? [])];
        if (sources.length === 0) return { action, ok: false, reason: "gist-needs-sources" };
        const sourceRows = sources.map(live);
        if (sourceRows.some((r) => r === null)) return { action, ok: false, reason: "not-shown-or-gone" };
        const words = this.words(change.text, dream);
        if (!words.ok) return { action, ok: false, reason: words.reason };
        const kind: Kind = (KINDS as readonly string[]).includes(String(change.kind)) ? (change.kind as Kind) : "fact";
        const cap = PHYSICS.DREAMED_CLAIM_CEILING;
        const title = (change.title ?? "").trim().slice(0, 180);
        const id = this.store.put({
          type: "memory",
          kind,
          title: `Dreamed: ${title.length > 0 ? title : firstLine(words.text)}`,
          body: words.text,
          salience: {
            novelty: null,
            relevance: clampTo(change.relevance ?? cap, cap),
            emotional: 0,
            predictive: clampTo(change.predictive ?? cap, cap),
            claimed: cap,
          },
          physics: { birthDay: day, lastUsedDay: day },
          source: "dreamed",
          // A pattern drawn from a confidential memory is as confidential as it.
          meta: { dream: dream.id, dreamed: true, sources, ...confidentialityOf(sourceRows as MemoryRow[]) },
          origin: { ...(dream.session === null ? {} : { session: dream.session }), ...(dream.scope === null ? {} : { scope: dream.scope }), ref: `dream:${dream.id}` },
          ...(dream.model === null ? {} : { model: dream.model }),
        });
        this.store.linkMany(
          sources.flatMap((s) => [
            { src: id, dst: s, weight: DREAM_TUNABLES.LINK_WEIGHT, day },
            { src: s, dst: id, weight: DREAM_TUNABLES.LINK_WEIGHT, day },
          ]),
        );
        this.store.recordDreamChange(dream.id, { action, ref: id, detail: { sources } });
        shown.add(id);
        return { action, ok: true, reason: "dreamed", id };
      }
      case "contradiction": {
        const a = live(change.a);
        const b = live(change.b);
        if (a === null || b === null) return { action, ok: false, reason: "not-shown-or-gone" };
        if (a.id === b.id) return { action, ok: false, reason: "same-memory" };
        this.store.recordDreamChange(dream.id, { action, ref: a.id, ref2: b.id, detail: {} });
        return { action, ok: true, reason: "flagged" };
      }
      case "feeling-now": {
        const row = live(change.id);
        if (row === null) return { action, ok: false, reason: "not-shown-or-gone" };
        // How it feels NOW can be as strong as it ever was, never stronger: a
        // dream records softening; it cannot manufacture a feeling that would
        // raise the memory or open the core's fast lane.
        const peak = emotionalIntensity(this.store.physicsOf(row.id));
        const s = Math.max(0, Math.min(Number(change.strength ?? 0), peak));
        const carried = this.words(change.carried_by ?? "", dream, true);
        const added = this.store.addFeelings(row.id, [
          {
            whose: "self",
            core: String(change.core ?? ""),
            emotion: String(change.emotion ?? ""),
            strength: s,
            carriedBy: `in a dream, ${dream.date ?? ""}${carried.ok && carried.text.length > 0 ? `: ${carried.text}` : ""}`.trim(),
          },
        ], { source: "dream" });
        this.store.recordDreamChange(dream.id, { action, ref: row.id, detail: { feelings: added.ids } });
        return { action, ok: true, reason: s < Number(change.strength ?? 0) ? "recorded-capped-at-peak" : "recorded", id: row.id };
      }
      case "nominate-core": {
        const row = live(change.id);
        if (row === null) return { action, ok: false, reason: "not-shown-or-gone" };
        if (row.promoted_identity === 1) return { action, ok: false, reason: "already-core" };
        // A NOMINATION IS THE DREAM'S SUGGESTION of what a memory is about (v9):
        // a dream cannot set the mark — only an awake model that read it can —
        // so it may nominate an unmarked memory, and the reflection decides.
        // What something awake already said is not about me (`work`, `world`)
        // is not nominated over it, and the craft (`skill`) is never core.
        if (row.kind === "skill") return { action, ok: false, reason: "work-is-not-core" };
        if (row.about === "work" || row.about === "world") return { action, ok: false, reason: "not-about-me" };
        const why = this.words(change.why ?? "", dream, true);
        this.store.appendCoreEvent({
          memoryId: row.id,
          action: "nominated",
          day,
          reason: why.ok && why.text.length > 0 ? why.text.slice(0, 300) : null,
          dreamId: dream.id,
          actor: "dream",
        });
        this.store.recordDreamChange(dream.id, { action, ref: row.id, detail: {} });
        return { action, ok: true, reason: "nominated", id: row.id };
      }
    }
  }

  // ── journal ───────────────────────────────────────────────────────────────

  /** Close the dream with its journal entry, and hand back the one marked line. */
  journal(input: { dream: string; session?: string; title?: string; text: string }):
    | { ok: true; handBack: string }
    | { ok: false; reason: DreamRefusal | string } {
    const open = this.openFor(input.dream, input.session);
    if (!open.ok) return open;
    const dream = open.dream;
    const words = this.words(input.text, dream, false, DREAM_TUNABLES.MAX_JOURNAL_CHARS);
    if (!words.ok) return { ok: false, reason: words.reason };
    const title = (input.title ?? "").trim().slice(0, 120) || firstLine(words.text);
    this.store.updateDream(dream.id, { state: "journaled", title, journal: words.text });
    const counts = this.counts(dream.id);
    this.record(DREAM_JOURNALED_EVENT, dream.id, { chars: words.text.length, ...counts });
    return { ok: true, handBack: this.handBack(dream.id, title, counts) };
  }

  /** The marked hand-back line of a journaled dream, or null. The reflection's hand-back opens with it. */
  handBackOf(id: string): string | null {
    const dream = this.store.dream(id);
    if (dream === undefined || dream.state !== "journaled") return null;
    return this.handBack(id, dream.title ?? "", this.counts(id));
  }

  private handBack(id: string, title: string, counts: Record<string, number>): string {
    const said = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${String(n)} ${k}`)
      .join(", ");
    return (
      `${dreamOpener(id)} I dreamed for a few minutes — "${title}". ` +
      `${said.length > 0 ? `Changes: ${said}.` : "Nothing changed."} ` +
      `The journal and every change are in \`counterparts dream --show ${id}\`; \`counterparts dream --undo ${id}\` reverses it.`
    );
  }

  // ── reading, and undo ─────────────────────────────────────────────────────

  counts(id: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.store.dreamChanges(id)) {
      if (c.undone === 1) continue;
      out[c.action] = (out[c.action] ?? 0) + 1;
    }
    return out;
  }

  list(limit = 20): { dream: DreamRow; counts: Record<string, number> }[] {
    return this.store.dreams({ limit }).map((dream) => ({ dream, counts: this.counts(dream.id) }));
  }

  show(id: string): { dream: DreamRow; changes: DreamChangeRow[] } | null {
    const dream = this.store.dream(id);
    return dream === undefined ? null : { dream, changes: this.store.dreamChanges(id) };
  }

  /**
   * REVERSE A DREAM'S BATCH, newest change first: merged originals come back
   * (their versions stay as history) and the merged memory is archived; links
   * go back to what they were; a gist is archived; a dream's feelings,
   * replays and nominations are removed; a flagged contradiction stops being
   * raised. The journal stays, marked undone. Idempotent: a change already
   * undone is skipped.
   */
  undo(id: string): { ok: boolean; reason: string; reversed: number; kept: number } {
    if (this.ctx.observer) return { ok: false, reason: "observer", reversed: 0, kept: 0 };
    const dream = this.store.dream(id);
    if (dream === undefined) return { ok: false, reason: "unknown-dream", reversed: 0, kept: 0 };
    let reversed = 0;
    let kept = 0;
    for (const c of [...this.store.dreamChanges(id)].reverse()) {
      if (c.undone === 1) continue;
      const detail = parseDetail(c.detail);
      switch (c.action) {
        case "merge": {
          const from = Array.isArray(detail["from"]) ? (detail["from"] as string[]) : [];
          // SAFE AFTER LATER EDITS: when the merged memory has moved on since —
          // revised into a successor, merged again by a later dream, archived
          // or removed — bringing the originals back would stand them beside
          // its live successor as duplicates. That merge is left as it is and
          // counted; the rest of the dream is still reversed.
          const merged = c.ref === null ? undefined : this.store.row(c.ref);
          if (merged === undefined || merged.archived === 1 || merged.superseded_by !== null) {
            kept += 1;
            continue;
          }
          for (const orig of from) {
            try {
              this.store.restoreSuperseded(orig, DREAM_MERGE_REASON);
            } catch {
              /* removed since: nothing to restore */
            }
          }
          if (c.ref !== null) this.archiveQuietly(c.ref);
          break;
        }
        case "link": {
          if (c.ref !== null && c.ref2 !== null) {
            this.store.restoreEdge(c.ref, c.ref2, edgePrior(detail["ab"]));
            this.store.restoreEdge(c.ref2, c.ref, edgePrior(detail["ba"]));
          }
          break;
        }
        case "gist": {
          if (c.ref !== null) {
            this.archiveQuietly(c.ref);
            const sources = Array.isArray(detail["sources"]) ? (detail["sources"] as string[]) : [];
            for (const s of sources) {
              this.store.restoreEdge(c.ref, s, null);
              this.store.restoreEdge(s, c.ref, null);
            }
          }
          break;
        }
        case "feeling-now": {
          const ids = Array.isArray(detail["feelings"]) ? (detail["feelings"] as string[]) : [];
          if (ids.length > 0) this.store.retractFeelings(ids);
          break;
        }
        default:
          // replayed, nominate-core: removed in bulk below; contradiction: no effect to reverse.
          break;
      }
      this.store.markDreamChangeUndone(id, c.seq);
      reversed += 1;
    }
    this.store.retractDreamReturns(id);
    this.store.retractDreamNominations(id);
    this.store.updateDream(id, { state: "undone" });
    this.record(DREAM_UNDONE_EVENT, id, { reversed, kept });
    return { ok: true, reason: kept > 0 ? "undone-except-moved-on" : "undone", reversed, kept };
  }

  /**
   * CONTRADICTIONS A DREAM FLAGGED, NOT YET RAISED AWAKE — one line each for
   * the next session, claimed by a meta latch so each is raised once. Only a
   * pair this session could be shown is raised (recall's gates).
   */
  raiseLines(input: { session: string }): string[] {
    if (this.ctx.observer) return [];
    const out: string[] = [];
    const owner = ownerNames(this.store);
    for (const dream of this.store.dreams({ limit: 10 })) {
      if (dream.state === "undone") continue;
      for (const c of this.store.dreamChanges(dream.id)) {
        if (c.action !== "contradiction" || c.undone === 1 || c.ref === null || c.ref2 === null) continue;
        const key = `${RAISED_PREFIX}${dream.id}.${String(c.seq)}`;
        if (this.store.getMeta(key) !== undefined) continue;
        const a = this.store.row(c.ref);
        const b = this.store.row(c.ref2);
        if (a === undefined || b === undefined || !this.showable(a) || !this.showable(b)) continue;
        this.store.setMeta(key, String(this.store.livedDay()));
        const theirs = (r: MemoryRow): boolean => r.about === "us" || r.about === "owner" || namesOwner(this.store, r, owner);
        const who = this.ctx.ownerName?.() ?? "the owner";
        const raise = theirs(a) || theirs(b) ? ` It is about ${who}, or the two of you: raise it with ${who}.` : "";
        out.push(
          `Counterparts: a dream on ${dream.date ?? "a recent night"} flagged two memories that disagree — ${c.ref} and ${c.ref2}. Look them up (recall by id) and settle which holds, awake; the dream did not.${raise}`,
        );
        if (out.length >= 2) return out;
      }
    }
    void input;
    return out;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * RECALL'S GATES, for a dream: what could surface in this session anyway. A
   * live, unarchived, un-superseded MEMORY (not a schema row: the page, a
   * handoff, a belief or an entity card is not a dream's to touch), not
   * protected (the owner's permanence guards it from any interpreter), and not
   * confidential unless this is the owner's own session.
   */
  showable(row: MemoryRow): boolean {
    return this.showableAs(row, this.ctx.owner);
  }

  /** `showable`, for a session whose owner stance is `owner` (the preview's). */
  private showableAs(row: MemoryRow, owner: boolean): boolean {
    if (row.archived === 1 || row.superseded_by !== null) return false;
    if (row.type !== "memory") return false;
    if (row.protected === 1) return false;
    if (row.confidential === 1 && !owner) return false;
    if (row.body === "") return false;
    return true;
  }

  /**
   * Memories made since `last` (or in the last few lived days), showable,
   * newest first, at most `MAX_NEW`. One bounded read (`store.newMemoryIds`,
   * which applies the column gates), then the deny-list and confidentiality
   * (`owner`: this session's stance unless the preview names another).
   */
  private freshIds(last: DreamRow | null, owner: boolean = this.ctx.owner): string[] {
    const day = this.store.livedDay();
    const ids = this.store.newMemoryIds(
      last === null
        ? { sinceAt: null, sinceDay: day - DREAM_TUNABLES.FIRST_DREAM_DAYS, limit: DREAM_TUNABLES.MAX_NEW * 3 }
        : { sinceAt: last.started_at, sinceDay: last.day, limit: DREAM_TUNABLES.MAX_NEW * 3 },
    );
    if (ids.length === 0) return [];
    const denied = new Set(this.store.deniedIds());
    const out: string[] = [];
    for (const id of ids) {
      if (denied.has(id)) continue;
      const row = this.store.row(id);
      if (row === undefined || !this.showableAs(row, owner)) continue;
      out.push(id);
      if (out.length >= DREAM_TUNABLES.MAX_NEW) break;
    }
    return out;
  }

  private compose(id: string, fresh: readonly string[], last: DreamRow | null, day: number, at: string): DreamBundle {
    const T = DREAM_TUNABLES;
    const memories: Record<string, DreamItem> = {};
    const denied = new Set(this.store.deniedIds());
    const take = (mid: string): boolean => {
      if (memories[mid] !== undefined) return true;
      if (denied.has(mid)) return false;
      const row = this.store.row(mid);
      if (row === undefined || !this.showable(row)) return false;
      const item = this.item(row, day);
      if (item === null) return false;
      memories[mid] = item;
      return true;
    };
    const rng = seeded(id);
    const freshSet = new Set(fresh);
    const freshOut: { id: string; neighbours: string[] }[] = [];
    const loose: string[] = [];
    for (const fid of fresh) {
      if (!take(fid)) continue;
      const self = this.store.row(fid) as MemoryRow;
      const ranked = this.near(fid, T.MIXING_TO_RANK);
      const neighbours: string[] = [];
      for (const [rank, nid] of ranked.entries()) {
        if (nid === fid || freshSet.has(nid)) continue;
        const nrow = this.store.row(nid);
        if (nrow === undefined || nrow.birth_day > self.birth_day) continue;
        if (rank >= T.MIXING_FROM_RANK) {
          loose.push(nid);
          continue;
        }
        if (neighbours.length < T.NEIGHBOURS && take(nid)) neighbours.push(nid);
      }
      freshOut.push({ id: fid, neighbours });
    }
    // REM MIXING: a few loosely related older memories, picked at random from
    // the loose band of the new memories' neighbourhoods.
    const mixing: string[] = [];
    const pool = [...new Set(loose)].filter((x) => memories[x] === undefined);
    while (mixing.length < T.MIXING && pool.length > 0) {
      const [pick] = pool.splice(Math.floor(rng() * pool.length), 1);
      if (pick !== undefined && take(pick)) mixing.push(pick);
    }
    // THE LOOK-BACK: the strongest-feeling memories from about a week ago.
    const lookback: string[] = [];
    const lo = day - T.LOOKBACK_DAYS - T.LOOKBACK_SPREAD;
    const hi = day - T.LOOKBACK_DAYS + T.LOOKBACK_SPREAD;
    const felt: { id: string; felt: number }[] = [];
    for (const mid of this.store.list({ type: "memory", archived: false })) {
      const row = this.store.row(mid);
      if (row === undefined || row.birth_day < lo || row.birth_day > hi || denied.has(mid) || !this.showable(row)) continue;
      const f = emotionalIntensity(this.store.physicsOf(mid));
      if (f > 0) felt.push({ id: mid, felt: f });
    }
    felt.sort((a, b) => b.felt - a.felt || (a.id < b.id ? -1 : 1));
    for (const f of felt) {
      if (lookback.length >= T.LOOKBACK_COUNT) break;
      if (take(f.id)) lookback.push(f.id);
    }
    // WHAT'S ON MY MIND: a few open things, not new. Their memories join the
    // shown set (a dream may link or feel them), never the fresh list.
    const onMind = onMyMind(this.store, {
      today: at,
      day,
      showable: (row) => !denied.has(row.id) && this.showable(row),
      owner: this.ctx.owner,
    }).filter((item) => item.ids.every((mid) => take(mid)));
    const owner = ownerNames(this.store);
    const aboutHim = Object.keys(memories).filter((mid) => {
      const row = this.store.row(mid);
      return row !== undefined && (row.about === "owner" || namesOwner(this.store, row, owner));
    });
    return {
      dream: id,
      date: at,
      livedDay: day,
      lastDreamed: last === null ? null : (last.date ?? null),
      limits: { ...T.LIMITS },
      selfPage: cut(this.ctx.page(), T.PAGE_CHARS),
      wake: cut(this.ctx.wake(), T.WAKE_CHARS),
      owner: { names: owner, memories: aboutHim },
      chapters: this.chaptersSince(last),
      memories,
      fresh: freshOut,
      mixing,
      lookback,
      onMind,
    };
  }

  /** The journal since the last dream: episode rows written or extended since, newest first. */
  private chaptersSince(last: DreamRow | null): { id: string; title: string | null; text: string }[] {
    const out: { id: string; title: string | null; text: string; at: number }[] = [];
    const day = this.store.livedDay();
    for (const id of this.store.list({ type: "episode", archived: false })) {
      const row = this.store.row(id);
      if (row === undefined) continue;
      if (row.confidential === 1 && !this.ctx.owner) continue;
      const at = row.updated_at ?? row.created_at ?? 0;
      const since = last === null ? row.birth_day >= day - DREAM_TUNABLES.FIRST_DREAM_DAYS : at > last.started_at;
      if (!since) continue;
      out.push({ id, title: row.title, text: cut(row.body, DREAM_TUNABLES.CHAPTER_CHARS) ?? "", at });
    }
    out.sort((a, b) => b.at - a.at);
    return out.slice(0, DREAM_TUNABLES.MAX_CHAPTERS).map(({ id, title, text }) => ({ id, title, text }));
  }

  /** Nearest memories to `id`, by the static embedder's vectors, else lexically. */
  private near(id: string, limit: number): string[] {
    const vec = this.store.vectorOf(id);
    if (vec !== null) return this.store.nearestTo(vec, limit + 1).map((h) => h.id);
    // No vector (embedder off, or not yet embedded): the rarest words of its
    // title and first line, through the token index.
    let doc: ProseDoc;
    try {
      doc = this.store.readProse(id);
    } catch {
      return [];
    }
    const words = `${doc.title ?? ""} ${firstLine(doc.body)}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 5)
      .slice(0, 6);
    const scores = new Map<string, number>();
    for (const w of words) for (const h of this.store.search(w, limit)) scores.set(h.id, (scores.get(h.id) ?? 0) + h.score);
    return [...scores].sort((a, b) => b[1] - a[1]).map(([mid]) => mid).slice(0, limit);
  }

  private item(row: MemoryRow, day: number): DreamItem | null {
    let doc: ProseDoc;
    try {
      doc = this.store.readProse(row.id);
    } catch {
      return null;
    }
    if (isSelfPage(doc) || isHandoff(doc)) return null;
    const p = this.store.physicsOf(row.id);
    const head = doc.title !== undefined && doc.title.trim().length > 0 ? `${doc.title.trim()} — ` : "";
    return {
      id: row.id,
      kind: row.kind,
      text: (cut(`${head}${doc.body}`, DREAM_TUNABLES.TEXT_CHARS) ?? "").replace(/\s+/g, " "),
      felt: round(emotionalIntensity(p)),
      strength: round(strength(p, day)),
      day: row.birth_day,
      learned: row.learned_on,
      core: row.promoted_identity === 1,
    };
  }

  /** A dream this session may still write to. */
  private openFor(id: string, session: string | undefined): { ok: true; dream: DreamRow } | { ok: false; reason: DreamRefusal } {
    if (this.ctx.observer) return { ok: false, reason: "observer" };
    const dream = this.store.dream(id);
    if (dream === undefined) return { ok: false, reason: "unknown-dream" };
    if (session !== undefined && dream.session !== null && dream.session !== session) return { ok: false, reason: "not-this-session" };
    if (dream.state !== "begun") return { ok: false, reason: "dream-closed" };
    // A dream left open (never journaled) is closed by the next one that
    // begins: otherwise an old id would stay writable for ever, with limits
    // and a shown set of its own. (Adversarial review of #251.)
    const newest = this.lastDream();
    if (newest !== null && newest.id !== dream.id) return { ok: false, reason: "dream-closed" };
    return { ok: true, dream };
  }

  /** The dream's words through the credential battery; bounded; never empty unless allowed. */
  private words(
    text: string | undefined,
    dream: DreamRow,
    allowEmpty = false,
    max: number = DREAM_TUNABLES.MAX_TEXT_CHARS,
  ): { ok: true; text: string } | { ok: false; reason: string } {
    const raw = (text ?? "").trim();
    if (raw.length === 0) return allowEmpty ? { ok: true, text: "" } : { ok: false, reason: "empty-text" };
    if (carriesDreamMark(raw)) return { ok: false, reason: "dream-mark-in-text" };
    const verdict = this.ctx.gate(raw.slice(0, max), dream.session ?? dream.id);
    if (!verdict.ok) return { ok: false, reason: `gate:${verdict.reason}` };
    return { ok: true, text: verdict.text };
  }

  private archiveQuietly(id: string): void {
    const row = this.store.row(id);
    if (row === undefined || row.archived === 1) return;
    try {
      this.store.archive(id, DREAM_UNDONE_REASON);
    } catch {
      /* removed since */
    }
  }

  /** The owner's name as it was written on the identity core (not lower-cased). */
  private ownerName(): string | null {
    for (const id of this.store.list({ type: "schema", kind: "self", archived: false })) {
      try {
        const meta = this.store.readProse(id).meta;
        if (meta["role"] === "entity" && typeof meta["name"] === "string" && meta["name"].trim().length > 0) {
          return meta["name"].trim();
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /** A durable row (ids and counts only), and the ring event beside it. */
  private record(name: string, ref: string | null, payload: Record<string, string | number | boolean | null>): void {
    this.emit(name, ref ?? undefined, payload);
    if (this.ctx.observer) return;
    try {
      this.store.appendEvent({ name, day: this.store.livedDay(), ref, payload });
    } catch {
      /* the log is evidence, never a reason to fail the dream */
    }
  }
}

// ── small helpers ────────────────────────────────────────────────────────────

function parseIds(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseDetail(json: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(json);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function edgePrior(v: unknown): { weight: number; day: number } | null {
  if (v === null || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return typeof r["weight"] === "number" && typeof r["day"] === "number" ? { weight: r["weight"], day: r["day"] } : null;
}

/**
 * The confidentiality marker a dream's new memory must carry when any memory
 * it was made from is confidential: `confidential: true`, plus the first
 * named class (`confidentiality`) found. Empty when none is.
 */
function confidentialityOf(rows: readonly MemoryRow[]): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.confidential !== 1) continue;
    let klass: unknown;
    try {
      const meta = JSON.parse(r.meta) as Record<string, unknown>;
      klass = meta["confidentiality"];
    } catch {
      klass = undefined;
    }
    if (out["confidential"] === undefined) out = { confidential: true };
    if (typeof klass === "string" && klass.length > 0 && out["confidentiality"] === undefined) out["confidentiality"] = klass;
  }
  return out;
}

function cut(text: string | null, max: number): string | null {
  if (text === null) return null;
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function firstLine(text: string): string {
  return (text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "").slice(0, 120);
}

function clampTo(x: number, cap: number): number {
  const n = Number.isFinite(x) ? x : cap;
  return Math.max(0, Math.min(n, cap));
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

function errName(err: unknown): string {
  if (err !== null && typeof err === "object" && "code" in err) return String((err as { code: unknown }).code);
  return err instanceof Error ? err.name : "UNKNOWN";
}

/** A small deterministic RNG seeded from the dream id, so a bundle is reproducible. */
function seeded(seed: string): () => number {
  let h = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
