# `log/` — INTERFACE-GAPS

What this module still owes, as of 2026-09-30.

1. **A hook the host kills mid-run leaves a `process.start` with no `process.end`.** Nothing
   reads that pairing yet; `counterparts log` prints the lines as they are.
2. **The MCP server's `process.end` is written only on a clean close of stdin.** A server the
   host kills outright leaves none.
3. **The worker flattens the core's events** (`runOnce`'s `onEvent` takes a name and data), so
   a core event's `ref` does not reach the worker's lines.
4. **Narration reuses the dashboard's sentences**, written for durable payloads. Where a ring
   event's data differs from its durable row's payload, the sentence may read thinner than
   the raw `key=value` would. Checked for `adapter.boundary` only; the rest are unchecked.
5. **No dashboard page** reads the log (out of scope for the first build).
