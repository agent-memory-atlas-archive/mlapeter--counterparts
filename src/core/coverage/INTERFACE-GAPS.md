# `coverage/` — INTERFACE-GAPS

What this module still owes, or leans on that is not what it looks like.

## 1. Three evidence lifetimes

The ledger joins facts that expire on different clocks: the host's registry forgets a
record 7 days after its last write (`adapters/sessions.ts#pruneSessions`); event rows are
kept about 90 lived days (dedup-keyed ones for good); captured text goes 7 days after a
session owes nothing (`remember/retention.ts`). A session whose registry record is gone
reads its end from `boundaries.jsonl` alone, and a `claude -p` / SDK session whose record
is gone can no longer be told from a person's for the small-stretch pointer.

## 2. A write-up's memories carry the writer's session

The door deposits under the WRITING session and covers the ended one's pieces
(`cover: { session }`), so the memory's `origin_session` is the writer's. The ledger
classifies the claim as `next-session` from the proposal record; a memory's own row does
not say whose words it came from.

## 3. Throughput: debts in projects not reopened lapse

The only writer of a debt is the next session in the same project, at most
`WRITE_UP_ASKS_PER_DAY` pointers a day store-wide, one part (~24 KB) each. A project not
reopened within two days of use after its stretch lapses it. The background run doing
write-ups (and arbitration between two writers claiming first) is a later build.

## 4. The crash sweep is unreachable

`remember/fallback.ts` is still the worker's step 1, and keyless it only writes its gate
row (`not-opted-in`). Nothing in this module reaches it, and nothing claims what it would
have.

## 5. "Nothing new" before 2026-09-30

Before this build a `memories: []` answer marked the registry (`nothingNewAt`) and claimed
nothing. Those sessions' stretches read unwritten now, and lapse with their days of use.
The registry mark is still written; nothing decides on it any more.
