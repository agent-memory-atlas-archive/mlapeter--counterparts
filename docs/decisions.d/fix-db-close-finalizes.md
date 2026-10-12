### Decided by the db-close builder, 2026-10-11, lightly held (`Db.close()` really closes)

- Decided by the db-close builder, 2026-10-11, lightly held: a `Statement` from `db.prepare`
  holds its SQL and looks up the driver statement on each call, instead of holding the driver
  statement. Why: a statement dropped from the cache (at the 512 cap, or on an `ALTER`/`DROP
  TABLE`) can then be finalized at once without breaking a caller that kept the handle, and
  that caller gets the new columns after an `ALTER`. The alternative, keeping dropped
  statements until `close()`, grows without bound under SQL built per call.
- Decided by the db-close builder, 2026-10-11, lightly held: anything run on a closed `Db`
  throws a new `StoreError` code, `DB_CLOSED`, and a second `close()` does nothing. Why: before,
  under bun a statement kept from before the close still ran on the half-closed connection,
  and under node a double close threw. A use after close is a bug that should say so.
- Decided by the db-close builder, 2026-10-11, lightly held: an observer's close is not kept
  from folding the log. When it is the last connection on a file, SQLite checkpoints at close
  and the database file's bytes can change with no row changing. Why: bun and node expose no
  way to turn that off for one connection (`SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE`), a read-only
  open refuses a WAL store whose sidecars are gone, and under node it was always so. The
  observer promise is about rows, and a writer folds its own log on close, so an instrument
  usually finds nothing to fold.
- Decided by the db-close builder, 2026-10-11, lightly held: a pre-migration copy older than
  today is reused when neither the database file nor a NON-EMPTY `-wal` is newer than it.
  Why: with closes now real, bun's own SQLite on Linux deletes the `-wal` at the last close
  and the next open makes an empty one, so an empty `-wal`'s mtime is an open's, not a
  write's; counting it meant an older copy was never reused there.
