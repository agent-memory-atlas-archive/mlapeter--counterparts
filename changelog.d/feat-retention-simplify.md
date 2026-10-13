- **Conversation text is kept for less time, and never in a backup.** The text of your
  conversations is deleted 3 days after it is written up and the session has ended (it
  was 7), and is never kept more than 14 days after the session's last activity, written
  up or not. Both can be changed in `claude-code.json`:
  `"retention": {"afterWriteUpDays": 3, "maxDays": 14}`. Daily backups no longer copy it
  at all, so restoring one loses whatever was not yet written up. Backups made before
  this update still hold it until they rotate out, or until you delete them.
- **Delete one kind of data at a time.** `counterparts delete conversation-text`,
  `delete backups` and `delete activity-log` each delete that one kind and nothing else.
  Each shows what it would delete first (for conversation text, how many sessions were
  still waiting to be written up and would be lost) and asks once; `--yes` skips the
  question for a script. The dashboard's Memories page has the same three under
  "Delete data…".
- **The first meeting says where the sidebar is.** In the plugin, the end of the first
  meeting now says the memory sidebar appears on the right once the window is wide
  enough.
