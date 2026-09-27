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

7. **Reflection (2026-09-27) — what it still owes.**
   - **The owner's reply to a share is not weighed** (the brief's follow-up): `told`
     records the telling; nothing reads his answer yet.
   - **No opt-out** for the morning share (on by default; Mike: opt out later if needed).
   - **A reflection on its own has no trigger**: `reflect launch` exists, but nothing asks
     for one on a dreamless day. The old SessionStart page writer still covers those
     nights.
   - **Not yet watched live** with a real background agent.
   - **`export --markdown` does not carry the `reflections` table** (as §4 for dreams).
   - **The crash-fallback sweep sets no about mark**: a self memory it mints is unmarked,
     so not a core candidate until something awake marks it. A choice, not an oversight —
     the sweep is a reteller.

8. **The dashboard reads the ask's preview (2026-09-27).** `previewAsk` exists for the
   Tonight box, which still counts "new since the last dream" itself until the dashboard
   session switches it over (its `DashboardSource` does not carry `dreams` yet). The
   dashboard is an observer: it passes `owner: true` to preview the owner's own gate
   (confidential memories counted), or leaves it off for a guest's — its call.
