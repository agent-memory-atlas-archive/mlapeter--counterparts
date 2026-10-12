- **Fewer reads of Claude Code's own files.** The nightly run no longer looks through `~/.claude/projects` for
  its own background session's transcript: it reads what that session printed as it ran, and doctor's Tool
  results line says whether that output was read. Claude Code's compaction summaries, skill bodies, hook
  feedback and other lines it writes for itself are no longer kept with a session's words; a message another
  session sent to this one still is.
- **The wake-arrival check is off by default.** It read the start of the session's transcript only to confirm
  the wake arrived whole. Set `COUNTERPARTS_WAKE_CHECK=1` in Claude Code's environment to turn it back on;
  doctor's Wake line names the setting when no wake was checked.
