/**
 * Every `dream/` knob, in one visible place. WORKING DEFAULTS from the owner's
 * conversation of 2026-09-26 ("try it, see how it goes, adjust"); CAL = not
 * yet measured against real dreams.
 */
export const DREAM_TUNABLES = {
  // ── when to ask ───────────────────────────────────────────────────────────
  /** The ask is due only when at least this many memories are new since the
   *  last dream — a dream with nothing to replay is not worth his minutes. CAL. */
  MIN_NEW: 3,
  /** A store that has never dreamed looks back this many lived days for "new". */
  FIRST_DREAM_DAYS: 7,

  // ── the bundle ────────────────────────────────────────────────────────────
  /** Most new memories one dream is shown (newest first). CAL. */
  MAX_NEW: 40,
  /** Nearest OLDER neighbours shown beside each new memory (owner: 5–8). */
  NEIGHBOURS: 6,
  /** Loosely related older memories shown for mixing (the REM half). CAL. */
  MIXING: 5,
  /** The loose band: neighbours ranked this far down are "loosely related". */
  MIXING_FROM_RANK: 12,
  MIXING_TO_RANK: 40,
  /** The look-back: the strongest-feeling memories from about a week back. */
  LOOKBACK_DAYS: 7,
  /** …within this many lived days either side of it. */
  LOOKBACK_SPREAD: 2,
  LOOKBACK_COUNT: 5,
  /** Characters of each memory's words the bundle carries. */
  TEXT_CHARS: 400,
  /** Characters of the self page, the wake and each chapter the bundle carries. */
  PAGE_CHARS: 6_000,
  WAKE_CHARS: 6_000,
  CHAPTER_CHARS: 3_000,
  MAX_CHAPTERS: 6,

  // ── what one dream may change (owner: "start ~10 merges, 20 links, 3 gists") ─
  LIMITS: {
    merge: 10,
    link: 20,
    gist: 3,
    replayed: 60,
    contradiction: 10,
    "feeling-now": 10,
    "nominate-core": 3,
  },
  /** The weight of a link a dream draws, both ways (about three co-activations). CAL. */
  LINK_WEIGHT: 0.3,
  /**
   * TEXT CAPS, raised 2026-09-28 (owner direction: loosen the limits; design a
   * real answer when something really grows too long). Longer is kept to the
   * cap and the result says so — never cut without a word.
   */
  /** Longest merged or dreamed text, in characters (was 2,000). */
  MAX_TEXT_CHARS: 8_000,
  /** Longest journal entry, in characters (was 12,000). */
  MAX_JOURNAL_CHARS: 30_000,
  /** Longest title of a merge, a gist or the journal (were 200, 180 and 120). */
  MAX_TITLE_CHARS: 200,
  /** Longest nomination why (was 300). */
  MAX_WHY_CHARS: 1_000,
} as const;

export type DreamAction = keyof typeof DREAM_TUNABLES.LIMITS;
export const DREAM_ACTIONS = Object.keys(DREAM_TUNABLES.LIMITS) as DreamAction[];
