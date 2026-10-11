- **Uninstalling with the plugin no longer leaves an empty memory folder behind.** After
  `uninstall` deletes or sets aside your memories, a plugin install is now told to remove the
  plugin right there in the terminal (`claude plugin uninstall …`), before opening Claude Code
  again. Opening Claude Code first let the still-enabled plugin set Counterparts up again, with
  a new, empty memory folder that stayed after the plugin was gone. If you have both the npm
  install and the plugin, it now names the plugin too.
