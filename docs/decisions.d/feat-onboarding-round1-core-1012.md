### Decided by the onboarding round-1 core builder, 2026-10-12, lightly held (the meeting holds the housekeeping)

- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: "the meeting is running in this
  session" means the meeting is `offered` and a `meet` call (a read or a step) came from this session within
  the last 30 minutes (`MEET_HOLD_MS`). No new meeting state was added, because the mod reads the `meet=` marker.
  Why: a read happens before the person even says yes, so without a time limit, someone who ignores the offer
  and goes on working (with nobody calling `later`) would have no write-up ask all session. Every step refreshes
  the window, so a real meeting never runs out of it.
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: the finish step (`meet` done) hands
  the write-up over in its result (session_end, then a chapter, then two or three lines of "here's what I'll
  remember", then the close). The one Stop after it is paced, so the pacer counts that write-up as its ask, but
  says nothing. Its `adapter.ask` row carries `coveredBy: "meeting"`. Why: otherwise the Stop right after the
  closing message would fire the ordinary ask (the meeting is past the first-ask threshold) and derail the close
  into bookkeeping again. If the model skipped the write-up, the coverage arm and the next day's catch-up still
  pick up what is unwritten.
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: no dream (line, headless run or
  catch-up alone) on a MEETING DAY. That is the day the meeting was finished, or a day it was offered while it is
  not finished. A later day's `later` or `skipped` releases that day, but the first offer's day holds either
  way, since it is the store's first day. This is the dream gate's new `meeting-day` reason, through a `holds`
  hook on the dream context. Why: one rule covers "not on the first day", "never on half a meeting" and the
  catch-up night that Mike saw start mid-meeting (lived day 1 is reached by the first Stop's cycle, so the
  existing `first-day` gate did not hold). Stores with no meeting keys are never held. Cost: someone who keeps
  being offered the meeting and saying nothing has no dream on those days (three at most, the offer cap).
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: the five research questions replace
  work/loved/problem/peeves/outside. "When Claude Code goes wrong for you" (peeves) is dropped too: it is not one
  of Mike's five and not a settings question. Step names are `week`, `work`, `love`, `saturday`, `started`. The
  second session's line still reads a 0.3.18/0.3.19 meeting's answers under their old names.
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: the close leaves out retention and
  uninstalling. The script keeps both for when the person asks, and retention as one exact line
  (`RETENTION_LINE`) that Claude is told not to paraphrase. The `/counterparts` sidebar line is said only on a
  plugin install, the same test the uninstall route uses.
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: the pronoun rule ("by name or as
  'they', until the person says") goes in the meeting script, the Stop write-up ask, Desktop's write-up ask and
  the dream's launch prompt. It costs about 20 tokens per write-up ask. One gendered model-facing line in
  reconsolidation ("stands as his. Tell him") is now neutral.
- Decided by the onboarding round-1 core builder, 2026-10-12, lightly held: "undo that dream" is a new `undo`
  phase on the dream tool. It does the same reversal as `counterparts dream --undo` and is refused in the
  nightly run. The dream's hand-back line now says `say "undo that dream"` for every install, in place of the two
  CLI commands. The journal entry itself stays. `meet` takes an optional `session`, used only when the registry
  confirms it, so the hold binds to the right session even before the server has one.
