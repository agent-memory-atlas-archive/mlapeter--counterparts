/**
 * `/api/search`, and `/api/chapters` (the chapter an Ask answer came from).
 *
 * Split out of `web/views.ts`, which re-exports every public name from here;
 * the four rules in that file's header apply to every line below.
 */
import { band, strength } from "../../../../core/physics/index.js";
import { isJournal } from "../../../../core/sleep/index.js";
import type { Band, Kind } from "../../../../core/types.js";
import { NEVER, NONE } from "../../layout.js";
import type { DashboardSource } from "../../source.js";
import { reveal, revealHere } from "../reveal.js";
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

/** How many ids one `/api/chapters` call looks at — an Ask answer is a handful. */
export const CHAPTER_LINKS_MAX = 50;

/** A journal-chapter memory's chapter: the journal entry it was minted from. */
export interface ChapterLink {
  readonly episodeId: string;
  /** The journal entry's title, or null when it has none (or is withheld). */
  readonly label: string | null;
}

/**
 * `/api/chapters?ids=…` — for each id that is a JOURNAL-CHAPTER MEMORY
 * (`isChapterMemory`: minted from a chapter, `meta.episodeId`), the journal
 * entry it came from. Ask (the console's `ask --json`) can return a chapter
 * and the memory drawn from it side by side with the same words; the page
 * folds the pair into one answer with a "from chapter …" link (2026-09-27).
 *
 * Read-only and quiet: `row()` only, never `read()` (a read is an event).
 * Ids that are not chapter memories, or whose journal entry is gone, are left
 * out.
 */
export function chapterLinks(src: DashboardSource, ids: readonly string[]): { links: Record<string, ChapterLink> } {
  const store = src.store;
  const links: Record<string, ChapterLink> = {};
  for (const id of ids.slice(0, CHAPTER_LINKS_MAX)) {
    const row = store.row(id);
    if (row === undefined || !isChapterMemory(row)) continue;
    let episodeId: unknown;
    try {
      episodeId = (JSON.parse(row.meta) as Record<string, unknown>)["episodeId"];
    } catch {
      continue;
    }
    if (typeof episodeId !== "string" || episodeId === id) continue;
    const episode = store.row(episodeId);
    if (episode === undefined) continue;
    const r = revealHere(store, episodeId, 80);
    const title = episode.title?.trim() ?? "";
    links[id] = { episodeId, label: r.confidential || !r.present || title === "" ? null : title };
  }
  return { links };
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
