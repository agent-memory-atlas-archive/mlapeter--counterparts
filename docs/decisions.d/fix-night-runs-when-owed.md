### Decided by the night-owed builder, 2026-10-11, lightly held (the night starts when write-ups are owed)

- Decided by the night-owed builder, 2026-10-11, lightly held: under dreaming `auto`, the
  night starts for its catch-up alone when the dream is not due for `too-little-new` or
  `first-day` and sessions from an earlier calendar day owe a write-up. Why: random-06's
  decision (coordinator agreed); with the pointer retired under `auto`, a first day with
  fewer than three memories was otherwise never written up.
- Decided by the night-owed builder, 2026-10-11, lightly held: "an earlier day" means the
  session's last activity (its last words, a boundary or its end, `HeldSession.clockFrom`)
  falls before today's date in the store's zone. "Owed" is the catch-up's own reading
  (`catchUpOwing`), not a new one. Why: one notion of owed; a session that ran past midnight
  waits one more day, which loses nothing because a stretch owes for 14 days of use.
- Decided by the night-owed builder, 2026-10-11, lightly held: the catch-up-only run claims
  the day through the same `dream_asks` latch as a dream (`launched`), and only on a day with
  no row yet. Why: racing sessions start one run, and the once-a-day claim stays one claim.
  The effect: if the catch-up's write-ups bring the queue to three, the ordinary relaunch
  dreams later that day, after the 30-minute quiet window, counted as a relaunch.
- Decided by the night-owed builder, 2026-10-11, lightly held: the catch-up-only run says
  nothing at its start and hands nothing back at the next prompt. Why: "the mechanism does
  the work, it doesn't remind". Doctor and `counterparts dream --list` show it as "the
  catch-up alone".
- Decided by the night-owed builder, 2026-10-11, lightly held: its row is `done`, with the
  dream's and the reflection's children `skipped: too-little-new` (or `first-day`), whenever
  the catch-up did what it could. It is `could-not-start` / `timed-out` / `failed`, with
  `detail: catch-up`, when the catch-up child could not start, was stopped, or failed. No ask
  follows a catch-up that could not start while the dream is not due, because there is no
  dream to ask about. Why: doctor
  must not show a failed dream for a dream that was never due, and must still go amber when
  `claude -p` itself is broken.
- Decided by the #426 reviewer, 2026-10-11, lightly held: a catch-up-only run that could not
  start, failed, timed out or went lost does not make the dream "fall back" to an ask
  (`Dreams#fellBack` ignores a row whose children say `skipped: <reason>`, and the hook
  writes those children on the run's very first row). If the dream comes due later that
  day, the ordinary relaunch starts the whole night headless after the 30-minute quiet
  window, counted against `RELAUNCHES_PER_DAY`; only if that run itself cannot start does
  the existing `auto` fallback ask, as it did before this change. Why: under `auto` nothing
  should turn into an ask because of a run that never tried to dream; the builder's version
  showed "I couldn't start dreaming on my own" for a catch-up that failed.
- Decided by the #426 reviewer, 2026-10-11, lightly held (replaces the builder's "no
  per-day memo"): the "is anything owed from an earlier day" read is remembered per
  calendar day. When it reads a real zero, the date goes in meta
  (`night.nothing-owed-before`) and the rest of that day's prompts skip the read; a read
  that fails is not remembered. Why: measured on a copy of the author's store (10-11
  snapshot plus its spans), the read costs ~29 ms, at every prompt of an `auto` day whose
  dream isn't due and whose day is unclaimed, on the latency-sensitive UserPromptSubmit
  hook; with the memo it is a meta read (<0.01 ms). Within a day the earlier days' debt
  only shrinks, so nothing is missed; a late capture that makes an earlier session owe
  waits until the next day, well inside the 14 days of use before a stretch lapses.
