- **The sidebar shows what memory is doing, in 35 columns.** A small brain beside the
  title (click COUNTERPARTS for the dashboard), the day, the count and a search box; then
  **Memories**, what was said to Claude in full for your last message, and
  **Subconscious**, the titles it was quietly given (`↗ opened` on one it looked up);
  **Saved this session**, newest first; **Mechanisms today**, how many times each of the
  twelve fired today, as bars (a click on one lists what its firings were about: the
  memories that came to mind, what faded, what was merged, never bare counts); and **Last
  Dream**, its first sentence (a click opens more of the dream). Each item takes up to
  three lines, and when they don't all fit, fewer show. A click opens any item in place,
  and again closes it; a long one shows 20 lines and ends with **more**, which opens that
  memory on the dashboard (the dashboard now opens one memory by `#memories?id=`). Dates
  in titles read short ("Oct 9"; today's are dropped). A click on a section's heading
  gives it the room. Three rows of switches at the bottom: Counterparts in this folder
  and Claude Code's own memory (each as safe as before: a pause still asks first, and an
  unknown state is never shown as on), the view, and the brain. On a laptop screen the
  sections fold to fit, each keeping its heading.
- **Closed, it says the newest thing in one line.** `/counterparts quiet` (or the pane's
  ✕) shows it dim at the end of the line under the prompt, as in "remembered: …", "stored:
  …" or "dreamed: …", always ending with "· /counterparts opens it". The amber status line
  is gone except to warn that a folder is paused or off, and clearing it gives the row
  back. `/counterparts brain turning|still|off` (or the footer) sets the brain: turning
  sways gently, still lights only when something fires, off leaves it out. A view or brain
  you set before carries over; v0.1's "full" opens the sidebar, its "quiet" and "hidden"
  are quiet.
- **The dashboard counts each mechanism's firings today.** `/api/mechanisms` carries
  `firedToday` on every mechanism: how many times it fired on today's date, counting
  rows rather than amounts, and one dream once. With a dashboard from before this
  release the sidebar counts them itself from the activity feed.
