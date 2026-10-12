### Decided for the arriving-slack lane, 2026-10-12, lightly held (who a plain reminder is told to, and who gets the session-start room)

- Decided by the arriving-slack builder, 2026-10-12, lightly held: a plain reminder is not said, and not
  marked told, at a prompt no person started. That covers a subagent's hand-back, a `<task-notification>`,
  "Another Claude session sent a message:", and a prompt that is only peer messages. It waits for the next
  prompt a person types. On such a prompt it is also held back from the quiet cues, so it does not spend a fire
  there. The prompt hook reads this from the prompt text alone (`transcript.ts#startedByHost`, the same
  frames capture uses to keep these turns out of pacing). Why: on 2026-10-12 at 00:19,
  mem_3d70c8464401 and mem_346077c3e78c were "told" to a coordinator session's turn that a hand-back had
  started, and nobody read it. The cost: a person who pastes one of those frames at the very start of a
  prompt is read as the host and is told one turn later.
- RANDOM's ruling, 2026-10-12, lightly held, for Mike's review, as built: at session start, "Arriving:" lines
  due within the next 3 days (`ARRIVING_NEAR_DAYS`), or in their grace days, get first claim on the room
  that would otherwise go to "Last here", "Last said here", "Today, elsewhere" and the handoffs. That
  includes the room kept for the newest handoff, which before this went only to a plain reminder due that
  day (`ROOM_ORDER`'s new `arrivingNear`, between `handoffsKept` and `pageBorrow`). They are listed after
  the due-day head and before the other dated lines. The turn-end composition marks none of them near, so
  it is unchanged. The total stays within the composition's budget plus the delivery's lent rooms, which is
  at most the ceiling less the preface's reserve. Measured on a fixture (page 6,472 bytes, four handoffs, two
  long dated lines): the session-start wake listed 1 dated line and 2 handoffs before, and lists 2 dated
  lines and no handoff now. Open: prospective's lead is also 3 days, so for day items the bound covers the
  whole lane except the grace days. The page's borrowing still outranks these lines.
- Decided by COUNTERPARTS, 2026-10-12, lightly held (built here): once a QUIET day item's date is behind the
  day asked about, the wake's lane applies the cue-only brakes to it again (over-fired, once a day, once a
  session, held for after). Why: #442's reviewer found that a quiet item cued twice in its lead days rode
  all 7 grace days as "was due …". It now leaves after its day. A plain item is unaffected, and so is a
  quiet item that was not cued out.
