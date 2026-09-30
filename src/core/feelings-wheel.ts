/**
 * THE FEELINGS WHEEL — the vocabulary a recorded feeling is spelled in
 * (owner-approved 2026-09-25, transcribed from his poster).
 *
 * Six CORE emotions at the centre (happy, sad, fear, anger, surprise, disgust),
 * a MIDDLE ring of named feelings under each, and an OUTER ring of two finer
 * words under each middle one. A recorded feeling (`store` table `feelings`,
 * schema v7) names one core and one entry from this list — or `other`, with the
 * person's own word kept beside it.
 *
 * **The key scheme.** An entry's key is its word, lower-case (`furious`,
 * `hopeful`). A word the wheel prints under TWO DIFFERENT cores gets a
 * core-qualified key on BOTH sides — `<core>.<word>` — so no key silently means
 * one of two feelings: `anger.insecure` / `fear.insecure`, `sad.inferior` /
 * `fear.inferior`. A word printed twice under the SAME core is one key (sad's
 * `abandoned` is a middle-ring feeling and also under `lonely`; it is kept once,
 * on the middle ring, with `alsoUnder: "lonely"`). The six cores are entries
 * too (ring `core`), for a feeling named only at the centre. `other` is the
 * one key that is not on the wheel. `resolveEmotion` accepts a bare word where
 * it is unambiguous, and qualifies an ambiguous one by the core it was given.
 *
 * **Valence** is +1 or −1 per entry, and 0 for `surprise` itself: surprise's
 * children take their own (amazed, awe, astonished, excited, energetic, eager
 * lean positive; startled, shocked, dismayed, confused, perplexed, disillusioned
 * lean negative). The one reader so far is the suggestion rule below: a word
 * off the wheel is never nudged toward a word of the opposite sign.
 *
 * **ADDITIONS — NOT THE POSTER'S** (emotion part A, 2026-09-26). Real use
 * showed the poster missing the words a counterpart actually reaches for:
 * session random-53 wrote eight feelings and seven fell off the wheel
 * (grateful, curious, tender, exposed, sheepish, caught, clarified — only
 * "amused" matched). `ADDED` below lists the words added for that, each marked
 * `added: true` on its entry and placed on the middle ring of its best core
 * with no parent — they are not squeezed under a poster word they do not
 * belong to. The poster's entries are unchanged, and `added` is how any reader
 * tells the two apart.
 *
 * **BLENDS carry two cores** with no schema change: an entry may declare
 * `alsoCore`. The stored row keeps the PRIMARY core (`core`); anything that
 * matches by core — mood-matching in recall — reads a blend as both
 * (`coresOfFeeling`), and a writer may name a blend under either of its cores.
 * One poster word gains a second core this way (`vulnerable`, + fear, so
 * "exposed" — its alias — can be written under fear); the word stays the
 * poster's and the entry says the second core is ours (`secondCoreAdded`).
 *
 * **ALIASES** (`ALIASES`): a few everyday words that mean a wheel word read
 * as that word (`exposed` → `vulnerable`, `thankful` → `grateful`). The caller
 * is told what its word was read as.
 *
 * **Suggestions are only offered when genuinely close** (`closestKeys`): a
 * misspelling (edit distance 1, or 2 for a word of six letters or more) of a
 * word under the SAME core, never one of the opposite valence. The first
 * version offered the five nearest keys by raw edit distance, so "tender"
 * under sad was offered bored / despair / lonely — steering a warm word toward
 * its opposite. A word with nothing close is simply kept as the writer's own.
 *
 * A leaf: no imports, so `store/` (which validates against it) and anything
 * above can read it without a layering question.
 */

export const CORE_EMOTIONS = ["happy", "sad", "fear", "anger", "surprise", "disgust"] as const;
export type CoreEmotion = (typeof CORE_EMOTIONS)[number];

export type WheelRing = "core" | "middle" | "outer";
export type Valence = 1 | 0 | -1;

export interface WheelEntry {
  /** The stored key (see the scheme above). */
  readonly key: string;
  /** The word as the wheel prints it. */
  readonly word: string;
  readonly core: CoreEmotion;
  readonly ring: WheelRing;
  /** The middle-ring key an outer word sits under; null for the core and middle rings. */
  readonly parent: string | null;
  readonly valence: Valence;
  /** A middle-ring word the wheel ALSO prints on the outer ring of the same core. */
  readonly alsoUnder?: string;
  /** True for a word added from real use — NOT on the owner's poster. See
   *  ADDITIONS in the header. */
  readonly added?: true;
  /** A blend's second core. The row stores `core`; matching reads both. */
  readonly alsoCore?: CoreEmotion;
  /** True when a POSTER word's `alsoCore` is ours, not the poster's. */
  readonly secondCoreAdded?: true;
}

/** The one emotion key that is not on the wheel: the person's own word is kept beside it. */
export const OTHER_EMOTION = "other";

type Branch = readonly [middle: string, outer: readonly [string, string]];

const TREE: Record<CoreEmotion, readonly Branch[]> = {
  anger: [
    ["hurt", ["embarrassed", "devastated"]],
    ["threatened", ["insecure", "jealous"]],
    ["hateful", ["resentful", "violated"]],
    ["mad", ["furious", "enraged"]],
    ["aggressive", ["provoked", "hostile"]],
    ["frustrated", ["infuriated", "irritated"]],
    ["distant", ["withdrawn", "suspicious"]],
    ["critical", ["skeptical", "sarcastic"]],
  ],
  disgust: [
    ["disapproval", ["judgmental", "loathing"]],
    ["disappointed", ["repugnant", "revolted"]],
    ["awful", ["revulsion", "detestable"]],
    ["avoidance", ["aversion", "hesitant"]],
  ],
  sad: [
    ["guilty", ["remorseful", "ashamed"]],
    ["abandoned", ["ignored", "victimized"]],
    ["despair", ["powerless", "vulnerable"]],
    ["depressed", ["inferior", "empty"]],
    ["lonely", ["abandoned", "isolated"]],
    ["bored", ["apathetic", "indifferent"]],
  ],
  happy: [
    ["optimistic", ["inspired", "open"]],
    ["intimate", ["playful", "sensitive"]],
    ["peaceful", ["hopeful", "loving"]],
    ["powerful", ["provocative", "courageous"]],
    ["accepted", ["fulfilled", "respected"]],
    ["proud", ["confident", "important"]],
    ["interested", ["inquisitive", "amused"]],
    ["joyful", ["ecstatic", "liberated"]],
  ],
  surprise: [
    ["excited", ["energetic", "eager"]],
    ["amazed", ["awe", "astonished"]],
    ["confused", ["perplexed", "disillusioned"]],
    ["startled", ["dismayed", "shocked"]],
  ],
  fear: [
    ["scared", ["terrified", "frightened"]],
    ["anxious", ["overwhelmed", "worried"]],
    ["insecure", ["incompetent", "inferior"]],
    ["submissive", ["worthless", "insignificant"]],
    ["rejected", ["inadequate", "alienated"]],
    ["humiliated", ["disrespected", "ridiculed"]],
  ],
};

const SURPRISE_POSITIVE = new Set(["excited", "energetic", "eager", "amazed", "awe", "astonished"]);

/**
 * THE ADDITIONS — words a counterpart actually has that the poster does not
 * (session random-53, 2026-09-26). Each sits on the middle ring of its best
 * core, marked `added`. A blend names its second core; its valence is stated
 * rather than derived, because a blend's sign is not its primary core's.
 * WORKING DEFAULTS: the placements are judgment, and the owner may move any.
 */
const ADDED: readonly { word: string; core: CoreEmotion; alsoCore?: CoreEmotion; valence: Valence }[] = [
  { word: "grateful", core: "happy", valence: 1 },
  { word: "curious", core: "happy", valence: 1 },
  { word: "intrigued", core: "happy", valence: 1 },
  { word: "fond", core: "happy", valence: 1 },
  { word: "relieved", core: "happy", valence: 1 },
  { word: "moved", core: "happy", valence: 1 },
  // Blends: the row keeps the first core, matching reads both.
  { word: "bittersweet", core: "happy", alsoCore: "sad", valence: 0 },
  { word: "tender", core: "sad", alsoCore: "happy", valence: 1 },
  { word: "wistful", core: "sad", alsoCore: "happy", valence: -1 },
  { word: "sheepish", core: "fear", alsoCore: "sad", valence: -1 },
];

/** A second core given to a POSTER word — itself an addition, marked on the entry. */
const ADDED_SECOND_CORE: Readonly<Record<string, CoreEmotion>> = {
  // Vulnerable is printed under sad (despair); being exposed is as much fear.
  vulnerable: "fear",
};

/**
 * Everyday words that MEAN a wheel word, read as it. Small on purpose: an
 * alias decides for the writer, so each one must be a synonym, not a cousin.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  exposed: "vulnerable",
  thankful: "grateful",
  touched: "moved",
  nostalgic: "wistful",
  inquiring: "curious",
  // 2026-09-30 (U13): "when was I afraid" named nothing.
  afraid: "scared",
};

function valenceOf(core: CoreEmotion, word: string, ring: WheelRing): Valence {
  if (core === "happy") return 1;
  if (core !== "surprise") return -1;
  if (ring === "core") return 0;
  return SURPRISE_POSITIVE.has(word) ? 1 : -1;
}

function build(): WheelEntry[] {
  // Which words sit under more than one core decides which keys are qualified.
  const coresOf = new Map<string, Set<CoreEmotion>>();
  for (const core of CORE_EMOTIONS) {
    for (const [middle, outer] of TREE[core]) {
      for (const w of [middle, ...outer]) {
        const set = coresOf.get(w) ?? new Set<CoreEmotion>();
        set.add(core);
        coresOf.set(w, set);
      }
    }
  }
  const keyOf = (core: CoreEmotion, word: string): string =>
    (coresOf.get(word)?.size ?? 0) > 1 ? `${core}.${word}` : word;
  const out: WheelEntry[] = [];
  const seen = new Set<string>();
  for (const core of CORE_EMOTIONS) {
    out.push({ key: core, word: core, core, ring: "core", parent: null, valence: valenceOf(core, core, "core") });
    seen.add(core);
    const middles = new Set(TREE[core].map(([m]) => m));
    for (const [middle] of TREE[core]) {
      const key = keyOf(core, middle);
      const alsoUnder = TREE[core].find(([m, o]) => m !== middle && o.includes(middle))?.[0];
      out.push({
        key,
        word: middle,
        core,
        ring: "middle",
        parent: null,
        valence: valenceOf(core, middle, "middle"),
        ...(alsoUnder === undefined ? {} : { alsoUnder: keyOf(core, alsoUnder) }),
      });
      seen.add(key);
    }
    for (const [middle, outer] of TREE[core]) {
      for (const word of outer) {
        const key = keyOf(core, word);
        if (seen.has(key) || middles.has(word)) continue; // sad's `abandoned`: one key
        out.push({ key, word, core, ring: "outer", parent: keyOf(core, middle), valence: valenceOf(core, word, "outer") });
        seen.add(key);
      }
    }
    // The additions, after the poster's own words for this core.
    for (const a of ADDED) {
      if (a.core !== core) continue;
      if (seen.has(a.word) || coresOf.has(a.word)) throw new Error(`feelings wheel: addition "${a.word}" is already on the poster`);
      out.push({
        key: a.word,
        word: a.word,
        core,
        ring: "middle",
        parent: null,
        valence: a.valence,
        added: true,
        ...(a.alsoCore === undefined ? {} : { alsoCore: a.alsoCore }),
      });
      seen.add(a.word);
    }
  }
  // A second core on a poster word is an addition too, and says so.
  return out.map((e) => {
    const second = ADDED_SECOND_CORE[e.key];
    return second === undefined ? e : { ...e, alsoCore: second, secondCoreAdded: true as const };
  });
}

/** Every entry on the wheel, cores first within each core's block. */
export const FEELINGS_WHEEL: readonly WheelEntry[] = build();

const BY_KEY = new Map(FEELINGS_WHEEL.map((e) => [e.key, e]));

export function isCoreEmotion(value: unknown): value is CoreEmotion {
  return typeof value === "string" && (CORE_EMOTIONS as readonly string[]).includes(value);
}

export function wheelEntry(key: string): WheelEntry | undefined {
  return BY_KEY.get(key);
}

/**
 * Every core a recorded feeling counts under: its own, plus a blend's second
 * core. An `other` (or a key the wheel does not know) counts under the core it
 * was recorded with, and nothing else.
 */
export function coresOfFeeling(core: string, emotion: string): CoreEmotion[] {
  const entry = BY_KEY.get(emotion);
  const out: CoreEmotion[] = isCoreEmotion(core) ? [core] : [];
  if (entry !== undefined) {
    if (!out.includes(entry.core)) out.push(entry.core);
    if (entry.alsoCore !== undefined && !out.includes(entry.alsoCore)) out.push(entry.alsoCore);
  }
  return out;
}

/** A blend may be named under either of its cores. */
function underCore(e: WheelEntry, core: CoreEmotion): boolean {
  return e.core === core || e.alsoCore === core;
}

/** How an emotion as given reads against the wheel, under the core it was given with. */
export type EmotionResolution =
  /** On the wheel. `alias` is the writer's word when it was read AS this entry
   *  (`exposed` → `vulnerable`); absent when the word was the entry itself. */
  | { readonly kind: "wheel"; readonly entry: WheelEntry; readonly alias?: string }
  | { readonly kind: "wrong-core"; readonly entry: WheelEntry }
  | { readonly kind: "other"; readonly word: string; readonly closest: readonly string[] };

/**
 * Read `emotion` (a key or a bare word, any case) under `core`. A bare word the
 * wheel prints under two cores is qualified by `core`; a blend reads under
 * either of its cores; an alias reads as its wheel word; a word that is on the
 * wheel under a DIFFERENT core only is `wrong-core`; anything else is `other`,
 * with a suggestion only when one is genuinely close (`closestKeys`).
 */
export function resolveEmotion(core: CoreEmotion, emotion: string): EmotionResolution {
  const raw = emotion.trim().toLowerCase();
  const direct = BY_KEY.get(raw) ?? BY_KEY.get(`${core}.${raw}`);
  if (direct !== undefined) return underCore(direct, core) ? { kind: "wheel", entry: direct } : { kind: "wrong-core", entry: direct };
  const aliased = Object.hasOwn(ALIASES, raw) ? BY_KEY.get(ALIASES[raw] as string) : undefined;
  if (aliased !== undefined) {
    return underCore(aliased, core) ? { kind: "wheel", entry: aliased, alias: emotion.trim() } : { kind: "wrong-core", entry: aliased };
  }
  const elsewhere = FEELINGS_WHEEL.find((e) => e.word === raw);
  if (elsewhere !== undefined) return { kind: "wrong-core", entry: elsewhere };
  return { kind: "other", word: emotion.trim(), closest: closestKeys(core, raw) };
}

/** The sign a core leans: happy up, surprise either way, the other four down. */
function coreSign(core: CoreEmotion): Valence {
  return core === "happy" ? 1 : core === "surprise" ? 0 : -1;
}

/**
 * At most `n` wheel keys that `word` is GENUINELY close to under `core` — and
 * usually none. Close means a misspelling: edit distance 1, or 2 for a word of
 * six letters or more, against a wheel word or an alias. Only words that can be
 * written under `core` (its own, and blends that include it) are offered, and
 * never one whose valence opposes the core's — a writer who chose `sad` is not
 * steered to a happy word, nor the reverse. Nothing close: an empty list, and
 * the writer's own word stands.
 *
 * Replaced 2026-09-26 the "five nearest keys by raw edit distance", which
 * offered "tender" (under sad) bored, despair and lonely.
 */
export function closestKeys(core: CoreEmotion, word: string, n = 3): string[] {
  const w = word.trim().toLowerCase();
  if (w.length === 0) return [];
  const limit = w.length >= 6 ? 2 : 1;
  const sign = coreSign(core);
  const fits = (e: WheelEntry): boolean =>
    e.ring !== "core" &&
    underCore(e, core) &&
    // A blend belongs to this core by definition; any other word must lean
    // the core's way (surprise, sign 0, leans either).
    (e.alsoCore !== undefined || sign === 0 || e.valence === 0 || e.valence === sign);
  const best = new Map<string, number>();
  const offer = (key: string, d: number): void => {
    if (d > limit) return;
    const had = best.get(key);
    if (had === undefined || d < had) best.set(key, d);
  };
  for (const e of FEELINGS_WHEEL) if (fits(e)) offer(e.key, editDistance(w, e.word));
  for (const [alias, key] of Object.entries(ALIASES)) {
    const e = BY_KEY.get(key);
    if (e !== undefined && fits(e)) offer(key, editDistance(w, alias));
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([key]) => key);
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] as number;
      prev[j] = Math.min(up + 1, (prev[j - 1] as number) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length] as number;
}
