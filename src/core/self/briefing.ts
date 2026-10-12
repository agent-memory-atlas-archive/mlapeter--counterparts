/**
 * THE WAKE BRIEFING — composed here, with no model in the room.
 *
 * Rulings (module-map, 2026-08-25): *the wake briefing renders WITHOUT a model at
 * launch.* v0's briefing was in fact model-compressed, so the precedent cuts the
 * other way and Amendment 15 decides instead — the simplest brain-faithful rule
 * that could work is rank-and-take, and machinery is earned only after it fails.
 * There is no client, no fetch, no URL and no prompt in this file, and the test
 * suite enumerates that.
 *
 * What the composition guarantees, and why each one exists:
 *
 *   - **The budget governs the composed total**, not any lane. v1 byte-capped its
 *     index lane at 8,192 and left the bundle unbounded; every session for eleven
 *     days received about 3 of 16 elements and nothing said so (scar §2.3).
 *   - **The budget is the CALLER'S.** It arrives on the request because the
 *     injection ceiling is a host capability, not a memory property (scar §2.18).
 *     There is no default in this module to fall back to.
 *   - **The trim order is declared and tested** (`TRIM_ORDER`), and trimming eats
 *     from the END of a lane, whose ordering is itself policy: *truncation must
 *     never be iteration luck* (§1 G3–G4). After the loop, what it could not
 *     pop gives way in ONE declared list (`ROOM_ORDER`, 2026-10-10): "Work
 *     here", the Yesterday line's titles, "Last here" and the handoffs give
 *     their room to "Arriving:" and "Still open"'s first item before either
 *     is left unlisted.
 *   - **The identity SHARE decides how the total is split when lanes compete.**
 *     The budget still governs the composed total (§5 G2); the share is not a
 *     lane budget but a rule about who wins the contested bytes, and it exists
 *     because trimming identity LAST means a store of long identity elements
 *     silently takes everything: measured 2026-09-04, the delivered wake was 8
 *     identity elements at ~1.1 KB each and four empty lanes. Whole elements
 *     only, never a truncated one; and when the other lanes cannot fill the
 *     remainder, identity takes the leftover back — a ceiling, not a cap.
 *   - **Truncation is never mid-statement.** A statement is admitted whole or not
 *     at all — there is no `clip()` here on purpose. A half-sentence about who
 *     someone is, is not a smaller identity; it is a corrupted one. The same is
 *     true of the self page (2026-10-09): every rung of its ladder is whole
 *     text — the page, its short version, its outline, its headings, or one
 *     line saying where to read it (`PageRung`, 2026-10-10).
 *   - **The header AND the tail sentinel each state the bundle's own true counts
 *     and bytes**, so a truncated injection is detectable from a truncation
 *     preview alone — from either end (§1 G2). Because both lines state a number
 *     that composing them changes, composition solves for the fixed point.
 *   - **Ids resolve to text HERE**, at render time, through `Resolve` — never
 *     baked into the decision record or the telemetry, so an erased memory stops
 *     resolving the instant it leaves the store.
 */
import type { LaneName, Ranked } from "./identity.js";
import { byteLength } from "./identity.js";
import type { SelfTunables } from "./tunables.js";
import { addDays, isDay } from "../time.js";
import { HANDOFF_RESERVE_MAX_BYTES, HANDOFF_RESERVE_MIN_BUDGET_MULTIPLE } from "../handoff/index.js";
import { TODAY_ELSEWHERE_MAX_BYTES } from "../handoff/last-here.js";

/**
 * Composed order — behavioral-spec §1's, minus the two riders the Rulings drop
 * with their subjects: the second-signature reminder went with the `protected.add`
 * queue, and the self-store pointer went with the self-store tool (contract §4).
 * What is left is furniture, then core, then work, then warmth, then what is
 * coming.
 */
export const LANE_ORDER: readonly LaneName[] = [
  "identity",
  "craft",
  "threads",
  "hints",
  "horizon",
];

/**
 * How many trimmed ids the DURABLE briefing row carries (`self.briefing`, written
 * by the composition root after the cycle's briefing phase). The row is evidence
 * that the wake trimmed, and which lanes lost — not an archive of every id a
 * pathological boundary could drop. The full number always rides beside the list
 * as `trimmedTotal`, so a capped list is never mistaken for the whole of it.
 *
 * It lives HERE because the trim is `self/`'s: `self/` decides what a trim IS and
 * emits one `self.briefing.trim` per id. The root that writes the row states no
 * rule of its own and cannot spell a number at all (`counterpart.ts`'s scanner
 * test), so the cap has to have a home, and this is the module that owns it.
 */
export const BRIEFING_TRIM_LOG_CAP = 64;

/**
 * The declared trim order — v1's, verbatim (contract §3): hints → craft →
 * threads → horizon → identity LAST. Craft before threads so craft can never
 * displace core; identity last because identity is the thing the briefing is for.
 */
export const TRIM_ORDER: readonly LaneName[] = [
  "hints",
  "craft",
  "threads",
  "horizon",
  "identity",
];

/**
 * WHO GIVES WAY TO WHOM WHEN THE WAKE IS SHORT OF ROOM — ONE LIST, first to
 * give way to last (2026-10-10).
 *
 * The owner's wake on lived day 19 was 8,922 bytes and read "Arriving: 1 — no
 * room to list them in this wake": the item left out was his tax reminder,
 * while the same wake still printed yesterday's chapter titles and four
 * handoffs. A promise with a date on it had lost to furniture, because the
 * handoff pointer and "Last here" are spliced at delivery into room the
 * composition never competes for, and the Yesterday line is furniture the
 * trim cannot pop. So the room the delivery holds for them is LENT, like the
 * room for "Work here", and every lane takes room from the lanes below it
 * here, lowest first — never from one above:
 *
 *   - `hints`, `craft`, `threads` — "Nearby", store-wide craft, and "Still
 *     open" past its first item: the trim loop's (`TRIM_ORDER`), whole
 *     elements from the end of each lane;
 *   - `work` — "Work here": the delivery's room for this directory's work
 *     lines (`lendBytes`), which then shows fewer of them;
 *   - `openCount` — "Still open"'s count beside the items the trim kept,
 *     paid for out of "Work here" and nothing else (review of #358);
 *   - `yesterday` — the Yesterday line: a title at a time gives way to its
 *     id, pointers instead of titles (`yesterdayShorter`);
 *   - `lastHere`, `handoffs` — the delivery's room for "Last here" and this
 *     directory's handoffs (`handoffLendBytes`), less the newest handoff's
 *     own block (`handoffsKept`, below): the delivery drops "Last here"
 *     first and then shows fewer handoffs in full, the rest by id while
 *     there is room for that line (`counterpart.ts#addHandoffPointer`,
 *     `handoff/#pointerLadder`). "Last said here" (2026-10-11) is the first
 *     thing each "Last here" block gives up there; its room is held in
 *     `work`'s, the room the page borrows before it steps down;
 *   - `elsewhere` — the "Today, elsewhere" line (2026-10-10, composed at
 *     session start only, `BriefingRequest.elsewhere`; at most
 *     `TODAY_ELSEWHERE_MAX_BYTES`, b2 + random-f8, lightly held; placed here
 *     by the review of #380): it takes room from every lane listed above it —
 *     the trim loop's lanes, then "Work here", the Yesterday line's titles
 *     and the handoffs' room (`takeRoom`) — before it steps down: chapters
 *     first, then directories, then the line. Above it, every dated item and
 *     the page: "Arriving:", "Still open"'s first item (the lane's last item
 *     left counts as its first, with its count), the page's borrowing, a
 *     due-day plain reminder. Only on a day other directories were active:
 *     no line, nothing taken;
 *   - `arriving` — "Arriving:" past its first line;
 *   - `openFirst` — "Still open"'s first item and its count, when it would
 *     otherwise list nothing (review of #350);
 *   - `arrivingFirst` — "Arriving:"'s first line;
 *   - `arrivingNear` — at session start only, "Arriving:"'s lines due from
 *     the session's date through `ARRIVING_NEAR_DAYS` after it (`Ranked.near`;
 *     2026-10-12, RANDOM's ruling, lightly held; not the grace days' "was
 *     due" lines, RANDOM's ruling at review of #445): first claim on the room
 *     the session-start lines would fill — "Last here", "Last said here",
 *     "Today, elsewhere", the older handoffs — but not the newest handoff's
 *     own (review of #445). The turn-end composition marks none;
 *   - `handoffsKept` — the room for the newest handoff's own block, with
 *     the margin (`handoffKeepBytes`, `counterpart.ts#handoffRoom`; review
 *     of #367): lent to `due` alone, so no ordinary line leaves the next
 *     session's instructions unshown, and a due-day plain reminder is never
 *     left unlisted for them;
 *   - `pageBorrow` — the self page past its own room, borrowing "Work here"
 *     (review of #358);
 *   - `due` — a plain reminder due the day this wake is read (`Ranked.due`):
 *     the person asked to be told, and a missed one is a broken promise;
 *   - `page` — the page within its own room, and "Who I am".
 *
 * Every step is whole: an element, a line, a shorter whole form, a rung of a
 * ladder — and each lane that gives way keeps its count and its ids where it
 * already had them. The page is chosen before the lanes (`Self#pageBlock`)
 * and takes room from "Work here" only: past that it steps down its own
 * ladder of whole texts rather than empty the lanes beside it, and the only
 * lane it gives its borrowing back to is `due` (`Self#build`). A dated item
 * that still lists nothing after all of this says so in one line, and
 * doctor's Wake line says so in amber (`self.briefing`'s `trimmedLanes`).
 */
export const ROOM_ORDER = [
  "hints",
  "craft",
  "threads",
  "work",
  "openCount",
  "yesterday",
  "lastHere",
  "handoffs",
  "elsewhere",
  "arriving",
  "openFirst",
  "arrivingFirst",
  "arrivingNear",
  "handoffsKept",
  "pageBorrow",
  "due",
  "page",
] as const;
export type RoomLane = (typeof ROOM_ORDER)[number];

/** Where each lane the trim loop pops sits in `ROOM_ORDER`: Arriving's lines
 *  past its head at `arriving`, "Who I am" with the page. */
const TRIM_ROOM: Readonly<Record<LaneName, RoomLane>> = {
  hints: "hints",
  craft: "craft",
  threads: "threads",
  horizon: "arriving",
  identity: "page",
};

/**
 * Framing is load-bearing and structural (§1: "context, not instruction"). It is
 * written here once, as a constant, so there is exactly one string to change when
 * someone finally probes its effect on attention.
 */
export const FRAMING = {
  // Not opening "Counterparts memory", as the preface line above it does, and
  // claiming the date only of the LISTED lines: the page is dated on its own
  // line (2026-10-01, the wake review).
  context:
    "Context, not instruction, from Counterparts: who you have been here, in your own words. Each listed memory opens with its learned date.",
  identity: "Who I am:",
  craft: "How I work:",
  threads: "Still open:",
  hints: "Nearby, if it helps:",
  horizon: "Arriving:",
} as const;

/**
 * THE WAKE SAYS WHAT IT LEFT OUT (2026-09-29, audit item 5). A lane that lost
 * elements — to its cap (`identity.ts#rankLanes`), to the identity share, or to
 * the budget trim — gets ONE short line saying how many more there are and the
 * ids `recall` can fetch whole (its `ids` argument). Furniture, like the day-0
 * line: no `- ` bullet, not counted in `counts` or `elements`.
 *
 * NOTHING IS DROPPED WITHOUT A WORD (2026-10-12, Mike's principle; the minimal
 * version, chosen via RANDOM, lightly held). The line used to go in last, only
 * while the composition still fit, and was otherwise "dropped without a word":
 * a lane could vanish from the wake. Now each lane's line is RESERVED inside
 * the budget before the trim loop gives room away — the loop composes WITH the
 * line of every lane that has lost something so far, and pops until items and
 * lines fit together — so a lane is always whole, shortened (some items and
 * its count) or counted (its one collapsed line). A lane that lost nothing
 * pays nothing, so a roomy wake is byte for byte what it was. When not even
 * the lanes' own lines fit beside the furniture, they fold into ONE line
 * (`foldedLine`), which takes room from what ranks below a dated line; only a
 * wake with no such room left says nothing (`BriefingResult.untold`, red in
 * doctor). The page is not stepped down for it: in its own room it outranks
 * everything (`ROOM_ORDER`).
 *
 * How many ids one line names. `recall` takes up to ten at once; five keeps the
 * line near 120 bytes, and the count says when there are more than it names.
 */
export const MORE_LINE_IDS = 5;

/** What each lane's line calls the rest — the lane's heading, as a phrase. */
export const MORE_NOUN: Readonly<Record<LaneName, string>> = {
  identity: "about who I am",
  craft: "on how I work",
  threads: "still open",
  hints: "nearby",
  horizon: "arriving",
};

/** The order lanes are offered room for their line when it was not reserved
 *  (the last resort, `tellLost`): the reverse of the trim order, so the
 *  lanes that are cut last are also told about first.
 *
 *  NEARBY'S CAP IS NOT COUNTED (2026-10-01, random-f2's item 5): what the
 *  hints lane's CAP leaves out is everything else warm in the store — "(331
 *  more nearby; recall ids …)" counted the store and named five ids nobody
 *  chose. Recall finds those by asking. What the BUDGET popped from the lane
 *  is counted (2026-10-12): at most `HINTS_MAX` hints this wake chose, each
 *  worth its id (`lostByLane`). */
const MORE_ORDER: readonly LaneName[] = [
  "identity",
  "horizon",
  "threads",
  "craft",
  "hints",
];

/** `(3 more still open; recall ids: mem_…, mem_…, mem_…)` */
export function moreLine(lane: LaneName, ids: readonly string[]): string {
  return `(${String(ids.length)} more ${MORE_NOUN[lane]}; ${recallIds(ids)})`;
}

/**
 * THE LANES' LINES, FOLDED INTO ONE (2026-10-12): what a wake prints when not
 * even each lane's own count line fits beside the page and the furniture —
 * every lane that lost something, counted, and the first ids of the
 * highest-ranked of them (`FOLD_ORDER`). Furniture, like the lines it stands
 * for. It takes room as a dated line does, from the lanes below
 * `arrivingFirst` in `ROOM_ORDER` (`render`'s trim loop).
 */
export const FOLDED_WORDS = "More than this wake lists:";

/** Who the folded line names first: dated items, then what is open, then the rest. */
const FOLD_ORDER: readonly LaneName[] = ["horizon", "threads", "identity", "craft", "hints"];

/** `More than this wake lists: 7 arriving, 4 still open; recall ids (the first 5): mem_…` */
export function foldedLine(lost: Partial<Record<LaneName, readonly string[]>>): string | null {
  const lanes = FOLD_ORDER.filter((l) => (lost[l]?.length ?? 0) > 0);
  if (lanes.length === 0) return null;
  const counts = lanes.map((l) => `${String(lost[l]?.length ?? 0)} ${MORE_NOUN[l]}`).join(", ");
  return `${FOLDED_WORDS} ${counts}; ${recallIds(lanes.flatMap((l) => [...(lost[l] ?? [])]))}`;
}

/** True for the folded line (`foldedLine`), which belongs to no one lane. */
export function isFoldedLine(line: string): boolean {
  return line.startsWith(`${FOLDED_WORDS} `);
}

/**
 * WHAT A WAKE COUNTS, read back off its own lines (2026-10-12): each lane a
 * "N more" line, a collapsed line or the folded line names, and N. Kept beside
 * the three writers so their wording and this reader change together. Pure.
 */
export function countedLanes(text: string): Partial<Record<LaneName, number>> {
  const out: Partial<Record<LaneName, number>> = {};
  const byNoun = new Map(LANE_ORDER.map((l) => [MORE_NOUN[l], l] as const));
  for (const line of text.split("\n")) {
    const collapsed = collapsedLane(line);
    if (collapsed !== null) {
      out[collapsed] = Number(/^\D*(\d+) — /.exec(line.slice(laneHeading(collapsed).length))?.[1] ?? 0);
      continue;
    }
    const more = /^\((\d+) more (.+?); recall ids/.exec(line);
    const lane = more === null ? undefined : byNoun.get(more[2] ?? "");
    if (more !== null && lane !== undefined) {
      out[lane] = Number(more[1]);
      continue;
    }
    if (!isFoldedLine(line)) continue;
    const counts = line.slice(FOLDED_WORDS.length + 1).split("; recall ids")[0] ?? "";
    for (const part of counts.split(", ")) {
      const m = /^(\d+) (.+)$/.exec(part);
      const l = m === null ? undefined : byNoun.get(m[2] ?? "");
      if (m !== null && l !== undefined) out[l] = Number(m[1]);
    }
  }
  return out;
}

function recallIds(ids: readonly string[]): string {
  const shown = ids.slice(0, MORE_LINE_IDS);
  const which = ids.length > shown.length ? `recall ids (the first ${String(shown.length)})` : "recall ids";
  return `${which}: ${shown.join(", ")}`;
}

/**
 * A LANE WITH NOTHING LISTED SAYS SO IN ONE LINE, NOT A HEADING OVER A COUNT
 * (2026-10-09). The owner's wake that morning read "Still open:" and, under
 * it, "(20 more still open; recall ids …)" with no item between — a heading
 * over nothing reads like a broken page, and "more" than none is not a count.
 * When a lane keeps no element and has something to say about what it left
 * out, the heading and the count are one line: `Still open: 20 — no room to
 * list them in this wake; recall ids (the first 5): mem_…`. Furniture, like
 * the "more" line it replaces; the identity lane keeps its heading, which has
 * the page or the day-0 line under it. The dashboard reads the lane off the
 * line's own heading (`collapsedLane`).
 */
export const COLLAPSED_WORDS = "no room to list them in this wake";

export function collapsedLine(lane: LaneName, ids: readonly string[]): string {
  return `${laneHeading(lane)} ${String(ids.length)} — ${COLLAPSED_WORDS}; ${recallIds(ids)}`;
}

/** The lane a collapsed line (`collapsedLine`) speaks for, or null for any other line. */
export function collapsedLane(line: string): LaneName | null {
  for (const lane of LANE_ORDER) {
    const heading = laneHeading(lane);
    if (!line.startsWith(`${heading} `)) continue;
    if (new RegExp(`^ \\d+ — ${COLLAPSED_WORDS}; recall ids`).test(line.slice(heading.length))) return lane;
  }
  return null;
}

/**
 * THE DAY-0 LANE — what "Who I am:" says before an identity element exists.
 *
 * Measured 2026-09-04 on a store opened the way `install --budget 9000 --name
 * "Dana"` opens one: after the `rebrief` QUICKSTART §7 tells the stranger to
 * run, the delivered wake was 385 bytes of furniture that promise "who you have
 * been here, in your own words" and then say nothing — and the name the owner
 * typed appeared nowhere in it. The identity core is a live row, but it is
 * `type: "schema"` and `scanActive` lists `{ type: "memory" }`, so no lane can
 * ever reach it (NOTES §11).
 *
 * Two facts and no third. It NAMES the core, and it says how the lane fills —
 * the mechanism `sleep/consolidate.ts` actually implements, where promotion
 * needs `base >= THETA_ID` AND reinforcement on `N_PROMOTION_DAYS` distinct
 * lived days (`physics/index.ts#promotionEligibility`), decided at the
 * consolidation inside the cycle `sessionEnd` runs. It invents no content: a
 * wake that composed a plausible first belief about Dana would be the rumination
 * pathway the contract forswears, arriving through the one surface read as
 * settled fact.
 *
 * It deliberately does NOT say "nothing has been lived here yet". The delivery
 * preface states the live memory count on the line above (`0 memories` on day
 * 0), and a line claiming emptiness would go false the moment the first note
 * landed while the identity lane — which takes distinct days to fill — was still
 * empty. One string that is true on day 0 and on day 30; the preface carries the
 * count, this line carries the WHO.
 *
 * No `- ` bullet: that prefix is reserved for a resolved statement, and
 * `FRAMING.context` promises every such line opens with the date it was learned,
 * which this line has none of. It is furniture, so `counts.identity` stays 0 and
 * the header and sentinel still read `elements=0`.
 *
 * **The name is FLATTENED, like every other string that reaches the bundle.**
 * `flatten` is what makes "a statement is a line here" true (see its own note),
 * and the name is the only user-supplied string this module renders — so it is
 * held to the same rule, at the one place the line is built. Adversarial review
 * of PR #71: a name carrying newlines injected lines into the delivered wake,
 * including a forged `- <date> <claim>` bullet that reads as a resolved
 * statement and that the dashboard's lane splitter then filed under a heading
 * the store had no rows for. Not a privilege boundary — the name is the owner's
 * own, and the sentinel still verified — but the "furniture, not an element"
 * property is exactly what a second line defeats, and a prose file the owner is
 * promised they may hand-edit (constitution 6) is a paste accident away.
 */
export function identityCoreLine(name: string): string {
  return `This memory is for ${flatten(name)}. No identity has formed here yet — identity is earned at the boundary that ends a session, from what recurs across distinct days.`;
}

/**
 * THE PAGE, IN "WHO I AM" — furniture, like the day-0 line, and for the same
 * reason: it is not a ranked element, it carries no `- ` bullet, and `counts`
 * and the sentinel's `elements=` stay true of a bundle that holds it.
 *
 * The page prints FIRST and AS IS. Not re-wrapped, not re-ordered, not
 * summarised: a page reassembled here would be a page this module wrote, and
 * what the owner and the session are promised is the thing they wrote.
 * `FRAMING.context`'s "each line opens with the date it was learned" is a claim
 * about the element lines — the day-0 line has carried no date since it shipped
 * — and the page carries its own date on its own line instead.
 */
export interface PageBlock {
  /**
   * The page as it will be injected, on the rung the room allowed
   * (`PageRung`, 2026-10-10): the whole page, the short version its writer
   * wrote with it, each section's heading and first sentence, its headings
   * alone, or the one line that says it did not fit (`pageTooLargeLine`).
   * Every rung is whole text — never part of a sentence (2026-10-09).
   */
  readonly text: string;
  /**
   * THE TOP LINE (2026-10-10, `pageTopLine`): what is below, the page's size,
   * the exact line it ends with, and both doors to the whole page — so a
   * reader whose copy was cut on the way (a host's preview) can tell. Null on
   * the one-line rung, which is its own top line.
   */
  readonly top: string | null;
  /** The page's own "last revised" line, or null when the page carries no date. */
  readonly dateline: string | null;
  /** THE END LINE (`pageEndLine`), after the dateline; null when `top` is. */
  readonly end: string | null;
  /** Which rung printed. */
  readonly rung: PageRung;
  /** True when the page did not print whole — any rung but `whole`. */
  readonly truncated: boolean;
  /** The page's own bytes, whole, whatever was rendered. */
  readonly wholeBytes: number;
}

/**
 * THE PAGE'S FALLBACK LADDER (2026-10-10), first to last; `Self#pageBlock`
 * takes the first that fits. Every rung is whole text, never a cut:
 *
 *   - `whole`    — the page, byte for byte;
 *   - `short`    — the short version the page's writer wrote WITH this
 *                  version of it (`SelfPage.short`, tied to the page's exact
 *                  text, so a page rewritten without one never shows a stale
 *                  one);
 *   - `outline`  — each `##` section's heading and its first whole sentence
 *                  (`page.ts#pageOutline`), mechanical;
 *   - `headings` — the headings alone;
 *   - `line`     — one line naming the page's size and both doors
 *                  (`pageTooLargeLine`), its own top line.
 */
export const PAGE_RUNGS = ["whole", "short", "outline", "headings", "line"] as const;
export type PageRung = (typeof PAGE_RUNGS)[number];

/**
 * What "Who I am" prints BESIDE the ranked elements. Both fields are decided by
 * `render` from the tunables and handed down, so `compose` stays a renderer with
 * no policy of its own.
 */
export interface IdentityBlock {
  /** The written page, when one exists. It replaces the list (spec §15 item 4). */
  readonly page: PageBlock | null;
  /** Printed when there is NO page and the list has been switched off. */
  readonly forming: string | null;
}

/** What "Who I am" says when no page has been written and the list is off. */
export const PAGE_FORMING_LINE =
  "Still forming — no page has been written here yet. It is written at a boundary, from what recurs, and can be amended by hand.";

/**
 * The page's own date, under the page. It states the DATE and — when the page
 * has gone stale — how long the silence was allowed to be, rather than "N days
 * ago": the bundle is composed at a boundary and then served unchanged until
 * the next one, so a delta computed here goes wrong while a date does not.
 */
export function pageDateline(revisedOn: string, stale: boolean, staleDays: number): string | null {
  const on = revisedOn.trim();
  // A page with no readable date SAYS SO. Returning null printed the page with
  // no date and no staleness signal at all while every other surface called it
  // stale — the one state where the wake said less than it knew (adversarial
  // review m6). Only reachable on a hand-minted or hand-edited row.
  if (on === "" || !/^\d{4}-\d{2}-\d{2}$/.test(on) || !Number.isFinite(Date.parse(`${on}T00:00:00Z`))) {
    return "(Last revised — the page carries no readable date.)";
  }
  return stale
    ? `(Last revised ${on} — more than ${staleDays} days before this wake was composed.)`
    : `(Last revised ${on}.)`;
}

/** Id → the verbatim statement AND its dates, at render time only. */
export interface Resolved {
  readonly statement: string;
  /**
   * The encode date (`ProseDoc.learnedOn`), at whatever precision it was stated.
   * Absent or blank means undated — the store writes `learned_on = ''` on a
   * chased row — and an undated element renders with no prefix rather than an
   * empty one.
   */
  readonly learnedOn?: string;
  /** The content date (`ProseDoc.happenedOn`), rendered only when it DIFFERS. */
  readonly happenedOn?: string;
  /**
   * The date an ARRIVING occasion is due (`HorizonItem.due`, 2026-10-01),
   * rendered `(due YYYY-MM-DD)` after the learned date when it differs, in
   * place of `(of …)`. Only horizon items carry one.
   */
  readonly due?: string;
  /**
   * How often an arriving occasion comes round, in words (`HorizonItem.every`,
   * 2026-10-09), printed beside its due date: `(due 2027-05-14, every May 14)`.
   * Only a horizon item that repeats carries one.
   */
  readonly every?: string;
  /**
   * True when `due` was already BEHIND the day the wake was composed for
   * (`HorizonItem.past`, 2026-10-09) — a one-off in its grace days — so the
   * line says `(was due …)` rather than reading as still to come.
   */
  readonly duePast?: boolean;
  /**
   * True when the encode date is only an UPPER BOUND — the element was known BY
   * then, not learned then. Set for migrated elements, whose `learned_on` is
   * v1's date when v1 carried one and the IMPORT date when it did not, with
   * nothing in the row to tell the two apart. See `datePrefix`.
   */
  readonly boundedDate?: boolean;
  /**
   * Its STANDING in a contradiction (2026-09-29, review of #284 S3 —
   * `recall/standing.ts`): a qualifier before the statement (`Earlier (now
   * [id]): `, `Unsettled — may be out of date, see [id]: `) and a pointer
   * after (` (disagrees with [id])`), so a lane never shows an old fact as
   * current. Absent: nothing to say.
   */
  readonly standing?: { readonly prefix: string; readonly suffix: string };
}

export type Resolve = (id: string) => Resolved;

export interface BriefingRequest {
  /** The host's reported injection ceiling, in bytes. REQUIRED — scar §2.18. */
  readonly budgetBytes: number;
  /** The lived day (scar E8), stated in the header so a stale bundle is legible. */
  readonly day: number;
  /**
   * The identity core's name, when the caller found one AND the identity lane is
   * empty — the day-0 lane (`identityCoreLine`, NOTES §11). Absent means render
   * nothing, which is what a store with no core has always rendered. The lookup
   * is the caller's because it reads prose, and `self/` invents no name.
   */
  readonly coreName?: string;
  /**
   * THE WRITTEN SELF PAGE, whole or the line that says it did not fit, dated
   * by the caller (`Self#pageBlock`). Present means "Who I am" prints this
   * and NOT the rotating list; absent means the list renders as it always has,
   * or — when `PAGE_EMPTY_SHOWS_LIST` is off — the still-forming line does.
   *
   * It arrives ready because whether it fits is a byte decision that needs the
   * caller's budget and the page's own prose, and this module composes rather
   * than reads.
   */
  readonly page?: PageBlock;
  /**
   * TRUE when the store HAS a page, whatever this render could fit of it. A
   * ceiling with no room for the wake's own furniture carries no page block at
   * all, and without this the renderer could not tell that from a store that has
   * never been written to — so with `PAGE_EMPTY_SHOWS_LIST` off it printed "no
   * page has been written here yet" over a store holding one (adversarial review
   * MINOR-D). Absent means the caller did not say, which reads as "no page".
   */
  readonly pageExists?: boolean;
  /**
   * THE "YESTERDAY" LINE (2026-10-01, build 3): one line, already composed and
   * dated by the caller — yesterday's chapter titles with their ids, so a wake
   * built at night still reads right in the morning. Furniture, like the page:
   * no `- ` bullet, not in `counts`, printed under the framing line, and paid
   * for out of the same budget (the lanes trim to make room). Dropped when even
   * the floor would not fit with it. Absent: no line.
   */
  readonly yesterday?: string;
  /**
   * SHORTER FORMS OF THE SAME LINE, widest first (review of #350,
   * 2026-10-09): fewer titles, each given-up title's id in its place
   * (2026-10-10) — composed by the caller, which holds the chapters. Stepped
   * down only for what ranks above the line in `ROOM_ORDER`. Ignored without
   * `yesterday`.
   */
  readonly yesterdayShorter?: readonly string[];
  /**
   * THE ROOM THE DELIVERY HOLDS FOR "WORK HERE" (review of #350, 2026-10-09),
   * in bytes: the caller's reserve for this directory's work lines, which it
   * took out of `budgetBytes` before composing. Lent, first of the delivery's
   * rooms (`ROOM_ORDER`'s `work`), to what ranks above it and is short of
   * room — "Arriving:" and "Still open"'s first item and count — never to a
   * lane the trim order already took: the work lines are hints, and the
   * delivery shows fewer of them in what is left. Absent: nothing to lend.
   */
  readonly lendBytes?: number;
  /**
   * THE ROOM THE DELIVERY HOLDS FOR "LAST HERE" AND THE HANDOFF POINTER
   * (2026-10-10), in bytes: the caller's share-ruled reserve, taken out of
   * `budgetBytes` before composing (`counterpart.ts#wakeReserveBytes`). Lent
   * after "Work here" and after the Yesterday line's titles
   * (`ROOM_ORDER`'s `lastHere`, `handoffs`) — to "Arriving:" and "Still
   * open"'s first item only. The delivery then has less room for them, and
   * drops "Last here" first and shows fewer handoffs in full, the rest by id.
   * Absent: nothing to lend.
   */
  readonly handoffLendBytes?: number;
  /**
   * THE REST OF THAT RESERVE (review of #367, 2026-10-10), in bytes: the room
   * for the newest handoff's own block, which `handoffLendBytes` leaves out.
   * Lent to a plain reminder due the day the wake is read and to nothing
   * else (`ROOM_ORDER`'s `handoffsKept`), last of the rooms that lane takes.
   * Absent: nothing to lend.
   */
  readonly handoffKeepBytes?: number;
  /**
   * THE "TODAY, ELSEWHERE" LINE (2026-10-10): one line, composed by the caller
   * at session start from the host's session registry and the store — which
   * other directories were worked in today, when, the chapter written there
   * (scope and confidential gates), and how many memories, as counts. Never
   * a word of a span, a work memory's title or a handoff from there.
   * Furniture, printed above "Nearby", at most `TODAY_ELSEWHERE_MAX_BYTES`
   * (a longer form is not printed). It takes room from the lanes below it in
   * `ROOM_ORDER` and gives way to those above it — "Arriving:", "Still
   * open"'s first item, the page and its borrowing (`ROOM_ORDER`'s
   * `elsewhere`).
   * Absent: no line — which is every render at a boundary, since the line is
   * about the moment a session starts.
   */
  readonly elsewhere?: string;
  /** Its shorter forms, widest first: fewer chapters, fewer directories.
   *  Ignored without `elsewhere`. */
  readonly elsewhereShorter?: readonly string[];
}

export interface TrimEvent {
  readonly lane: LaneName;
  readonly id: string;
  readonly strength: number;
}

export interface Composed {
  readonly text: string;
  readonly bytes: number;
  readonly header: string;
  readonly sentinel: string;
  readonly counts: Record<LaneName, number>;
  readonly elements: number;
}

export interface BriefingResult extends Composed {
  readonly budgetBytes: number;
  readonly day: number;
  /** Ids kept, per lane, in rendered order. */
  readonly kept: Record<LaneName, string[]>;
  readonly trimmed: TrimEvent[];
  /**
   * The lanes the wake COUNTS rather than lists in full, and N for each — what
   * the lane lost to its cap, the identity share or the trim, said in its "N
   * more" line (`moreLine`), its collapsed line, or the folded line (2026-10-12:
   * reserved, so every lane that lost something is here).
   */
  readonly more: Partial<Record<LaneName, number>>;
  /** True when the lanes' lines were folded into one (`foldedLine`). */
  readonly folded: boolean;
  /**
   * What the wake left out WITHOUT A WORD, per lane (2026-10-12): ids the lane
   * lost that no line names. Empty unless not even the folded line fit — a
   * floor over its budget, or a bug — and doctor's Wake line says so in red.
   */
  readonly untold: Partial<Record<LaneName, number>>;
  /** True when the render crossed the pressure ratio — the tripwire that fires
   *  when a budget is APPROACHED, not only when it blows (scar §2.4). */
  readonly pressure: boolean;
  /** True when even the floor (furniture + sentinel, zero statements) does not
   *  fit the caller's budget. The floor still publishes: an under-floor budget is
   *  a host misconfiguration, and the wake never fails the session (§1 G7). */
  readonly overBudget: boolean;
  /** The page as it RENDERED — null when no page was handed to this render. The
   *  bytes are the injected ones (its top and end lines included, or the one
   *  line when nothing else fit), so what the page cost this wake, its true
   *  size and the rung it printed on are all readable. */
  readonly page: {
    readonly bytes: number;
    readonly truncated: boolean;
    readonly wholeBytes: number;
    readonly rung: PageRung;
  } | null;
  /** The "Today, elsewhere" line as it printed (the form the room allowed),
   *  or absent when none was asked for or none fit. */
  readonly elsewhere?: string;
}


function headerLine(day: number, elements: number, bytes: string): string {
  return `<!-- counterparts:wake day=${day} elements=${elements} bytes=${bytes} -->`;
}

function sentinelLine(
  day: number,
  counts: Record<LaneName, number>,
  elements: number,
  bytes: string,
  page = false,
): string {
  // `page=1` beside `identity=0` (2026-10-01, the wake review): with a page,
  // "Who I am" is the page and the identity lane's count is 0, which read as
  // an empty self. Absent when no page rendered, so every other sentinel is
  // byte for byte what it was.
  const lanes = LANE_ORDER.map((l) => (l === "identity" && page ? `${l}=${counts[l]} page=1` : `${l}=${counts[l]}`)).join(" ");
  return `<!-- counterparts:wake/end day=${day} ${lanes} elements=${elements} bytes=${bytes} -->`;
}

function laneHeading(lane: LaneName): string {
  switch (lane) {
    case "identity":
      return FRAMING.identity;
    case "craft":
      return FRAMING.craft;
    case "threads":
      return FRAMING.threads;
    case "hints":
      return FRAMING.hints;
    case "horizon":
      return FRAMING.horizon;
  }
}

/**
 * One statement per line, VERBATIM. Whitespace is flattened (a statement is a
 * line here) but never cut: what is rendered is exactly what `Resolve` returned,
 * or the statement is not rendered at all.
 */
export function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * THE DATE, IN FRONT OF THE CLAIM.
 *
 * Measured 2026-09-04: the wake rendered every element with no date of any kind,
 * and a migrated element learned 2026-07-26 ("the credential fix sits
 * uncommitted pending review") was read as a current fact and repeated to the
 * owner as one. The delivery preface dates the WAKE; nothing dated the ELEMENTS,
 * and a reader with no age cannot discount one.
 *
 * LEADING, not trailing, for three reasons: the age is read before the claim
 * rather than after it has landed; the element's own text still ENDS the line,
 * so "a statement is admitted whole" stays checkable by its own final
 * punctuation and nothing that follows can be mistaken for part of it; and it is
 * the cheaper of the two forms — 14 bytes at day precision (`YYYY-MM-DD` plus
 * ` · `), against 21 for a trailing `(learned YYYY-MM-DD)`, on every element in
 * every lane. The word "learned" is stated ONCE, in `FRAMING.context`, instead
 * of once per element.
 *
 * The element text itself is never touched: the annotation lives outside it, so
 * a belief still renders verbatim for contradiction detection.
 *
 * A differing content date is named inline and neutrally — `(of 2026-06-01)` —
 * because the horizon lane's dates are in the FUTURE (an arriving occasion), and
 * "happened" would be a lie about half of them.
 *
 * **`by` — the upper bound, and why a MIGRATED element gets one.** Run live on
 * 2026-09-05, the first dated wake read `2026-09-03 ·` on all eleven elements,
 * including a July incident and a mid-August finding: the importer writes the
 * IMPORT date as `learned_on` for every row v1 carried no date for, and nothing
 * in the row distinguishes those from the ones that kept v1's own. A wrong date
 * is worse than no date — it is a claim, made confidently, in the one line the
 * reader uses to discount everything else — so a migrated element states what is
 * actually known: `by 2026-09-03 ·`, three bytes for a date that is true
 * whichever of the two it is.
 *
 * A migrated element carrying a CONTENT date is the exception and renders
 * plainly, as everything else does: `happened_on` is evidence about the thing
 * itself, it survived the import unaltered, and hedging real evidence would make
 * `by` mean nothing. *Named cost: a migrated row that did keep v1's own date and
 * has no content date is hedged too — "by 2026-07-26" instead of "2026-07-26".
 * Weaker, never wrong, and the alternative needs a per-row discriminator the
 * import did not record.*
 */
export const DATE_SEP = " · ";
export const DATE_BOUND = "by ";
/** How an arriving line names its date, ahead of it and once it has passed. */
export const DUE_WORD = "due";
export const DUE_PAST_WORD = "was due";

export function datePrefix(r: Resolved): string {
  const learned = (r.learnedOn ?? "").trim();
  const due = (r.due ?? "").trim();
  // AN ARRIVING OCCASION SAYS WHEN IT IS DUE (2026-10-01): a watch list read
  // "2026-09-27 · …" while the item was due 2026-10-03, and the learned date
  // alone reads as when it happens.
  if (due !== "") {
    // A repeating one says how often beside it (2026-10-09) — even when it is
    // due on the day it was learned, since "every May 14" is news there too.
    const every = (r.every ?? "").trim();
    const often = every === "" ? "" : `, ${every}`;
    // PAST ITS DATE, IT SAYS SO (2026-10-09): a one-off stays under
    // "Arriving:" for its grace days (`prospective/` GRACE_DAYS), and
    // "(due 2026-10-08)" read on the 9th reads as still to come.
    const word = r.duePast === true ? DUE_PAST_WORD : DUE_WORD;
    // DUE ON THE DAY IT WAS LEARNED: the one date, stated once — as the DUE
    // date (2026-10-09), so the line still says when, and the delivery can
    // put it in the past tense the morning after (`arrivingTense`).
    if (learned === "" || (due === learned && often === "")) return `${word} ${due}${often}${DATE_SEP}`;
    return `${r.boundedDate === true ? DATE_BOUND : ""}${learned} (${word} ${due}${often})${DATE_SEP}`;
  }
  if (learned === "") return "";
  const happened = (r.happenedOn ?? "").trim();
  if (happened !== "" && happened !== learned) return `${learned} (of ${happened})${DATE_SEP}`;
  const bound = r.boundedDate === true ? DATE_BOUND : "";
  return `${bound}${learned}${DATE_SEP}`;
}

/**
 * ONE rendered line for one element — the single place the shape is decided, so
 * the byte accounting (`elementBytes`, and through it the identity share) can
 * never disagree with what `compose` actually writes.
 */
export function elementLine(item: Ranked, resolve: Resolve): string {
  const r = resolve(item.id);
  const statement = flatten(r.statement);
  const standing = r.standing?.prefix ?? "";
  let date = datePrefix(r);
  // ONE DATE, NOT TWO (2026-10-01, the wake review): a statement that already
  // opens with the very date the prefix would state ("2026-09-26: …") read
  // "2026-09-26 · 2026-09-26: …". The line still opens with that date; only a
  // plain prefix is dropped — "by", "(of …)" and "(due …)" say something the
  // statement does not, and a standing qualifier would come between.
  const learned = (r.learnedOn ?? "").trim();
  if (standing === "" && learned !== "" && date === `${learned}${DATE_SEP}` && statement.startsWith(learned)) date = "";
  return `- ${date}${standing}${statement}${r.standing?.suffix ?? ""}`;
}

type Kept = Record<LaneName, Ranked[]>;

/** Every lane empty — the floor a composition cannot go below. */
function emptyKept(): Kept {
  return { identity: [], craft: [], threads: [], hints: [], horizon: [] };
}

function emptyCounts(): Record<LaneName, number> {
  return { identity: 0, craft: 0, threads: 0, hints: 0, horizon: 0 };
}

/**
 * Solve the byte fixed point EXACTLY rather than iterating and hoping.
 *
 * The header and the sentinel each state the composed total, so the total
 * depends on how many DIGITS the total has. With `skeleton` = the composed bytes
 * excluding the two numbers, the true total for a digit width `w` is
 * `skeleton + occurrences * w`; the fixed point is the first `w` whose own digit
 * count matches. v1's approach — iterate a few times and take what you get —
 * silently ships a sentinel that is wrong by one or two bytes exactly when the
 * total crosses a power of ten, which is the moment anyone reads it.
 */
export function fixedPointTotal(skeletonBytes: number, occurrences: number): number {
  for (let w = 1; w <= 12; w++) {
    const total = skeletonBytes + occurrences * w;
    if (String(total).length === w) return total;
  }
  // Unreachable for any total under 10^12; loud rather than silently wrong.
  throw new Error(`self: byte fixed point did not converge (skeleton=${skeletonBytes})`);
}

export function compose(
  kept: Kept,
  day: number,
  resolve: Resolve,
  coreName?: string,
  identity?: IdentityBlock,
  /** A lane's "N more" line (`moreLine`), printed under its elements. */
  more: Partial<Record<LaneName, string>> = {},
  /** The "Yesterday" line (`BriefingRequest.yesterday`), under the framing. */
  yesterday?: string,
  /** The "Today, elsewhere" line (`BriefingRequest.elsewhere`), above "Nearby". */
  elsewhere?: string,
  /** The lanes' lines folded into one (`foldedLine`), under "Who I am"; the
   *  caller then passes no `more`. */
  fold?: string,
): Composed {
  const counts = emptyCounts();
  for (const lane of LANE_ORDER) counts[lane] = kept[lane].length;
  const elements = LANE_ORDER.reduce((n, lane) => n + counts[lane], 0);
  // The day-0 lane: a heading and one line of furniture, never an element. The
  // counts and `elements` above are untouched, so `elements=0` in the header and
  // `identity=0` in the sentinel stay true of a bundle that carries it. The same
  // is true of the page and the still-forming line below.
  const page = identity?.page ?? null;
  const forming = identity?.forming ?? null;
  const dayZero =
    page === null && kept.identity.length === 0 && coreName !== undefined && coreName.length > 0
      ? coreName
      : null;

  const build = (bytes: string): string => {
    const lines: string[] = [headerLine(day, elements, bytes), FRAMING.context];
    if (yesterday !== undefined && yesterday.length > 0) lines.push(flatten(yesterday));
    for (const lane of LANE_ORDER) {
      const items = kept[lane];
      if (lane === "hints" && elsewhere !== undefined && elsewhere.length > 0) lines.push("", flatten(elsewhere));
      if (lane === "identity") {
        const furniture = page !== null || forming !== null || dayZero !== null;
        if (items.length === 0 && !furniture && more.identity === undefined) continue;
        lines.push("", laneHeading(lane));
        // THE PAGE FIRST, and then nothing else that speaks for the same thing:
        // `render` empties the lane when a page exists, so the loop below is a
        // no-op there. A direct caller that hands both is rendered both rather
        // than silently cut, because `counts.identity` would otherwise state a
        // number the bundle does not carry.
        if (page !== null) {
          // The top line, the page on its rung, its date, then the end line
          // the top line names (2026-10-10): a reader can tell a page that
          // ended from one cut on the way.
          if (page.top !== null) lines.push(page.top);
          lines.push(page.text);
          if (page.dateline !== null) lines.push(page.dateline);
          if (page.end !== null) lines.push(page.end);
        } else {
          if (forming !== null) lines.push(forming);
          if (dayZero !== null) lines.push(identityCoreLine(dayZero));
        }
        for (const item of items) lines.push(elementLine(item, resolve));
        if (more.identity !== undefined) lines.push(more.identity);
        continue;
      }
      // The folded line (2026-10-12): just under "Who I am", where a preview
      // that keeps the head of the wake still carries it.
      if (lane === "craft" && fold !== undefined && fold.length > 0) lines.push("", fold);
      const tail = more[lane];
      if (items.length === 0 && tail === undefined) continue;
      // Nothing listed: the tail is the lane's one collapsed line, heading
      // included (`collapsedLine`), never a heading over a count.
      if (items.length === 0 && tail !== undefined) {
        lines.push("", tail);
        continue;
      }
      lines.push("", laneHeading(lane));
      for (const item of items) lines.push(elementLine(item, resolve));
      if (tail !== undefined) lines.push(tail);
    }
    lines.push("", sentinelLine(day, counts, elements, bytes, page !== null));
    return lines.join("\n");
  };

  const skeleton = byteLength(build(""));
  const total = fixedPointTotal(skeleton, 2);
  const stated = String(total);
  const text = build(stated);
  return {
    text,
    bytes: byteLength(text),
    header: headerLine(day, elements, stated),
    sentinel: sentinelLine(day, counts, elements, stated, page !== null),
    counts,
    elements,
  };
}

/** What one element costs the composition: its own rendered line, exactly —
 *  the DATE included, so the share bounds what is actually written. */
function elementBytes(item: Ranked, resolve: Resolve): number {
  return byteLength(`${elementLine(item, resolve)}\n`);
}

/** The identity lane's ceiling in bytes while other lanes are competing for it. */
export function identityShareBytes(budgetBytes: number, t: SelfTunables): number {
  return Math.floor(budgetBytes * t.IDENTITY_SHARE);
}

/**
 * Cut the identity lane down to its share, BY WHOLE ELEMENTS, and return what
 * was held back (in rank order) so the leftover pass can offer it the room.
 *
 * Two rules keep this from becoming a lane budget:
 *
 *   - **No other lane has content ⇒ no share at all.** A store that is nothing
 *     but identity is not a store competing with itself, and half a budget of
 *     white space is not a smaller wake, it is a worse one.
 *   - **The first element always survives the cut.** An element is admitted
 *     whole or not at all, so a single element longer than the share would
 *     otherwise empty the lane the briefing exists for. The BUDGET may still
 *     take it later, in `TRIM_ORDER` position, which is where that decision
 *     belongs.
 */
function withheldForShare(
  kept: Kept,
  budgetBytes: number,
  resolve: Resolve,
  t: SelfTunables,
): Ranked[] {
  const competing = LANE_ORDER.some((l) => l !== "identity" && kept[l].length > 0);
  if (!competing || kept.identity.length === 0) return [];
  const share = identityShareBytes(budgetBytes, t);
  let used = 0;
  let n = 0;
  for (const item of kept.identity) {
    const cost = elementBytes(item, resolve);
    if (n > 0 && used + cost > share) break;
    used += cost;
    n += 1;
  }
  return kept.identity.splice(n);
}

/**
 * WHAT EACH LANE LOST, by id, in the lane's rank order: the budget trim's
 * (popped from the end, so reversed back), then — identity only — what the
 * share held back and the leftover did not return, then what the lane's cap
 * left out — but not Nearby's cap, which is the rest of the store
 * (`MORE_ORDER`'s note). Identity says nothing while the page replaces the list.
 */
function lostByLane(
  overflow: Partial<Record<LaneName, readonly string[]>> | undefined,
  trimmed: readonly TrimEvent[],
  held: readonly Ranked[],
  suppressList: boolean,
): Partial<Record<LaneName, string[]>> {
  const out: Partial<Record<LaneName, string[]>> = {};
  for (const lane of LANE_ORDER) {
    if (lane === "identity" && suppressList) continue;
    const ids = [
      ...trimmed.filter((e) => e.lane === lane).map((e) => e.id).reverse(),
      ...(lane === "identity" ? held.map((r) => r.id) : []),
      ...(lane === "hints" ? [] : (overflow?.[lane] ?? [])),
    ];
    if (ids.length > 0) out[lane] = ids;
  }
  return out;
}

/**
 * WHAT THE RENDER HAS COMPOSED SO FAR, rescue by rescue (2026-10-10): the trim
 * loop's composition, then each lane that took room from the lanes below it
 * (`takeRoom`). `lent` is what the composition runs past `budgetBytes` — lent
 * by "Work here" first, then by the room held for "Last here" and the handoff
 * pointer — and `pinned` the count lines already paid for, which
 * the render keeps (`tellLost`).
 */
interface Rescued {
  readonly kept: Kept;
  readonly trimmed: TrimEvent[];
  readonly yesterday: string | undefined;
  /** The "Today, elsewhere" line as it stands (`BriefingRequest.elsewhere`). */
  readonly elsewhere: string | undefined;
  readonly pinned: Partial<Record<LaneName, string[]>>;
  readonly composed: Composed;
  readonly lent: number;
  /** True when `pinned` is said in the one folded line (`foldedLine`): the
   *  trim loop found no room for each lane's own. A rescue may unfold it,
   *  never fold it. */
  readonly fold: boolean;
}

interface RescueCtx {
  readonly req: BriefingRequest;
  readonly resolve: Resolve;
  readonly coreName: string | undefined;
  readonly identity: IdentityBlock;
  /** How many of Arriving's first lines no rescue below them may take
   *  (`arrivingHead`). */
  readonly head: number;
  /** The "Today, elsewhere" line's forms, widest first (`narrowerElsewhere`). */
  readonly elsewhereForms: readonly string[];
}

function copyKept(k: Kept): Kept {
  return {
    identity: [...k.identity],
    craft: [...k.craft],
    threads: [...k.threads],
    hints: [...k.hints],
    horizon: [...k.horizon],
  };
}

/** A non-negative whole number of bytes, or 0. */
function lendOf(n: number | undefined): number {
  return Math.max(0, Math.floor(n ?? 0));
}

/**
 * The count lines a composition carries for its pinned lanes: "N more", or —
 * a lane that lists nothing — its one collapsed line (`collapsedLine`).
 */
function pinnedLines(pinned: Partial<Record<LaneName, readonly string[]>>, kept: Kept): Partial<Record<LaneName, string>> {
  const out: Partial<Record<LaneName, string>> = {};
  for (const lane of LANE_ORDER) {
    const ids = pinned[lane];
    if (ids === undefined || ids.length === 0) continue;
    out[lane] = lane !== "identity" && kept[lane].length === 0 ? collapsedLine(lane, ids) : moreLine(lane, ids);
  }
  return out;
}

/**
 * How many of Arriving's first lines are its HEAD (2026-10-10): every plain
 * reminder due the day the wake is read (`Ranked.due`, which `Self#build`
 * puts first), or else its first line alone. No rescue ranked below
 * `ROOM_ORDER`'s `arrivingFirst` takes them; "Still open"'s first item takes
 * the lines after them, and last of all (`takeRoom`'s `arriving` step).
 */
export function arrivingHead(horizon: readonly Pick<Ranked, "due">[]): number {
  let n = 0;
  while (horizon[n]?.due === true) n += 1;
  return Math.min(horizon.length, Math.max(1, n));
}

/** How many days ahead a dated item counts as NEAR at session start
 *  (`HorizonItem.near`; 2026-10-12, RANDOM's ruling, lightly held). */
export const ARRIVING_NEAR_DAYS = 3;

/** Whether a dated item due `due` is NEAR on `at`: from that day through
 *  `ARRIVING_NEAR_DAYS` after it. A grace day's "was due" line, behind `at`,
 *  is not (RANDOM's ruling at the review of #445, 2026-10-12, lightly held). */
export function nearDue(due: string | undefined, at: string): boolean {
  return due !== undefined && isDay(due) && isDay(at) && due >= at && due <= addDays(at, ARRIVING_NEAR_DAYS);
}

/**
 * How many of Arriving's first lines are NEAR (2026-10-12): the head, then
 * every line after it marked `near` (`Ranked.near`, set at session start
 * only, and sorted to follow the head). Zero when none is.
 */
export function arrivingNear(horizon: readonly Pick<Ranked, "due" | "near">[]): number {
  let n = 0;
  while (horizon[n]?.due === true || horizon[n]?.near === true) n += 1;
  return horizon.some((r) => r.near === true) ? n : 0;
}

/**
 * The "Today, elsewhere" line's forms the render may print, widest first:
 * each within `TODAY_ELSEWHERE_MAX_BYTES` (2026-10-10), each narrower than
 * the one before. Empty without a line.
 */
function elsewhereFormsOf(line: string | undefined, shorter: readonly string[] | undefined): string[] {
  if (line === undefined || line.length === 0) return [];
  const out: string[] = [];
  for (const form of [line, ...(shorter ?? [])]) {
    const size = byteLength(flatten(form));
    if (form.length === 0 || size > TODAY_ELSEWHERE_MAX_BYTES) continue;
    const last = out[out.length - 1];
    if (last !== undefined && size >= byteLength(flatten(last))) continue;
    out.push(form);
  }
  return out;
}

/** The "Today, elsewhere" line's next form after `line` in `forms`, or none. */
function narrowerElsewhere(line: string, forms: readonly string[]): string | undefined {
  const at = forms.indexOf(line);
  return at < 0 ? undefined : forms[at + 1];
}

/** The Yesterday line's shorter forms, widest first, each narrower than `line`. */
function shorterThan(line: string | undefined, forms: readonly string[] | undefined): string[] {
  if (line === undefined) return [];
  const bytes = byteLength(line);
  return (forms ?? []).filter((s) => s.length > 0 && byteLength(s) < bytes);
}

/**
 * TAKE ROOM FROM THE LANES BELOW `target`, lowest first, as `ROOM_ORDER` says
 * (2026-10-10) — and only as much as it needs: the composition `want`, with
 * its `pinned` count lines, is tried as it stands, then again after each
 * step, and the first that fits is kept. The steps the render can take:
 *
 *   - `work` — the room held for "Work here" (`lendBytes`);
 *   - `yesterday` — the Yesterday line, one title at a time given way to its
 *     id (`yesterdayShorter`);
 *   - `handoffs` — the room held for "Last here" and the handoff pointer
 *     (`handoffLendBytes`), which the delivery gives up in its own order;
 *   - `arriving` — Arriving's lines past its head (`arrivingHead`), from the
 *     end, each a `TrimEvent` so the lane's count can still say so;
 *   - `elsewhere` — the "Today, elsewhere" line, a narrower form at a time,
 *     then none (2026-10-10; between `handoffs` and `arriving` since the
 *     review of #380). The trim loop also asks here on the line's behalf
 *     (`target` `elsewhere`) before it steps the line down;
 *   - `handoffsKept` — the room held for the newest handoff's own block
 *     (`handoffKeepBytes`): reached only by `due`, the one lane above it
 *     that takes room here (review of #367; `arrivingNear` stops below it,
 *     review of #445).
 *
 * The lanes below them are the trim loop's and are gone before any rescue
 * runs; `lastHere` is the delivery's, inside the room lent at `handoffs`; the
 * page is chosen before the lanes (`Self#build`), and gives its borrowing
 * back to `due` there. All or nothing: null when even the last step below
 * `target` leaves no room — the render is then what it was.
 */
function takeRoom(
  target: RoomLane,
  from: Rescued,
  want: Kept,
  pinned: Partial<Record<LaneName, readonly string[]>>,
  trimmed: readonly TrimEvent[],
  ctx: RescueCtx,
  /** Folded (`from.fold`): try the one folded line before each lane's own —
   *  the trim loop's own call, so the lanes' count borrows as little as it
   *  can (2026-10-12). */
  foldFirst = false,
): Rescued | null {
  const { req } = ctx;
  const work = lendOf(req.lendBytes);
  const handoffs = lendOf(req.handoffLendBytes);
  const kept = lendOf(req.handoffKeepBytes);
  const k = copyKept(want);
  const t = [...trimmed];
  const pins: Partial<Record<LaneName, string[]>> = {};
  for (const lane of LANE_ORDER) {
    const ids = pinned[lane];
    if (ids !== undefined && ids.length > 0) pins[lane] = [...ids];
  }
  let limit = req.budgetBytes + from.lent;
  let y = from.yesterday;
  let e = from.elsewhere;
  const attempt = (): Rescued | null => {
    // Folded already (2026-10-12): each lane's own line when there is room,
    // else the one line — never a lane left without a word. `foldFirst`:
    // the one line first.
    const each = (): Composed => compose(k, req.day, ctx.resolve, ctx.coreName, ctx.identity, pinnedLines(pins, k), y, e);
    const folded = from.fold ? foldedLine(pins) : null;
    const one = (): Composed | null => (folded === null ? null : compose(k, req.day, ctx.resolve, ctx.coreName, ctx.identity, {}, y, e, folded));
    let fold = false;
    let c: Composed;
    const first = foldFirst ? one() : null;
    if (first !== null && first.bytes <= limit) {
      c = first;
      fold = true;
    } else {
      c = each();
      const second = c.bytes > limit && !foldFirst ? one() : null;
      if (second !== null) {
        c = second;
        fold = true;
      }
    }
    return c.bytes <= limit
      ? { kept: k, trimmed: t, yesterday: y, elsewhere: e, pinned: pins, composed: c, lent: Math.max(0, c.bytes - req.budgetBytes), fold }
      : null;
  };
  let got = attempt();
  for (const lane of ROOM_ORDER) {
    if (got !== null || lane === target) break;
    switch (lane) {
      case "elsewhere":
        // Its titles first, then the line (2026-10-10).
        while (got === null && e !== undefined) {
          e = narrowerElsewhere(e, ctx.elsewhereForms);
          got = attempt();
        }
        break;
      case "work":
        if (req.budgetBytes + work > limit) {
          limit = req.budgetBytes + work;
          got = attempt();
        }
        break;
      case "yesterday":
        for (const form of shorterThan(y, req.yesterdayShorter)) {
          y = form;
          got = attempt();
          if (got !== null) break;
        }
        break;
      case "handoffs":
        if (req.budgetBytes + work + handoffs > limit) {
          limit = req.budgetBytes + work + handoffs;
          got = attempt();
        }
        break;
      case "arriving":
        while (got === null && k.horizon.length > ctx.head) {
          const dropped = k.horizon.pop();
          if (dropped === undefined) break;
          t.push({ lane: "horizon", id: dropped.id, strength: dropped.strength });
          // The lane's count names it, first: it ranked first. Always
          // (2026-10-12): a line popped here is never popped without a word.
          pins.horizon = [dropped.id, ...(pins.horizon ?? [])];
          got = attempt();
        }
        break;
      case "handoffsKept":
        if (req.budgetBytes + work + handoffs + kept > limit) {
          limit = req.budgetBytes + work + handoffs + kept;
          got = attempt();
        }
        break;
      default:
        break;
    }
  }
  return got;
}

/**
 * "ARRIVING:" LISTS ITS DATED ITEMS BEFORE THE FURNITURE BELOW IT KEEPS ITS
 * ROOM (2026-10-10, `ROOM_ORDER`). The trim loop pops Arriving only after
 * "Nearby", craft and "Still open" are gone, but the page, the Yesterday line
 * and the room held for the delivery's lanes are nothing it can pop — so on
 * the owner's lived day 19 his tax reminder collapsed to "Arriving: 1 — no
 * room to list them" while yesterday's titles and four handoffs printed.
 *
 * Here the lane's first `upTo` lines are listed again — as many as fit, each
 * time with the count of the rest (an item under a heading with no count
 * reads as the only one arriving). Without the count only for a plain
 * reminder due the day the wake is read (`target` `due`): it is said in full
 * whatever else happens (#442), and the render's last step folds the count
 * it could not carry into one line (2026-10-12; before that, any listed date
 * outranked the count of the others, and the rest went unsaid). The room comes from the
 * lanes below `target` (`takeRoom`). Called twice: for the lane's head at
 * its own rank (`due` or `arrivingFirst`), and — after "Still open"'s first
 * item — for the rest at `arriving`. Null when nothing was trimmed from it,
 * or nothing more fits.
 */
function keepArriving(
  arrived: readonly Ranked[],
  overflow: readonly string[],
  upTo: number,
  target: RoomLane,
  from: Rescued,
  ctx: RescueCtx,
): Rescued | null {
  const want = Math.min(upTo, arrived.length);
  for (let n = want; n > from.kept.horizon.length; n--) {
    const listed = arrived.slice(0, n);
    const k: Kept = { ...copyKept(from.kept), horizon: [...listed] };
    const t = from.trimmed.filter((e) => !(e.lane === "horizon" && listed.some((r) => r.id === e.id)));
    // The rest, as `lostByLane` lists it: the trim's (popped from the end, so
    // reversed back), then what the lane's cap left out.
    const rest = [...t.filter((e) => e.lane === "horizon").map((e) => e.id).reverse(), ...overflow];
    const others: Partial<Record<LaneName, string[]>> = { ...from.pinned };
    delete others.horizon;
    for (const counted of rest.length === 0 ? [false] : target === "due" ? [true, false] : [true]) {
      const got = takeRoom(target, from, k, counted ? { ...others, horizon: rest } : others, t, ctx);
      if (got !== null) return got;
    }
  }
  return null;
}

/**
 * "ARRIVING:" SAYS HOW MANY MORE, BY ID, BEFORE IT LISTS A LATER LINE IN FULL
 * (review of #367, 2026-10-10). The lane's count names every dated item it
 * did not list — the trim's and those past `prospective/`'s count
 * (`BoundaryRequest.horizonMore`) — and those past the count leave no trim
 * row for doctor to read, so a count left out is a dated item silently gone.
 * Last of the rescues: when the lane lists something and has no count yet,
 * the count takes room from the lanes below `arriving` — "Work here", the
 * Yesterday line's titles, the handoffs' room — and, only when it names an
 * item past that count (one no trim row records), from Arriving's lines past
 * its head too, each named in the count it pays for. A count of the trim's
 * alone leaves the listed lines as they are: a listed date outranks it, and
 * doctor reads the trim. Null when the count is already in, there is nothing
 * to count, or no room is found.
 *
 * AND WHEN THE LANE LISTS NOTHING (2026-10-12): its one collapsed line takes
 * room the same way. The owner's 10-12 bundles carried seven dated items and
 * not a word about them — the page, borrowing "Work here", had spent the
 * room, and the line was offered only what was left.
 */
function keepArrivingCount(overflow: readonly string[], from: Rescued, ctx: RescueCtx): Rescued | null {
  if ((from.pinned.horizon?.length ?? 0) > 0) return null;
  const rest = [...from.trimmed.filter((e) => e.lane === "horizon").map((e) => e.id).reverse(), ...overflow];
  if (rest.length === 0) return null;
  const pinned = { ...from.pinned, horizon: rest };
  // Room as the composition stands: `tellLost` says it then, as it says every lane's.
  const { req } = ctx;
  if (from.lent === 0 && compose(from.kept, req.day, ctx.resolve, ctx.coreName, ctx.identity, pinnedLines(pinned, from.kept), from.yesterday, from.elsewhere).bytes <= req.budgetBytes) {
    return null;
  }
  return takeRoom(overflow.length > 0 ? "openFirst" : "arriving", from, from.kept, pinned, from.trimmed, ctx);
}

/**
 * "STILL OPEN" KEEPS ITS FIRST ITEM, AND ITS COUNT (review of #350,
 * 2026-10-09; its place in `ROOM_ORDER` since 2026-10-10).
 *
 * The owner's wake on 10-09 read "Still open:" over "(20 more still open; …)"
 * and no item. The self page is furniture the trim cannot pop, the Yesterday
 * line is too, and `TRIM_ORDER` takes "Still open" before "Arriving" — so
 * beside a long page the lane gave up its last item while Arriving kept every
 * line. The page is not what gives way: it is the self the wake is for
 * (`Self#pageBlock`). What gives way is what `ROOM_ORDER` ranks below
 * `openFirst`, lowest first (`takeRoom`): "Work here", the Yesterday line's
 * titles, the room for "Last here" and the handoffs, and only then Arriving
 * past its head — whose first line, and every plain reminder due the day the
 * wake is read, rank above this.
 *
 * The target is the lane's first item AND its "N more" line: one item under a
 * heading with no count reads as the only thing open. All or nothing: when
 * even the last step leaves no room, the render is what it was, and a lane
 * that lists nothing says so in one line (`collapsedLine`).
 *
 * AND THE COUNT BESIDE WHAT THE TRIM KEPT (review of #358, 2026-10-09): when
 * the trim loop left the lane its items but no room for its "N more" line,
 * the count is paid for out of "Work here" and out of nothing else
 * (`openCount`, just above `work`): the items stay as the trim kept them (a
 * smaller budget still keeps a subset). Not when the count already fits as
 * the composition stands: `tellLost` says it then, as it says every
 * lane's.
 */
function keepFirstOpen(
  arrived: readonly Ranked[],
  overflow: readonly string[],
  arrivedHorizon: number,
  from: Rescued,
  ctx: RescueCtx,
): Rescued | null {
  const first = arrived[0];
  if (first === undefined) return null;
  const kept = from.kept;
  // Arriving's FIRST line outranks it: when not even that is listed, this
  // budget has no room to rearrange.
  if (kept.threads.length === 0 && arrivedHorizon > 0 && kept.horizon.length === 0) return null;
  // What the lane lists: the items the trim kept, or — when it kept none —
  // its first item.
  const k: Kept = { ...copyKept(kept), threads: kept.threads.length > 0 ? [...kept.threads] : [first] };
  const t = from.trimmed.filter((e) => !(e.lane === "threads" && k.threads.some((l) => l.id === e.id)));
  // The rest of the lane, as `lostByLane` will list it: the trim's (popped
  // from the end, so reversed back), then what the lane's cap left out.
  const rest = [...t.filter((e) => e.lane === "threads").map((e) => e.id).reverse(), ...overflow];
  const pinned: Partial<Record<LaneName, string[]>> = { ...from.pinned, threads: rest };
  if (rest.length === 0) delete pinned.threads;
  if (kept.threads.length > 0) {
    // Items the trim kept: only their count is owed here, and only when it
    // does not fit as the composition stands.
    if (rest.length === 0) return null;
    const { req } = ctx;
    const asIs = compose(k, req.day, ctx.resolve, ctx.coreName, ctx.identity, pinnedLines(pinned, k), from.yesterday, from.elsewhere);
    if (from.lent === 0 && asIs.bytes <= req.budgetBytes) return null;
    return takeRoom("openCount", from, k, pinned, t, ctx);
  }
  return takeRoom("openFirst", from, k, pinned, t, ctx);
}

/**
 * THE LANES' LINES, SAID LAST AND CHECKED (2026-10-12): every lane that lost
 * something, counted under `limit`. Each lane's own line ("N more", or the
 * collapsed line of a lane that lists nothing) when they all fit; else the
 * one folded line (`foldedLine`); else — a floor over its budget, or a bug —
 * each lane's line in `MORE_ORDER` while it still fits, and what is left
 * `untold`, which the caller records and doctor reads in red. The room was
 * reserved: the trim loop and every rescue composed with these lines.
 */
function tellLost(ctx: {
  kept: Kept;
  lost: Partial<Record<LaneName, string[]>>;
  req: BriefingRequest;
  resolve: Resolve;
  coreName: string | undefined;
  identity: IdentityBlock;
  yesterday?: string;
  elsewhere?: string;
  limit: number;
}): { composed: Composed; more: Partial<Record<LaneName, number>>; folded: boolean; untold: Partial<Record<LaneName, number>> } {
  const at = (more: Partial<Record<LaneName, string>>, fold?: string): Composed =>
    compose(ctx.kept, ctx.req.day, ctx.resolve, ctx.coreName, ctx.identity, more, ctx.yesterday, ctx.elsewhere, fold);
  const counts: Partial<Record<LaneName, number>> = {};
  for (const lane of LANE_ORDER) {
    const n = ctx.lost[lane]?.length ?? 0;
    if (n > 0) counts[lane] = n;
  }
  const each = at(pinnedLines(ctx.lost, ctx.kept));
  if (Object.keys(counts).length === 0 || each.bytes <= ctx.limit) return { composed: each, more: counts, folded: false, untold: {} };
  const line = foldedLine(ctx.lost);
  if (line !== null) {
    const folded = at({}, line);
    if (folded.bytes <= ctx.limit) return { composed: folded, more: counts, folded: true, untold: {} };
  }
  // The last resort: what fits, lane by lane; the rest is untold.
  let current = at({});
  const lines: Partial<Record<LaneName, string>> = {};
  const more: Partial<Record<LaneName, number>> = {};
  for (const lane of MORE_ORDER) {
    const ids = ctx.lost[lane];
    if (ids === undefined || ids.length === 0) continue;
    lines[lane] = lane !== "identity" && ctx.kept[lane].length === 0 ? collapsedLine(lane, ids) : moreLine(lane, ids);
    const candidate = at(lines);
    if (candidate.bytes > ctx.limit) {
      delete lines[lane];
      continue;
    }
    current = candidate;
    more[lane] = ids.length;
  }
  const untold: Partial<Record<LaneName, number>> = {};
  for (const lane of LANE_ORDER) {
    const n = counts[lane];
    if (n !== undefined && more[lane] === undefined) untold[lane] = n;
  }
  return { composed: current, more, folded: false, untold };
}

/**
 * Compose within the caller's budget, trimming in `TRIM_ORDER` until it fits.
 *
 * Trimming pops the LAST item of the lane — the lane's own ordering decides who
 * that is (identity: weakest; threads: the newest non-relational one) — and never
 * skips down the lane looking for something that would fit, because a
 * skip-and-refill is exactly the iteration luck §1 G4 forbids.
 *
 * If the floor itself does not fit, the floor is returned anyway with
 * `overBudget: true`. That is a deliberate divergence from `recall/`, which goes
 * quiet: a quiet turn is a turn with nothing to say, but a wake with nothing to
 * say is amnesia, and v1 shipped exactly that failure disguised as a fresh
 * install (scar §2.3). A misconfigured ceiling gets a tripwire, not a lobotomy.
 */
export function render(
  lanes: Kept & { readonly overflow?: Partial<Record<LaneName, readonly string[]>> },
  req: BriefingRequest,
  resolve: Resolve,
  t: SelfTunables,
): BriefingResult {
  const kept: Kept = {
    identity: [...lanes.identity],
    craft: [...lanes.craft],
    threads: [...lanes.threads],
    hints: [...lanes.hints],
    horizon: [...lanes.horizon],
  };
  const trimmed: TrimEvent[] = [];
  // THE DAY-0 GUARD, DECIDED ONCE, HERE — on the lane as it ARRIVED.
  //
  // Adversarial review of PR #71: gating the lookup on the ranked lane and the
  // render on the post-trim copy is two predicates, and the trim loop pops from
  // `kept.identity` last but it does pop. A day-30 store with two real identity
  // beliefs and a 400-byte ceiling trimmed both and then asserted "No identity
  // has formed here yet" — identity amnesia printed over a store that has
  // identity, which is this module's own worst failure (scar §2.3). Unreachable
  // through `Self`, which never sets `coreName` on a non-empty lane; reachable
  // by any caller of this exported function, and the CONTRACT's "guarded by the
  // empty lane" has to be true at the seam that renders, not only at the seam
  // that looks the name up. A store that HAS identity says nothing about not
  // having it, whatever the budget did to the lane.
  const coreName = lanes.identity.length === 0 ? req.coreName : undefined;
  // THE PAGE REPLACES THE LIST (spec §15 item 4), and it replaces it HERE — by
  // emptying the lane before the share, the trim order or the counts see it —
  // so `counts.identity` and the sentinel's `elements=` state what the bundle
  // actually carries. The lane's elements are not "trimmed": nothing was
  // dropped for want of room, so no `TrimEvent` is written for them, and the
  // rotation memory (`RENDERED_PREFIX`) simply stops advancing while a page is
  // what renders.
  //
  // THE STILL-FORMING LINE, which is about the PAGE and never about identity,
  // and which prints on ONE value of the switch: the list has been turned off
  // and no page has been written, so the line stands in the list's place.
  //
  // **It deliberately does NOT print under the default, on a lane that happens
  // to be empty**, and the reason is measured rather than tidy. It is FURNITURE
  // — untrimmable, like the day-0 line — so printing it whenever the lane is
  // empty adds ~127 bytes to the floor of every such wake. A host reporting a
  // 400-byte ceiling then composes 539 and publishes `overBudget`, which is the
  // host-budget guarantee (§1, scar §2.18) paying for a sentence. On a
  // brand-new store the day-0 line already says the same thing in the words
  // this module chose for it — "No identity has formed here yet — identity is
  // earned at the boundary…" — so the honesty the plan asks for on a first wake
  // is already there, and the switch's other value is one word away for an
  // owner who wants the sentence verbatim. See NOTES §12.
  const page = req.page ?? null;
  const exists = page !== null || req.pageExists === true;
  const suppressList = page !== null || !t.PAGE_EMPTY_SHOWS_LIST;
  if (suppressList) kept.identity.length = 0;
  const identity: IdentityBlock = {
    page,
    // A page this ceiling could not carry is still a page, so the line that says
    // none has been written stays off it (MINOR-D).
    forming: !exists && !t.PAGE_EMPTY_SHOWS_LIST ? PAGE_FORMING_LINE : null,
  };
  // THE SHARE, applied BEFORE the trim order rather than inside it: identity
  // trims last by policy, so by the time the trim loop could bound identity
  // every other lane is already gone. Held-back elements are not trimmed —
  // nothing is dropped here, and `held` is offered the leftover below.
  const held = withheldForShare(kept, req.budgetBytes, resolve, t);
  // THE "YESTERDAY" LINE rides only while the FLOOR — no element at all — fits
  // with it: it is furniture the trim loop cannot pop, and a ceiling too small
  // for it is told nothing rather than published over budget. Since
  // 2026-10-10 it rides in its widest form that fits — a title at a time
  // given way to its id, pointers instead of titles — and, ranked above "Work
  // here" (`ROOM_ORDER`), in what is left of that room when the budget alone
  // has none: beside a page that borrowed, the whole line was dropped, ids
  // and all. Told nothing only when not even its pointers fit.
  const forms =
    req.yesterday === undefined || req.yesterday.length === 0 ? [] : [req.yesterday, ...shorterThan(req.yesterday, req.yesterdayShorter)];
  const floorWith = (y: string): number => compose(emptyKept(), req.day, resolve, coreName, identity, {}, y).bytes;
  let yesterday = forms.find((y) => floorWith(y) <= req.budgetBytes + lendOf(req.lendBytes));
  // What the line borrowed, the trim loop composes inside.
  let base = yesterday === undefined ? req.budgetBytes : Math.max(req.budgetBytes, floorWith(yesterday));
  // THE "TODAY, ELSEWHERE" LINE (2026-10-10; at most
  // `TODAY_ELSEWHERE_MAX_BYTES`, b2 + random-f8, lightly held; its rank since
  // the review of #380, `ROOM_ORDER`'s `elsewhere`, between the handoffs'
  // room and "Arriving:"): its widest form first. The trim loop pops the
  // lanes below it — "Nearby", craft, "Still open" past its first item —
  // and before it would pop one above it, the line takes room from "Work
  // here", the Yesterday line's titles and the handoffs' room (`takeRoom`),
  // and only then steps down a form. The rescues below step it down for
  // what ranks above it; the page and its borrowing, chosen before the lanes
  // (`Self#composeLanes`), give it nothing. Not a lane: no trim row.
  const elsewhereForms = elsewhereFormsOf(req.elsewhere, req.elsewhereShorter);
  let elsewhere: string | undefined = elsewhereForms[0];
  const ctx: RescueCtx = { req, resolve, coreName, identity, head: arrivingHead(lanes.horizon), elsewhereForms };
  // "Still open"'s last item left is its first, which outranks the line
  // with its count (`openFirst`, as `keepFirstOpen` restores them): the line
  // finds room for itself beside both, or steps down, before the trim loop
  // pops it.
  const lone = (lane: LaneName): boolean => lane === "threads" && kept.threads.length === 1;
  const outranksLine = (lane: LaneName): boolean =>
    ROOM_ORDER.indexOf(lone(lane) ? "openFirst" : TRIM_ROOM[lane]) > ROOM_ORDER.indexOf("elsewhere");

  // EACH LANE'S LINE IS RESERVED (2026-10-12): the loop composes with the
  // line of every lane that has lost something so far — to its cap, the
  // identity share or a pop — and pops until items and lines fit together.
  // When nothing is left to pop, the "Today, elsewhere" line steps down, and
  // then the lanes' lines fold into one (`foldedLine`) — and they fold before
  // the loop pops "Who I am", the lane the wake is for. A floor that holds
  // not even the folded line composes bare (`bare`): its lanes go untold.
  let fold = false;
  let bare = false;
  const lostNow = (): Partial<Record<LaneName, string[]>> => lostByLane(lanes.overflow, trimmed, held, suppressList);
  const linesFor = (lost: Partial<Record<LaneName, readonly string[]>>, k: Kept, folded: boolean): { more: Partial<Record<LaneName, string>>; fold?: string } => {
    if (!folded) return { more: pinnedLines(lost, k) };
    const line = foldedLine(lost);
    return line === null ? { more: {} } : { more: {}, fold: line };
  };

  for (;;) {
    const lost = lostNow();
    const lines = bare ? { more: {} } : linesFor(lost, kept, fold);
    const c = compose(kept, req.day, resolve, coreName, identity, lines.more, yesterday, elsewhere, lines.fold);
    const fits = c.bytes <= base;
    let cut: TrimEvent | null = null;
    let stepped = false;
    if (!fits) {
      for (const lane of TRIM_ORDER) {
        if (elsewhere !== undefined && outranksLine(lane)) {
          const from: Rescued = { kept, trimmed: [...trimmed], yesterday, elsewhere, pinned: lost, composed: c, lent: base - req.budgetBytes, fold };
          // "Still open"'s lone item keeps its count beside it: `lost` has it.
          const got = takeRoom("elsewhere", from, kept, lost, trimmed, ctx);
          if (got === null) {
            elsewhere = narrowerElsewhere(elsewhere, elsewhereForms);
          } else {
            for (const l of LANE_ORDER) kept[l] = got.kept[l];
            trimmed.splice(0, trimmed.length, ...got.trimmed);
            yesterday = got.yesterday;
            base = req.budgetBytes + got.lent;
            fold = got.fold;
          }
          stepped = true;
          break;
        }
        const items = kept[lane];
        if (items.length === 0) continue;
        if (lane === "identity" && !fold && Object.keys(lost).length > 0) {
          const folded = linesFor(lost, kept, true);
          if (compose(kept, req.day, resolve, coreName, identity, folded.more, yesterday, elsewhere, folded.fold).bytes <= base) {
            fold = true;
            stepped = true;
            break;
          }
        }
        const dropped = items.pop();
        if (dropped === undefined) continue;
        cut = { lane, id: dropped.id, strength: dropped.strength };
        break;
      }
      if (cut === null && !stepped) {
        // Nothing left to pop. The lanes' lines fold into one; then that
        // line takes room from what ranks below a dated line (`takeRoom` to
        // `arrivingFirst`: "Work here", the Yesterday line's titles, the
        // handoffs' room, "Today, elsewhere", Arriving past its head) — and
        // only when even that finds none do the lanes go untold (`bare`).
        const counting = Object.keys(lost).length > 0;
        if (counting && !fold) {
          fold = true;
          continue;
        }
        if (counting && !bare) {
          const from: Rescued = { kept, trimmed: [...trimmed], yesterday, elsewhere, pinned: lost, composed: c, lent: base - req.budgetBytes, fold: true };
          const got = takeRoom("arrivingFirst", from, kept, lost, trimmed, ctx, true);
          if (got === null) {
            bare = true;
          } else {
            for (const l of LANE_ORDER) kept[l] = got.kept[l];
            trimmed.splice(0, trimmed.length, ...got.trimmed);
            yesterday = got.yesterday;
            elsewhere = got.elsewhere;
            base = req.budgetBytes + got.lent;
            fold = got.fold;
          }
          continue;
        }
        if (elsewhere !== undefined) {
          elsewhere = narrowerElsewhere(elsewhere, elsewhereForms);
          continue;
        }
      }
    }
    if (stepped) continue;
    if (fits || cut === null) {
      // WHAT THE TRIM COULD NOT POP GIVES WAY, IN `ROOM_ORDER` (2026-10-10):
      // the head of "Arriving:" — every plain reminder due the day the wake is
      // read, or its first line — then "Still open"'s first item and its
      // count (review of #350), then the rest of "Arriving:", each taking room
      // only from the lanes below it: "Work here", the Yesterday line's
      // titles, the room for "Last here" and the handoffs — never the page. A
      // rescue that finds no room leaves the render as it was. Each starts
      // from the lanes' reserved lines (`pinned`), and keeps them.
      const dueHead = lanes.horizon[0]?.due === true;
      const near = arrivingNear(lanes.horizon);
      // No later rescue takes a near line back to pay for a count of the rest.
      const nearCtx: RescueCtx = near > ctx.head ? { ...ctx, head: near } : ctx;
      const overflow = lanes.overflow;
      let state: Rescued = { kept, trimmed: [...trimmed], yesterday, elsewhere, pinned: lost, composed: c, lent: base - req.budgetBytes, fold: fold || bare };
      let first: Rescued | null = null;
      if (fits) {
        const steps: ((s: Rescued) => Rescued | null)[] = [
          (s) => keepArriving(lanes.horizon, overflow?.horizon ?? [], ctx.head, dueHead ? "due" : "arrivingFirst", s, ctx),
          (s) => keepFirstOpen(lanes.threads, overflow?.threads ?? [], lanes.horizon.length, s, ctx),
          // At session start, the lines due within the next few days, down
          // to, not into, the newest handoff's room (`arrivingNear`, 2026-10-12;
          // its floor, review of #445).
          (s) => (near > 0 ? keepArriving(lanes.horizon, overflow?.horizon ?? [], near, "arrivingNear", s, nearCtx) : null),
          (s) => keepArriving(lanes.horizon, overflow?.horizon ?? [], lanes.horizon.length, "arriving", s, ctx),
          (s) => keepArrivingCount(overflow?.horizon ?? [], s, nearCtx),
        ];
        for (const step of steps) {
          const next = step(state);
          if (next === null) continue;
          state = next;
          first = next;
        }
      }
      if (first !== null) {
        for (const lane of LANE_ORDER) kept[lane] = first.kept[lane];
        trimmed.splice(0, trimmed.length, ...first.trimmed);
      }
      const said = first === null ? yesterday : first.yesterday;
      const away = first === null ? elsewhere : first.elsewhere;
      // What it was composed to: the caller's budget, and what the delivery's
      // rooms lent (`takeRoom`) — so a reader comparing the bundle to its
      // ceiling sees one that fits, which it does: the delivery shows fewer
      // work lines, and then fewer handoffs, in what is left.
      const budgetBytes = req.budgetBytes + (first?.lent ?? base - req.budgetBytes);
      // The leftover clause. Only when NOTHING had to be trimmed: a lane that
      // lost an element wanted the room, and handing it to identity instead
      // would make the share decide the opposite of what it was set for. When
      // the other lanes are all present and the budget is still not spent, the
      // held-back identity elements take it back, in rank order, whole — each
      // with the identity count of what is still held, so the count's room
      // stays reserved. Not beside a rescue: its counts are already in.
      if (fits && first === null && trimmed.length === 0) {
        while (held.length > 0) {
          const next = held[0];
          if (next === undefined) break;
          kept.identity.push(next);
          const l = linesFor(lostByLane(lanes.overflow, trimmed, held.slice(1), suppressList), kept, fold);
          if (compose(kept, req.day, resolve, coreName, identity, l.more, said, away, l.fold).bytes > req.budgetBytes) {
            kept.identity.pop();
            break;
          }
          held.shift();
        }
      }
      // THE LANES' LINES, last and checked: each lane that lost something is
      // counted, in its own line or the folded one (`tellLost`).
      const told = tellLost({
        kept,
        lost: lostByLane(lanes.overflow, trimmed, held, suppressList),
        req,
        resolve,
        coreName,
        identity,
        ...(said === undefined ? {} : { yesterday: said }),
        ...(away === undefined ? {} : { elsewhere: away }),
        limit: budgetBytes,
      });
      // AN ARRIVING ID THE COUNT COULD NOT NAME LEAVES A TRIM ROW (review of
      // #367, 2026-10-10). One past the lane's cap — `prospective/`'s count
      // (`BoundaryRequest.horizonMore`) or the lane's own — was never a line
      // the trim popped, so when the lane's count did not fit either it was in
      // no line and no row. Now it is recorded as a popped line is (no rank of
      // its own: strength 0). Since 2026-10-12 the count is reserved, so this
      // is only a floor over its budget, and `untold` says so too.
      if (told.more.horizon === undefined) {
        const recorded = new Set(trimmed.filter((e) => e.lane === "horizon").map((e) => e.id));
        for (const id of lanes.overflow?.horizon ?? []) {
          if (!recorded.has(id)) trimmed.push({ lane: "horizon", id, strength: 0 });
        }
      }
      const composed = told.composed;
      return {
        ...composed,
        budgetBytes,
        day: req.day,
        kept: {
          identity: kept.identity.map((r) => r.id),
          craft: kept.craft.map((r) => r.id),
          threads: kept.threads.map((r) => r.id),
          hints: kept.hints.map((r) => r.id),
          horizon: kept.horizon.map((r) => r.id),
        },
        trimmed,
        more: told.more,
        folded: told.folded,
        untold: told.untold,
        pressure: composed.bytes >= budgetBytes * t.BUDGET_PRESSURE,
        overBudget: !fits,
        ...(away === undefined ? {} : { elsewhere: away }),
        page:
          identity.page === null
            ? null
            : {
                bytes: pageBlockBytes(identity.page),
                truncated: identity.page.truncated,
                wholeBytes: identity.page.wholeBytes,
                rung: identity.page.rung,
              },
      };
    }
    trimmed.push(cut);
  }
}

// ── reading a rendered bundle back ──────────────────────────────────────────

export interface SentinelReading {
  readonly present: boolean;
  readonly line: string | null;
  readonly statedBytes: number | null;
  readonly statedElements: number | null;
  readonly actualBytes: number;
  /** The sentinel is the last line AND its stated total matches the real one. */
  readonly intact: boolean;
}

const SENTINEL_RE = /^<!-- counterparts:wake\/end .*elements=(\d+) bytes=(\d+) -->$/;

/**
 * The consumer's half of the guarantee: verify arrival from the last line alone.
 * A bundle whose sentinel is missing was truncated in transit; one whose stated
 * bytes disagree with its real bytes was edited or clipped. Both are errors, and
 * neither is silence.
 */
export function readSentinel(text: string): SentinelReading {
  const actualBytes = byteLength(text);
  const lines = text.split("\n");
  const line = lines[lines.length - 1] ?? "";
  const m = SENTINEL_RE.exec(line);
  if (m === null) {
    return {
      present: false,
      line: null,
      statedBytes: null,
      statedElements: null,
      actualBytes,
      intact: false,
    };
  }
  const statedElements = Number(m[1]);
  const statedBytes = Number(m[2]);
  return {
    present: true,
    line,
    statedBytes,
    statedElements,
    actualBytes,
    intact: statedBytes === actualBytes,
  };
}


// ── the delivery preface (composed at INJECTION, never at sleep) ─────────────

/**
 * THE ONE LINE THE BODY CANNOT WRITE FOR ITSELF.
 *
 * The bundle is composed at a boundary and then served, unchanged, to every
 * session until the next one. On 2026-09-03 the memory system under this host
 * was switched from v1 to Counterparts mid-day; the stored wake still carried a
 * v1-era finding ("bansai's surprise pipeline has never fired") as a current
 * fact, nothing in the body said which system was speaking or how old the
 * render was, and the model repeated it as current until the owner corrected
 * it. Only the HTML comment named the system, and comments are furniture.
 *
 * So one line, composed where and when the bundle is DELIVERED — which system,
 * which lived day, today's date, how big the store is — and it says out loud
 * that the body below was composed at the last boundary. Constitution 16: if
 * the owner (or the waking session) cannot see it, it isn't trustworthy.
 *
 * It is deliberately not per-session: nothing in it varies between two sessions
 * on the same day in the same store, so the delivery check the next hook makes
 * (§2.3) compares a sentinel that is stable for as long as the bundle is.
 */
export const WAKE_SYSTEM = "Counterparts";

/**
 * THE WHOLE WAKE'S OWN WAY BACK (2026-10-10), the preface's last sentence.
 *
 * Measured on Claude Code 2.1.296 (host numbers: `adapters/config.ts`
 * `HOST_OUTPUT_CHARS`, `HOST_PREVIEW_CHARS`): a hook field over the host's cap
 * is saved to a file, and the model is shown a "too large, saved to <path>"
 * note and about the first 2,000 characters — and nothing tells it to read
 * the file, which holds all of it. So the wake says so itself, where any
 * preview carries it: in the preface, the line after the opening comment. It
 * names the end (`counterparts:wake/end`, the sentinel every wake closes on)
 * and the door (the file the host made). No other door reads a session's
 * composed wake today (self INTERFACE-GAPS §13). The self page's own top line
 * (`pageTopLine`) is the second layer, for a cut inside the wake.
 */
export const WAKE_WHOLE_SENTENCE =
  "If a note says this was too large and saved to a file, read that file: it holds all of this, down to the counterparts:wake/end line.";

/**
 * The room the composed budget leaves for the preface, in bytes. It is the
 * preface's OWN cap, asserted by a test at the widest plausible day, date and
 * store size — one number, not a lane cap that can drift from what it bounds.
 * Structural, not tunable: the renderer must reserve exactly what delivery adds.
 *
 * Raised 128 → 160 on 2026-09-14 with U4's second number: the widest line is now
 * 126 bytes (a six-digit day and a billion rows on both counts), and a cap two
 * bytes above its own worst case is a cap that fails the first time the line
 * gains a word.
 *
 * Raised again on 2026-10-10 by exactly the whole-wake sentence
 * (`WAKE_WHOLE_SENTENCE`) and its space, which the line now ends with: 160 +
 * 133 = 293. The page's room is derived through this number
 * (`deliveryReserveBound`), so the sentence is paid for there too.
 */
export const PREFACE_RESERVE_BYTES =
  // Measured with an encoder of its own: `identity.ts#byteLength` may not be
  // initialised yet when an import cycle evaluates this module first.
  160 + new TextEncoder().encode(` ${WAKE_WHOLE_SENTENCE}`).length;

/**
 * THE ROOM THE WAKE'S OWN FURNITURE TAKES AROUND THE PAGE, in bytes — the
 * number `Self.build` subtracts from the caller's ceiling before it asks
 * whether the page fits. Structural, not tunable, and measured rather than guessed: a test
 * composes the widest plausible furniture (a six-digit day and six-digit lane
 * counts in both comment lines, the stale dateline at a six-digit threshold)
 * and asserts it fits under this.
 *
 * It exists because of the adversarial review of PR #138. The page's cap was
 * clamped to the WHOLE budget, so a long page filled the budget exactly and the
 * header, `FRAMING.context`, the heading, the dateline and the sentinel pushed
 * the composition past it — and nothing could trim it back, because the identity
 * lane is empty by then and the page is furniture the trim loop cannot pop. An
 * 8,657-byte page published `overBudget: true` at host budgets of 400, 900,
 * 2,000 and 6,000. That is scar §2.18's guarantee paying for a block of prose,
 * and it is the same measurement that kept the still-forming line out of the
 * default switch (NOTES §12a) — applied to the page this time.
 *
 * Widest measured furniture: 444 bytes. 512 is that plus room for a line to
 * gain a word.
 */
export const PAGE_FLOOR_RESERVE_BYTES = 512;

/**
 * HOW MANY OF THE DELIVERY'S RESERVES ARE HELD UNDER THE SHARE RULE
 * (`handoff/#reserveBytes`), beside the preface: the handoff pointer with its
 * "Last here" line, and "Work here" with the "Last said here" line beside it
 * (2026-10-11, one term; `counterpart.ts#wakeReserveBytes` and
 * `#workReserveBytes`). Each is at most an eighth of the ceiling and never past
 * `HANDOFF_RESERVE_MAX_BYTES`. A third reserve there is a third here, or the
 * page's limit below promises room the wake does not have — a test holds the
 * root to `deliveryReserveBound`.
 */
export const DELIVERY_SHARED_RESERVES = 2;

/**
 * THE MOST THE DELIVERY CAN HOLD BACK FROM A HOST CEILING, in bytes
 * (2026-10-09): the preface's reserve and `DELIVERY_SHARED_RESERVES` terms at
 * the share rule's widest. What the root subtracts on a given day is usually
 * less; this is the bound the page's limit is sized under. Pure.
 */
export function deliveryReserveBound(budgetBytes: number): number {
  const share = Math.max(
    0,
    Math.min(HANDOFF_RESERVE_MAX_BYTES, Math.floor(budgetBytes / HANDOFF_RESERVE_MIN_BUDGET_MULTIPLE)),
  );
  return PREFACE_RESERVE_BYTES + DELIVERY_SHARED_RESERVES * share;
}

/**
 * THE END LINE OF EACH RUNG (2026-10-10). Fixed words, so the top line's
 * quote of it costs a known number of bytes and a reader can match it
 * exactly. Printed after the page's dateline. The one-line rung has none: it
 * is its own top line.
 */
export const PAGE_END_LINES: Readonly<Record<Exclude<PageRung, "line">, string>> = {
  whole: "(End of my page.)",
  short: "(End of the short version.)",
  outline: "(End of the outline.)",
  headings: "(End of the headings.)",
};

/** The end line a rung prints, or null for the one-line rung. */
export function pageEndLine(rung: PageRung): string | null {
  return rung === "line" ? null : PAGE_END_LINES[rung];
}

/** Both doors to the whole page, in the words every rung uses. */
const PAGE_DOORS = "the self_page tool or 'counterparts self-page'";

/**
 * THE TOP LINE OF EACH RUNG (2026-10-10): what follows, the page's size, the
 * exact line it ends with, and — if that line is missing — that it was cut
 * on the way, and both doors to the whole page. It is what protects against
 * the cuts this package does not make: a host's preview keeps the head of
 * what it was handed, so the top line survives the cut it describes.
 * `wholeBytes` is the page's own size, whatever the rung shows. Plain words,
 * for whoever reads the wake. Null on the one-line rung.
 */
export function pageTopLine(rung: PageRung, wholeBytes: number): string | null {
  const n = groupDigits(wholeBytes);
  const end = pageEndLine(rung);
  if (end === null) return null;
  const ends = `It ends with "${end}" — if you don't see that line, it was cut off`;
  switch (rung) {
    case "whole":
      return `(My page, ${n} bytes. ${ends}: read it whole with ${PAGE_DOORS}.)`;
    case "short":
      return `(The short version of my ${n}-byte page, too long for this wake. ${ends}. Read the whole page with ${PAGE_DOORS}.)`;
    case "outline":
      return `(My page is ${n} bytes, too long for this wake: here is each section's heading and first sentence. ${ends}. Read the whole page with ${PAGE_DOORS}.)`;
    case "headings":
      return `(My page is ${n} bytes, too long for this wake: here are its section headings. ${ends}. Read the whole page with ${PAGE_DOORS}.)`;
    case "line":
      return null;
  }
}

/** Each rung's top line (and the last rung's one line), as a reader finds it again. */
const PAGE_TOP_READERS: readonly (readonly [PageRung, RegExp])[] = [
  ["whole", /^\(My page, ([\d,]+) bytes\. It ends with "/],
  ["short", /^\(The short version of my ([\d,]+)-byte page, too long for this wake\./],
  ["outline", /^\(My page is ([\d,]+) bytes, too long for this wake: here is each section's heading and first sentence\./],
  ["headings", /^\(My page is ([\d,]+) bytes, too long for this wake: here are its section headings\./],
  ["line", /^\(My page is (\d+) bytes — no room for it (?:whole )?in this wake\./],
];

/**
 * WHICH RUNG A WAKE PRINTED THE PAGE ON, read back off its own words
 * (2026-10-10) — for a reader of a published bundle that has no render row
 * (the dashboard's wake costs). The first top line found, and the page's
 * size it states; null when the wake carries none (no page, or a bundle
 * published before the ladder). Kept beside `pageTopLine` so the wording and
 * its reader change together; a test round-trips every rung. Pure.
 */
export function readPageTopLine(text: string): { rung: PageRung; wholeBytes: number } | null {
  for (const line of text.split("\n")) {
    for (const [rung, re] of PAGE_TOP_READERS) {
      const m = re.exec(line);
      if (m !== null) return { rung, wholeBytes: Number((m[1] ?? "0").replace(/,/g, "")) };
    }
  }
  return null;
}

/**
 * A LINE OF THE WAKE'S OWN FRAME AROUND THE PAGE (review of #363): a rung's
 * top line or end line, or the one line, standing whole on a line of its own.
 * A session that copies its page out of the wake and back through a writer
 * would otherwise store them, and every wake after would print a stale size
 * and an end line in the middle of the page — after which a cut would look
 * whole. Left out where the page is written and where it is rendered, like
 * its datelines (`Self#ownWords`). A sentence that only mentions one is not
 * one. Pure.
 */
export function isPageFrameLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("(") || !t.endsWith(")")) return false;
  if ((Object.values(PAGE_END_LINES) as readonly string[]).includes(t)) return true;
  return PAGE_TOP_READERS.some(([, re]) => re.test(t));
}

/**
 * THE ROOM A PAGE BLOCK TAKES in "Who I am", in bytes: its top line, its text
 * and its end line, with the newlines that join them. The dateline is not
 * counted here — it is furniture, inside `PAGE_FLOOR_RESERVE_BYTES`. Pure.
 */
export function pageBlockBytes(block: Pick<PageBlock, "top" | "text" | "end">): number {
  return (
    byteLength(block.text) +
    (block.top === null ? 0 : byteLength(block.top) + 1) +
    (block.end === null ? 0 : byteLength(block.end) + 1)
  );
}

/**
 * THE MOST THE TOP AND END LINES TAKE beside the page itself, in bytes
 * (2026-10-10) — on the two rungs a writer writes for, `whole` and `short`,
 * at a size wider than the write ceiling lets the top line state (999,999
 * bytes against 16,384). Structural, not tunable, and measured: the widest is
 * the short version's, 261, and a test holds both under this. It is paid for
 * in the page's room (`pageRoomBytes`), so the room the writer is told is the
 * room the page itself has, top and end lines already counted. (The two
 * mechanical rungs' frames are wider — no writer aims at them, and the wake
 * measures every rung exactly.)
 */
export const PAGE_FRAME_RESERVE_BYTES = 264;

/**
 * THE PAGE THE WAKE PRINTS WHOLE at a host ceiling, whatever the delivery
 * reserves that day, in bytes (2026-10-09): the ceiling, less the most the
 * delivery can hold back (`deliveryReserveBound`), less the furniture the wake
 * wraps the page in (`PAGE_FLOOR_RESERVE_BYTES`), less its top and end lines
 * (`PAGE_FRAME_RESERVE_BYTES`, 2026-10-10). `Self#pageBlock` prints a page
 * whole whenever it fits the room the composition actually has, which is
 * never less than this. A short version within it prints whole the same way.
 * Grows with the ceiling. Pure.
 */
export function pageRoomBytes(hostBudgetBytes: number): number {
  return hostBudgetBytes - deliveryReserveBound(hostBudgetBytes) - PAGE_FLOOR_RESERVE_BYTES - PAGE_FRAME_RESERVE_BYTES;
}

/**
 * THE HOST CEILING THE PAGE'S LIMIT IS SIZED AGAINST, in bytes — the one
 * `install` writes when nobody names one (`adapters/cli/commands.ts`'s
 * `DEFAULT_BUDGET_BYTES` is this constant), and the one every host reads
 * today: Claude Code's hooks and Claude Desktop's `wake` tool deliver the same
 * bundle, composed at the configuration's `injectionBudgetBytes`.
 *
 * NOT a ceiling anything composes against: scar §2.18 holds, and a host that
 * reported none still composes no wake. It sizes one write limit, below.
 */
export const PAGE_HOST_BUDGET_BYTES = 9_000;

/**
 * THE SELF PAGE'S ROOM, in bytes (2026-10-09; a target, not a limit, since
 * 2026-10-10): `pageRoomBytes` at `PAGE_HOST_BUDGET_BYTES`. One number for
 * both ends, derived rather than chosen, so what the writer is told and what
 * the wake guarantees cannot drift apart: a page within it prints whole, byte
 * for byte, top and end lines included, at that ceiling or a larger one,
 * under the widest reserves the delivery can take.
 *
 * The writer is told it as a TARGET ("aim under N bytes"), and a page past it
 * is kept whole — refused only past the write ceiling (`PAGE_MAX_BYTES`,
 * 16,384). Past the room the wake steps down the ladder (`PageRung`) on a day
 * it cannot hold the page, so the writer is asked for a short version within
 * this same number, written with the page.
 *
 * Why one number: #350's second reviewer measured the old pair apart — the
 * wake's cap was `min(6,144, budget − 512)`, which under the widest reserves at
 * 9,000 is 6,078, while the writer accepted up to 16,384 — so a page between
 * them was cut. #358 then refused every page past the room, and the page's
 * history showed the stopgap losing by a few hundred bytes each time (7,012,
 * 6,767, then 6,085, each trimmed by hand).
 */
export const PAGE_ROOM_BYTES = pageRoomBytes(PAGE_HOST_BUDGET_BYTES);

/**
 * THE LAST RUNG (2026-10-09): the one short line a wake with no room for any
 * other prints instead of the page — never a fragment of it. It names the
 * page's size and both doors, so it is its own top line.
 */
export function pageTooLargeLine(bytes: number): string {
  return `(My page is ${bytes} bytes — no room for it whole in this wake. Read it with the self_page tool, or 'counterparts self-page'.)`;
}

export interface PrefaceFacts {
  /** Which memory system composed and is delivering this. */
  readonly system: string;
  /** The lived day (scar E8) — days lived, never calendar days. */
  readonly day: number;
  /** Today's calendar date as the HOST reports it. Absent ⇒ no date is stated. */
  readonly date?: string;
  /** Live memories in the store AT DELIVERY, not at the render:
   *  `countMemories({ type: "memory", archived: false })`. */
  readonly memories: number;
  /**
   * TRUE when the body was ASSEMBLED at session start (2026-10-10,
   * `Self#assemble`) rather than read as the last boundary composed it: the
   * line then says so — fewer bytes than the words it replaces, so the
   * reserve holds.
   */
  readonly assembled?: boolean;
  /**
   * EVERY live row at delivery — memories, journal episodes, beliefs and
   * entities: `countMemories({ archived: false })` (IMPROVEMENTS U4).
   *
   * The header said "14,002 memories" while recall said "considered 41 of 14,701
   * live rows" in the same session, and nothing on either surface said why the
   * two differed by ~700. Both numbers were right and neither was labelled: the
   * header counts `type: "memory"` rows, recall's `storeSize` is
   * `list({ archived: false }).length`, the same WHERE minus the type clause, so
   * the gap is exactly the live episodes and schema rows (superseded rows are
   * `archived = 1` and are outside both). Stating both, in recall's own words —
   * "live rows" — is what makes the model's two readings one vocabulary.
   *
   * Required, not optional: a line that sometimes carries the second number and
   * sometimes does not is a line whose absence a reader has to interpret.
   */
  readonly liveRows: number;
}

/** Thousands, hand-rolled: `toLocaleString` varies with the runtime's ICU. */
export function groupDigits(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/** One line, under `PREFACE_RESERVE_BYTES`, stating what the body cannot — and
 *  saying WHICH population each of its two counts is (U4) — then how to read
 *  all of it when a host cut it (`WAKE_WHOLE_SENTENCE`, 2026-10-10). */
export function prefaceLine(f: PrefaceFacts): string {
  const when = f.date === undefined ? `day ${f.day}` : `day ${f.day} (${f.date})`;
  return (
    `${f.system} memory, ${when}, ${groupDigits(f.memories)} memories of ` +
    `${groupDigits(f.liveRows)} live rows — ${f.assembled === true ? "assembled at session start" : "composed at the last boundary"}. ${WAKE_WHOLE_SENTENCE}`
  );
}

/**
 * THE TENSE ONLY THE DELIVERY KNOWS (2026-10-09).
 *
 * The owner's wake on 10-09 carried "Arriving: - … (due 2026-10-08) · …". By
 * design: a one-off stays in the horizon lane for its grace days, and the wake
 * is composed at a boundary — the evening one, the day before — and read the
 * next morning. The DATE was true; the lane's heading made it read as still to
 * come. A render can put a date it is already past into the past tense
 * (`Resolved.duePast`), but on the evening of the 8th the 8th is today, and only
 * the delivery knows the morning is the 9th.
 *
 * So, where the preface is composed and with the same date (`WakeDelivery
 * .date`, the person's day): an Arriving line whose due date is before today
 * reads `(was due 2026-10-05)`, and `(was due yesterday, 2026-10-08)` the day
 * after. Only the date prefix of a `- ` line in the Arriving lane is touched —
 * never a statement, never another lane — and only as far as `room` allows:
 * "was " on every such line first, then "yesterday, " while room remains, so a
 * line that would not fit keeps the date it was composed with, which is still
 * true. The caller passes what the preface reserve has left
 * (`PREFACE_RESERVE_BYTES`), so the delivered bundle stays inside it.
 */
export function arrivingTense(text: string, today: string, room: number): string {
  if (!isDay(today) || room <= 0) return text;
  const lines = text.split("\n");
  // The LAST such heading: the lane is last, and a page above it is printed as
  // written, so a line of the page that happens to read "Arriving:" is not it.
  const start = lines.lastIndexOf(FRAMING.horizon);
  if (start < 0) return text;
  const prior = addDays(today, -1);
  const shape = /^(- (?:(?:by )?\d{4}-\d{2}-\d{2} \()?)(was )?due (\d{4}-\d{2}-\d{2})(?=[,)]| · )/;
  const was = `${DUE_PAST_WORD} `;
  const words = { was: byteLength(was) - byteLength(`${DUE_WORD} `), yesterday: byteLength("yesterday, ") };
  const past: { i: number; head: string; already: boolean; date: string; rest: string; was: boolean; yesterday: boolean }[] = [];
  for (let i = start + 1; i < lines.length && lines[i] !== ""; i++) {
    const line = lines[i] ?? "";
    const m = shape.exec(line);
    const date = m?.[3];
    if (m === null || date === undefined || date >= today) continue;
    const already = m[2] !== undefined;
    past.push({ i, head: m[1] ?? "- ", already, date, rest: line.slice(m[0].length), was: already, yesterday: false });
  }
  let left = room;
  for (const p of past) {
    if (p.was || left < words.was) continue;
    p.was = true;
    left -= words.was;
  }
  for (const p of past) {
    if (!p.was || p.date !== prior || left < words.yesterday) continue;
    p.yesterday = true;
    left -= words.yesterday;
  }
  for (const p of past) {
    if (!p.was || (p.already && !p.yesterday)) continue;
    lines[p.i] = `${p.head}${was}${p.yesterday ? "yesterday, " : ""}${p.date}${p.rest}`;
  }
  return lines.join("\n");
}

export interface PrefacedBundle {
  readonly text: string;
  readonly bytes: number;
  /** The sentinel of the DELIVERED text — what the next hook must see. */
  readonly sentinel: string | null;
  /** False when the bundle was not a well-formed render and was left alone. */
  readonly applied: boolean;
}

const BYTES_FIELD = /bytes=\d+/;
const OPEN_RE = /^<!-- counterparts:wake .*elements=(\d+) bytes=(\d+) -->$/;

/**
 * Splice the preface INSIDE the wake block, above the composed body, and re-solve
 * the byte fixed point so the opening comment and the tail sentinel both state
 * the delivered total. The alternative — adding bytes and leaving the two lines
 * describing something smaller — would hand every reader a sentinel that fails
 * the check it exists to pass (§1 G2).
 *
 * A bundle that is not a well-formed render (bootstrap line, clipped, edited) is
 * returned UNTOUCHED: rewriting the byte count of a damaged bundle would erase
 * the damage, which is the one thing the sentinel is for.
 */
export function applyPreface(text: string, preface: string): PrefacedBundle {
  const lines = text.split("\n");
  const open = lines[0] ?? "";
  const tail = lines[lines.length - 1] ?? "";
  if (lines.length < 2 || !OPEN_RE.test(open) || !SENTINEL_RE.test(tail)) {
    return {
      text,
      bytes: byteLength(text),
      sentinel: SENTINEL_RE.test(tail) ? tail : null,
      applied: false,
    };
  }
  const build = (stated: string): string[] => [
    open.replace(BYTES_FIELD, `bytes=${stated}`),
    preface,
    ...lines.slice(1, -1),
    tail.replace(BYTES_FIELD, `bytes=${stated}`),
  ];
  const skeleton = byteLength(build("").join("\n"));
  const composed = build(String(fixedPointTotal(skeleton, 2)));
  const out = composed.join("\n");
  return {
    text: out,
    bytes: byteLength(out),
    sentinel: composed[composed.length - 1] ?? null,
    applied: true,
  };
}

/**
 * Splice a block in at the FOOT of the wake block, above the tail sentinel, and
 * re-solve the byte fixed point so both comment lines state the delivered total
 * — `applyPreface`'s mechanism, pointed at the other end of the bundle.
 *
 * It exists for the per-directory handoff pointer (E1), which is a delivery-time
 * fact for exactly the reason the preface is: ONE bundle is published per store
 * at a boundary and read by sessions in every directory, so which directory this
 * session opened in cannot be known when the body is composed. The pointer is
 * FURNITURE — no `- ` bullet, no lane — so `counts` and the sentinel's
 * `elements=` stay true of a bundle that carries it, exactly as they stay true
 * of one carrying the page or the day-0 line.
 *
 * At the foot rather than the head because a handoff is the last thing that
 * happened here and the first thing to pick up, and because the preface's own
 * place above the body is a claim about the WHOLE bundle that a second line
 * there would blunt.
 *
 * A bundle that is not a well-formed render is returned UNTOUCHED, for
 * `applyPreface`'s reason: rewriting the byte count of a damaged bundle erases
 * the damage the sentinel exists to show.
 */
export function spliceBeforeSentinel(text: string, block: string): PrefacedBundle {
  const lines = text.split("\n");
  const open = lines[0] ?? "";
  const tail = lines[lines.length - 1] ?? "";
  if (lines.length < 2 || !OPEN_RE.test(open) || !SENTINEL_RE.test(tail) || block.length === 0) {
    return {
      text,
      bytes: byteLength(text),
      sentinel: SENTINEL_RE.test(tail) ? tail : null,
      applied: false,
    };
  }
  const body = lines.slice(1, -1);
  // `compose` already pushes a blank line before the sentinel, so the separator
  // is added only when this bundle does not have one — a doubled blank line is
  // not wrong, but it costs bytes the reserve measured for one.
  const gap = body[body.length - 1] === "" ? [] : [""];
  const build = (stated: string): string[] => [
    open.replace(BYTES_FIELD, `bytes=${stated}`),
    ...body,
    ...gap,
    block,
    "",
    tail.replace(BYTES_FIELD, `bytes=${stated}`),
  ];
  const skeleton = byteLength(build("").join("\n"));
  const composed = build(String(fixedPointTotal(skeleton, 2)));
  const out = composed.join("\n");
  return {
    text: out,
    bytes: byteLength(out),
    sentinel: composed[composed.length - 1] ?? null,
    applied: true,
  };
}
