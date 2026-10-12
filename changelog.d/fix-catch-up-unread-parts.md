- **A catch-up no longer re-reads what a session already wrote up.** A long session that wrote its own
  chapters as it went left parts whose every word was already written up, and a catch-up handed each one to a
  reader anyway, about 24 KB at a time, only for it to answer "nothing new" in two seconds. Those parts are now
  passed over without a reader and cost a batch nothing, and the run's summary says how many there were
  ("16 parts written, 11 of them already written up in their own session"). On the first live catch-up's
  biggest session that is one child instead of three, with about the same memories kept.
- **A catch-up's "nothing worth keeping" says why.** In the nightly run or `counterparts catch-up`, an empty
  answer for a part that holds words not yet written up now needs a one-line reason; without one the part is
  not counted as written, stays owed for the next run, and doctor and `counterparts coverage` say how many
  parts were left unread. A live session's empty answer is unchanged.
- **`counterparts catch-up --reowe <run>`.** Owes again the parts a named run closed with nothing kept, when
  their words were not yet written up. It prints the plan first, then asks for the run's id typed back
  (`--yes` skips that, `--dry-run` stops at the plan), and refuses by name what it cannot do: a session the
  run went on to write up, parts after them that brought memories back, or words no longer kept. It reads the
  run from the log, which keeps a week.
