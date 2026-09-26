# Adversarial review — PR #247 (reminder follow-ups N7, N8), 2026-09-26

Branch `prospective/followups`, reviewed at `e59321f`. The PR moves a dated memory's
`eventDate`/`remind` to the revision that succeeds it (`Counterpart#carryReminder` /
`#moveReminder`, which calls `Store#revise(old, { eventDate: null, reason: "reminder-moved" })`),
threads a three-state `DateIntent` through intake, makes `eventDate` nullable in the tool
schema, and says when a date has already passed.

Every finding below was reproduced against the PR head with a hermetic probe before it
was fixed. Blockers and should-fixes are fixed on the branch; notes are left as they are.

## Blocker

**B1. After one carry, the reminder can no longer be cancelled or rescheduled by the id
the model first saw.** Revising an ordinary memory is link-only, so the old row stays
live and recall keeps showing it; the model's next `updates:` names it again. That is the
normal case, not an edge. The carry read the date off that row only, and the move had
already cleared it.
- *Cancel:* `note(M, dated, plain)` → `note(updates: M)` mints N1 carrying the date →
  `note(updates: M, eventDate: null)`. The reply had no `reminder` field at all, and N1
  kept firing on 10-15. The person was told nothing, and the reminder came back anyway.
- *Reschedule, same shape in one `session_end`:* entry 1 `updates: M` (no date) and
  entry 2 `updates: M, eventDate: "2026-10-20"`. This left two dated rows, N1 on 10-15 and
  N2 on 10-20, and N2 dropped from `plain` to `quiet`. The old day kept firing, which is
  the failure N7 was written to stop.

*Fixed.* The move writes `meta.reminderMovedTo: <successor>` on the old row in the same
`revise` that clears its date, so both land together or not at all. `carryReminder` now
finds the date through `reminderHolder`: the target when it is dated, and otherwise the
end of its `reminderMovedTo` chain. Each hop goes through `Store#resolve`. The walk is
bounded by `DATE_LINEAGE_MAX` and is cycle-safe. The reply's `from` names that
holder. A revision that sends `eventDate: null` and reaches no dated memory now answers
`reminder: { cleared: false, note }` instead of silence. A fresh note sending `null` still
answers nothing.

## Should-fix

**S1. A move reset the reminder's spent state. So one reminder did come back twice, and
the new `DATE_PRIVILEGES` claim was false.** Two kinds of state are keyed by memory id:
the plain latch (`prospective.plain` rows, deduped by
`prospective.plain:<memoryId>:<window>:<beat>`) and the quiet firing rows
(`prospective(memory_id, window_key)`). So the successor started with nothing spent.
- *Plain month or range:* `2026-10` plain. The "opens" beat was told and claimed on 10-03,
  then a revision came the same day. `plainDue` offered "opens" again for the successor
  on 10-03 and again on 10-10, which is any non-last day of the window. The PR's "known
  edge" named only the same-day case for a day reminder. The real scope was every day of
  a month or range.
- *Quiet:* a window the assistant had already used (`reference` → `suppressed`, brake 4:
  "zero further fires this window") came back with a full `FIRES_PER_WINDOW` budget after
  a revision. `last_fired_day` and `told-plainly-today` were lost the same way.

*Fixed, read-side.* The successor's `meta.reminderFrom` names its predecessor, written at
the minting seam from `Proposal.reminderFrom`, which only `carryReminder` sets. The plain
reads (`plainTold`, `plainToldOn`) use `Prospective#lineage` to walk it. So do the brakes'
rows (`firingRowsFor`, used in `arrivals` and `fire`). They count what was spent for the
same window key on the memories the reminder moved through. A new date is a new key and
starts fresh, exactly as `reschedule` does. Nothing is copied. Copying plain rows would
have written `prospective.plain` rows for tells that never happened, and the gauge and
dashboard count those rows.

**S2. An archived dated memory was revived by a revision.** `archive(M)` followed by
`note(updates: M)` carried M's date onto a new live row, which then fired. It also wrote a
`reminder-moved` version on the archived row. `revision.ts` refuses `target-archived` on
every path, and archival (decay, or put away) is one of the ways a reminder is meant to
stop. *Fixed:* `reminderHolder` returns null for an archived or removed row, so nothing is
carried or moved and the author's own fields stand.

## Notes (no change)

- **The extra `revise` on the old row** writes one version row (reason `reminder-moved`,
  the old date kept, pruned with other versions at 90 days). It bumps `revision` and
  `updated_at` and re-indexes the unchanged text, which means one embed call. It keeps
  `model`, because the body is unchanged. It recomputes `confidential` from meta, which the
  new pointer key does not affect. It does not touch physics: `revise` writes none of the
  physics columns, and `updated_at` has no reader outside `store/`. So decay, strength,
  uses and credit are unchanged, and no reinforce or credit event is emitted. The
  owner-op seam is not involved: this is an ordinary `revise`, not a removal or strike.
- **Protected targets:** only self pages are ever `protected`, and they are never dated,
  so the move cannot hit one.
- **Removed targets:** `resolve` stops at a denied id, and the removal skeleton has
  `event_date = NULL` and `archived = 1`, so nothing carries.
- **Superseded targets:** `resolve` forwards to the head, and the carry reads the head.
  For a current-state or identity target, `applyRevision` may supersede the old row after
  the move. The move runs first, so the date has already left it. A later revision of
  *that* old id resolves to the pressure successor, which carries no pointer. This is
  rare, because dated notes are episodic.
- **Partial failure** is ordered on purpose. The successor is minted first, then the old
  date is cleared. A failed clear leaves the reminder on both rows: a double, never a
  loss. It is evented (`counterpart.reminder.move.failed`) and answered `unmoved: true`.
  A failed mint moves nothing. A retried deposit is refused as `duplicate-content` before
  anything moves.
- **Scope and confidentiality:** `updates:` resolution by id is not scope-limited, and
  it was not before this PR either. So a revision in scope A can take the date of a
  memory in scope B, and the reply echoes that date. A confidential memory's date can
  land on a non-confidential successor, because the successor's confidentiality comes
  from its own meta. It is the date only, never words. This is worth a decision if scopes
  ever become a boundary.
- **Exit accounting:** the old memory's firing rows stay where they are, so
  `exitReport` can count a moved window once per memory.
- **`Prospective#arm` / `reference` / `expire`** still read the memory's own rows, not
  the inherited ones. `reference` and `expire` write terminal states, so that is harmless.
  `arm(successor, key)` would write `armed` over an inherited `suppressed`. `arm` has no
  caller in `src/` (`fire` arms lazily), so this is left alone. If one is ever wired, have
  `write` read `firingRowsFor`.
- **A reschedule with identical words** is refused as `duplicate-content` by the content
  ledger. This predates the PR.
- **Schema `["string", "null"]`:** a client that sends no `eventDate` is unaffected, since
  the intent is `absent`. A client that fills every optional field with `null` would now
  *drop* a revised memory's date, where before it lost it anyway. The `mcp.test`
  privilege and schema tests pass.
- **Same-day double-say for a day reminder:** closed by S1, since the latch now follows
  the lineage.

## Tests added (`test/prospective-followups.test.ts`)

Six tests, under "review of #247":
- a cancel by the original id reaches the holder
- a two-entry `session_end` leaves one plain reminder
- a plain month is not re-told after a revision, and its last day still is
- a used quiet window stays used, and a reschedule starts fresh
- an archived target is not revived
- a cancel with nothing to cancel is said, and a fresh `null` is quiet

A mutation check reverting the read-side lineage fails the two S1 tests.
