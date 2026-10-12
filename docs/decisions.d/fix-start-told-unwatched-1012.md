### Decided by the start-told builder, 2026-10-12, lightly held (who is told at a session start)

- Decided by the start-told builder, 2026-10-12, lightly held: the sessions that started at 00:19 on 10-12 were
  the night run's own children, and they were told nothing. The reminder and the morning share went to the
  coordinator's open session, on a turn that another session's message started, which #445 already covers. The
  children's hooks get `CLAUDE_CODE_ENTRYPOINT=sdk-cli` and `CLAUDE_CODE_SESSION_ATTENDED=0` from the host
  (measured on 2.1.296), and `COUNTERPARTS_NIGHT_RUN` passes through. Why: this is recorded so nobody chases the
  night children again.
- Decided by the start-told builder, 2026-10-12, lightly held: the session start reads one test,
  `watchedAtStart`. It is `isInteractive`, minus the night run's child (named outright, so the run's own marker
  holds whatever a later host sets) and minus `source: "compact"`. It gates the plain reminders, the first
  meeting's line and the wake row's `interactive`. Why: a compaction fires mid-turn, so it is only as watched as
  the turn that filled the context, and that turn may be a hand-back nobody typed. An Agent-tool subagent's own
  compaction fires it too (seen on 10-10: `SessionStart:compact` inside a subagent, `cli`, handed a full wake).
  When a person did type `/compact`, the reminder is said on their next prompt, so the cost is one turn.
- Decided by the start-told builder, 2026-10-12, lightly held: `startup`, `clear` and `resume` stay a person's.
  Why: `claude -p` and the SDK already read as unwatched through the host's entrypoint and attended flags. A
  terminal session that a tool opens is indistinguishable from one a person opens, and treating every `startup`
  as unwatched would cost every person their morning reminder.
- Decided by the start-told builder, 2026-10-12, lightly held: the night run's prompt gets no temporal cues at all
  (`recallForTurn`'s `noCues`). Why: at 00:19 its recall handed the dream child the day's plain and quiet
  reminders as "quietly available" lines, and that spent a fire of the person's day on a run nobody reads.
  Hand-back turns in a person's session still spend quiet cues as before (only plain items are withheld there,
  per #445). That is left open.
