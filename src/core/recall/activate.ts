/**
 * Activation — from cues to a scored candidate set.
 *
 * Three channels, and the difference between them is the whole design:
 *
 *   **cue** (lexical, plus TEMPORAL) and **semantic** (embedding) are the
 *   CONVERSATION. Either one makes a memory a candidate at all.
 *
 *   A **temporal cue** — the calendar reached a window a memory remembers — is
 *   folded into the cue channel and into nothing else (SEAMS item D,
 *   `prospective/INTERFACE-GAPS.md` §1). It is "one more cue, like the user typing
 *   'Portland'": same map, same activation number, same background bar, and it
 *   COUNTS AS CUE in `cueFraction`, or hard gate (c) would silently change
 *   meaning. It is emphatically NOT the `arrival` channel below, which shares its
 *   English name and nothing else — wiring a temporal arrival into
 *   `ARRIVAL_WEIGHT` would turn a recency MULTIPLIER into an ADMISSION channel and
 *   break hard gate (a) for every dated memory.
 *   **arrival** (base-level strength) is RECENCY. It modulates a candidate that
 *   the conversation already reached, and it can never create one — which is how
 *   hard gate (a), *an uncued memory is dark whatever its salience*, is enforced
 *   structurally rather than checked: an uncued memory is not fetched, so its
 *   salience arithmetic is never evaluated (§9 G7a).
 *   **hops** (spreading activation, SEAMS item L) MODULATE a candidate the
 *   conversation reached, like arrival, and are excluded from `cueFraction`
 *   altogether — which is what makes "spreading never creates a loud-tier
 *   candidate without a cue" arithmetic rather than a promise. (Until
 *   2026-09-28 hop weight sat in the DENOMINATOR, which also let a hop push a
 *   well-cued memory under the loud tier's cue fraction: a hop can neither buy
 *   the loud tier nor revoke it.)
 *   **Quiet pointers** (association build 2, 2026-09-28 — working default).
 *   `associate/INTERFACE-GAPS.md` §1 named three answers for a hop that reaches
 *   "a memory no cue and no embedding touched"; build 1 took (a), modulate only,
 *   which kept hard gate (a) STRUCTURAL. This build takes (b): such a memory may
 *   join the turn as a footnote-tier POINTER — pattern completion, a partial cue
 *   recovering what goes with it — above `LINK_POINTER_MIN_FRACTION` of the
 *   strongest seed, `maxTier: "footnoted"`, marked `linkOnly`, carrying who
 *   passed it what (`linkedFrom`); the gate shows it only beside a memory the
 *   turn shows that passed it enough (the anchor), at most `LINK_POINTERS_MAX`
 *   a turn. Hard gate (a)
 *   is therefore CHECKED for this one lane rather than structural: the gate
 *   admits a `linkOnly` candidate to its own quiet slots and to nothing else,
 *   and every other uncued candidate is still dark.
 *
 * The candidate set is exactly the union of the token index's hits and the vector
 * index's hits. NO MODEL CALL: the turn's vector is an INPUT. Its absence degrades
 * to lexical-only, which is guarantee 1's precise v2 form — the ambient path may
 * consult an embedding, never a generative model, and must degrade rather than
 * fail.
 */
import type { Kind, MemoryPhysics } from "../types.js";
import { emotionalIntensity, sal, strength } from "../physics/index.js";
import type { Hit, ProseDoc, Store } from "../store/index.js";
import { confidentialByMeta, rowToPhysics, tokenize } from "../store/index.js";
import { buildCues, informativeness } from "./cues.js";
import type { Cue } from "./cues.js";
import type { RecallTunables, SemanticPath, SemanticTuning } from "./tunables.js";
import { semanticTuning } from "./tunables.js";
import { NO_MOOD, hasMood, moodLift } from "./mood.js";
import type { Mood } from "./mood.js";

export interface Candidate {
  readonly id: string;
  readonly kind: Kind;
  readonly doc: ProseDoc;
  readonly physics: MemoryPhysics;
  readonly strength: number;
  /** Salience as the GATE sees it: emotional dimension included only when the
   *  turn itself carries first-person feeling (§9 G10/G11 — emotion is
   *  turn-gated, and that gate is the safety property). */
  readonly sal: number;
  /** The part of `sal` that the current MOOD added (recall G18): 0 unless this
   *  candidate is cued and carried a feeling matching someone's mood. */
  readonly mood: number;
  readonly cue: number;
  /** The portion of `cue` that came from a temporal window (already included in
   *  `cue`; carried separately only so the ceiling below can be decided). */
  readonly temporal: number;
  readonly semantic: number;
  readonly arrival: number;
  /** Spreading activation from `associate/`. In `activation`, never in
   *  `cueFraction`'s numerator, and never able to mint a candidate. */
  readonly hops: number;
  readonly activation: number;
  /** (cue + semantic) / (cue + semantic + arrival) — hard gate (c)'s input. Hops are
   *  in neither half (2026-09-28). */
  readonly cueFraction: number;
  readonly matched: number;
  /** Every matching cue was an ambiguous handle and nothing corroborated it:
   *  it fires at reduced weight (already applied) and TRAINS NOTHING. */
  readonly trains: boolean;
  /** A per-candidate tier CEILING. `"footnoted"` for a candidate whose only cue
   *  is temporal: a remembered date may make a memory quietly available and must
   *  never make it loud (prospective §12 G5). Absent from the gate's other rules
   *  by design — it caps, it never admits. */
  readonly maxTier: "surfaced" | "footnoted";
  readonly confidential: boolean;
  /**
   * A QUIET POINTER (association build 2, 2026-09-28): a memory no cue and no
   * embedding reached, brought here ONLY by links from memories that were
   * (`associate/INTERFACE-GAPS.md` §1 answer (b), pattern completion). Its
   * `cue` and `semantic` are 0, its `hops` is what arrived, `maxTier` is
   * `footnoted`, and the gate gives it its own few slots in the quiet tier —
   * never the loud one. Absent on every candidate the conversation reached.
   */
  readonly linkOnly?: true;
  /** For a quiet pointer: which memories passed it activation, and how much
   *  (`associate` `Contribution.from`). The gate shows a pointer only when
   *  enough of it came from memories the turn SHOWS (2026-09-28). */
  readonly linkedFrom?: Readonly<Record<string, number>>;
}

/**
 * The injected traversal's shape, structurally `Associate.spreadFrom`. Only
 * `contributions` is required; the rest is what the traversal says about
 * ITSELF — how far it got and why it stopped — carried onto the turn's record
 * (`SpreadStats`) so nobody has to guess what spreading did (2026-09-28).
 */
export type SpreadFn = (
  seeds: readonly { id: string; activation: number }[],
  day: number,
) => {
  contributions: readonly { id: string; activation: number; from?: Readonly<Record<string, number>> }[];
  expanded?: number;
  stop?: string;
  depth?: number;
  waiting?: number;
};

/**
 * What spreading did on one turn — counts only (2026-09-28, association
 * build 1). `computed` is every memory the graph reached; `landed` is how many
 * of those were already candidates and so actually moved a number. Under hops
 * modulate only (`associate/INTERFACE-GAPS.md` §1 answer (a)) a seed receives
 * nothing, so on a turn with no semantic or temporal hit `landed` is 0 by
 * construction — that is the rule, not a fault.
 */
export interface SpreadStats {
  readonly seeds: number;
  readonly expanded: number | null;
  /** `exhausted` / `hop-limit` / `threshold` / `node-limit`, as the traversal
   *  reported it (`threshold` since the best-first walk, 2026-09-28). */
  readonly stop: string | null;
  /** Deepest hop expanded: 1 = seeds only, 2 = got past them. */
  readonly depth: number | null;
  /** When the node budget bound: nodes at or above the threshold still waiting
   *  (2026-09-28). Absent when the traversal did not say. */
  readonly waiting?: number;
  readonly computed: number;
  /** Contributions that landed on a candidate the cut KEPT (what the gate saw). */
  readonly landed: number;
  /** Candidates whose hop score the ceiling cut (`HOP_CEILING` × their own
   *  cue + semantic), and pointers held to `LINK_POINTER_CAP_FRACTION` of the
   *  strongest seed — 2026-09-28, counted rather than silent. */
  readonly hopsCapped: number;
  readonly pointersCapped: number;
  /**
   * The link-only half (association build 2, 2026-09-28). `linkOnly`: memories
   * the graph reached that no cue and no embedding did. `pointerCandidates`: of
   * those, the live ones at or above the pointer threshold
   * (`LINK_POINTER_MIN_FRACTION` of the strongest seed) — every one of them is
   * handed to the gate. What the gate did with them is on the decision, filled
   * in by `Recall.build`: `pointersShown` in the quiet tier, and
   * `pointersUnanchored` refused because too little of what reached them came
   * from a memory the turn shows. The rest (dedup, inhibition, the
   * `LINK_POINTERS_MAX` cap) are in the verdicts, by name.
   */
  readonly linkOnly: number;
  readonly pointerCandidates: number;
  readonly pointersShown?: number;
  readonly pointersUnanchored?: number;
}

export interface ActivationInput {
  readonly text: string;
  readonly vector?: readonly number[] | undefined;
  /** A ranking somebody else already computed — the lagged semantic cue the
   *  worker resolved one turn ago (`session.ts`). Supplied hits REPLACE the
   *  `nearestTo` scan; an empty array is "nothing was near", which degrades. */
  readonly hits?: readonly Hit[] | undefined;
  readonly carried?: readonly string[] | undefined;
  readonly aliases?: ReadonlyMap<string, readonly string[]> | undefined;
  /** Temporal cues from `prospective.arrivals()`: memory id and cue weight.
   *  Folded into `cueScore`, never into `arrival` (see the header). */
  readonly temporal?: readonly { id: string; weight: number }[] | undefined;
  /** INJECTED traversal (`Associate.spreadFrom`), because `recall/` must not
   *  import `associate/`. Seeded with the candidates the conversation reached —
   *  words AND meaning — and their own activation. A contribution to a
   *  candidate modulates it; a contribution to anything else may become a quiet
   *  pointer (bounded, thresholded, footnote tier only — 2026-09-28). */
  readonly spread?: SpreadFn | undefined;
  readonly day: number;
  /** Whether the turn stated a FIRST-PERSON feeling. Gates emotional salience. */
  readonly selfFelt: boolean;
  /** How each person feels now (`mood.ts#currentMood`). Absent: no mood. */
  readonly mood?: Mood | undefined;
  readonly maxCandidates: number;
  /** Live memory count, for informativeness and the cold-start regime. */
  readonly storeSize: number;
}

export interface ActivationResult {
  readonly cues: Cue[];
  readonly candidates: Candidate[];
  readonly storeSize: number;
  /** Candidates dropped before scoring because they are not live memory. */
  readonly skipped: number;
  /** True when a vector was supplied but the index answered nothing — the
   *  lexical-only degradation, recorded rather than silent. */
  readonly semanticDegraded: boolean;
  /** Documents whose cue sum hit the per-document ceiling (`CUE_DOC_CAP`).
   *  Reported, not recorded: it is the number `tools/recall-bench` reads to
   *  tell "the cap did the work" from "normalization did the work". It is
   *  deliberately NOT a `RecallDecision` field — that record's field list is a
   *  hashed surface set the parallel run carries ratings across, and a new
   *  column there would invalidate a live instrument mid-run. */
  readonly capped: number;
  /**
   * Which semantic calibration this pass used — the recorded identity, the path,
   * and the floor/weight `semanticTuning` chose — or null when no semantic input
   * came at all. Reported, not recorded (the same reason as `capped`).
   */
  readonly semantic: { identity: string | null; path: SemanticPath; floor: number; weight: number } | null;
  /** What spreading did this turn; null when it did not run (no traversal
   *  injected, or nothing was cued to seed it). */
  readonly spread: SpreadStats | null;
  /** Scored candidates the `maxCandidates` cut left out — counted, never
   *  silent (2026-09-28). */
  readonly dropped: number;
}

/**
 * THE SELF PAGE IS NOT A RECALL CANDIDATE (2026-09-18, S1).
 *
 * The page is `self/`'s one row of standing prose about the self, and it is
 * already delivered — whole, first, at every wake. Leaving it in the candidate
 * pool means it can be quoted back to the model on a turn it is ALSO carrying in
 * its own wake, can accrue use credit and association edges for being what it
 * always is, and — since a schema row has no project scope — can surface under a
 * project the owner never wrote it in. It is up to 16 KB against a bounded
 * result, and it is the one row whose surfacing tells the reader nothing they
 * were not already told.
 *
 * The role string is read STRUCTURALLY rather than imported: `recall/` does not
 * depend on `self/`, and a shape check that fails reads as "not the page", which
 * is the direction that only ever costs a candidate slot. The owner of the
 * constant is `self/page.ts#SELF_PAGE_ROLE`.
 *
 * One line to reverse, if the page should come back to mind.
 */
export function isSelfPage(doc: ProseDoc): boolean {
  return doc.type === "schema" && doc.meta["role"] === "page";
}

/** `isSelfPage` by id, for the scan, which holds rows rather than documents. A
 *  page whose prose will not read is not the page for this purpose: the safe
 *  direction is to let it compete, not to drop a row nobody could identify. */
function isPageRow(store: Store, id: string): boolean {
  try {
    return isSelfPage(store.readProse(id));
  } catch {
    return false;
  }
}

/**
 * THE PER-DIRECTORY HANDOFF IS NOT A RECALL CANDIDATE (2026-09-20, E1).
 *
 * A handoff is working context for one directory — "what I was doing here" —
 * delivered as a pointer at the wake of that directory and expandable by id
 * from there. It is not an interpretation of what was learned, it carries no
 * project scope a search could honour, and it expires. Surfacing one inside a
 * turn would put another directory's unfinished business in front of this one.
 *
 * Read STRUCTURALLY for `isSelfPage`'s reason: `recall/` depends on no other
 * core module, and a shape check that fails reads as "not a handoff", which only
 * ever costs a candidate slot. The constant's owner is
 * `handoff/index.ts#HANDOFF_ROLE`.
 */
export function isHandoff(doc: ProseDoc): boolean {
  return doc.type === "schema" && doc.meta["role"] === "handoff";
}

/** `isHandoff` by id, for the scan. */
function isHandoffRow(store: Store, id: string): boolean {
  try {
    return isHandoff(store.readProse(id));
  } catch {
    return false;
  }
}

/**
 * A memory's confidentiality class, as the surfacing gate asks it.
 *
 * The truth table itself is `store/index.ts#confidentialByMeta`, which is also
 * what `StoredMemory.confidential` carries — one answer, so a caller holding a
 * `StoredMemory` and a caller holding a bare `ProseDoc` can never disagree. This
 * wrapper is the door for the second kind (`dashboard/web/reveal.ts`,
 * `mcp/deliberate.ts`); prefer the flag where a read already produced one.
 */
export function isConfidential(doc: ProseDoc): boolean {
  return confidentialByMeta(doc.meta);
}

/**
 * Salience with the emotional dimension gated on the turn (§9 G10). When the
 * turn carries first-person feeling, the dimension reads as the memory's full
 * emotional INTENSITY — the stronger of its numeric score and its recorded
 * feelings (physics §5.10) — so a memory that holds its feeling in the
 * `feelings` table is not read as unfelt. Otherwise it is 0, as before.
 */
export function gatedSal(p: MemoryPhysics, selfFelt: boolean): number {
  if (selfFelt) return sal({ ...p.salience, emotional: emotionalIntensity(p) });
  return sal({ ...p.salience, emotional: 0 });
}

export function activate(
  store: Store,
  input: ActivationInput,
  t: RecallTunables,
): ActivationResult {
  const storeSize = input.storeSize;

  // ── the token channel: one index probe per distinct cue token ────────────
  const searchTokens: string[] = [];
  const seenTok = new Set<string>();
  for (const tok of tokenize(input.text)) {
    if (tok.length < t.MIN_CUE_LENGTH || seenTok.has(tok)) continue;
    seenTok.add(tok);
    searchTokens.push(tok);
    if (searchTokens.length >= t.MAX_CUES * 3) break;
  }
  for (const tok of input.carried ?? []) {
    if (tok.length < t.MIN_CUE_LENGTH || seenTok.has(tok)) continue;
    seenTok.add(tok);
    searchTokens.push(tok);
  }

  // ── rarity FIRST, postings second ───────────────────────────────────────
  //
  // The order is the fix. This pass used to probe the index for every search
  // token and take `df = hits.length` — but `hits` is a top-`PER_CUE_FETCH`,
  // and a bounded top-K's length is `min(trueDf, K)`, never a document
  // frequency. On a 15,421-document index that made every word occurring in 24
  // or more memories measure as equally rare: `the` and `conversation` drew
  // `informativeness` 5.7 against a ceiling of 8.95 where their true
  // frequencies put them at 0-3. §9 G4's "informativeness weighting replaces
  // stop-lists" was therefore true on a fixture (where `trueDf` cannot reach K)
  // and false on the live store — the rule silently switched off as the store
  // grew. `store.docFrequency` counts instead of measuring a limit.
  //
  // Asking for rarity first also means the index is probed only for the tokens
  // that BECAME cues (at most `MAX_CUES`), rather than for every candidate
  // token (up to `MAX_CUES * 3`). Nothing downstream reads a non-cue's
  // postings, so that is an equivalence and strictly less work — it pays for
  // the df query several times over.
  const df = store.docFrequency(searchTokens);

  const cues = buildCues(
    {
      text: input.text,
      carried: input.carried ?? [],
      ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
      storeSize,
      df,
    },
    t,
  );

  /**
   * token -> (memoryId -> the token's LENGTH-NORMALIZED evidence in that
   * document). The store applies the normalization before its own
   * `ORDER BY … LIMIT`, so what arrives here is both scored and SELECTED
   * length-fairly; re-ranking a raw-tf top-24 in this file would have left the
   * long documents holding every slot (see `store/cache.ts#searchIndex`).
   */
  const postings = new Map<string, Map<string, number>>();
  const norm = {
    k1: t.CUE_TF_SATURATION,
    b: t.CUE_LENGTH_NORM,
    oneSided: t.CUE_LENGTH_ONE_SIDED,
  };
  for (const cue of cues) {
    if (postings.has(cue.token)) continue;
    const byDoc = new Map<string, number>();
    for (const h of store.search(cue.token, t.PER_CUE_FETCH, norm)) byDoc.set(h.id, h.score);
    postings.set(cue.token, byDoc);
  }

  const cueScore = new Map<string, number>();
  const matchCount = new Map<string, number>();
  const unambiguousMatch = new Set<string>();
  /** The single strongest cue each document received — the cap's yardstick. */
  const bestCue = new Map<string, number>();
  for (const cue of cues) {
    const byDoc = postings.get(cue.token);
    if (byDoc === undefined) continue;
    for (const [id, evidence] of byDoc) {
      // `evidence` already carries the tf saturation AND the length
      // normalization, applied by the index (`store/cache.ts#searchIndex`).
      // Applying `tfFactor` again here would saturate a saturated number.
      const add = cue.weight * evidence;
      if (add <= 0) continue;
      cueScore.set(id, (cueScore.get(id) ?? 0) + add);
      bestCue.set(id, Math.max(bestCue.get(id) ?? 0, add));
      matchCount.set(id, (matchCount.get(id) ?? 0) + 1);
      if (!cue.ambiguous) unambiguousMatch.add(id);
    }
  }

  // ── the per-document ceiling ────────────────────────────────────────────
  // Length normalization damps how loudly ONE cue speaks for a long memory; it
  // does not stop a memory that mentions everything from being touched by
  // twenty cues at once. This is the second half of the same rule: a document's
  // cue evidence may reach `CUE_DOC_CAP` times its own strongest single cue and
  // no further. Three converging cues is corroboration; twenty is coverage, and
  // coverage is a property of the document rather than of the turn.
  //
  // It is applied HERE, to the lexical sum only — before the temporal channel
  // adds to the same map. A temporal cue is id-addressed and has no length, so
  // capping it would be capping the calendar.
  let capped = 0;
  if (t.CUE_DOC_CAP > 0 && Number.isFinite(t.CUE_DOC_CAP)) {
    for (const [id, sum] of cueScore) {
      const ceiling = (bestCue.get(id) ?? 0) * t.CUE_DOC_CAP;
      if (sum > ceiling) {
        cueScore.set(id, ceiling);
        capped += 1;
      }
    }
  }

  // ── the temporal channel: the same map, so one activation number ────────
  // A temporal cue can CREATE a candidate (that is what a cue is) and is counted
  // as cue by `cueFraction` below. Its ceiling is applied when the candidate is
  // assembled, not here — this stage scores, it does not decide tiers.
  //
  // The weight arrives in CUE UNITS and is converted here, for the same reason
  // the gate's floors are: `prospective.CUE_STRENGTH` is 0.5 on v1's normalized
  // scale, and v2's cue channel is a sum of idf x evidence whose size grows with
  // the store. Left absolute, a temporal cue would be worth 0.23 of a
  // maximally-rare word on a seventeen-memory store and 0.056 of one on a
  // fifteen-thousand-memory store — the calendar going quiet as the owner
  // remembers more, which is the exact shape of scar §2.8 in the other
  // direction. Converted, `CUE_STRENGTH` finally means what its comment says:
  // *one more cue, like the user typing "Portland"* — half of one, at full ramp.
  const temporalScore = new Map<string, number>();
  const cueUnit = informativeness(1, storeSize);
  for (const t0 of input.temporal ?? []) {
    if (!(t0.weight > 0)) continue;
    const w = t0.weight * cueUnit;
    temporalScore.set(t0.id, (temporalScore.get(t0.id) ?? 0) + w);
    cueScore.set(t0.id, (cueScore.get(t0.id) ?? 0) + w);
  }

  // ── the embedding channel: an INPUT, never a fetched one ────────────────
  //
  // TWO ways in, one scoring rule. `vector` is the caller's own embedding and
  // this pass ranks it (the deliberate ask, which has no latency budget);
  // `hits` is a ranking somebody else already did — the detached worker, one
  // turn ago (`session.ts`, the lagged semantic cue), because the RANK is what
  // costs 600-1000 ms on a live-sized index, not the arithmetic below. Supplied
  // hits win: a caller that has both meant the resolved one.
  const semScore = new Map<string, number>();
  let semanticDegraded = false;
  const ranked: readonly Hit[] | null =
    input.hits !== undefined
      ? input.hits
      : input.vector !== undefined && input.vector.length > 0
        ? store.nearestTo(input.vector, t.SEMANTIC_TOP_M)
        : null;
  // PER-EMBEDDER, PER-PATH (2026-09-23): the floor and weight are chosen for
  // the model box 3 RECORDS — read fresh from the file at every activation
  // (`Store.rankingIdentity`) — on the path this ranking came by: a static
  // table's cosines sit lower and closer together than Voyage's, and a lagged
  // cue can be about the previous subject (`tunables.ts`). A lagged row ranked
  // under another model never reaches here: `loadSessionSemantic` answers
  // `other-model` for it.
  const path: SemanticPath = input.hits !== undefined ? "lagged" : "inline";
  const identity = recordedIdentity(store);
  const tuning: SemanticTuning = semanticTuning(t, identity, path);
  if (ranked !== null) {
    if (ranked.length === 0) semanticDegraded = true;
    const floor = tuning.floor;
    for (const h of ranked.slice(0, t.SEMANTIC_TOP_M)) {
      if (h.score < floor) continue;
      const scaled = floor >= 1 ? h.score : (h.score - floor) / (1 - floor);
      semScore.set(h.id, tuning.weight * scaled);
    }
  }

  // ── assemble: only live, resolvable, non-removed memory ─────────────────
  const denied = new Set(store.deniedIds());
  const ids = new Set<string>([...cueScore.keys(), ...semScore.keys()]);

  // Two passes: SCORE from box 2, then READ the survivors' prose.
  //
  // Every number in the sort key — cue, semantic, arrival, hops — is available
  // from the operational row alone. The prose body is not in that row, and is
  // needed only for the confidentiality class and for whatever the renderer
  // prints. So the ranking happens first and the FILE READS happen only for the
  // candidates that survive `maxCandidates`.
  //
  // This is an equivalence, not a heuristic: same candidates, same order, same
  // `skipped` count. It is here because length normalization widened the union
  // of the token index's hits by an order of magnitude — the old scorer's nine
  // hubs occupied most of every cue's top-`PER_CUE_FETCH`, so the union was
  // small by ACCIDENT, and the accident was the bug. Reading a prose file for
  // each of ~1,000 ids and discarding all but 24 measured ~600 ms of a 1200 ms
  // budget on the live store; it is now 24 reads whatever the union's width.
  interface Scored {
    readonly id: string;
    readonly physics: MemoryPhysics;
    readonly strength: number;
    /** The turn-gated salience the cut's key divides by. */
    readonly sal: number;
    readonly cue: number;
    readonly temporal: number;
    readonly semantic: number;
    readonly arrival: number;
    readonly hops: number;
    readonly activation: number;
    /** The rank the cut uses: activation over the gate's own salience factor. */
    readonly cutKey: number;
  }
  /** The row, when this id is live memory that may be recalled at all; the
   *  same test for a candidate and for a link-only pointer. */
  const recallable = (id: string): ReturnType<Store["row"]> => {
    if (denied.has(id)) return undefined;
    const row = store.row(id);
    // Archive is a state, not a deletion: it keeps its id and simply never
    // surfaces (§4.2 G3). A superseded head forwards; the successor is reached
    // on its own merits, never by dragging the old id along.
    if (row === undefined || row.archived === 1 || row.superseded_by !== null) return undefined;
    // The self page, which is delivered at wake and never here (`isSelfPage`).
    // The prose read is gated on the row's own columns, so only a SCHEMA row of
    // the self kind pays for it — the page, the identity core, and the handful
    // of beliefs held about the self.
    if (row.type === "schema" && row.kind === "self" && isPageRow(store, id)) return undefined;
    // The per-directory handoff (E1), for the page's reason and one of its own:
    // it is already delivered as a pointer at the wake of the directory it
    // belongs to, and it has no project scope of its own that a search could
    // honour — so left in the pool it would surface one directory's working
    // context inside another's turn. Gated on the row's own columns, as above,
    // so only a SCHEMA row of the place kind pays for the prose read.
    if (row.type === "schema" && row.kind === "place" && isHandoffRow(store, id)) return undefined;
    return row;
  };
  let scored: Scored[] = [];
  let skipped = 0;
  for (const id of ids) {
    const row = recallable(id);
    if (row === undefined) {
      skipped += 1;
      continue;
    }
    const physics = rowToPhysics(row);
    const cue = cueScore.get(id) ?? 0;
    const temporal = temporalScore.get(id) ?? 0;
    const semantic = semScore.get(id) ?? 0;
    const s = strength(physics, input.day);
    const arrival = cue + semantic > 0 ? t.ARRIVAL_WEIGHT * s : 0;
    const activation = cue + semantic + arrival;
    const gatedS = gatedSal(physics, input.selfFelt);
    scored.push({
      id,
      physics,
      strength: s,
      sal: gatedS,
      cue,
      temporal,
      semantic,
      arrival,
      hops: 0,
      activation,
      cutKey: salienceRank(activation, gatedS, t),
    });
  }
  // SALIENCE BEFORE THE CUT (2026-09-28). The gate lowers a salient candidate's
  // relative bar and raises a dull one's (`gate.ts#modulate`), but it can only
  // do that for candidates that reach it — and the cut to `maxCandidates` used
  // to rank on activation alone, so a salient memory ranked 25th never met the
  // bar that would have let it in. The cut now ranks by what the gate will ask
  // of it: activation over the gate's own salience factor. Mood's lift is NOT
  // in this key — it needs the feelings read, which stays after the cut (below);
  // the turn-gated emotional dimension is.
  //
  // Only where the gate WILL modulate: the relative regime. On a cold-start
  // store, or a turn too thin for a background (`gate.ts#background`), the bar
  // is absolute and salience never lowers it — ranking by salience there would
  // let a quieter memory displace the one the absolute bar would admit, and
  // cold start is stricter, not looser. The regime test mirrors
  // `gate.ts#background`: the gate's sample is the kept candidates with
  // `cue + semantic > 0` (at most `maxCandidates` of them), and a sample with
  // no spread (sd 0) is thin too. Estimated here on the cued candidates an
  // activation-ranked cut would keep.
  const rankForCut = (list: Scored[]): void => {
    const sample = list
      .filter((c) => c.cue + c.semantic > 0)
      .map((c) => c.activation)
      .sort((x, y) => y - x)
      .slice(0, input.maxCandidates);
    const relative = storeSize >= t.COLD_START_MIN_STORE && sample.length >= t.MIN_BACKGROUND_SAMPLE && spreadOf(sample) > 0;
    list.sort((a, b) =>
      relative
        ? b.cutKey - a.cutKey || b.activation - a.activation || (a.id < b.id ? -1 : 1)
        : b.activation - a.activation || (a.id < b.id ? -1 : 1),
    );
  };
  rankForCut(scored);

  // ── the hop channel (SEAMS item L) ──────────────────────────────────────
  // The SEEDS are the strongest candidates the CONVERSATION reached — words
  // AND meaning (2026-09-28: a semantic hit is as much "what this turn is
  // about" as a cued one) — ranked the way the cut ranks, the top
  // `SPREAD_SEEDS` of them, each with its own activation. Not the whole union:
  // on a big store the union is ~1,000 ids, most of them one weak word away
  // from the turn, and seeding from all of it spread their neighbourhoods
  // instead of the turn's.
  //
  // A seed receives no contribution of its own — a round trip a→b→a would
  // hand a memory its own activation back as new evidence (associate NOTES
  // §6). So what the graph adds goes to two places: a candidate that is NOT a
  // seed (ranked past `SPREAD_SEEDS`; the contribution may lift it into the
  // cut), and a memory that is not a candidate at all (`linkOnly` — a possible
  // quiet pointer, below). Inside the seeds, links do not reorder: that is the
  // conversation's to decide.
  const linkOnlyScore = new Map<string, number>();
  /** Who passed each link-only memory what (`Contribution.from`), for the anchor. */
  const linkOnlyFrom = new Map<string, Readonly<Record<string, number>>>();
  let strongestSeed = 0;
  let hopsCapped = 0;
  let spreadRun: Omit<SpreadStats, "landed" | "pointerCandidates" | "hopsCapped" | "pointersCapped"> | null = null;
  if (input.spread !== undefined && scored.length > 0) {
    const seeds = scored
      .filter((c) => c.cue + c.semantic > 0)
      .slice(0, t.SPREAD_SEEDS)
      .map((c) => ({ id: c.id, activation: c.activation }));
    const seedIds = new Set(seeds.map((s) => s.id));
    for (const s of seeds) strongestSeed = Math.max(strongestSeed, s.activation);
    const out = input.spread(seeds, input.day);
    const hopScore = new Map<string, number>();
    for (const c of out.contributions) {
      if (!(c.activation > 0) || seedIds.has(c.id)) continue;
      // A candidate is modulated; anything else is link-only. Whether a
      // link-only memory is SHOWN is decided below, after the cut — it has to
      // be live, above the threshold, and among the few.
      if (ids.has(c.id)) hopScore.set(c.id, (hopScore.get(c.id) ?? 0) + c.activation);
      else {
        linkOnlyScore.set(c.id, (linkOnlyScore.get(c.id) ?? 0) + c.activation);
        if (c.from !== undefined) linkOnlyFrom.set(c.id, c.from);
      }
    }
    if (hopScore.size > 0) {
      scored = scored.map((c) => {
        const raw = c.cue + c.semantic > 0 ? hopScore.get(c.id) ?? 0 : 0;
        if (raw === 0) return c;
        // THE CEILING (2026-09-28, association build 2): "links suggest, they
        // don't take over", as arithmetic. Contributions sum over every path,
        // so a memory many seeds point at could gather a hop score out of
        // proportion to its own evidence; it is capped at `HOP_CEILING` times
        // what the conversation gave it (cue + semantic), and every cap is
        // counted (`hopsCapped`).
        const ceiling = t.HOP_CEILING * (c.cue + c.semantic);
        const hops = Math.min(raw, ceiling);
        if (raw > ceiling) hopsCapped += 1;
        const activation = c.activation + hops;
        return { ...c, hops, activation, cutKey: salienceRank(activation, c.sal, t) };
      });
      rankForCut(scored);
    }
    spreadRun = {
      seeds: seeds.length,
      expanded: typeof out.expanded === "number" ? out.expanded : null,
      stop: typeof out.stop === "string" ? out.stop : null,
      depth: typeof out.depth === "number" ? out.depth : null,
      computed: out.contributions.length,
      ...(typeof out.waiting === "number" ? { waiting: out.waiting } : {}),
      linkOnly: linkOnlyScore.size,
    };
  }

  const kept = scored.slice(0, input.maxCandidates);
  const dropped = scored.length - kept.length;
  // MOOD (recall G18): one batched read, and only when someone has a mood — and only
  // for CUED candidates. An uncued candidate is dark at hard gate (a) before
  // salience is ever read, so it is not even asked (the guarantee is the gate's;
  // this just declines to do work the gate would throw away).
  const mood = input.mood ?? NO_MOOD;
  const feelingsById = hasMood(mood)
    ? store.feelingsOn(kept.filter((c) => c.cue + c.semantic > 0).map((c) => c.id))
    : new Map<string, never[]>();
  const candidates: Candidate[] = [];
  for (const c of kept) {
    const { id, physics, cue, temporal, semantic, arrival, hops, activation } = c;
    const lift = cue + semantic > 0 ? moodLift(feelingsById.get(id), mood, input.day, t) : 0;
    const gated = gatedSal(physics, input.selfFelt);
    // `readProse` is `read().doc`, so taking the whole read costs nothing and
    // brings the confidentiality flag with it instead of re-deriving it.
    const stored = store.read(id);
    const doc = stored.doc;
    candidates.push({
      id,
      kind: physics.kind,
      doc,
      physics,
      strength: c.strength,
      // The mood lift rides salience only: it can lower this candidate's
      // relative bar, never raise its activation or admit it uncued.
      sal: Math.min(1, gated + lift),
      mood: Math.min(1, gated + lift) - gated,
      cue,
      temporal,
      semantic,
      arrival,
      hops,
      activation,
      // Hops are in NEITHER half (2026-09-28): they can raise a candidate's
      // standing, can never buy it the loud tier, and can no longer REVOKE it
      // either — with hops in the denominator, a neighbour's activation could
      // push a well-cued memory under `MIN_CUE_FRACTION` and footnote it.
      cueFraction: cue + semantic + arrival > 0 ? (cue + semantic) / (cue + semantic + arrival) : 0,
      matched: matchCount.get(id) ?? 0,
      // A temporal cue is id-addressed: no handle is involved, so nothing about
      // it is ambiguous, and an unambiguous cue trains. Without this clause a
      // temporal-only surface would be refused as "ambiguous-handle-trains-
      // nothing" — a true refusal under a false name (scar §2.4).
      trains: unambiguousMatch.has(id) || semantic > 0 || temporal > 0,
      // §12 G5: temporal ALONE reaches the footnote tier at most.
      maxTier: temporal > 0 && cue - temporal <= 0 && semantic <= 0 ? "footnoted" : "surfaced",
      confidential: stored.confidential,
    });
  }

  // ── quiet pointers: pattern completion, held to a few (2026-09-28) ──────
  // A memory the words and the meaning did not reach, that the graph did. It
  // is handed to the gate as a possible footnote-tier pointer when it is live,
  // recallable memory and the activation that arrived is at least
  // `LINK_POINTER_MIN_FRACTION` of the strongest seed's — the first cut, and
  // every one of those goes to the gate. The gate decides which are SHOWN: only
  // one a memory the turn shows passed enough to (the anchor, `gate.ts`), then
  // confidentiality, dedup, inhibition, `LINK_POINTERS_MAX`. What the threshold
  // left out is counted on the turn's record (`linkOnly` against
  // `pointerCandidates`), never cut silently.
  const threshold = strongestSeed * t.LINK_POINTER_MIN_FRACTION;
  const pool = [...linkOnlyScore]
    .filter(([, a]) => a >= threshold)
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  let pointerCandidates = 0;
  let pointersCapped = 0;
  // A pointer's own, smaller ceiling (2026-09-28): whatever arrived, it carries
  // at most `LINK_POINTER_CAP_FRACTION` of the strongest seed — ranked by what
  // arrived, recorded at the cap, and the cap counted (`pointersCapped`).
  const pointerCap = strongestSeed * t.LINK_POINTER_CAP_FRACTION;
  for (const [id, arrived] of pool) {
    const row = recallable(id);
    if (row === undefined) continue;
    pointerCandidates += 1;
    const carried = Math.min(arrived, pointerCap);
    if (arrived > pointerCap) pointersCapped += 1;
    const physics = rowToPhysics(row);
    const stored = store.read(id);
    candidates.push({
      id,
      kind: physics.kind,
      doc: stored.doc,
      physics,
      strength: strength(physics, input.day),
      // No mood lift: mood modulates what the conversation reached, and this
      // is not that (recall G18).
      sal: gatedSal(physics, input.selfFelt),
      mood: 0,
      cue: 0,
      temporal: 0,
      semantic: 0,
      arrival: 0,
      hops: carried,
      activation: carried,
      cueFraction: 0,
      matched: 0,
      // A link is an id, not an ambiguous handle: an expansion of a pointer is
      // a use like any other, and it is what confirms the link.
      trains: true,
      maxTier: "footnoted",
      confidential: stored.confidential,
      linkOnly: true,
      linkedFrom: linkOnlyFrom.get(id) ?? {},
    });
  }

  return {
    cues,
    candidates,
    storeSize,
    skipped,
    semanticDegraded,
    capped,
    semantic: ranked === null ? null : { identity, path, floor: tuning.floor, weight: tuning.weight },
    // `landed` is counted AFTER the cut: a hop on a candidate the cut left out
    // reached nothing the gate saw.
    spread:
      spreadRun === null
        ? null
        : {
            ...spreadRun,
            landed: kept.filter((c) => c.hops > 0).length,
            hopsCapped,
            pointerCandidates,
            pointersCapped,
          },
    dropped,
  };
}

/** Population standard deviation — the gate's own (`gate.ts#background`). */
function spreadOf(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / xs.length);
}

/**
 * The cut's rank: activation divided by the factor the gate's relative bar is
 * multiplied by (`gate.ts#modulate`, `1 − SAL_BAR_WEIGHT·(2·sal − 1)`), so the
 * order the cut keeps is the order in which candidates would clear that bar.
 * Guarded so a tunable pushing the factor to zero ranks by activation alone.
 */
export function salienceRank(activation: number, sal: number, t: RecallTunables): number {
  const factor = 1 - t.SAL_BAR_WEIGHT * (2 * sal - 1);
  return factor > 0 ? activation / factor : activation;
}

/**
 * The identity box 3 records for its vectors, read FRESH from the file at every
 * activation (`Store.rankingIdentity`: one primary-key read) — the tag, when
 * this handle may rank against it; null when it may not (a hold, a newer
 * build's cache, a file now another identity's) or when nothing is recorded.
 * Null means the defaults, and in the refused cases the ranking is empty anyway.
 *
 * Fresh, not the handle's open-time verdict (keyless/recall-tune review MINOR 2):
 * a handle whose open was `deferred` by a lost lock, or one with no identity of
 * its own, still ranks real vectors — and gets the calibration of the model
 * that wrote them.
 */
export function recordedIdentity(store: Store): string | null {
  return store.rankingIdentity();
}
