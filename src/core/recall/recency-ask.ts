/**
 * A QUESTION ABOUT TIME — the deliberate path only (2026-09-30, the
 * continuity test).
 *
 * Recall had no sense of time. Asked "what do you remember from our most
 * recent session?", it matched "session" and "recent" as words across every
 * day the store holds, and the candidate cap filled with other sessions'
 * release work; the evening the question was about never came back. A person
 * asks this plainly, so the plain question has to work: a cue here, like the
 * feeling cues in `feeling-ask.ts`, and the caller (`mcp/deliberate.ts`) puts
 * this directory's most recent session — its chapter and what it wrote —
 * first.
 *
 * Deliberate only: the ambient turn says "today" and "just now" all the time
 * without asking for anything. NO MODEL CALL: a fixed list of phrases.
 */

/** Phrases that ask about the recent past, matched on words (lower case,
 *  apostrophes dropped, runs of other characters as one space). */
export const RECENCY_PHRASES: readonly string[] = [
  "most recent",
  "last session",
  "previous session",
  "earlier session",
  "last conversation",
  "previous conversation",
  "last time",
  "last chat",
  "just now",
  "a minute ago",
  "minutes ago",
  "earlier today",
  "this morning",
  "this afternoon",
  "this evening",
  "tonight",
  "last night",
  "today",
  "yesterday",
  "left off",
  "pick up where",
  "just did",
  "just talked",
  "recently",
];

/** A clock time or a range of them: `16:01`, `4pm`, `4 pm`. */
const CLOCK = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:am|pm)\b/i;

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9:]+/g, " ").trim()} `;
}

/**
 * IS THIS QUESTION ABOUT THE RECENT PAST? The first phrase that says so, or
 * `"a clock time"`, or null. Pure.
 */
export function readRecencyAsk(text: string): string | null {
  const said = words(text);
  for (const p of RECENCY_PHRASES) if (said.includes(` ${p} `)) return p;
  return CLOCK.test(text) ? "a clock time" : null;
}
