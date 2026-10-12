### Decided by the cc-memory-switch removal builder, 2026-10-12, lightly held (the sidebar's Claude memory switch)

- Decided by the cc-memory-switch removal builder, 2026-10-12, lightly held: the switch is removed outright, with
  no migration step. A stored `claudeMemory: false` or `claudeMemorySwitch` is left in the plugin store and never
  read, so whoever had Claude Code's memory off gets it back from the next session. Why: with the filter gone there
  is nothing to undo, and writing to the store to clear dead keys would be one more thing that could fail.
- Decided by the cc-memory-switch removal builder, 2026-10-12, lightly held: `tools/term-loop` stops putting the
  `claudeMemory` preference back by a click on the switch. Why: the switch no longer exists, so the click could
  only miss or land on a memory titled "Claude memory".
