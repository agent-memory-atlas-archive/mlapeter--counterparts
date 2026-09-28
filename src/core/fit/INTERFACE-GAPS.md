# `fit/` — INTERFACE-GAPS

What this module still owes, or asks of others. Newest last.

## §1. The dashboard (2026-09-28)

The lookup count is in doctor (`Lookups`). The dashboard does not show it yet, nor the queue
(`dream.begun`'s `queue`, `waiting`, `agedOut`), nor the fidelity a merge or gist was made at
(`dream_changes.detail.fidelity`). Those belong to the dashboard's own session.

## §2. Other mechanisms that could fit this way

- The page writer's day (`self/writer.ts`, 8 KB by strength): one long statement can take most
  of the room; a line per statement would fit more.
- The wake's lanes (`self/identity.ts`): a "N more" pointer per lane.
- One budget per hook envelope (SessionStart, UserPromptSubmit).
