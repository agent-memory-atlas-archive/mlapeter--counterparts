- **The nightly run catches up on everything owed.** Sessions that ended before they were
  written up used to wait for a new session in the same folder, or for the nightly run,
  which took at most four of them a night. The nightly run now writes up all of them,
  oldest first, in short batches, with a ceiling of 100 parts and an hour a night against
  runaway cost. What it leaves stays owed for the next night.
- **`counterparts catch-up` does it now.** It writes up every ended session that is still
  owed, through the same windowless `claude -p` the nightly run uses, while your other
  sessions stay open. It prints each batch, then how many sessions it caught up and how many
  sessions and parts are left. It uses your Claude subscription like any session.
- **New sessions no longer write up other sessions at the start.** With dreaming on `auto`,
  a new session isn't pointed at an older session's words any more; the nightly run and the
  command do that work. Your sessions' own write-ups are unchanged. With dreaming on `ask` or
  `off`, no nightly run happens, so the pointer stays.
- **Doctor says how far a catch-up got.** Its Catch-up line (it was Write-ups) and its
  Nightly run line count the parts written and the parts still owed. On 10-11, "wrote up 0 of
  1" was shown for a night that wrote 5 of a session's 17 parts. When the night has caught
  up, the next session is told in one line.
- **A nightly run cut off by an update says so.** If an install migrates the store while the
  nightly run is going, the run is recorded as unreadable after an update mid-run. It used
  to say the run had used none of its tools.
