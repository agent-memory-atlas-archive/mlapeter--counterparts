/**
 * A QUESTION ABOUT FEELING — the deliberate path only (2026-09-30, U13 items 1
 * and 2).
 *
 * Asked by name or topic, recall answered well; asked by feeling ("what have I
 * felt most strongly", "times I felt moved or sad") it answered with plumbing.
 * Stored feelings only REWEIGHTED candidates the words had already found
 * (`activate.ts#gatedSal`, `mood.ts#moodLift`); they never NOMINATED one, and a
 * memory stamped `moved` whose text never says the word could not be reached by
 * "moved" at all.
 *
 * This file answers two questions about the asked text, and one about a stamp:
 *
 *   `readFeelingAsk` — is the question about feeling, which words of it name a
 *     feeling, and whose feeling it asks about.
 *   `feelingTokens`  — the words a stamp answers to: the emotion word as the
 *     writer's key spells it, the everyday words that alias to it, the wheel
 *     core(s) it counts under (a blend under both), and the writer's own word
 *     when it is off the wheel (`other_word`).
 *
 * **Deliberate only, and why.** The ambient path's affect gate (§9 G10/G11:
 * stated-only, first-person, turn-gated — `cues.ts#detectAffect`) is a safety
 * property, not a vocabulary gap: a turn that says "sad" must not pull every
 * sad memory into a conversation nobody asked it into. A deliberate question is
 * the experiencer asking on purpose. Nothing here is read by `detectAffect`,
 * and `Recall.build` runs the lane only when the turn carries a `feeling` ask,
 * which only `mcp/deliberate.ts#answerQuestion` sets.
 *
 * **Whose.** The table holds two: `owner` and `self`. First person means the
 * ASKER (the counterpart, through its `recall` tool; the owner, through the
 * console's `ask`), second person the other one, the owner's names or "owner"
 * the owner, and "we" both. Nothing said, or both said: both.
 *
 * NO MODEL CALL: a fixed vocabulary and the store's own tokenizer.
 */
import { ALIASES, CORE_EMOTIONS, FEELINGS_WHEEL, OTHER_EMOTION, coresOfFeeling, wheelEntry } from "../feelings-wheel.js";
import { tokenize } from "../store/index.js";

export type FeelingWhose = "owner" | "self";

/** What the caller knows and this file cannot: who is asking, and the owner's names. */
export interface FeelingAskInput {
  /** Whose "I" it is. `self` for the counterpart's own `recall`; `owner` at the console. */
  readonly asker: FeelingWhose;
  /** The owner's names, lower-case (`sleep/consolidate.ts#ownerNames`). */
  readonly ownerNames?: readonly string[];
  /** The owner's own session — filled in by `Recall.build` from its own stance,
   *  so a confidential stamp takes no nomination slot a non-owner can't see. */
  readonly owner?: boolean;
}

/** Words that make a question about feeling on their own, with no feeling named. */
export const FEEL_WORDS: readonly string[] = [
  "feel", "feels", "feeling", "feelings", "felt", "emotion", "emotions", "emotional", "mood", "moods",
];

/** Every word the wheel knows a feeling by: its words, its cores, and the aliases. */
export const WHEEL_VOCABULARY: ReadonlySet<string> = new Set<string>([
  ...CORE_EMOTIONS,
  ...FEELINGS_WHEEL.map((e) => e.word),
  ...Object.keys(ALIASES),
]);

// Not "id" ("I'd" without its apostrophe): in this store "id" is far more often a
// memory id, and a missed "I'd" only falls back to both.
const FIRST = new Set(["i", "im", "ive", "me", "my", "mine", "myself"]);
const SECOND = new Set(["you", "youre", "youve", "your", "yours", "yourself"]);
const PLURAL = new Set(["we", "weve", "us", "our", "ours", "ourselves"]);
const OWNER_WORDS = new Set(["owner", "user"]);

/** Lower-case words, apostrophes dropped, "I" kept (`cues.ts#words`'s rule). */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

/**
 * Whose feeling the question asks about, or null for both. `ownerNames` are
 * matched as whole words, each word of a multi-word name on its own.
 */
export function whoseAsked(text: string, input: FeelingAskInput): FeelingWhose | null {
  const other: FeelingWhose = input.asker === "self" ? "owner" : "self";
  const names = new Set((input.ownerNames ?? []).flatMap((n) => words(n)).filter((w) => w.length >= 2));
  const said = new Set<FeelingWhose>();
  for (const w of words(text)) {
    if (FIRST.has(w)) said.add(input.asker);
    else if (SECOND.has(w)) said.add(other);
    else if (PLURAL.has(w)) {
      said.add("owner");
      said.add("self");
    } else if (OWNER_WORDS.has(w) || names.has(w)) said.add("owner");
  }
  return said.size === 1 ? ([...said][0] as FeelingWhose) : null;
}

/** The words one stamp answers to. See the header. */
export function feelingTokens(f: { core: string; emotion: string; other_word: string | null }): Set<string> {
  const out = new Set<string>();
  const add = (text: string): void => {
    for (const tok of tokenize(text)) out.add(tok);
  };
  if (f.emotion !== OTHER_EMOTION) {
    add(wheelEntry(f.emotion)?.word ?? f.emotion.split(".").pop() ?? f.emotion);
    for (const [alias, key] of Object.entries(ALIASES)) if (key === f.emotion) add(alias);
  }
  for (const c of coresOfFeeling(f.core, f.emotion)) add(c);
  if (f.other_word !== null) {
    // The writer's own word — ONE word only (review of #293, B2). A phrase kept
    // as the word ("at the edge of something") would make "something" a
    // feeling word for the whole store.
    const own = tokenize(f.other_word);
    if (own.length === 1) out.add(own[0] as string);
  }
  return out;
}

export interface FeelingAsk {
  /**
   * A REAL question about feeling, so the answer is RANKED by the stamps'
   * strength: a feel-word, or a word naming a feeling, used about a PERSON
   * (see `aboutAPerson`). "what have I felt most strongly", "what moved me".
   */
  readonly ranked: boolean;
  /** Question words that name a feeling (wheel words, cores, aliases, or a
   *  word a stamp in this store answers to), leaving out a word used as a verb
   *  on a thing ("where we moved THE parser"). Empty with `ranked`: every stamp
   *  is in the pool. Without `ranked`, the stamps these words answer to are
   *  ordinary cues — they can find a memory, never lead the answer. */
  readonly named: ReadonlySet<string>;
  readonly whose: FeelingWhose | null;
}

/** A word that, right after a feeling word, makes it a verb acting on a thing. */
const DETERMINERS = new Set(["the", "a", "an", "this", "that", "these", "those", "our", "their", "its", "some"]);
/** Scanning back stops here: another subject owns what follows (`cues.ts`'s rule). */
const THIRD = new Set(["he", "she", "they", "it", "its", "his", "her", "their", "theyre"]);
/** How far a person word may stand from the feeling word: before, and after. */
const BEFORE = 3;
const AFTER = 2;

/**
 * Is the feeling word at `at` used ABOUT A PERSON — the way `detectAffect`
 * decides, widened to both sides for "what moved ME"? A person is the first
 * person singular, the second person, the owner by word or by name, and — for a
 * feel-word only — "we": "what have we felt" is a feeling question, "where we
 * moved the parser" is not. Scanning back stops at a third-person subject.
 */
function aboutAPerson(toks: readonly string[], at: number, feelWord: boolean, names: ReadonlySet<string>): boolean {
  const person = (w: string): boolean =>
    FIRST.has(w) || SECOND.has(w) || OWNER_WORDS.has(w) || names.has(w) || (feelWord && PLURAL.has(w));
  for (let j = at - 1; j >= Math.max(0, at - BEFORE); j--) {
    const w = toks[j] as string;
    if (THIRD.has(w)) break;
    if (person(w)) return true;
  }
  for (let j = at + 1; j <= Math.min(toks.length - 1, at + AFTER); j++) {
    if (person(toks[j] as string)) return true;
  }
  return false;
}

/**
 * Read a deliberate question. `stored` is every word some stamp in the store
 * answers to, so a writer's own word off the wheel ("unsettled") names a
 * feeling here even though the wheel never heard of it.
 *
 * The everyday words on the wheel (`open`, `happy`, `moved`, `critical`) and
 * the everyday feel-word ("how does the importer feel to use") are why the
 * ranking needs a person: without one, a question about the happy path would
 * put six stamped memories ahead of the answer (review of #293, B2).
 */
export function readFeelingAsk(
  text: string,
  input: FeelingAskInput,
  stored: ReadonlySet<string>,
  minLength: number,
): FeelingAsk {
  const toks = words(text);
  const names = new Set((input.ownerNames ?? []).flatMap((n) => words(n)).filter((w) => w.length >= 2));
  const named = new Set<string>();
  let ranked = false;
  toks.forEach((w, i) => {
    if (FEEL_WORDS.includes(w)) {
      if (aboutAPerson(toks, i, true, names)) ranked = true;
      return;
    }
    if (w.length < minLength || !(WHEEL_VOCABULARY.has(w) || stored.has(w))) return;
    if (DETERMINERS.has(toks[i + 1] ?? "")) return; // a verb on a thing, not a feeling
    named.add(w);
    if (aboutAPerson(toks, i, false, names)) ranked = true;
  });
  return { ranked, named, whose: whoseAsked(text, input) };
}
