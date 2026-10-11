### Decided by the onboarding-core reviewer, 2026-10-11, lightly held (the first meeting's offers)

- Decided by the onboarding-core reviewer, 2026-10-11, lightly held: the wake's offer line
  is carried on at most three calendar days (`MEET_OFFER_DAYS`), then stops, whatever the
  state; a `meet` read counts as that day's offer. The state stays `not_started` or
  `later`, so the mod's "Meet your counterpart" and a person asking to meet still work.
  Why: without a cap, a person who never answered (or said "later" once) was offered the
  meeting every day for ever.
- Decided by the onboarding-core reviewer, 2026-10-11, lightly held: a bare `meet` read
  leaves `skipped` as it is (it used to move it to `offered`, and the next day to `later`,
  which re-armed the daily offer). Why: `skipped` is "don't ask again"; the steps still
  record and `done` still finishes it.
- Decided by the onboarding-core reviewer, 2026-10-11, lightly held: the script asks where
  memory is on only while the scope registry has no entries. Why: the registry lives beside
  the configuration, not in the store, so a `start-fresh` store's meeting that wrote `/` off
  outlived `start-fresh --undo` and turned off every folder the owner had never named; and
  anyone who has set a folder has answered the question their own way.
- Decided by the onboarding-core reviewer, 2026-10-11, lightly held: the wake's marker says
  the settled state: an `offered` from an earlier day is moved to `later` before the marker
  is written. Why: the marker said `offered` while the line beside it said "last time they
  said later", and the mod keeps what the marker says.
- Decided by the onboarding-core reviewer, 2026-10-11, lightly held: `meet` refuses by name
  in a nightly-run child, and the second session's line skips an answer marked confidential
  since. Why: nobody is in the night run to meet, and the line rides into wakes that are not
  the owner's own (a Desktop chat).
