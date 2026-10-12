### Decided by the arriving-slack builder, 2026-10-12, lightly held (who a plain reminder is told to, and who gets the session-start room)

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
  lines and no handoff at all now, not even by id. Open, for review: prospective's lead is also 3 days, so
  for day items the bound covers the whole lane, grace days included; it bounds nothing today. Leaving the
  grace-day ("was due") lines out of `near` would restore a bound. The page's borrowing still outranks
  these lines, and "Still open"'s first item is rescued before them.
- Decided by COUNTERPARTS, 2026-10-12, lightly held (built here): once a QUIET day item's date is behind the
  day asked about, the wake's lane applies the cue-only brakes to it again (over-fired, once a day, once a
  session, held for after). Why: #442's reviewer found that a quiet item cued twice in its lead days rode
  all 7 grace days as "was due …". It now leaves after its day. A plain item is unaffected, and so is a
  quiet item that was not cued out.
- Decided by COUNTERPARTS, 2026-10-12, lightly held, confirmed by RANDOM (built by the #445 reviewer): the
  newest handoff keeps a floor. The near lines take room from "Last here", "Last said here", "Today,
  elsewhere" and the older handoffs, but not from the newest handoff's own block (`arrivingNear` now sits
  before `handoffsKept` in `ROOM_ORDER`; that room is again lent to a due-day plain reminder alone). Why:
  the newest handoff is how a session knows where its work was left off. On the builder's fixture the wake
  now lists 1 dated line (the second line's count by id) and the handoffs, as before this PR. What (b)
  still adds: near lines are ordered right after the head, and the count rescue may not pop them.
- RANDOM's ruling, 2026-10-12, lightly held (built by the #445 reviewer): a grace-day ("was due …") line is
  not near. Only items due from the session's date through 3 days on are (`briefing.ts#nearDue`). Past
  items keep their ordinary place in Arriving. This restores the bound the builder found missing.
- Decided by COUNTERPARTS, 2026-10-12, lightly held, confirmed by RANDOM (built by the #445 reviewer): the
  dream's prompt lines get the same guard. On a turn no person started (`startedByHost`) the prompt hook
  treats the session as unwatched (`startUnwatched`): a headless night may still start and its line is
  held for the next watched prompt; the day's line, the morning share, a night's hand-back and the
  contradiction raises are neither said nor claimed there. Why: a morning share should count as told only
  on a turn a person typed.
