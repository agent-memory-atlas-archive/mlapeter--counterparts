### Decided by the uninstall-plugin-order builder, 2026-10-11, lightly held (removing the plugin after a terminal delete)

- Decided by the uninstall-plugin-order builder, 2026-10-11, lightly held: after a delete or a
  park, `counterparts uninstall` tells a plugin install to run `claude plugin uninstall <id>`
  at that terminal before Claude Code opens again, instead of `/plugin → Installed →
  counterparts → Uninstall`. Why: measured with Claude Code 2.1.296 in a throwaway home,
  reopening with the plugin enabled runs its SessionStart (and first run) at startup, before
  anybody can reach /plugin, and re-creates `~/.counterparts`; removing it from the terminal,
  or disabling it before the delete, leaves nothing. The person is already at a terminal with
  Claude Code closed, so the terminal command is the one that fits.
- Decided by the uninstall-plugin-order builder, 2026-10-11, lightly held: the id comes from
  Claude Code's `installed_plugins.json`, else `counterparts@counterparts` (the published one).
  An npm install whose host also has the plugin enabled is told to remove it too, because once
  the npm hooks are out the plugin stops standing down. The keep arm's closing line is
  unchanged: its configuration stays, so no first run fires. Why: the hazard is a missing
  configuration, and only delete and park remove it.
- Decided by the #425 reviewer, 2026-10-11, lightly held: the printed removal names the scope.
  Claude Code's `installed_plugins.json` records each install's `scope` and, for a project or
  local one, its `projectPath`, so a project or local install is told
  `cd <folder> && claude plugin uninstall <id> --scope <scope>` (or "in the project it was
  installed for" when no folder is recorded); a user install keeps the plain command. Only the
  first record is read. Why: `claude plugin uninstall` defaults to user scope and fails for a
  project install, and the scope was cheap to know.
- Decided by the #425 reviewer, 2026-10-11, lightly held: `commands/uninstall.md` step 5 offers
  both removals (the terminal command the closing line names, or /plugin → Uninstall after
  reopening), keeping #421's disable-first order. Why: the terminal and the command now say the
  same thing; either route is safe there because step 1 disabled the plugin.
