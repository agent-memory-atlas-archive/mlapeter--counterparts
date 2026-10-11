- **"Since you started."** A session that is already open now hears what changed in other
  folders while it worked: one line for the assistant, at a prompt, such as "Since you
  started (10:40): ~/deadfront ended 11:05, 3 memories; ~/random open since 10:52, 2
  memories." Only when something changed there (a session started or ended, a
  chapter, new memories), never at the first prompt after the wake, and at most once an
  hour. The same rules as "Today, elsewhere": counts, not what was said; a chapter's title
  only when it is about you or me; folders whose scope is not on are not named. It takes
  only the room recall left, and waits for the next prompt when there is none. Reads only,
  no model call: about 5 ms on a prompt that checks, nothing in the hour after a line.
