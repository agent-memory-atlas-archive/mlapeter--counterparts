# `coverage/` — CONTRACT

## 1. Purpose

Say what is not written up yet, in one place. A captured piece of conversation counts as
written up only when a claim for it stands in `coverage.jsonl`; this module is the one
reader of that file for "what is owed", and the pacer, retention, the next-session
write-up, the handoff pointer, doctor and `counterparts coverage` all read it here.

It does not change how pieces are claimed. `SpanBuffer.claimCoverage` still does all of
it; this module adds two callers with no proposal behind them ("nothing new", a chapter).

## 2. Brain analog

**Rehearsal debt.** What was lived and not yet consolidated is fragile; what nobody
rehearses within a few days of use is lost to the ordinary forgetting. The ledger is that
debt made countable. **Named deviation** (constitution 12): the brain keeps no ledger of
what it has not rehearsed. Here the rehearsal is a written act, and a written act can be
counted, so it is.

## 3. Keeps

- **The claim as the only proof.** [v2, `remember/` §4.1 G4] Claims partition a session:
  each takes what is unclaimed. The ledger reads that and nothing else — not asks, not
  answers, not handoffs.
- **Host evidence handed in.** [v2, `remember/owes.ts`] Whether a session ended is the
  host's to say; core knows no host.
- **Content by reference.** [store §5 G10] Rows carry ids, counts and codes; the scope as
  its buffer key, never the path; no text and no hash of text.

## 4. Drops / simplifies

- **The asked / answered rule** (B3, 2026-09-23) and #285's separate short debt: one rule
  now, on pieces and time.
- **The 12-hour silence window** for "is it still running" in the write-up: a session is at
  work while it has captured something today and has not ended.
- **Any backfill.** On a store with old unwritten stretches the ordinary rule applies the
  first time it runs: they lapse, with one row each.

## 5. Contract

**Inputs** — a `SpanBuffer` (read-only for everything but the two claims), the store's
zone, a clock, and optional host evidence (`endedAt` per session).
**Outputs** — the ledger (per session: state, pieces, what is written up, the unwritten
stretch, owed, lapsed, small, per-date counts); `askFromStretch`; `claimUnwritten`;
`workSince`; three durable row names written by `recordCoverage`.

**Guarantees** — **[M]** mechanized, **[A]** advisory:

1. **[M] One rule for "owes".** A session owes a write-up when its unwritten stretch is at
   least `OWED_PIECES` pieces spanning `OWED_SPAN_MS`, it is not active (it ended, or it has
   captured nothing since the calendar date changed in the store's zone), and the stretch
   has not lapsed. `remember/owes.ts#planRetention` reads it; nothing else decides it.
2. **[M] The pacer's third arm is pieces AND time**: `ASK_PIECES` unwritten pieces and
   `ASK_AFTER_MS` since the later of the stretch's first piece and the last ask. One piece,
   however large, is never an ask on its own. The 12-a-day cap is the pacer's and stands.
3. **[M] Lapse deletes nothing.** An owed stretch lapses at the first turn-end of the
   `LAPSE_DAYS_OF_USE`th day of use after the date of its latest piece; the session stops
   owing and its text goes on retention's ordinary week.
4. **[M] One row per stretch per state** — `coverage.owed`, `coverage.written` (with its
   writer: the session, nothing-new, a chapter, the next session), `coverage.lapsed` —
   each under a dedup key. The first pass on a store writes no written-up rows for claims
   made before it.
5. **[M] Dates are the pieces' own**, read in the store's zone — never the lived day on a
   piece, which lags on a date's first turn-end.
6. **[M] Read-only but for two claims**: "nothing new" and a chapter, each under
   `<by>:<id>` in the same `coverage.jsonl`, refused under observer by the buffer's seam.
7. **[A] "Written up" / "not yet written up"** in anything a person reads; never "covered".

## 6. Tunables

`tunables.ts`, every one a working default: `ASK_PIECES` 3, `ASK_AFTER_MS` 30 min,
`OWED_PIECES` 3, `OWED_SPAN_MS` 15 min, `LAPSE_DAYS_OF_USE` 3, `SMALL_STRETCH_PIECES` 6.
