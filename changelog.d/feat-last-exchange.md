- **"Last said here."** A new session in a folder now gets one line pointing at the last
  exchange there: when, which session, and the first few words of the last message that
  session got, such as `Last said here, 18:42 (session 3fa9c1d2): "ok now let's fix the reserve…" —
  recall "last exchange"`. It comes from the most recent other session in the same folder,
  within about a day, and never from another folder. Asking `recall` for the handle
  `last exchange` returns both messages, the last message there and the assistant's last reply,
  with their times, each cut at a sentence. The end-of-session ask and its answer, text the host
  added (reminders, task notifications, subagent reports, skills, slash commands) and tool-only
  turns are skipped; text the host adds with no mark of its own (a coordinator's message) can
  still read as a message, so neither the line nor the handle says who sent it. It is read only
  from what Counterparts already captured in that
  folder, and never stored, and only in your own sessions: an observer folder, or a
  session that is not yours, gets no line and no answer. A session that was killed after you typed and before it
  finished replying is named by the last exchange it did finish. The line sits beside "Last
  here" and the handoffs, and is the first of them to give way. Dated items and the page
  always come first.
