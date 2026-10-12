### Decided by the coordinator, 2026-10-11, lightly held (a note claims its own turn)

- Decided by the coordinator, 2026-10-11, lightly held: a memory written in the moment (the note tool, source
  `jot`) claims only its own turn — its own span, and the conversation pieces whose cursor `from` equals the
  note's own `from` (the prompt that started the turn it was written in, captured at the Stop after the note and
  added to the note's claim then, under the same proposal id). A session-end write-up, the write-up door,
  "nothing new" and a chapter keep their whole-session claims. Why: on 10-10 one short note in session e92c5180
  claimed 18 pieces (about 48 KB, 2.6 hours) of that session's unwritten backlog, and the catch-up then rightly
  saw them as written; it was the only real loss found in the first live catch-up. Same principle as Group 4's
  write-time links (own turn only) and "memory forms as you go": a note is a moment, not a summary of the session.
  For random-06's and Mike's review.
- Decided by the coverage-jot-breadth builder, 2026-10-11, lightly held: the turn is found by the cursor, not by
  times. A note's span is written with `from` = the session's cursor in that scope, and the next capture in that
  scope starts at the same cursor, so "the capture that begins at the note's `from`" is the turn. When two notes
  share a turn, the first accepted one takes the turn piece. A note written in a turn with no prompt of the
  person's (the reply to a Stop ask, whose prompt is the ask itself and is never captured) claims only itself. A
  note whose own span did not land (an exact repeat of an earlier note's text) claims nothing. Why: no new field
  or file is needed (no store-format change), and every miss leaves the turn unwritten, which is the safe side.
- Decided by the coverage-jot-breadth builder, 2026-10-11, lightly held: `counterparts coverage` splits owed
  sessions with the same filter doctor and the catch-up read (`sessions.ts#pointable`): a small stretch from a
  session the registry does not show as a person's is listed under "Left to lapse (not a person's session)", not
  "Owed now". Why: one source of truth; the command listed d4929258 (an `sdk-cli` session) as owed while the
  catch-up and doctor let it lapse. Same caveat as doctor's: a small debt whose registry record was pruned (after
  a week) also reads as not a person's.
- Decided by the coverage-jot-breadth builder, 2026-10-11, lightly held: the catch-up's "left N parts unread" line
  in `counterparts coverage` shows only when the date asked is today or the date of that run. Why: the line came
  from the newest run whatever date was asked for (review of #435).
