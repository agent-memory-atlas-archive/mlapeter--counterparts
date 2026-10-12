### Decided by the cc-reads-trim builder, 2026-10-12, lightly held (fewer reads of Claude Code's files)

- Decided by the cc-reads-trim builder, 2026-10-12, lightly held: the nightly run reads its child's
  `--output-format stream-json --verbose` output, kept in memory to 64 MiB and never written to disk, in
  place of the child's transcript under `~/.claude/projects`. `--session-id` stays (it keeps the children
  apart); the row's field keeps its name, `transcript`, so old and new rows read alike. A host that refuses
  the arguments is retried once plain, its cut unchecked. Why: we launch the child, so its own output is the
  smallest read; a scan of the host's projects directory is the read a directory reviewer would flag.
- Decided by the cc-reads-trim builder, 2026-10-12, lightly held: the turn-budget swap
  (`content-replacement`) is still parsed if it appears in the stream, but was not seen there. If it is
  transcript-only, turn-budget cuts go unseen. Why: no cheap way to make a real host spill tonight; the
  miss is quiet, never a false amber.
- Decided by the cc-reads-trim builder, 2026-10-12, lightly held: Claude Code's compaction summaries and its
  other `isMeta` user lines enter no turn (`transcript.ts#hostRecord`), but a message another session sent
  here (`isMeta` with `origin.kind: "peer"`) is still kept, as task notifications are. Why: the policy names
  conversation summaries, and the summary repeats turns each Stop already captured; a peer's message is
  addressed to this conversation, not the host's bookkeeping.
- Decided by the cc-reads-trim builder, 2026-10-12, lightly held: the wake-arrival check became an opt-in
  diagnostic (`COUNTERPARTS_WAKE_CHECK=1` in the hooks' environment) rather than being removed. Why: one
  line of gate against several hundred lines of reader, tests and doctor wording to remove; off, nothing is
  read and no row is written.
