/**
 * Every number `coverage/` has, in one place. Working defaults agreed with the
 * owner on 2026-09-30, held lightly: each is here to be read against how the
 * ledger behaves on a real store and moved when it fights that.
 */
export const COVERAGE_TUNABLES = {
  /** The pacer's third way to an ask: a session holding at least this many
   *  pieces that are not written up... */
  ASK_PIECES: 3,
  /** ...once this long has passed since the later of the stretch's first piece
   *  and the session's last ask. Pieces AND time, so one huge paste is never an
   *  ask on its own. */
  ASK_AFTER_MS: 30 * 60_000,
  /** A session owes a write-up when what it has not written up is at least this
   *  many pieces... */
  OWED_PIECES: 3,
  /** ...spanning at least this long, first piece to last. Under both, a closing
   *  turn's tail owes nothing. */
  OWED_SPAN_MS: 15 * 60_000,
  /** An owed stretch lapses at the first turn-end of the third day of use after
   *  the day its latest piece was lived — two days of use after that day. Days
   *  of USE: a weekend away lapses nothing. */
  LAPSE_DAYS_OF_USE: 3,
  /** An owed stretch under this many pieces is small: the pointer says one line
   *  is enough. */
  SMALL_STRETCH_PIECES: 6,
} as const;

export type CoverageTunables = typeof COVERAGE_TUNABLES;
