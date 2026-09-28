/**
 * FEELINGS ON A MEMORY — the `feelings` table's shape and the one check every
 * write of it crosses (schema v7, owner-approved 2026-09-25).
 *
 * One row per feeling. A memory can hold several: mixed feelings are several
 * rows, and the owner's and this self's feelings about the same moment sit side
 * by side, told apart by `whose`. Each names a `core` (one of six) and an
 * `emotion` from the wheel (`core/feelings-wheel.ts`), or `other` with the
 * person's own word kept in `other_word`. `strength` is recorded as felt and
 * never rewritten — softening with time is for a reader to compute. A feeling
 * can sit on top of another on the same memory (`beneath_id`: anger over fear).
 * `carried_by` says briefly what in the moment carried it — the words, what
 * happened — and need not be a statement of feeling.
 *
 * READ SINCE 2026-09-26 (emotion part A). The strongest recorded strength on
 * a memory joins its numeric `emotional` score as its emotional intensity,
 * which lifts its height and slows its decay (physics §5.10, read beside the row
 * by `Store.row()`); a feeling recorded in the last few hours sets the mood
 * that recall matches against (recall G18). The `meta.feeling` label is still
 * only a label.
 *
 * A BLEND (`tender`: sad + happy) may be named under either of its cores and is
 * stored under its PRIMARY core — `core` holds one value, and anything that
 * matches by core reads the blend as both (`feelings-wheel.ts#coresOfFeeling`).
 */
import { CORE_EMOTIONS, OTHER_EMOTION, closestKeys, isCoreEmotion, resolveEmotion } from "../feelings-wheel.js";
import type { CoreEmotion } from "../feelings-wheel.js";
import type { Row } from "./db.js";
import { StoreError } from "./errors.js";

/** Whose feeling it is. Two today; the column is TEXT so a person (an entity
 *  id) can join later without a migration. */
export const FEELING_WHOSE = ["owner", "self"] as const;
export type FeelingWhose = (typeof FEELING_WHOSE)[number];

/**
 * v9 (2026-09-27): WHO RECORDED A FEELING. `session` — a writer in a session,
 * at the moment or at its end (every feeling before v9 but a dream's); `dream`
 * — a dream's feeling-now, capped at the memory's peak; `reflection` — the
 * waking self's feeling-now, which may be stronger than anything written at
 * the time and is marked `recorded_later` with its date. The core's fast lane
 * reads only the first two unless `CORE_FAST_ACCEPTS_REFLECTED_FEELING` is set
 * (physics §5.3).
 */
export const FEELING_SOURCES = ["session", "dream", "reflection"] as const;
export type FeelingSource = (typeof FEELING_SOURCES)[number];

/**
 * `carried_by` is the nuance in the writer's own words — what in the moment
 * carried it. Raised 280 → 1,000 (owner direction 2026-09-28: loosen the
 * limits); longer is kept to this length with a repair notice, never refused.
 */
export const CARRIED_BY_MAX_CHARS = 1_000;
/**
 * The free word kept when the emotion is not on the wheel. Raised 40 → 80
 * (2026-09-28). An emotion longer than this, or one that carries a phrase
 * (`steadied: the guard held`), is SPLIT, never refused (`repairEmotion`).
 */
export const OTHER_WORD_MAX_CHARS = 80;

export interface FeelingInput {
  readonly whose: string;
  readonly core: string;
  /** A wheel key or bare word (`furious`, `fear.inferior`), or `other`. */
  readonly emotion: string;
  /** The person's word, when `emotion` is `other`. */
  readonly otherWord?: string;
  /** 0..1, as recorded. */
  readonly strength: number;
  /** What carried it. May be empty. */
  readonly carriedBy?: string;
  /**
   * The feeling this one sits on top of: an existing feeling's id on the SAME
   * memory, or the index of another input in the same call.
   */
  readonly beneath?: string | number;
}

export interface FeelingRow extends Row {
  id: string;
  memory_id: string;
  whose: string;
  core: string;
  emotion: string;
  other_word: string | null;
  strength: number;
  beneath_id: string | null;
  carried_by: string;
  model: string | null;
  created_at: number;
  updated_at: number;
  /** v9: who recorded it (`FEELING_SOURCES`); null only on a bare test row. */
  source: string | null;
  /** v9: the calendar date it was recorded after the moment; null = felt at the time. */
  recorded_later: string | null;
}

/**
 * What the caller should hear about one input: either it was stored as `other`
 * (the word as given, and the wheel keys GENUINELY close to it — usually none),
 * or, with `readAs`, the word was an alias and was stored as that wheel key.
 */
export interface FeelingNotice {
  readonly index: number;
  readonly word: string;
  readonly core: CoreEmotion;
  readonly closest: readonly string[];
  /** Set when `word` was read as this wheel key (`exposed` → `vulnerable`). */
  readonly readAs?: string;
}

/**
 * ACCEPT AND REPAIR (owner direction 2026-09-28): what the check changed so
 * the feeling could be stored rather than refused — an emotion that carried a
 * phrase split into the word and the nuance, or a `carried_by` kept to its
 * length. `was` is what was sent, `now` what was stored in that field.
 */
export interface FeelingRepair {
  readonly index: number;
  readonly field: "emotion" | "other_word" | "carried_by" | "core";
  readonly was: string;
  readonly now: string;
  readonly note: string;
}

export interface AddFeelingsResult {
  readonly ids: readonly string[];
  readonly notices: readonly FeelingNotice[];
  readonly repairs: readonly FeelingRepair[];
}

/** Where an emotion that carries a phrase is cut: the word before, the nuance after. */
const STRONG_BREAK = /\s*(?:[:;—–]|\s-\s)\s*/u;
const ANY_BREAK = /\s*(?:[:;,—–]|\s-\s)\s*/u;

/**
 * SPLIT AN EMOTION THAT CARRIES A PHRASE (2026-09-28). A model that writes
 * `emotion: "steadied: the guard has held every time since…"` meant the word
 * `steadied` and the nuance after it, which belongs in `carried_by`. Split
 * when the text is longer than `OTHER_WORD_MAX_CHARS`, or carries a strong
 * break (`:`, `;`, a dash): the head — up to the first `:`, `—`, `–`, `;` or
 * `,` (a comma only when over-long) — is the emotion, and the rest goes to
 * `carried_by` (set when empty, else appended). With no break, an over-long
 * phrase is cut at the last word boundary within the cap ("a deep and abiding
 * sense of gratitude for…" keeps its first words, not just "a"); punctuation
 * alone is kept to the cap. The emotion that comes back is never longer than
 * the cap. Pure; null when nothing needed splitting.
 */
export function repairEmotion(emotion: string, carriedBy: string): { emotion: string; carriedBy: string; tail: string } | null {
  const raw = emotion.trim();
  const long = raw.length > OTHER_WORD_MAX_CHARS;
  if (!long && !STRONG_BREAK.test(raw)) return null;
  const cut = (long ? ANY_BREAK : STRONG_BREAK).exec(raw);
  let head: string;
  let tail: string;
  if (cut !== null && cut.index > 0) {
    head = raw.slice(0, cut.index).trim();
    tail = raw.slice(cut.index + cut[0].length).trim();
  } else {
    // A break before any words (": steadied — …"): drop the leading
    // punctuation and read what is left. No break at all: the whole of it.
    const stripped = raw.replace(/^[\s:;,—–-]+/u, "").trim();
    if (stripped.length > 0 && stripped !== raw) {
      const again = repairEmotion(stripped, carriedBy);
      return again ?? { emotion: stripped, carriedBy: carriedBy.trim(), tail: "" };
    }
    head = stripped.length > 0 ? stripped : raw;
    tail = "";
  }
  if (head.length > OTHER_WORD_MAX_CHARS) {
    const [kept, rest] = fitWords(head, OTHER_WORD_MAX_CHARS);
    head = kept;
    tail = [rest, tail].filter((x) => x.length > 0).join(" ");
  }
  if (head.length === 0) return null;
  const carried = carriedBy.trim();
  const joined = tail.length === 0 ? carried : carried.length === 0 ? tail : `${carried}; ${tail}`;
  return { emotion: head, carriedBy: joined, tail };
}

/** `text` cut at the last word boundary within `max` (or at `max` when one word is longer), and the rest. */
function fitWords(text: string, max: number): [string, string] {
  if (text.length <= max) return [text, ""];
  const at = text.lastIndexOf(" ", max);
  if (at > 0) return [text.slice(0, at).trim(), text.slice(at).trim()];
  return [text.slice(0, max), text.slice(max)];
}

/** What a split says to the writer, so the next one is written right. */
export function splitNote(split: { emotion: string; tail: string }, field: "emotion" | "other_word" = "emotion"): string {
  return `"${split.emotion}" was kept as the ${field === "emotion" ? "emotion" : "word"}${split.tail.length > 0 ? " and the rest went to carried_by" : ""}: ${field} is one word, carried_by holds the nuance.`;
}

/** A `carried_by` kept to its length, whole where it fits. */
function keepCarried(text: string): string {
  return text.length <= CARRIED_BY_MAX_CHARS ? text : `${text.slice(0, CARRIED_BY_MAX_CHARS - 1)}…`;
}

/** One input, checked and spelled as it will be stored. `beneath` still unresolved. */
export interface CheckedFeeling {
  readonly whose: FeelingWhose;
  readonly core: CoreEmotion;
  readonly emotion: string;
  readonly otherWord: string | null;
  readonly strength: number;
  readonly carriedBy: string;
  readonly beneath: string | number | null;
}

function invalid(index: number, reason: string, extra: Record<string, string | number> = {}): never {
  throw new StoreError("FEELING_INVALID", { index, reason, ...extra });
}

/**
 * THE CHECK, pure — no store needed, so a door (the MCP tools) can run it
 * BEFORE it mints the memory the feelings belong to, and refuse the whole
 * entry rather than leave a memory whose feelings were dropped. Throws
 * `FEELING_INVALID` naming the input and the reason; returns the checked rows
 * and the `other` notices.
 */
export function checkFeelings(inputs: readonly FeelingInput[]): { rows: CheckedFeeling[]; notices: FeelingNotice[]; repairs: FeelingRepair[] } {
  const rows: CheckedFeeling[] = [];
  const notices: FeelingNotice[] = [];
  const repairs: FeelingRepair[] = [];
  inputs.forEach((given, i) => {
    let f = given;
    if (f === null || typeof f !== "object") invalid(i, "not-an-object");
    if (typeof f.whose !== "string" || !(FEELING_WHOSE as readonly string[]).includes(f.whose)) {
      invalid(i, "whose-unknown", { allowed: FEELING_WHOSE.join("|") });
    }
    if (!isCoreEmotion(f.core)) invalid(i, "core-unknown", { allowed: CORE_EMOTIONS.join("|") });
    const core = f.core as CoreEmotion;
    if (typeof f.strength !== "number" || !Number.isFinite(f.strength) || f.strength < 0 || f.strength > 1) {
      invalid(i, "strength-out-of-range");
    }
    if (f.carriedBy !== undefined && typeof f.carriedBy !== "string") invalid(i, "carried-by-not-a-string");
    // TYPES BEFORE ANY WORK (review S2): a non-string `otherWord` used to
    // throw a TypeError out of `.trim()`.
    if (typeof f.emotion !== "string" || f.emotion.trim().length === 0) invalid(i, "emotion-missing");
    if (f.otherWord !== undefined && typeof f.otherWord !== "string") invalid(i, "other-word-not-a-string");
    // ACCEPT AND REPAIR, never refuse for length (2026-09-28): an emotion (or
    // an `other` word) that carries a phrase is split into the word and the
    // nuance BEFORE the wheel reads it — so a huge `emotion` is still never
    // scored by edit distance (review S2's other half).
    const split = (field: "emotion" | "other_word", text: string): void => {
      const fixed = repairEmotion(text, f.carriedBy ?? "");
      if (fixed === null) return;
      f = field === "emotion" ? { ...f, emotion: fixed.emotion, carriedBy: fixed.carriedBy } : { ...f, otherWord: fixed.emotion, carriedBy: fixed.carriedBy };
      repairs.push({
        index: i,
        field,
        was: text.trim(),
        now: fixed.emotion,
        note: splitNote(fixed, field),
      });
    };
    split("emotion", f.emotion);
    if (typeof f.otherWord === "string") split("other_word", f.otherWord);
    const sentCarried = f.carriedBy ?? "";
    const carriedBy = keepCarried(sentCarried);
    if (carriedBy !== sentCarried) {
      repairs.push({
        index: i,
        field: "carried_by",
        was: sentCarried,
        now: carriedBy,
        note: `carried_by was kept to its first ${String(CARRIED_BY_MAX_CHARS)} characters.`,
      });
    }
    if (f.beneath !== undefined && typeof f.beneath !== "string" && typeof f.beneath !== "number") {
      invalid(i, "beneath-not-an-id-or-index");
    }
    let emotion: string;
    let otherWord: string | null = null;
    let storedCore: CoreEmotion = core;
    if (f.emotion.trim().toLowerCase() === OTHER_EMOTION) {
      const word = (f.otherWord ?? "").trim();
      if (word.length === 0) invalid(i, "other-word-missing");
      emotion = OTHER_EMOTION;
      otherWord = word;
      notices.push({ index: i, word, core, closest: closestKeys(core, word.toLowerCase()) });
    } else {
      const read = resolveEmotion(core, f.emotion);
      if (read.kind === "wrong-core") {
        // ACCEPT AND REPAIR (owner, 2026-09-28): a wheel word named under
        // another core is stored under its own, and said (it was refused
        // `emotion-under-another-core`).
        emotion = read.entry.key;
        storedCore = read.entry.core;
        repairs.push({
          index: i,
          field: "core",
          was: core,
          now: read.entry.core,
          note: `"${read.entry.word}" sits under ${read.entry.core} on the wheel, not ${core}, so it was stored under ${read.entry.core}.`,
        });
      } else if (read.kind === "wheel") {
        emotion = read.entry.key;
        // A blend named under its second core is stored under its primary.
        storedCore = read.entry.core;
        if (read.alias !== undefined) notices.push({ index: i, word: read.alias, core: storedCore, closest: [], readAs: read.entry.key });
      } else {
        // Not on the wheel: kept, as `other`, with the word — and the caller is
        // told of a wheel word only when one is genuinely close (a misspelling).
        emotion = OTHER_EMOTION;
        otherWord = read.kind === "other" ? read.word : f.emotion.trim();
        notices.push({ index: i, word: otherWord, core, closest: read.kind === "other" ? read.closest : [] });
      }
    }
    if (typeof f.beneath === "number") {
      if (!Number.isInteger(f.beneath) || f.beneath < 0 || f.beneath >= inputs.length || f.beneath === i) {
        invalid(i, "beneath-index-out-of-range");
      }
    }
    rows.push({
      whose: f.whose as FeelingWhose,
      core: storedCore,
      emotion,
      otherWord,
      strength: f.strength,
      carriedBy,
      beneath: f.beneath ?? null,
    });
  });
  // No loop of "this sits on that" inside one call: follow each chain.
  rows.forEach((_, start) => {
    const seen = new Set<number>([start]);
    let at = rows[start]?.beneath;
    while (typeof at === "number") {
      if (seen.has(at)) invalid(start, "beneath-cycle");
      seen.add(at);
      at = rows[at]?.beneath;
    }
  });
  return { rows, notices, repairs };
}
