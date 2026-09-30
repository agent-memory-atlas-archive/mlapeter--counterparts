# `log/` — INTERFACE-GAPS

What this module still owes, as of 2026-09-30.

1. **A hook the host kills mid-run leaves a `process.start` with no `process.end`** — or, at a
   prompt, which writes no start, nothing at all. Nothing reads that pairing yet;
   `counterparts log` prints the lines as they are.
2. **The MCP server's `process.end` is written only on a clean close of stdin.** A server the
   host kills outright leaves none.
3. **The worker flattens the core's events** (`runOnce`'s `onEvent` takes a name and data), so
   a core event's `ref` does not reach the worker's lines.
4. **Narration covers five names** (`LOG_NARRATED`). The dashboard's sentences are written for
   durable payloads; another name joins once its ring data is checked against its row, or
   once the log carries the durable payload itself.
5. **No dashboard page** reads the log (out of scope for the first build).
