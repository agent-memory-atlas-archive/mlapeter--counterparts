- **The sidebar's Counterparts switch has three positions: on · paused · off.** Paused and
  off each ask first and hold for every session in that folder; on resumes a pause at once.
  It stays as careful as before: a state it couldn't read is never shown as on, it changes
  only a folder with a setting of its own (anything else it explains), and it won't turn a
  folder that is off back on (it says the `counterparts scope <folder> --on` command, and
  the off confirm says so before you choose).
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
