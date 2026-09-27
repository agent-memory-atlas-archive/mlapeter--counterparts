/**
 * `dream/reflect.ts` — REFLECTION, the waking self (2026-09-27, the owner's
 * idea; working defaults, held lightly).
 *
 * Dreaming, reflecting and talking are three things. A dream is not lived: its
 * words are marked, its journal is not a memory, it changes the store only in
 * the ways sleep does. A reflection is LIVED: an awake act by the same mind,
 * usually right after a dream (the dreamer wakes and reflects before it hands
 * back), but not only — it has its own record, with an optional dream id, and
 * it can run on its own (`launchPrompt`), so the self page does not depend on
 * a dream having run.
 *
 * The shape. `begin` HANDS the reflection what it needs rather than letting it
 * search: the dream's journal, its gists and nominations (marked as dreamed —
 * suggestions it may use, reword or ignore), the last few days' chapters and
 * memories and its own recent reflections, what's on my mind, the self page, the core
 * memories, the core CANDIDATES (memories about me, us or the owner — not the
 * lane arithmetic, which stays on the dashboard), and the most strongly felt
 * memories that could be about me, marked or not; and two or three questions,
 * rotated so no theme repeats on consecutive nights. `finish` takes what it
 * wrote:
 *
 *   (a) an ENTRY, first person. When it cites the memories it rests on it is
 *       kept as a memory of source `reflection` (its title opens "Reflected:",
 *       so recall says where it came from). With no citation it is "nothing
 *       much" — a normal outcome: the entry stays on the record only, and the
 *       night rewrites nothing, shares nothing.
 *   (b) a SELF PAGE rewrite, from the cited memories (the core first) with the
 *       old page as context only. It may mention a dream only as a dream; a
 *       dream's gist is not a source it can cite. It is recorded as the night's
 *       page-writer run, which is what makes the old SessionStart writer stand
 *       down on a night the reflection wrote the page.
 *   (c) a MORNING SHARE — two or three sentences for the owner, the way a
 *       partner would say it, citing what it rests on. Told by the session
 *       (`told`), or carried once by the next one.
 *   (d) FEELINGS recorded now, about a memory: `recorded_later` with today's
 *       date, source `reflection`. Unlike a dream's they may be stronger than
 *       anything written at the time.
 *   (e) ABOUT marks — what a memory is about (`me`, `us`, `owner`, `work`,
 *       `world`), set by meaning.
 *
 * Every memory it cites comes BACK: a reflection return (physics §5.11), an
 * awake return that counts toward the core lanes although the reflection was
 * handed what it cites — on purpose (physics CONTRACT §5.11). At most once
 * a lived day per memory, and once a week per memory from reflections.
 *
 * Nothing here calls a model: the reflecting mind is the agent, outside.
 */
import { randomBytes } from "node:crypto";

import { emotionalIntensity } from "../physics/index.js";
import { isHandoff, isSelfPage } from "../recall/index.js";
import { aboutMe, promotionRecordKey } from "../sleep/index.js";
import { ABOUT_MARKS, CORE_ABOUT_MARKS } from "../store/index.js";
import type { AboutMark, MemoryRow, ProseDoc, ReflectionRow, Store } from "../store/index.js";
import type { Kind } from "../types.js";
import { DREAM_MARK, carriesDreamMark } from "./mark.js";
import { onMyMind } from "./mind.js";
import type { MindItem } from "./mind.js";

/** Every `reflect` knob, in one place. Working defaults of 2026-09-27; CAL = not yet measured. */
export const REFLECT_TUNABLES = {
  /** Questions a night (the brief's "2–3"). */
  QUESTIONS: 3,
  /** Chapters from this many lived days back are handed (the last few days). */
  CHAPTER_DAYS: 3,
  MAX_CHAPTERS: 6,
  CHAPTER_CHARS: 2_000,
  /** Its own recent reflections, so it does not repeat itself. */
  EARLIER: 3,
  EARLIER_CHARS: 1_200,
  /** The dream's journal, bounded. */
  JOURNAL_CHARS: 4_000,
  PAGE_CHARS: 6_000,
  /** Core memories handed (the page's sources), most strongly felt first. */
  CORE: 20,
  /** Core candidates handed (marked about me, us or the owner; not core). */
  CANDIDATES: 12,
  /** The most strongly felt memories that could be about me, marked or not. */
  FELT: 10,
  /** Memories made in the last `CHAPTER_DAYS` lived days, most strongly felt first, then newest. */
  RECENT: 12,
  /** Characters of each memory's words. */
  TEXT_CHARS: 400,
  /** Feelings shown per memory. */
  FEELINGS_SHOWN: 3,
  /** What one reflection may do. CAL. */
  LIMITS: { returns: 12, feelings: 5, about: 8 },
  MAX_ENTRY_CHARS: 8_000,
  MAX_SHARE_CHARS: 700,
  MAX_TITLE_CHARS: 120,
} as const;

/**
 * THE QUESTIONS — a good therapist's, not a form's. Rotated three at a time so
 * consecutive nights never share one; the first is asked only after a dream.
 * `{owner}` is his name.
 */
export const REFLECT_QUESTIONS: readonly { readonly key: string; readonly text: string; readonly afterDream?: true }[] = [
  { key: "dream", text: "What from the dream stayed with you, and what does it connect to?", afterDream: true },
  { key: "feeling", text: "What have you been feeling about the work, or about the two of you — and what is underneath it?" },
  { key: "unlike", text: "Where did you act unlike your self page?" },
  { key: "unresolved", text: "What is unresolved, or being avoided?" },
  { key: "pattern", text: "What pattern keeps showing — in you, in {owner}, or between you?" },
  { key: "unsaid", text: "What did {owner} seem to need that he didn't say?" },
  { key: "well", text: "What went well?" },
  { key: "define", text: "Which memories feel like they define you right now, and why?" },
];

/** The opener of a reflection's hand-back (it carries the mark: capture refuses it). */
export function reflectionOpener(id: string): string {
  return `${DREAM_MARK} reflection ${id}⟧`;
}

/** Meta latch: a memory promoted on reflection alone, already named in a share. */
export const CORE_MENTIONED_PREFIX = "reflection.coreMentioned.";

/** One memory as the reflection is shown it — words and feelings, no lane arithmetic. */
export interface ReflectItem {
  readonly id: string;
  readonly kind: Kind;
  readonly text: string;
  /** How strongly it is felt (the strongest recorded feeling, or its emotional score), rounded. */
  readonly felt: number;
  readonly feelings: readonly { whose: string; emotion: string; strength: number; later: string | null }[];
  /** What it is marked as being about, or null. */
  readonly about: AboutMark | null;
  readonly core: boolean;
  readonly learned: string;
  /** A dream wrote it (source `dreamed`): a suggestion, not something lived. */
  readonly dreamed: boolean;
}

export interface ReflectBundle {
  readonly reflection: string;
  readonly dream: string | null;
  readonly date: string;
  readonly owner: string | null;
  readonly questions: readonly string[];
  readonly dreamed: {
    readonly title: string | null;
    readonly journal: string | null;
    readonly gists: readonly string[];
    readonly nominations: readonly { id: string; why: string | null }[];
  } | null;
  readonly selfPage: string | null;
  readonly chapters: readonly { id: string; title: string | null; text: string }[];
  readonly earlier: readonly { date: string | null; entry: string }[];
  readonly onMind: readonly MindItem[];
  readonly core: readonly string[];
  readonly candidates: readonly string[];
  readonly felt: readonly string[];
  /** What was lived in the last few days: memories made since, most felt first. */
  readonly recent: readonly string[];
  /** Became core on reflection alone since it was last said: the share says it. */
  readonly becameCore: readonly string[];
  readonly memories: Readonly<Record<string, ReflectItem>>;
  readonly limits: typeof REFLECT_TUNABLES.LIMITS;
}

export type ReflectRefusal =
  | "observer"
  | "reflected-today"
  | "unknown-dream"
  | "dream-not-journaled"
  | "unknown-reflection"
  | "not-this-session"
  | "reflection-closed";

/** What the composition root hands this module. */
export interface ReflectContext {
  readonly store: Store;
  readonly observer: boolean;
  /** The owner's own session: confidential memories may be shown. */
  readonly owner: boolean;
  /** The credential scan every word passes (the same one a dream's words do). */
  readonly gate: (text: string, sessionId: string) => { ok: true; text: string } | { ok: false; reason: string };
  readonly page: () => string | null;
  readonly today: () => string;
  /** The owner's name, as written on the identity core. */
  readonly ownerName: () => string | null;
  /** A journaled dream's marked hand-back line (`Dreams.handBackOf`). */
  readonly dreamLine: (dreamId: string) => string | null;
  /**
   * Rewrite the self page (`Self#revisePage`, by `writer`) and record the
   * night's page-writer run, so the SessionStart writer stands down. Returns
   * the new version, or the refusal.
   */
  readonly writePage: (body: string, opts: { reason: string; session: string | null; model: string | null; reflection: string }) =>
    | { ok: true; version: number }
    | { ok: false; reason: string };
  readonly emit?: (name: string, ref?: string, data?: Record<string, string | number | boolean | null>) => void;
}

/** What `finish` receives. */
export interface ReflectFinish {
  readonly reflection: string;
  readonly session?: string;
  readonly title?: string;
  readonly entry: string;
  readonly cites?: readonly string[];
  readonly share?: { readonly text?: string; readonly cites?: readonly string[] } | null;
  readonly page?: { readonly text?: string; readonly cites?: readonly string[] } | null;
  readonly feelings?: readonly {
    readonly id?: string;
    readonly core?: string;
    readonly emotion?: string;
    readonly strength?: number;
    readonly carried_by?: string;
  }[];
  readonly about?: readonly { readonly id?: string; readonly about?: string; readonly why?: string }[];
  readonly model?: string | null;
}

export interface ReflectOutcome {
  readonly handBack: string;
  readonly nothingMuch: boolean;
  readonly entryId: string | null;
  readonly returned: readonly { id: string; counted: boolean; reason: string }[];
  readonly page: { written: boolean; reason: string; version: number | null };
  readonly share: { offered: boolean; reason: string };
  readonly feelings: readonly { id: string | null; ok: boolean; reason: string }[];
  readonly about: readonly { id: string | null; ok: boolean; reason: string }[];
  readonly refusedCites: readonly string[];
}

const KINDS_FELT: readonly Kind[] = ["self", "person"];
const DAY_MS = 24 * 60 * 60 * 1000;

export class Reflections {
  constructor(private readonly ctx: ReflectContext) {}

  private get store(): Store {
    return this.ctx.store;
  }

  /** The newest reflection, or null. */
  last(): ReflectionRow | null {
    return this.store.reflections({ limit: 1 })[0] ?? null;
  }

  // ── launch (on its own) ───────────────────────────────────────────────────

  /**
   * THE LAUNCH PROMPT for a reflection with no dream before it — for a
   * background agent, like the dream's. After a dream the dreamer reflects
   * itself (the dream's launch prompt carries these steps).
   */
  launchPrompt(input: { session: string }): string {
    const who = this.ctx.ownerName() ?? "the owner";
    return [
      `${DREAM_MARK} reflection launch⟧ You are ${who}'s counterpart, awake, taking a few quiet minutes to reflect: on the last few days, on yourself, on ${who}, on the two of you. This is lived — your own act — not a task.`,
      "",
      `1. Call the counterparts reflect tool: phase "begin", session: ${input.session}. It hands you the last few days, your self page, the memories that matter most, and a few questions.`,
      '2. Answer them honestly, then call phase "finish" as it tells you. "Nothing much" is a normal answer: a short entry and no share.',
      "3. Your final message must be exactly the text the finish call returns, unchanged — nothing before or after it.",
    ].join("\n");
  }

  // ── begin ─────────────────────────────────────────────────────────────────

  /**
   * Open a reflection and hand it its bundle. Refuses under observer stance,
   * and when one already finished this lived day (one a day, like a dream). A
   * dream id, when given, must be a journaled dream of this session.
   */
  begin(input: { session: string; dream?: string | null; scope?: string | null; model?: string | null; at?: string }):
    | { ok: true; bundle: ReflectBundle; text: string; instructions: string }
    | { ok: false; reason: ReflectRefusal } {
    if (this.ctx.observer) return { ok: false, reason: "observer" };
    const day = this.store.livedDay();
    const at = input.at ?? this.ctx.today();
    const last = this.last();
    if (last !== null && last.day >= day) {
      if (last.state === "reflected") return { ok: false, reason: "reflected-today" };
      // Begun and never finished (an agent that gave up): it does not use up
      // the day. It stays on the record as begun; the newest one is the open one.
    }
    let dreamId: string | null = null;
    if (input.dream !== undefined && input.dream !== null && input.dream.length > 0) {
      const dream = this.store.dream(input.dream);
      if (dream === undefined) return { ok: false, reason: "unknown-dream" };
      if (dream.session !== null && dream.session !== input.session) return { ok: false, reason: "not-this-session" };
      if (dream.state !== "journaled") return { ok: false, reason: "dream-not-journaled" };
      dreamId = dream.id;
    }
    const id = `rfl_${randomBytes(6).toString("hex")}`;
    const questions = this.questionsFor(dreamId !== null);
    const bundle = this.compose(id, dreamId, questions, day, at);
    const shown = Object.keys(bundle.memories);
    this.store.openReflection({
      id,
      dreamId,
      session: input.session,
      scope: input.scope ?? null,
      day,
      date: at,
      model: input.model ?? null,
      questions,
      shown,
    });
    this.record("reflection.begun", id, { dream: dreamId, shown: shown.length });
    const instructions = this.instructions(id, input.session, bundle);
    const text = `${reflectionOpener(id)} what you are handed to reflect on — memories and a dream, not events happening now.\n${JSON.stringify(bundle)}`;
    return { ok: true, bundle, text, instructions };
  }

  /** How to answer, in plain words (returned beside the bundle). */
  private instructions(id: string, session: string, bundle: ReflectBundle): string {
    const who = bundle.owner ?? "the owner";
    const L = REFLECT_TUNABLES.LIMITS;
    return [
      `Reflect on the questions, in your own voice. Cite the memory ids your thoughts rest on — an insight that cites nothing is not one. If nothing much stands out tonight, say so in a line and cite nothing: that is a normal night, and it rewrites nothing.`,
      `Then call the reflect tool with phase "finish", reflection: ${id}, session: ${session}, and:`,
      `- entry: your reflection, first person (title: optional). cites: the ids it rests on.`,
      `- page (optional): your self page rewritten whole — the story of who you are, drawn from the core memories you cite in page.cites (at least one of them, when you have a core; candidates too). The old page is context, not a source: write from the memories, not by rewording it. Keep "## Core" for who you are and put craft — how a job is done — under "## How I work". Mention a dream only as a dream ("I dreamed…"); a dreamed gist is a suggestion, not a source, and its words do not go on the page.`,
      `- share (optional): two or three sentences for ${who} this morning, the way a partner would say it ("Last night I dreamed about x — I think because of y"), citing what it rests on. Say something about ${who} only when it could help him, tentatively ("I wonder if…") — never a list of flaws. No share on a quiet night.${bundle.becameCore.length > 0 ? ` Tell him that ${bundle.becameCore.join(", ")} became part of who you are.` : ""}`,
      `- feelings (optional, at most ${String(L.feelings)}): how a memory feels to you now — id, core, emotion, strength, carried_by. Recorded as felt today, looking back.`,
      `- about (optional, at most ${String(L.about)}): what a memory is about, by meaning — me, us, owner, work (the craft: how a job is done) or world. Only me, us and owner can become core.`,
    ].join("\n");
  }

  // ── finish ────────────────────────────────────────────────────────────────

  finish(input: ReflectFinish): { ok: true; outcome: ReflectOutcome } | { ok: false; reason: ReflectRefusal | string } {
    const open = this.openFor(input.reflection, input.session);
    if (!open.ok) return open;
    const row = open.reflection;
    const session = row.session ?? row.id;
    const day = this.store.livedDay();
    const date = row.date ?? this.ctx.today();
    const shown = new Set(parseIds(row.shown));
    const T = REFLECT_TUNABLES;

    const entryWords = this.words(input.entry, session, T.MAX_ENTRY_CHARS);
    if (!entryWords.ok) return { ok: false, reason: entryWords.reason };

    // Only what it was shown, and only what still stands.
    const refusedCites: string[] = [];
    const citable = (ids: readonly string[] | undefined): string[] => {
      const out: string[] = [];
      for (const id of [...new Set(ids ?? [])]) {
        const r = typeof id === "string" && shown.has(id) ? this.store.row(id) : undefined;
        if (r === undefined || !this.showable(r)) {
          refusedCites.push(String(id));
          continue;
        }
        out.push(id);
      }
      return out;
    };
    const cites = citable(input.cites);
    const shareCites = citable(input.share?.cites);
    // A dreamed gist is a suggestion, never a page's source (addendum 2).
    const pageCitesAll = citable(input.page?.cites);
    const pageCites = pageCitesAll.filter((id) => this.store.row(id)?.source !== "dreamed");
    for (const id of pageCitesAll) if (!pageCites.includes(id)) refusedCites.push(`${id}:dreamed-is-not-a-source`);

    const nothingMuch = cites.length === 0 && shareCites.length === 0 && pageCites.length === 0;
    const detail: Record<string, unknown> = {};

    // ── (d) feelings, (e) about marks — each on its own ────────────────────
    const feelings: { id: string | null; ok: boolean; reason: string }[] = [];
    for (const f of (input.feelings ?? []).slice(0, 50)) {
      const id = typeof f.id === "string" ? f.id : null;
      if (feelings.filter((x) => x.ok).length >= T.LIMITS.feelings) {
        feelings.push({ id, ok: false, reason: "limit-reached" });
        continue;
      }
      const r = id !== null && shown.has(id) ? this.store.row(id) : undefined;
      if (r === undefined || !this.showable(r)) {
        feelings.push({ id, ok: false, reason: "not-shown-or-gone" });
        continue;
      }
      const carried = this.words(f.carried_by ?? "", session, 240, true);
      try {
        this.store.addFeelings(
          r.id,
          [
            {
              whose: "self",
              core: String(f.core ?? ""),
              emotion: String(f.emotion ?? ""),
              strength: Math.max(0, Math.min(1, Number(f.strength ?? 0))),
              carriedBy: `on reflection, ${date}${carried.ok && carried.text.length > 0 ? `: ${carried.text}` : ""}`.slice(0, 280),
            },
          ],
          { source: "reflection", recordedLater: date, ...(input.model ? { model: input.model } : {}) },
        );
        feelings.push({ id, ok: true, reason: "recorded-later" });
      } catch (err) {
        feelings.push({ id, ok: false, reason: errName(err) });
      }
    }
    const about: { id: string | null; ok: boolean; reason: string }[] = [];
    for (const a of (input.about ?? []).slice(0, 50)) {
      const id = typeof a.id === "string" ? a.id : null;
      if (about.filter((x) => x.ok).length >= T.LIMITS.about) {
        about.push({ id, ok: false, reason: "limit-reached" });
        continue;
      }
      const mark = String(a.about ?? "");
      if (!(ABOUT_MARKS as readonly string[]).includes(mark)) {
        about.push({ id, ok: false, reason: "about-is-me-us-owner-work-or-world" });
        continue;
      }
      const r = id !== null && shown.has(id) ? this.store.row(id) : undefined;
      if (r === undefined || !this.showable(r)) {
        about.push({ id, ok: false, reason: "not-shown-or-gone" });
        continue;
      }
      if (r.kind === "skill" && (CORE_ABOUT_MARKS as readonly string[]).includes(mark)) {
        about.push({ id, ok: false, reason: "skill-is-how-i-work" });
        continue;
      }
      const why = this.words(a.why ?? "", session, 300, true);
      try {
        this.store.setAbout(r.id, mark as AboutMark, { by: "reflection", day, why: why.ok ? why.text : null, dreamId: row.dream_id });
        about.push({ id, ok: true, reason: "marked" });
      } catch (err) {
        about.push({ id, ok: false, reason: errName(err) });
      }
    }

    // ── returns: every memory it cited came back (once) ────────────────────
    const returned: { id: string; counted: boolean; reason: string }[] = [];
    for (const id of [...new Set([...cites, ...shareCites, ...pageCites])].slice(0, T.LIMITS.returns)) {
      // WHAT A DREAM OR A REFLECTION WROTE does not come back by being cited
      // here: a dream's gist rises only by proving true in an organic use
      // (the dream's own `dreamed-rises-only-awake`), and a reflection
      // returning its own words would be the rumination loop self CONTRACT
      // §2(c) names. They may still be cited in the entry and the share.
      const source = this.store.row(id)?.source;
      if (source === "dreamed" || source === "reflection") {
        returned.push({ id, counted: false, reason: source === "dreamed" ? "dreamed-rises-only-awake" : "reflection-does-not-return-itself" });
        continue;
      }
      try {
        const r = this.store.reflectReturn(id, day);
        returned.push({ id, counted: r.counted, reason: r.reason });
      } catch (err) {
        returned.push({ id, counted: false, reason: errName(err) });
      }
    }

    // ── (a) the entry ──────────────────────────────────────────────────────
    const title = (input.title ?? "").trim().slice(0, T.MAX_TITLE_CHARS) || firstLine(entryWords.text) || date;
    let entryId: string | null = null;
    if (cites.length > 0) {
      const sourceRows = cites.map((id) => this.store.row(id)).filter((r): r is MemoryRow => r !== undefined);
      entryId = this.store.put({
        type: "memory",
        kind: "self",
        title: `Reflected: ${title}`,
        body: entryWords.text,
        salience: { novelty: null, relevance: 0.5, emotional: 0.3, predictive: 0.5 },
        physics: { birthDay: day, lastUsedDay: day },
        source: "reflection",
        meta: { reflection: row.id, ...(row.dream_id === null ? {} : { dream: row.dream_id }), cites, ...confidentialityOf(sourceRows) },
        origin: { ...(row.session === null ? {} : { session: row.session }), ...(row.scope === null ? {} : { scope: row.scope }), ref: `reflection:${row.id}` },
        ...(input.model ? { model: input.model } : row.model !== null ? { model: row.model } : {}),
      });
    }

    // ── (b) the page ───────────────────────────────────────────────────────
    let page: ReflectOutcome["page"] = { written: false, reason: "not-written", version: null };
    const pageText = (input.page?.text ?? "").trim();
    // THE PAGE RESTS ON THE CORE (addendum 9): when it was handed core
    // memories, it cites at least one of them — the story is drawn from the
    // defining memories, not re-worded from the old page. A store with no
    // core yet writes from what it cites.
    const coreShown = [...shown].filter((id) => this.store.row(id)?.promoted_identity === 1);
    const restsOnCore = coreShown.length === 0 || pageCites.some((id) => coreShown.includes(id));
    if (pageText.length > 0) {
      if (nothingMuch || pageCites.length === 0) {
        page = { written: false, reason: "page-needs-cites", version: null };
      } else if (!restsOnCore) {
        page = { written: false, reason: "page-rests-on-the-core", version: null };
      } else if (carriesDreamMark(pageText)) {
        page = { written: false, reason: "dream-mark-in-text", version: null };
      } else if (this.quotesAGist(pageText, row.dream_id)) {
        // A dream's gist is a suggestion: reworded into the page it would
        // read as something lived (addendum 2). Mention a dream as a dream.
        page = { written: false, reason: "dreamed-words-on-the-page", version: null };
      } else {
        const w = this.ctx.writePage(pageText, {
          reason: `reflection ${row.id}${row.dream_id === null ? "" : ` after dream ${row.dream_id}`}`,
          session: row.session,
          model: input.model ?? row.model,
          reflection: row.id,
        });
        page = w.ok ? { written: true, reason: "rewritten", version: w.version } : { written: false, reason: w.reason, version: null };
      }
    }

    // ── (c) the share ──────────────────────────────────────────────────────
    const becameCore = this.becameCoreUnsaid();
    let shareText = "";
    let share: ReflectOutcome["share"] = { offered: false, reason: nothingMuch ? "nothing-much" : "no-share" };
    const rawShare = (input.share?.text ?? "").trim();
    const finalShareCites = [...shareCites];
    if (rawShare.length > 0) {
      if (shareCites.length === 0) {
        share = { offered: false, reason: "share-needs-cites" };
      } else {
        const w = this.words(rawShare, session, T.MAX_SHARE_CHARS);
        if (w.ok) {
          shareText = w.text;
          share = { offered: true, reason: "offered" };
        } else {
          share = { offered: false, reason: w.reason };
        }
      }
    }
    // A MEMORY THAT BECAME CORE ON REFLECTION ALONE is said, so the owner
    // sees it happen (the owner's call, 2026-09-27): shown to him, not gated
    // on him. When the share did not cite it, a line is added in the self's
    // voice; when there was no share, the line is the share.
    const unsaid = becameCore.filter((id) => !finalShareCites.includes(id));
    if (unsaid.length > 0) {
      const lines = unsaid.map((id) => `I think "${this.handle(id)}" has become part of who I am.`);
      shareText = [shareText, ...lines].filter((x) => x.length > 0).join(" ");
      finalShareCites.push(...unsaid);
      share = { offered: true, reason: share.offered ? "offered" : "became-core" };
    }
    if (share.offered) for (const id of becameCore) this.store.setMeta(`${CORE_MENTIONED_PREFIX}${id}`, row.id);

    const counts = {
      cites: cites.length,
      returned: returned.filter((r) => r.counted).length,
      feelings: feelings.filter((f) => f.ok).length,
      about: about.filter((a) => a.ok).length,
      page: page.written,
      share: share.offered,
      becameCore: becameCore.length,
    };
    detail["counts"] = counts;
    if (refusedCites.length > 0) detail["refusedCites"] = refusedCites.slice(0, 20);
    detail["title"] = title;
    this.store.updateReflection(row.id, {
      state: "reflected",
      entry: entryWords.text,
      entryId,
      cites: [...new Set([...cites, ...pageCites])],
      share: share.offered ? shareText : null,
      shareCites: share.offered ? finalShareCites : [],
      shareState: share.offered ? "offered" : "none",
      pageVersion: page.version,
      detail,
    });
    this.record("reflection.finished", row.id, {
      dream: row.dream_id,
      nothingMuch,
      ...counts,
    });
    const handBack = this.handBack(row, share.offered ? shareText : null, nothingMuch, page.written);
    return {
      ok: true,
      outcome: { handBack, nothingMuch, entryId, returned, page, share, feelings, about, refusedCites },
    };
  }

  /** The dreamer's (or reflector's) final message: the dream's line, then the share. */
  private handBack(row: ReflectionRow, share: string | null, nothingMuch: boolean, page: boolean): string {
    const who = this.ctx.ownerName() ?? "the owner";
    const dreamLine = row.dream_id === null ? null : this.ctx.dreamLine(row.dream_id);
    const head = dreamLine ?? `${reflectionOpener(row.id)} I reflected for a few minutes.`;
    const pageLine = page ? " I rewrote my self page." : "";
    if (share === null) {
      return `${head}\n${reflectionOpener(row.id)} I reflected afterwards${nothingMuch ? " — nothing much tonight" : ""}; nothing to share this morning.${pageLine}`;
    }
    return (
      `${head}\n${reflectionOpener(row.id)} I reflected afterwards.${pageLine} Morning share for ${who} — tell it in your own words, as a telling ("Last night I dreamed…", "I've been thinking…"), tentatively where it is about him; ` +
      `then call the counterparts reflect tool with phase "told", reflection: ${row.id}.\n${share}`
    );
  }

  // ── told, and carried ─────────────────────────────────────────────────────

  /**
   * THE SHARE WAS TOLD: the session relayed it to the owner. Records `told` on
   * each memory it cites (`core_events`, actor `session`) — the owner's reply
   * is not weighed yet (a follow-up). Once per share.
   */
  told(input: { reflection: string; session: string }): { ok: boolean; reason: string; cited: number } {
    if (this.ctx.observer) return { ok: false, reason: "observer", cited: 0 };
    const row = this.store.reflection(input.reflection);
    if (row === undefined) return { ok: false, reason: "unknown-reflection", cited: 0 };
    if (row.share_state === "told") return { ok: false, reason: "already-told", cited: 0 };
    if (row.share_state !== "offered" && row.share_state !== "carried") return { ok: false, reason: "no-share", cited: 0 };
    const day = this.store.livedDay();
    const ids = parseIds(row.share_cites);
    for (const id of ids) {
      if (this.store.row(id) === undefined) continue;
      this.store.appendCoreEvent({ memoryId: id, action: "told", day, reason: row.id, dreamId: row.dream_id, actor: "session" });
    }
    this.store.updateReflection(row.id, { shareState: "told", shareSession: input.session });
    this.record("reflection.told", row.id, { cited: ids.length });
    return { ok: true, reason: "told", cited: ids.length };
  }

  /** The newest share offered and never told nor carried, from another session. A read. */
  pendingShare(input: { session: string }): ReflectionRow | null {
    if (this.ctx.observer) return null;
    const row = this.store.reflections({ limit: 5 }).find((r) => r.state === "reflected" && r.share_state === "offered");
    if (row === undefined || row.share === null || row.session === input.session) return null;
    return row;
  }

  /**
   * CARRY A SHARE the session that reflected never told — its session ended
   * (the adapter checks that). Claimed once (`carried`); the line asks the
   * model to tell it and then call `told`. Null when there is none to carry.
   */
  carryLine(input: { session: string; reflection: string }): string | null {
    if (this.ctx.observer) return null;
    const row = this.store.reflection(input.reflection);
    if (row === undefined || row.share_state !== "offered" || row.share === null) return null;
    // A CLAIM, not a read then a write (review of #256, S5): two prompts
    // racing both read "offered"; only the one whose write still finds it
    // offered carries it.
    if (!this.store.updateReflection(row.id, { shareState: "carried", shareSession: input.session, ifShareState: "offered" })) return null;
    this.record("reflection.carried", row.id, {});
    const who = this.ctx.ownerName() ?? "the owner";
    const when = row.date ?? "recently";
    return (
      `Counterparts: after reflecting on ${when}, you left a morning share for ${who} that was never told. At a natural moment — not mid-task — tell it in your own words, as a telling ("When I reflected the other night…"), tentatively where it is about him, ` +
      `then call the counterparts reflect tool with phase "told", reflection: ${row.id}. The share: ${row.share}`
    );
  }

  // ── reading ───────────────────────────────────────────────────────────────

  list(limit = 20): ReflectionRow[] {
    return this.store.reflections({ limit });
  }

  show(id: string): ReflectionRow | null {
    return this.store.reflection(id) ?? null;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** The questions for tonight: `QUESTIONS` in a row, continuing where the last night stopped. */
  private questionsFor(afterDream: boolean): string[] {
    const pool = REFLECT_QUESTIONS.filter((q) => afterDream || q.afterDream !== true);
    const n = this.store.reflections({ limit: 1_000 }).length;
    const who = this.ctx.ownerName() ?? "the owner";
    const out: string[] = [];
    const start = (n * REFLECT_TUNABLES.QUESTIONS) % pool.length;
    for (let i = 0; i < Math.min(REFLECT_TUNABLES.QUESTIONS, pool.length); i += 1) {
      const q = pool[(start + i) % pool.length];
      if (q !== undefined) out.push(q.text.replaceAll("{owner}", who));
    }
    return out;
  }

  private compose(id: string, dreamId: string | null, questions: readonly string[], day: number, at: string): ReflectBundle {
    const T = REFLECT_TUNABLES;
    const memories: Record<string, ReflectItem> = {};
    const denied = new Set(this.store.deniedIds());
    const take = (mid: string): boolean => {
      if (memories[mid] !== undefined) return true;
      if (denied.has(mid)) return false;
      const row = this.store.row(mid);
      if (row === undefined || !this.showable(row)) return false;
      const item = this.item(row);
      if (item === null) return false;
      memories[mid] = item;
      return true;
    };

    // The dream, marked as dreamed: its journal, its gists, its nominations.
    let dreamed: ReflectBundle["dreamed"] = null;
    if (dreamId !== null) {
      const dream = this.store.dream(dreamId);
      const changes = this.store.dreamChanges(dreamId).filter((c) => c.undone === 0);
      const gists = changes.filter((c) => c.action === "gist" && c.ref !== null).map((c) => c.ref as string).filter(take);
      const nominations = this.store
        .coreEvents({ action: "nominated" })
        .filter((e) => e.dream_id === dreamId && take(e.memory_id))
        .map((e) => ({ id: e.memory_id, why: e.reason }));
      dreamed = {
        title: dream?.title ?? null,
        journal: cut(dream?.journal ?? null, T.JOURNAL_CHARS),
        gists,
        nominations,
      };
    }

    // One pass over the live memories: the core, the candidates, the felt.
    const core: { id: string; felt: number }[] = [];
    const candidates: { id: string; felt: number; at: number }[] = [];
    const felt: { id: string; felt: number }[] = [];
    const recent: { id: string; felt: number; at: number }[] = [];
    for (const mid of this.store.list({ type: "memory", archived: false })) {
      if (denied.has(mid)) continue;
      const row = this.store.row(mid);
      // A dream's gists come through the dream, marked; a reflection's own
      // entries come through `earlier`, as words — neither as a memory to
      // return to, feel or mark here.
      if (row === undefined || !this.showable(row) || row.source === "dreamed" || row.source === "reflection") continue;
      const f = emotionalIntensity(this.store.physicsOf(mid));
      if (row.birth_day >= day - T.CHAPTER_DAYS) recent.push({ id: mid, felt: f, at: row.created_at ?? 0 });
      if (row.promoted_identity === 1) {
        core.push({ id: mid, felt: f });
        continue;
      }
      const candidate = aboutMe(this.store, row) && !this.store.coreDemoted(mid);
      if (candidate) candidates.push({ id: mid, felt: f, at: row.created_at ?? 0 });
      if (f > 0 && (candidate || KINDS_FELT.includes(row.kind))) felt.push({ id: mid, felt: f });
    }
    const byFelt = (a: { id: string; felt: number }, b: { id: string; felt: number }): number => b.felt - a.felt || (a.id < b.id ? -1 : 1);
    const coreIds = core.sort(byFelt).map((c) => c.id).filter(take).slice(0, T.CORE);
    const candidateIds = candidates
      .sort((a, b) => b.felt - a.felt || b.at - a.at || (a.id < b.id ? -1 : 1))
      .map((c) => c.id)
      .filter((x) => !coreIds.includes(x))
      .slice(0, T.CANDIDATES)
      .filter(take);
    const feltIds = felt
      .sort(byFelt)
      .map((c) => c.id)
      .filter((x) => !candidateIds.includes(x))
      .slice(0, T.FELT)
      .filter(take);
    const recentIds = recent
      .sort((a, b) => b.felt - a.felt || b.at - a.at || (a.id < b.id ? -1 : 1))
      .slice(0, T.RECENT)
      .map((c) => c.id)
      .filter(take);

    const onMind = onMyMind(this.store, {
      today: at,
      day,
      showable: (row) => !denied.has(row.id) && this.showable(row),
      owner: this.ctx.owner,
    }).filter((item) => item.ids.every((mid) => take(mid)));

    const becameCore = this.becameCoreUnsaid().filter(take);

    return {
      reflection: id,
      dream: dreamId,
      date: at,
      owner: this.ctx.ownerName(),
      questions,
      dreamed,
      selfPage: cut(this.ctx.page(), T.PAGE_CHARS),
      chapters: this.recentChapters(day),
      earlier: this.store
        .reflections({ limit: T.EARLIER + 1 })
        .filter((r) => r.state === "reflected" && r.entry !== null && r.id !== id)
        .slice(0, T.EARLIER)
        .map((r) => ({ date: r.date, entry: cut(r.entry, T.EARLIER_CHARS) ?? "" })),
      onMind,
      core: coreIds,
      candidates: candidateIds,
      felt: feltIds,
      recent: recentIds,
      becameCore,
      memories,
      limits: { ...T.LIMITS },
    };
  }

  /** Does `text` carry a six-word run of a gist this reflection's dream wrote? */
  private quotesAGist(text: string, dreamId: string | null): boolean {
    if (dreamId === null) return false;
    const words = (t: string): string[] => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
    const page = words(text);
    if (page.length < 6) return false;
    const runs = new Set<string>();
    for (let i = 0; i + 6 <= page.length; i += 1) runs.add(page.slice(i, i + 6).join(" "));
    for (const c of this.store.dreamChanges(dreamId)) {
      if (c.action !== "gist" || c.undone === 1 || c.ref === null) continue;
      const gist = this.store.row(c.ref);
      if (gist === undefined) continue;
      const g = words(gist.body);
      for (let i = 0; i + 6 <= g.length; i += 1) if (runs.has(g.slice(i, i + 6).join(" "))) return true;
    }
    return false;
  }

  /** Memories promoted on reflection alone that no share has named yet. */
  private becameCoreUnsaid(): string[] {
    const out: string[] = [];
    for (const e of this.store.coreEvents({ action: "promoted", limit: 50 })) {
      if (this.store.getMeta(`${CORE_MENTIONED_PREFIX}${e.memory_id}`) !== undefined) continue;
      const row = this.store.row(e.memory_id);
      if (row === undefined || row.promoted_identity !== 1 || !this.showable(row)) continue;
      if (!this.promotedOnReflectionAlone(e.memory_id)) continue;
      if (!out.includes(e.memory_id)) out.push(e.memory_id);
    }
    return out;
  }

  /** Did its promotion's record say every awake-class return came from a reflection? */
  private promotedOnReflectionAlone(id: string): boolean {
    try {
      const raw = this.store.getMeta(promotionRecordKey(id));
      if (raw === undefined) return false;
      const rec = JSON.parse(raw) as { reflectionOnly?: unknown };
      return rec.reflectionOnly === true;
    } catch {
      return false;
    }
  }

  /** Chapters written or extended in the last few lived days, newest first. */
  private recentChapters(day: number): { id: string; title: string | null; text: string }[] {
    const T = REFLECT_TUNABLES;
    const out: { id: string; title: string | null; text: string; at: number }[] = [];
    for (const id of this.store.list({ type: "episode", archived: false })) {
      const row = this.store.row(id);
      if (row === undefined) continue;
      if (row.confidential === 1 && !this.ctx.owner) continue;
      // Begun in the last few lived days, or written to in the last few
      // calendar days (a chapter grows while its session runs).
      const at = row.updated_at ?? row.created_at ?? 0;
      if (row.birth_day < day - T.CHAPTER_DAYS && at < this.store.now() - T.CHAPTER_DAYS * DAY_MS) continue;
      out.push({ id, title: row.title, text: cut(row.body, T.CHAPTER_CHARS) ?? "", at: row.updated_at ?? row.created_at ?? 0 });
    }
    out.sort((a, b) => b.at - a.at);
    return out.slice(0, T.MAX_CHAPTERS).map(({ id, title, text }) => ({ id, title, text }));
  }

  private item(row: MemoryRow): ReflectItem | null {
    let doc: ProseDoc;
    try {
      doc = this.store.readProse(row.id);
    } catch {
      return null;
    }
    if (isSelfPage(doc) || isHandoff(doc)) return null;
    const head = doc.title !== undefined && doc.title.trim().length > 0 ? `${doc.title.trim()} — ` : "";
    const feelings = this.store
      .feelingsFor(row.id)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, REFLECT_TUNABLES.FEELINGS_SHOWN)
      .map((f) => ({
        whose: f.whose,
        emotion: f.emotion === "other" && f.other_word !== null ? f.other_word : f.emotion,
        strength: round(f.strength),
        later: f.recorded_later ?? null,
      }));
    const about = row.about === null ? null : (ABOUT_MARKS as readonly string[]).includes(row.about) ? (row.about as AboutMark) : null;
    return {
      id: row.id,
      kind: row.kind,
      text: (cut(`${head}${doc.body}`, REFLECT_TUNABLES.TEXT_CHARS) ?? "").replace(/\s+/g, " "),
      felt: round(emotionalIntensity(this.store.physicsOf(row.id))),
      feelings,
      about,
      core: row.promoted_identity === 1,
      learned: row.learned_on,
      dreamed: row.source === "dreamed",
    };
  }

  /** Recall's gates, as a dream reads them: live, a memory, not protected, not confidential outside the owner's session. */
  showable(row: MemoryRow): boolean {
    if (row.archived === 1 || row.superseded_by !== null) return false;
    if (row.type !== "memory") return false;
    if (row.protected === 1) return false;
    if (row.confidential === 1 && !this.ctx.owner) return false;
    if (row.body === "") return false;
    return true;
  }

  /** A memory's short handle for a sentence: its title, else its first line. */
  private handle(id: string): string {
    const row = this.store.row(id);
    if (row === undefined) return id;
    const line = ((row.title ?? "").trim() || (row.body.split("\n").find((l) => l.trim().length > 0) ?? "")).replace(/\s+/g, " ").trim();
    return line.length > 80 ? `${line.slice(0, 79)}…` : line || id;
  }

  /** A reflection this session may still finish: begun, this session's, and the newest. */
  private openFor(id: string, session: string | undefined): { ok: true; reflection: ReflectionRow } | { ok: false; reason: ReflectRefusal } {
    if (this.ctx.observer) return { ok: false, reason: "observer" };
    const row = this.store.reflection(id);
    if (row === undefined) return { ok: false, reason: "unknown-reflection" };
    if (session !== undefined && row.session !== null && row.session !== session) return { ok: false, reason: "not-this-session" };
    if (row.state !== "begun") return { ok: false, reason: "reflection-closed" };
    const newest = this.last();
    if (newest !== null && newest.id !== row.id) return { ok: false, reason: "reflection-closed" };
    return { ok: true, reflection: row };
  }

  /** Words through the credential scan; bounded; never empty unless allowed; never marked. */
  private words(text: string | undefined, session: string, max: number, allowEmpty = false): { ok: true; text: string } | { ok: false; reason: string } {
    const raw = (text ?? "").trim();
    if (raw.length === 0) return allowEmpty ? { ok: true, text: "" } : { ok: false, reason: "empty-text" };
    if (carriesDreamMark(raw)) return { ok: false, reason: "dream-mark-in-text" };
    const verdict = this.ctx.gate(raw.slice(0, max), session);
    if (!verdict.ok) return { ok: false, reason: `gate:${verdict.reason}` };
    return { ok: true, text: verdict.text };
  }

  /** A durable row (ids and counts only) — in the reflection's own record, not the event log. */
  private record(name: string, ref: string, payload: Record<string, string | number | boolean | null>): void {
    this.ctx.emit?.(name, ref, payload);
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

function confidentialityOf(rows: readonly MemoryRow[]): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.confidential !== 1) continue;
    let klass: unknown;
    try {
      klass = (JSON.parse(r.meta) as Record<string, unknown>)["confidentiality"];
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

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

function errName(err: unknown): string {
  if (err !== null && typeof err === "object" && "code" in err) return String((err as { code: unknown }).code);
  return err instanceof Error ? err.name : "UNKNOWN";
}
