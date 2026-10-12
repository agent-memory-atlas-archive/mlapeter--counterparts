### Decided by the catch-up-unread-parts builder, 2026-10-11, lightly held (did the catch-up skim?)

- Decided by the catch-up-unread-parts builder, 2026-10-11, lightly held: the first live `counterparts
  catch-up` did not skim. Every one of the 16 parts it closed with `[]` was wholly marked "already written
  up" before the run began: 14 by the session's own half-hourly chapters, 2 by one mid-session note. The
  reader was told not to write marked words again, and didn't. The waste was the door handing such parts
  over at all. Why: read back from the parts the children were actually served (every entry carried the kept
  mark) and from the coverage ledger's claims.
- Decided by the catch-up-unread-parts builder, 2026-10-11, lightly held: a part whose every word is already
  written up is passed over by the door (and recorded done) and costs a catch-up batch no bytes and no place,
  except the session's last part, which is always served because only a session that was handed words sets
  the write-up mark. Why: the smallest change that stops the waste without touching the mark's path.
- Decided by the catch-up-unread-parts builder, 2026-10-11, lightly held: the guard on empty answers is a
  required one-line `nothing` reason on the granted (catch-up) path, for a part that holds unwritten words.
  There is no timer and no "N empty answers in a row" rule. Without the reason the answer is refused, nothing
  is recorded, and the part stays owed ("unread"). Why: fetch-to-answer time measures what a reader wrote, not
  what it read (a model takes in a whole part at once), and the 16 two-second answers that prompted this were
  all right. A seconds-per-KB floor or a run-of-empties rule would have marked every one of them unread, and
  kept re-owing them forever, since the chapters' claims stay. A live session's `[]` keeps the meaning it has
  had since 2026-09-23. The reason's text is not stored.
- Decided by the catch-up-unread-parts builder, 2026-10-11, lightly held: `catch-up --reowe <run>` only moves
  a session's progress counter back, and only while nothing has claimed those words since. A session the run
  went on to mark written up, or whose later memories claimed the words (each memory claims its session's
  backlog), is refused `needs-retraction`. Taking a mark or a coverage claim back would mean a new operation
  on two pinned seams (`write-up-seam.ts`, the coverage ledger), which is left as an open question rather
  than built here. Why: with passed-over parts and the reason guard, a run that closes unwritten words empty
  should be rare, and the retraction is a design call, not a repair.
- Noted for the coordinator, not changed here: a mid-session note (`remember`/jot) claims coverage of every
  unwritten word its session said before it (`submitJot` always covers its own session), so one note about
  one fact can mark hours of conversation as written up. That is how 2 of the 16 parts (one session's
  evening) came to read as already written up when the note covered none of their substance.
- Decided by the #435 reviewer, 2026-10-11, lightly held: `catch-up --dry-run` or `--yes` without `--reowe`
  is a usage mistake (exit 1). Why: the flags were added to `catch-up` for `--reowe`, and alone a typed
  `catch-up --dry-run` started a real run that writes memories and spends the subscription.
- Decided by the #435 reviewer, 2026-10-11, lightly held: `--reowe` exits with the CLI's codes (`EXIT`:
  usage 1, refused 2), not its own inverted pair. Why: a script reads one meaning per code across commands.
- Decided by the #435 reviewer, 2026-10-11, lightly held: the SessionStart pointer (dreaming `ask`/`off`)
  names the part the door will hand over (`firstUnwrittenPart`) and counts only the parts a reader is
  handed. Why: the door passes over parts with nothing unwritten on every path, not only the catch-up's,
  and the pointer said "part 1 of N" and the whole backlog's size while the door handed part 9.
- Noted by the #435 reviewer, not changed: with the reason guard in place, a future run's logged empty
  parts with unwritten words are all ones the reader explicitly declined with a `nothing` line, which the
  log does not record. `--reowe` owes those back too; that is what a "known-bad run" means here.
