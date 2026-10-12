### Decided by the primacy-removal builder, 2026-10-12, lightly held (directory pre-flight)

- Decided by the primacy-removal builder, lightly held: an old configuration's `parallel`
  key, in any shape (`{ "enabled": true }`, a half-written block, a string), is ignored in
  silence. It is not refused, does not take the configuration to observer, and adds no
  `retired` line. Why: the key switched on a stand-down only the parallel run used, so
  dropping it changes nothing for anyone; refusing it would cost a user their hooks for a
  stale line, and a `retired` note would tell nearly everyone about a setting they never had.
  Before this change a malformed `parallel` block made the whole configuration unreadable;
  that strictness went with the knob.
- Decided by the primacy-removal builder, lightly held: `primacy.ts` moved to
  `tools/parallel/primacy.ts` rather than being deleted outright. Why: `tools/parallel/`
  (kept on purpose) imports `assignmentHealth`/`assignmentPath`/`AB_DIR_ENV` from it, and
  deleting it would break the instrument and its tests. Two edits inside `tools/parallel/`
  follow from that: `readers.ts` imports from `./primacy.js`, and `preflight.ts` reads
  `parallel.enabled` from the raw config JSON because `loadConfig` no longer parses it.
- Decided by the primacy-removal builder, lightly held: in its new home the resolver has no
  `~/.memory-ab` default; `abDir()` throws when `MEMORY_AB_DIR` is unset. Why:
  `test/parallel.test.ts` requires that no non-`bin/` module in `tools/parallel/` imports
  `node:os`, and every caller already passes the directory in (`readAssignmentAs`).
- Decided by the primacy-removal builder, lightly held: the `adapter.primacy.deliver` and
  `adapter.primacy.standdown` event names stay in core, the dashboard and `fired.ts`. Why:
  they name rows already in stores from the run; removing them would leave old rows
  unnarrated, and keeping them changes no store format. Nothing in src/ emits them now.
- Decided by the primacy-removal builder, lightly held: the resolver's own unit tests stay
  in `test/claude-code.test.ts`, importing from `tools/parallel/primacy.js`; the
  `parallel.enabled` hook tests were replaced by a stale-key test. Two tests in that block
  that checked unrelated durable rows (delivery rows, boundary rows) were kept and run
  without the knob.
