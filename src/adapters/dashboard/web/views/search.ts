/**
 * `/api/search`.
 *
 * Split out of `web/views.ts`, which re-exports every public name from here;
 * the four rules in that file's header apply to every line below.
 */
import { band, strength } from "../../../../core/physics/index.js";
import { isJournal } from "../../../../core/sleep/index.js";
import type { Band, Kind } from "../../../../core/types.js";
import { NEVER, NONE } from "../../layout.js";
import type { DashboardSource } from "../../source.js";
import { reveal } from "../reveal.js";
import { feelingsShown, isChapterMemory, shownOf } from "./memory-words.js";
import type { DateFrom, FeelingShown } from "./memory-words.js";

// ─────────────────────────────────────────────────────────────────────────────
// search
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchView {
  readonly q: string;
  readonly hits: {
    id: string;
    score: number;
    text: string;
    kind: Kind;
    band: Band;
    strength: number;
    confidential: boolean;
    /** The row shape the memories list uses (`memory-words.ts`). */
    title: string | null;
    shown: string;
    date: string | null;
    dateFrom: DateFrom | null;
    core: boolean;
    protected: boolean;
    journal: boolean;
    feelings: FeelingShown[];
  }[];
  readonly absent: string | null;
}

export function searchView(src: DashboardSource, q: string, limit = 25): SearchView {
  const store = src.store;
  const day = store.livedDay();
  const query = q.trim();
  if (query.length === 0) return { q: "", hits: [], absent: NEVER };
  let raw: { id: string; score: number }[];
  try {
    raw = store.search(query, limit * 2);
  } catch {
    return { q: query, hits: [], absent: NONE };
  }
  const hits: SearchView["hits"] = [];
  for (const hit of raw) {
    const row = store.row(hit.id);
    // The journal is searchable in the owner's editor; it is not a memory here.
    if (row === undefined || isJournal(row)) continue;
    const r = reveal(store, hit.id, 100);
    let s = 0;
    let b: Band = row.band;
    try {
      const physics = store.physicsOf(hit.id);
      s = strength(physics, day);
      b = band(physics, day);
    } catch {
      /* a row that will not read is still a hit; it lists with a named absence */
    }
    const chapter = isChapterMemory(row);
    const shown = shownOf(row.body, {
      chapter,
      learnedOn: row.learned_on,
      confidential: r.confidential || !r.present,
      withheld: r.text ?? r.label,
    });
    hits.push({
      id: hit.id,
      score: hit.score,
      text: r.text ?? r.label,
      kind: row.kind,
      band: b,
      strength: s,
      confidential: r.confidential,
      title: r.confidential || row.title === null || row.title.trim() === "" ? null : row.title.trim(),
      shown: shown.text || (r.text ?? r.label),
      date: shown.date,
      dateFrom: shown.dateFrom,
      core: row.promoted_identity === 1,
      protected: row.protected === 1,
      journal: chapter,
      feelings: feelingsShown(store, hit.id),
    });
    if (hits.length >= limit) break;
  }
  return { q: query, hits, absent: hits.length === 0 ? NONE : null };
}
