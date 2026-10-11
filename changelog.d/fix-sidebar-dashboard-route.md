- **Plugin installs can start the dashboard: `/counterparts:dashboard`.** A plugin install
  has no `counterparts` command, so the sidebar's "start it with `counterparts dashboard`"
  couldn't work there. The new command starts the same dashboard from the plugin, in the
  background, until the session ends. With the dashboard down, the sidebar names the way
  that works for your install: `counterparts dashboard` for the npm install,
  `/counterparts:dashboard` for the plugin.
- **The sidebar finds a dashboard on another port.** When `COUNTERPARTS_DASHBOARD_PORT` is
  set, the sidebar reads and links to that port, as the dashboard itself does, instead of
  assuming 4747.
