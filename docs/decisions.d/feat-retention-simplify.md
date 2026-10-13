### Decided by the retention builder, 2026-10-13, lightly held (simpler retention, no text in backups, delete one kind)

- Decided by the retention builder, 2026-10-13, lightly held: the 14-day ceiling is
  measured from the session's last ACTIVITY (its last capture or boundary), not from a
  later write-up or registry end, and it overrides every other keep: owed, held open by
  the registry, or inside the 3-day clock. Why: "never kept more than 14 days" should be
  literally true, and a late write-up must not extend it. A session whose every moment
  failed to read (at 0) is not judged by the ceiling, so a bad read still moves toward
  keeping.
- Decided by the retention builder, 2026-10-13, lightly held: the two clocks are a
  `retention` block in `claude-code.json` (`afterWriteUpDays`, `maxDays`, whole days,
  at least 1), read leniently like `snapshots`: a bad field falls back to its default,
  is named, and doctor's Raw transcripts line turns amber. Only the worker's retention
  pass and doctor read them; the write-up's readers use the defaults, because the clocks
  change when text goes, never what is owed. The onboarding line says the defaults
  (3 / 14) whatever the configuration says.
- Decided by the retention builder, 2026-10-13, lightly held: `spans` leaves the backup
  set (`store/paths.ts#LAYOUT`, `backup: false`), so the manual `backup` command stops
  copying it too, not only the daily snapshot. No setting turns it back on. Snapshot
  recognition keys on classification, so copies without `spans/` and older copies with
  it are both "ours" and rotate as before.
- Decided by the retention builder, 2026-10-13, lightly held: the database holds no
  conversation text, with one small exception: `gate_session`'s scalar row carries the
  previous turn's cue tokens (single keywords, one-turn expiry). Revised the same day
  (fix/gate-carry-retention): `pruneGateSessions` turned out to have no live caller, so
  an ended or killed session kept its last turn's tokens indefinitely. The worker now
  empties the carry of every session idle past `maxDays` (`recall/session.ts#clearIdleCarries`,
  every run, before the day's copy), so copies taken from then on hold none older than
  the ceiling. Copies taken before it keep theirs until they rotate; no strip step was
  added to the copy path.
- Decided by the retention builder, 2026-10-13, lightly held: `counterparts delete <kind>`
  has one confirm shape: no flag prints the counts and changes nothing, a terminal is
  asked once (y/N), and `--yes` acts for a script or the dashboard (which shows the
  counts and a "Yes, delete" button first). Not `remove`'s typed-back id: these are three
  fixed kinds, and Mike asked for a plain confirm. Conversation text goes through
  `remember/`'s strike naming every hash and session held (`by: "owner"`); backups are
  taken apart file by file with the rotation guards (`snapshots.ts#deleteAllCopies`),
  including the mirror, leaving pre-rows copies and folders that are not ours; the
  activity log deletes its dated files only. Each leaves one `owner.deleted` row with
  the kind and counts. It is on the advanced help shelf, not the first page (that page
  is the owner's words, byte for byte). The dream journal and the self page are not
  kinds.
