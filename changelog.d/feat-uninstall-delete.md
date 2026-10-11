- **`counterparts uninstall` asks whether to delete your memory too.** Once Claude Code is
  disconnected, at a terminal, it lists every path that would go (the store, its snapshots,
  the configuration) with its size, says what it leaves (Claude Code's own files), and asks
  "Also delete all memories and related data? This can't be undone. [y/N]". Enter keeps your
  memory. A yes asks you to type `DELETE MEMORIES` before anything is deleted. It isn't asked
  from a pipe, with `--yes`, or with the new `--keep-memories`, and isn't offered while a
  Claude Code session, the dashboard or the worker has the memory open.
- **`--delete-memories` also waits for open sessions.** It now refuses while a Claude Code
  session's hooks ran on the store in the last ten minutes, or a memory server is recorded
  as running on it, not only while one shows up in the process list.
- **`counterparts uninstall --json`, for the plugin's own command.** On its own it prints
  the plan as one JSON object and changes nothing: what a delete would remove and leave, the
  count, and whether it can go ahead now. With `--keep-memories` it uninstalls and keeps your
  memory. It never deletes: that is always typed by you, at a terminal.
- **Uninstall's last lines fit a plugin install.** Run through the plugin, they name the
  plugin's own command line and Claude Code's `/plugin` to remove it, not `bun remove -g`.
