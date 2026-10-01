/**
 * LAST HERE — the wake's line for the session that last wrote a chapter in
 * this directory (2026-09-30, the continuity test).
 *
 * A handoff is for unfinished work, and a session that finished cleanly
 * leaves none, so the directory's pointer said nothing of it: Mike ended an
 * evening's session in ~/random (twenty notes, a chapter, session_end
 * memories, no handoff), opened a new one two minutes later, asked "what do
 * you remember from our most recent session?", and the new session could not
 * find any of it. Every session that writes a chapter writes this line,
 * finished or not, and the line is beside the handoff pointer, not instead of
 * it.
 *
 * **Derived, not stored.** A chapter (`epi_`) records its session and no
 * directory; the directory a session ran in is in the buffer's turn-ends
 * (`coverage/#sessionsHere`, from `boundaries.jsonl`, which retention never
 * strikes). The caller joins the two, so this works for every chapter already
 * written and adds no row, no column and no write.
 *
 * Furniture, like the handoff pointer: spliced at delivery above it, never an
 * element, never a `- ` bullet, every line flattened. Its room comes out of
 * the same reserve, by the same share rule (`reserveBytes`), and it is the
 * first thing given up when there is not room for both — a fortnight's
 * unfinished work outranks orientation.
 */
import type { Store } from "../store/index.js";
import { isModelId } from "../types.js";
import { HANDOFF_EXCERPT_BYTES, HANDOFF_LIFE_DAYS, excerpt, flatten, sessionWords } from "./index.js";

/**
 * How long a chapter is "last here", in LIVED days since it was written — the
 * handoff's fortnight, so the two kinds of working context age alike and the
 * reserve walk stays bounded by recent work.
 */
export const LAST_HERE_LIFE_DAYS = HANDOFF_LIFE_DAYS;

/** How many sessions the line names in full (the newest with its first
 *  sentence, the one before it by title); the rest of that day by id. */
export const LAST_HERE_SHOWN = 2;

/** How many further chapters "+N more" names by id; past it, a count. */
export const LAST_HERE_LISTED = 3;

/** The title's cap in the line. The id is the door to the whole chapter. */
export const LAST_HERE_TITLE_BYTES = 100;

/** One session's latest chapter, as the line reads it. */
export interface ChapterHere {
  /** The episode row (`epi_…`). */
  readonly id: string;
  readonly session: string;
  /** The model that wrote it, when the row recorded one. */
  readonly model: string | null;
  readonly title: string | null;
  /** The first sentence of its LATEST chapter. */
  readonly excerpt: string;
  /** Epoch ms of the latest write to it. */
  readonly writtenAt: number;
  /** The lived day its latest chapter was written on, from the heading. */
  readonly writtenDay: number | null;
}

/** A chapter's session here, with the times the line prints, spelled by the caller. */
export interface LastHere {
  readonly chapter: ChapterHere;
  /** `09-30 16:01–17:53`: when the session was here. */
  readonly when: string;
  /** `09-30`: the date its chapter was written, for "+N more here on …". */
  readonly date: string;
}

/** A chapter heading, either written form (`self/episodes.ts#chapterHeading`). */
const HEADING = /^[ \t]*#{1,6}[ \t]*chapter[ \t]+\d+[^\n]*$/gim;

/**
 * EVERY SESSION'S LATEST CHAPTER, by session — one walk of the live episode
 * rows. Never throws: a store that will not answer has no chapters.
 */
export function chaptersBySession(store: Store): Map<string, ChapterHere> {
  const out = new Map<string, ChapterHere>();
  let ids: string[];
  try {
    ids = store.list({ type: "episode", archived: false });
  } catch {
    return out;
  }
  for (const id of ids) {
    try {
      const row = store.row(id);
      if (row === undefined || row.superseded_by !== null) continue;
      let session = row.origin_session;
      if (session === null || session.length === 0) {
        const meta = JSON.parse(row.meta || "{}") as Record<string, unknown>;
        session = typeof meta["sessionId"] === "string" ? meta["sessionId"] : null;
      }
      if (session === null || session.length === 0) continue;
      const writtenAt = row.updated_at ?? row.created_at ?? 0;
      const held = out.get(session);
      if (held !== undefined && held.writtenAt >= writtenAt) continue;
      const { text, day } = latestChapter(row.body);
      out.set(session, {
        id,
        session,
        model: isModelId(row.model) ? row.model : null,
        title: row.title === null || row.title.trim().length === 0 ? null : row.title,
        excerpt: excerpt(text),
        writtenAt,
        writtenDay: day ?? (Number.isFinite(row.birth_day) ? row.birth_day : null),
      });
    } catch {
      continue;
    }
  }
  return out;
}

/** The text of an episode's LAST chapter, and the lived day its heading names. */
export function latestChapter(body: string): { text: string; day: number | null } {
  let last: RegExpExecArray | null = null;
  for (const m of body.matchAll(HEADING)) last = m as RegExpExecArray;
  if (last === null) return { text: body, day: null };
  const day = /lived day[ \t]+(\d+)/i.exec(last[0])?.[1];
  return { text: body.slice((last.index ?? 0) + last[0].length), day: day === undefined ? null : Number(day) };
}

/**
 * THE CHAPTERS WRITTEN HERE, newest first: each session that ran in this
 * directory (`sessions`, from `coverage/#sessionsHere`) joined to its latest
 * chapter, kept while that chapter is inside `LAST_HERE_LIFE_DAYS`. `firstAt`
 * and `lastAt` are when the session was here; `lastAt` is never before its
 * chapter.
 */
export function chaptersHere(
  chapters: ReadonlyMap<string, ChapterHere>,
  sessions: readonly { session: string; firstAt: number; lastAt: number }[],
  day: number,
  lifeDays = LAST_HERE_LIFE_DAYS,
): { chapter: ChapterHere; firstAt: number; lastAt: number }[] {
  const out: { chapter: ChapterHere; firstAt: number; lastAt: number }[] = [];
  for (const s of sessions) {
    const chapter = chapters.get(s.session);
    if (chapter === undefined) continue;
    if (chapter.writtenDay !== null && day - chapter.writtenDay >= lifeDays) continue;
    out.push({ chapter, firstAt: s.firstAt, lastAt: Math.max(s.lastAt, chapter.writtenAt) });
  }
  return out.sort((a, b) => b.chapter.writtenAt - a.chapter.writtenAt || (a.chapter.id < b.chapter.id ? 1 : -1));
}

/** `— "Title" (epi_…)`, or `— epi_…` when the chapter has no title. */
function named(c: ChapterHere): string {
  return c.title === null ? `— ${c.id}` : `— "${excerpt(c.title, LAST_HERE_TITLE_BYTES)}" (${c.id})`;
}

/**
 * THE LINES, for the newest `shown` sessions here (1 or 2): the newest with its
 * first sentence, the one before it by title, and the rest written THAT DAY by
 * id. `more` false leaves the "+N more" line off — the narrowest rung.
 */
export function lastHereBlock(
  entries: readonly LastHere[],
  opts: { readonly shown?: number; readonly more?: boolean; readonly reader?: string | null } = {},
): string | null {
  const first = entries[0];
  if (first === undefined) return null;
  const reader = opts.reader ?? null;
  const sameDay = entries.filter((e) => e.date === first.date);
  const shown = Math.max(1, Math.min(opts.shown ?? LAST_HERE_SHOWN, sameDay.length));
  const who = (e: LastHere): string => sessionWords(e.chapter.session, e.chapter.model, reader);
  const lines = [
    `Last here: ${who(first)}, ${first.when} ${named(first.chapter)}.${first.chapter.excerpt.length > 0 ? ` ${excerpt(first.chapter.excerpt, HANDOFF_EXCERPT_BYTES)}` : ""}`,
  ];
  for (const e of sameDay.slice(1, shown)) lines.push(`Before it: ${who(e)}, ${e.when} ${named(e.chapter)}.`);
  const rest = sameDay.slice(shown);
  if (opts.more !== false && rest.length > 0) {
    const ids = rest.slice(0, LAST_HERE_LISTED).map((e) => e.chapter.id);
    const unnamed = rest.length - ids.length;
    lines.push(`+${rest.length} more here on ${first.date}: ${ids.join(", ")}${unnamed > 0 ? `, and ${unnamed} more` : ""}.`);
  }
  return lines.map(flatten).join("\n");
}

/**
 * THE BLOCKS A DELIVERY MAY TRY, widest first — `pointerLadder`'s shape: every
 * session of that day shown, then the newest with the count of the rest, then
 * the newest alone. Duplicates dropped.
 */
export function lastHereLadder(entries: readonly LastHere[], reader: string | null = null): string[] {
  const out: string[] = [];
  for (const block of [
    lastHereBlock(entries, { reader }),
    lastHereBlock(entries, { reader, shown: 1 }),
    lastHereBlock(entries, { reader, shown: 1, more: false }),
  ]) {
    if (block !== null && !out.includes(block)) out.push(block);
  }
  return out;
}
