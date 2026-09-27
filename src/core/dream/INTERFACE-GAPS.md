# `dream/` — INTERFACE-GAPS

What this module still owes, or asks of others (2026-09-26).

1. **Live try-out with a real background agent.** The flow was exercised against a demo
   store through the MCP server (launch → begin → propose → journal, then
   `counterparts dream --show/--undo`); a real Claude Code session launching the Agent
   tool with the prompt has not yet been watched end to end on the owner's machine.
2. **The ask is claimed when composed**, not at delivery. If the host drops the line
   (envelope limits), that day's ask is lost. The plain reminders' pattern
   (`bin/hook.ts#deliverTurn` → claim only what the envelope carries) is the fix.
3. **A subagent's own turns (the sidechain).** On current hosts a subagent's transcript
   is a separate file the boundary does not read; if a host ever writes a dreamer's
   turns into the parent's file, only turns carrying the mark are refused. The
   dreamer's final message is the marked hand-back by instruction and by the tool
   handing it the words.
4. **`export --markdown` does not carry the `dreams` table**, and there is no door to
   remove one dream's journal short of undoing it (which keeps it, marked undone). The
   owner's removal of a MEMORY blanks its address in `dream_changes`.
5. **Merged memories keep no embedding** until the next backfill embeds them (as any new
   memory).
6. **Dream links are ordinary edges.** If the association work wants them marked (a
   table, a starting weight, a hop rule), `apply`'s `link` and `gist` arms are the two
   writers.
