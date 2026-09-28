# `fit/` — NOTES

What the build learned. Newest last.

## §1. Build B (2026-09-28)

- **Measured as it leaves.** A tool result is the payload's JSON, pretty-printed, with the
  bundle text escaped inside it once more — so a character of bundle can cost two on the wire.
  Parts are measured that way (`dreamResultChars`, reflect's `resultChars`), not by the
  bundle's own length.
- **Stateless carry-over where it can be.** The dream's queue is read from the dreams' own
  `shown` column — no queue table. The ledger holds only what cannot be re-derived: which
  fidelity each id was shown at, the later parts' keys, and how far into each episode the last
  dream read.
- **No new durable event names.** The fit report rides on `dream.begun`, the reflection's row
  (`detail.fit`), and the `mcp.recall` row (`fromIndex`). A new name would need every
  dashboard registry to learn it; that is a dashboard change for its own session.
- **Unsure:** the chapter-entry importance is a keyword heuristic (feeling words, the owner
  named, words of a turn). A model-written label per entry would be better when one exists.
- **Unsure:** `NIGHT_CHARS` 100,000 and the reflection's `ROOM_CHARS` 80,000 are sized by
  feel from the first dream's ~111k tokens. The lookup count and a real night's `dream.begun`
  row are what should size them.

## §2. After the adversarial review (2026-09-28)

- **Characters are not tokens.** The ceilings are in tokens; a CJK character is about a token by
  itself. Every room and part now costs text by `wireChars` (a non-ASCII character counts as
  three), and cuts go by `clipWire`. Tested with Chinese text at the real limits.
- **A result carries its payload twice** (the text, and `structuredContent`). Whether a host
  counts both is not known here; nothing in this package reads `structuredContent`, so the long
  `bundle` text rides only in the text and the structured copy says `bundleChars`.
- **A lookup counts as the index's only while its run is open** (the dream not journaled, the
  reflection not finished) or within `LOOKUP_GRACE_MS` of its end.
- **Journal entries the room did not take are carried**: the index keeps each episode's entry
  count and the entries below it that were not taken (`unread`); the next dream sends them
  whether or not the episode grew.

