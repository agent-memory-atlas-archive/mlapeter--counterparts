- **Your words from a session's last turn no longer stay in the database.** Recall keeps a
  few words from your previous message to help with the next one. A session that ended,
  or was closed abruptly, kept its last few words indefinitely. Now they are cleared once
  the session has been quiet for the retention limit (14 days unless you changed it),
  including for sessions from before this update. Backups taken from then on don't
  contain them either.
