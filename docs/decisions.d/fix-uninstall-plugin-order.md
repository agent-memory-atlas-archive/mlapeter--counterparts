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
