/* Ask's answers, with a journal chapter and the memory drawn from it folded
   into one (2026-09-27, round 3; a try, not a rule).

   `counterparts ask` can return a journal chapter (`journal: true`, the entry)
   and the memory minted from it (`isChapterMemory`) side by side, with the
   same words. The page shows the memory once, where the better of the two was
   ranked, with a small "from chapter …" link to the entry. Pure (no DOM), so
   `bun test` checks it; the links come from `/api/chapters`
   (`views/search.ts#chapterLinks`). */

const TIER_ORDER = { vivid: 0, quiet: 1, dim: 2 };

/**
 * `mems`: Ask's `memories`, best first. `links`: `{ [memoryId]: { episodeId,
 * label } }`. Returns the answers to show, best first, each with `from` (its
 * chapter link, or null) and `chapter` (true for a chapter memory). An entry
 * whose chapter memory is also in the answer is dropped, and the memory takes
 * the entry's place and tier when the entry ranked higher.
 */
export function foldChapters(mems, links) {
  const list = Array.isArray(mems) ? mems : [];
  const L = links || {};
  const at = new Map();
  list.forEach((m, i) => { if (m && m.journal) at.set(m.id, i); });
  const folded = new Set();
  const items = list.map((m, i) => {
    const link = L[m.id] || null;
    let rank = i, tier = m.tier;
    if (link && at.has(link.episodeId)) {
      const j = at.get(link.episodeId);
      folded.add(link.episodeId);
      if (j < rank) rank = j;
      const other = list[j].tier;
      if ((TIER_ORDER[other] ?? 9) < (TIER_ORDER[tier] ?? 9)) tier = other;
    }
    return { m: { ...m, tier, from: link, chapter: link !== null }, rank, i };
  });
  return items
    .filter((x) => !(x.m.journal && folded.has(x.m.id)))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.m);
}

/** The link's words: `from chapter “Halfmoon pilot — 2026-06-01”`. */
export function fromWords(from) {
  if (!from) return "";
  return from.label ? "from chapter “" + from.label + "”" : "from its journal chapter";
}
