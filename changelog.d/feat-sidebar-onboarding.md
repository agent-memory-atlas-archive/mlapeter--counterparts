- **The sidebar's Counterparts switch has three positions: on · paused · off.** Paused and
  off each ask first and hold for every session in that folder; on resumes a pause at once,
  and turns a folder you set off back on after one confirmation ("Nothing from while it was
  off was kept."). It stays as careful as before: a state it couldn't read is never shown
  as on, and it changes only a folder with a setting of its own. A folder that is off or
  paused because a folder above it is, it explains, naming that folder, and leaves alone.
- **The "Claude memory" switch is hidden unless you ask for it.** It turns Claude Code's
  own memory (MEMORY.md) on and off, which most people don't need beside Counterparts. If
  you had already turned Claude Code's memory off, you keep the switch. To show it anyway,
  start Claude Code with `COUNTERPARTS_SIDEBAR_CC_MEMORY=1` in the environment (for
  example `export COUNTERPARTS_SIDEBAR_CC_MEMORY=1` in your shell profile). What it does
  when shown is unchanged.
- **Ready for the first meeting.** Once Counterparts' first meeting ships, the sidebar
  starts it: in the first session after an install, Claude speaks first ("Counterparts is
  installed. Say hello and introduce yourself.", shown as sent by the plugin), once per
  install, never in a `-p` run, in a folder that is paused or off, or after you've typed.
  If you put the meeting off, a **Meet your counterpart** row at the top of the sidebar
  starts it when you're ready. Until then nothing changes.
