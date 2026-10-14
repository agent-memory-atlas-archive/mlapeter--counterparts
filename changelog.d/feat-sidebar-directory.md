- **The sidebar is ready for Anthropic's plugin directory.** The search box (hidden since
  0.3.20) is gone. In a terminal, COUNTERPARTS and a memory's `more` are now ordinary links
  to the dashboard, opened by your terminal (on some terminals with a ⌘- or Ctrl-click); in
  the desktop app they are buttons that run `/counterparts:dashboard`. The sidebar no
  longer runs a command to open a browser. The fox's pictures load from the plugin's own
  image files.
- **`counterparts dashboard` opens the dashboard that is already running** for your memory,
  instead of failing because its port is taken. A dashboard for another memory on that
  port still fails, and says so.
