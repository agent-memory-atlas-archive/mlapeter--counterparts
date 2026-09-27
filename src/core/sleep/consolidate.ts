/**
 * Consolidation, and the ONE place identity promotion happens.
 *
 * Redesigned 2026-09-26 with the owner (dreaming + consolidation). Two jobs:
 *
 * 1. **The LEGACY consolidation marking.** Until schema v8 a memory that had
 *    survived a lived day at or above the semantic floor was marked
 *    `consolidated`, worth a one-time `+CONS_BONUS` to `base` for the rest of
 *    its life. That path is now open ONLY to memories born before the upgrade
 *    (`legacy`, physics §5.2) — exactly the rows that had it — so the upgrade
 *    moves nothing down a band and prunes nothing sooner. Every memory made
 *    since earns durability from RETURNS instead (physics §5.11): each spaced
 *    return slows its fading, credited at the moment of the use (or of a
 *    dream's replay), not here. The criterion is still physics'
 *    (`consolidationEligibility`), and a post-upgrade memory is refused
 *    `not-legacy` by it.
 *
 * 2. **Core promotion — HERE AND ONLY HERE**, now by LANES (physics §5.3):
 *    only a memory about me or about us (`self`, or a `person` memory about the
 *    owner) can become core, by the fast lane (strongly felt, and it came back
 *    after a gap) or the slow lane (it kept coming back over weeks). Physics
 *    decides eligibility; this phase decides who is ABOUT ME (it can read the
 *    words and the owner's names), honours the owner's demotions, and caps the
 *    night at `CORE_MAX_PER_SLEEP`, strongest first — the rest wait for the
 *    next consolidation. The crossing is an EXPLICIT, COUNTED EVENT with a
 *    persisted record carrying its lane, never an emergent side effect of a
 *    number drifting past a line (scar §2.4). Nothing is born into identity;
 *    this and revision inheritance are the only two doors, and a dream's
 *    nomination is not one (`core/dream/`).
 *
 * Arithmetic only: this phase never calls a model.
 */

import { consolidationEligibility, promote, strength } from "../physics/index.js";
import type { PromotionCrossing, PromotionReason } from "../physics/index.js";
import { rowToPhysics } from "../store/operational.js";
import type { MemoryRow } from "../store/operational.js";
import { readCursor, resumeIndex, writeCursor } from "./markers.js";
import { PROMOTION_RECORD_PREFIX, TUNABLES } from "./tunables.js";
import type { Phase, PhaseCtx, PhaseOutcome, PromotionRecord, SleepStore } from "./types.js";

/** The two reads "who is this about" needs — a read-only store has both. */
export type ReadsDocs = Pick<SleepStore, "list" | "read">;
import { countSkip, emptyOutcome, isJournal } from "./types.js";

/** This phase's own name, for the cursor it keeps. Typed, so a rename in the
 *  phase vocabulary fails `tsc` here rather than reading an empty cursor. */
const CONSOLIDATE_PHASE: Phase = "consolidate";

export const CONSOLIDATION_SKIPS = [
  // The three housekeeping entries. The rest of this list IS physics' reason
  // vocabulary, so a reason cannot drift between the two.
  "archived",
  "removed",
  "journal",
  "not-legacy",
  "already-consolidated",
  "born-today",
  "below-semantic-floor",
] as const;

export type ConsolidationSkip = (typeof CONSOLIDATION_SKIPS)[number];

export interface ConsolidateResult extends PhaseOutcome {
  readonly consolidated: readonly string[];
  readonly promoted: readonly PromotionRecord[];
  /** Every blocking promotion reason, counted. "Never asked" is not "refused". */
  readonly promotionBlocked: Readonly<Record<string, number>>;
}

export function promotionRecordKey(id: string): string {
  return `${PROMOTION_RECORD_PREFIX}${id}`;
}

/**
 * Is this the SELF PAGE's row? Read structurally rather than by importing
 * `self/page.ts` — `sleep/` depends on nothing in `self/`, and a shape check
 * that fails reads as "not the page", which is master's behaviour and therefore
 * the safe direction. The role string's owner is `self/page.ts#SELF_PAGE_ROLE`.
 */
function isThePage(store: PhaseCtx["store"], id: string): boolean {
  try {
    return store.read(id).doc.meta["role"] === "page";
  } catch {
    return false;
  }
}

/**
 * The OWNER's names, read off the identity core — the one `kind: "self"`
 * schema row with `role: "entity"`, which install seeds with the owner's name
 * (`self/identity.ts#IDENTITY_CORE_ROLE`, `init --name`). Read structurally for
 * `isThePage`'s reason. Lower-cased; empty when no core was ever named, and then
 * no `person` memory can be told to be about him and only `self` qualifies.
 */
export function ownerNames(store: ReadsDocs): string[] {
  const out: string[] = [];
  for (const id of store.list({ type: "schema", kind: "self", archived: false })) {
    try {
      const meta = store.read(id).doc.meta;
      if (meta["role"] !== "entity") continue;
      const add = (v: unknown): void => {
        if (typeof v === "string" && v.trim().length >= 2) out.push(v.trim().toLowerCase());
      };
      add(meta["name"]);
      const aliases = meta["aliases"];
      if (Array.isArray(aliases)) for (const a of aliases) add(a);
    } catch {
      continue;
    }
  }
  return [...new Set(out)];
}

/** Does `text` name any of `names` as a whole word (case-insensitive)? */
function names(text: string, owner: readonly string[]): boolean {
  const lower = text.toLowerCase();
  for (const n of owner) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(lower)) return true;
  }
  return false;
}

/**
 * IS THIS MEMORY ABOUT ME OR ABOUT US? — the core's first question (owner
 * decision 2026-09-26). `self` kind always is. A `person` memory is when it
 * names the owner (title, body, or its `name` / `entity` meta); a person memory
 * about somebody else is not, and a `fact` that merely mentions him never is,
 * whatever it says. Everything else is not.
 */
export function aboutMe(store: ReadsDocs, row: Pick<MemoryRow, "id" | "kind">, owner: readonly string[]): boolean {
  if (row.kind === "self") return true;
  if (row.kind !== "person" || owner.length === 0) return false;
  try {
    const doc = store.read(row.id).doc;
    const meta = doc.meta;
    const fields = [doc.title ?? "", doc.body, String(meta["name"] ?? ""), String(meta["entity"] ?? "")];
    return fields.some((f) => f.length > 0 && names(f, owner));
  } catch {
    return false;
  }
}

export function runConsolidate(ctx: PhaseCtx): ConsolidateResult {
  const out = emptyOutcome();
  for (const skip of CONSOLIDATION_SKIPS) out.skipped[skip] = 0;
  const promotionBlocked: Record<string, number> = {};
  const consolidated: string[] = [];
  const promoted: PromotionRecord[] = [];
  const block = (reason: string): void => {
    promotionBlocked[reason] = (promotionBlocked[reason] ?? 0) + 1;
    countSkip(out, `promotion:${reason}`);
  };

  const { store, day } = ctx;
  const denied = new Set(store.deniedIds());
  const ids = store.list();
  const owner = ownerNames(store);

  // WHERE THE LAST RUN STOPPED. `store.list()` is `ORDER BY id`, so the rotation
  // is stable and a cursor means something: this run resumes strictly after it
  // and wraps to the head once it reaches the end, visiting each id at most once
  // per run. A budget is still not a debt (§3) — the marker still advances and
  // nothing is owed; only the STARTING PLACE moved
  // (`docs/promotion-diagnosis-2026-09-17.md`).
  const start = resumeIndex(ids, readCursor(store, CONSOLIDATE_PHASE));
  let visited = 0;
  let stoppedAt: string | null = null;

  /** Tonight's eligible crossings, before the cap. */
  const eligible: { id: string; index: number; crossing: PromotionCrossing; strength: number }[] = [];

  while (visited < ids.length) {
    if (out.examined >= ctx.budget) {
      out.budgetExhausted = true;
      out.skippedForBudget = ids.length - visited;
      break;
    }
    const id = ids[(start + visited) % ids.length] as string;
    const index = visited + 1;
    visited += 1;
    stoppedAt = id;
    const row = store.row(id);
    if (row === undefined) continue;
    if (denied.has(id)) {
      countSkip(out, "removed");
      continue;
    }
    if (row.archived === 1) {
      countSkip(out, "archived");
      continue;
    }
    // A source is not consolidated and cannot cross into the identity band; the
    // MEMORY made from it can, and that is the path (`types.ts#isJournal`).
    if (isJournal(row)) {
      countSkip(out, "journal");
      continue;
    }
    out.examined += 1;

    let p = rowToPhysics(row);

    // ── 1. the legacy consolidation marking ─────────────────────────────────
    const eligibility = consolidationEligibility(p, day);
    if (!eligibility.eligible) {
      countSkip(out, eligibility.reason);
    } else {
      if (ctx.apply) store.updatePhysics(id, { consolidated: true });
      p = { ...p, consolidated: true };
      consolidated.push(id);
      out.changed += 1;
      ctx.event("sleep.consolidated", id, { kind: p.kind, day });
      ctx.step("item", { index, id });
    }

    // ── 2. the core lanes ───────────────────────────────────────────────────
    //
    // THE SELF PAGE DOES NOT CROSS (2026-09-18): it can be given the physics a
    // lane wants and would then carry `promoted_identity` on a row the wake can
    // never rank. The guard is THE PAGE, not schema rows generally — see
    // `sleep/NOTES.md` for why the identity core and beliefs are not exempted.
    if (row.type === "schema" && row.kind === "self" && isThePage(store, id)) {
      block("self-page");
      continue;
    }
    if (p.promotedIdentity) {
      block("already-identity");
      continue;
    }
    // Who it is about is asked only where it can matter — `self` and `person`
    // — so the prose read is paid by those rows alone.
    const about = aboutMe(store, row, owner);
    const outcome = promote(p, day, {
      aboutMe: about,
      demoted: about ? (store.coreDemoted?.(id) ?? false) : false,
    });
    if (!outcome.promoted || outcome.crossing === null) {
      // Every blocking reason is reported: "not about me" and "no lane yet"
      // are different diagnoses.
      for (const reason of outcome.verdict.blockedBy) block(reason);
      continue;
    }
    eligible.push({ id, index, crossing: outcome.crossing, strength: strength(p, day) });
  }

  // ── the nightly cap: strongest first, the rest wait ──────────────────────
  eligible.sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const cap = TUNABLES.CORE_MAX_PER_SLEEP;
  for (const [i, e] of eligible.entries()) {
    if (i >= cap) {
      block("cap");
      continue;
    }
    const record: PromotionRecord = { id: e.id, ...e.crossing };
    if (ctx.apply) {
      // Record BEFORE the flag: a crossing nobody could account for afterwards
      // is exactly the emergent promotion this phase exists to replace. If the
      // record cannot be written, the memory does not cross.
      store.setMeta(promotionRecordKey(e.id), JSON.stringify(record));
      store.appendEvent?.({
        name: record.event,
        day,
        ref: e.id,
        dedupKey: promotionRecordKey(e.id),
        payload: { ...record },
      });
      store.appendCoreEvent?.({ memoryId: e.id, action: "promoted", day, lane: record.lane, actor: "sleep" });
      store.updatePhysics(e.id, { promotedIdentity: true });
      // The band column is canonical for a crossing (a decision, not a decay
      // reading), and this is the only writer of `identity`.
      store.setBand(e.id, "identity", day);
    }
    promoted.push(record);
    out.changed += 1;
    ctx.event("sleep.promoted", e.id, {
      kind: record.kind,
      lane: record.lane,
      intensity: record.intensity,
      returnDays: record.returnDays,
      day,
    });
    ctx.step("item", { index: e.index, id: e.id });
  }

  // The cursor moves only where a row was actually visited, and only under
  // `apply`: an observer's read-only report may not move the store's place in
  // the store (§5 G10).
  if (ctx.apply && stoppedAt !== null) writeCursor(store, CONSOLIDATE_PHASE, stoppedAt);

  return { ...out, consolidated, promoted, promotionBlocked };
}

export type { PromotionReason };
