# `coverage/` — NOTES

What the build (2026-09-30, `coverage/0930`) decided where the brief left room. Each is a
working default.

## 1. Where "owed" and "lapsed" are evaluated

Two places, one rule. The rule is pure over the buffer (`ledger`), so whoever reads it
gets the same answer: retention's plan, the SessionStart pointer, the door, doctor and the
console each compute it when they need it. The ROWS are written in one place: the
turn-end worker (`claude-code/bin/runner.ts`, step 3a), after the sleep cycle and before
retention, at every turn-end — keyless, like every step but the sweep. Before retention so
a lapse is recorded while its pieces are still there to count. Nothing reads the rows to
decide; they are the record.

## 2. The lag, and which way it went

The lived day on a piece lags on a date's first turn-end (the capture runs before the
worker advances the clock). The lapse therefore does not read the lived day at all: days of
use are the distinct dates, in the store's zone, on which a turn-end was recorded
(`boundaries.jsonl`, every scope). That is what the lived clock counts — `advanceClock`
moves once per new date with a worker run, and a worker runs at every turn-end — without
its lag. A stretch whose latest piece is on date D lapses when three later dates of use
exist, which is the first turn-end of the third one. Retention never strikes boundaries,
so the count does not shrink. Zone moves and the clock's "one day back holds" rule can make
the two counts differ by a day; not measured.

## 3. The stretch is the session's, across scopes

The ledger is per session, from each piece's own `session`, not the scope-wide
`CoverageReport`. A session with words in two projects has one stretch over both (the
floor is on the session); the pacer reads its own project's only. A claim is per scope,
so after the door writes up one project's share, the other's is owed on its own — if it is
still past the floor. A share under the floor is owed by nobody and goes on its week.

## 4. What counts as a piece

`buffer.jsonl` and `jots.jsonl`, as `CoverageReport` counts them, plus what a claim holds
in flight (a claim file is the buffer renamed aside; nothing in flight may make a session
look written up — retention's old promise). Not quarantine: that is the sweep's terminal
give-up. The assistant's own turns are not pieces; they do count as "captured" for the
active / quiet state.

## 5. Small

An owed stretch under `SMALL_STRETCH_PIECES` (6, the first-ask turn count) is small: the
pointer keeps #285's "one line is enough" sentence, it is offered only after every full
debt has had today's pointer, and only for a session the registry knows and a person
drove. Unlike #285's short debt it is a retention debt like any other, until written up
or lapsed.

## 6. Written-up rows

Read off `coverage.jsonl` by claim (`proposalId` and session): one row per claim. The
writer is the claim's prefix — `nothing-new:`, `chapter:`, `writeup:` (the door's own
claim) — or, for a `prp_` proposal, the session itself unless the proposal's session is
another one (the door's last part deposits under the writer and covers the ended
session). A watermark in meta (`coverage.written.through`) starts at the first pass, so
an old store gets no backfill; each pass re-reads from ten minutes before the watermark
(moved only once it has fallen that far behind, so a quiet turn-end writes nothing), and
the keys already written are read once per pass, so a re-read is free. Dedup-keyed rows are kept by the log's prune for good; the written-up row is the
busiest, one per answer — a few dozen a day on the owner's store.

## 7. The handoff pointer

`handoff/` stays a module that depends on `store/` alone: the words "how current" are
computed by the composition root at delivery (`Counterpart#handoffSince`, from the newest
`handoff.written` row's time and `workSince`) and passed in. The reserve is sized to the
widest of those words, so the share rule now turns the reserve on from about 3,000 bytes
of ceiling instead of 2,400.

## 8. Doctor

The `Write-ups` line replaces #192's `Crash write-up` and keeps its key (`crash-write-up`)
so the console's layout and its headline order are untouched. The 3-day wait is gone:
amber when a stretch from yesterday or earlier is owed.
