/**
 * A REAL v7 file, for the v7 → v8 upgrade tests: a store this build made, with
 * every v8 column and table taken off again and the stamp put back to 7 — the
 * shape the 0.3.2 / 0.3.3 builds write. Not a test file (no `.test.ts`).
 */
import { Database } from "bun:sqlite";

import { paths } from "../src/core/store/index.js";

/** The v8 columns, in the order v8 added them. */
export const V8_COLUMNS: readonly [string, string][] = [
  ["memories", "legacy"],
  ["memories", "returns"],
  ["memories", "return_days"],
  ["memories", "first_return_day"],
  ["memories", "last_return_day"],
  ["memories", "last_dream_day"],
];

/** The v8 tables. */
export const V8_TABLES: readonly string[] = [
  "returns",
  "wake_display",
  "dreams",
  "dream_changes",
  "dream_asks",
  "core_events",
];

/** Take a closed store at `dir` back to v7, in place. */
export function stripToV7(dir: string): void {
  const db = new Database(paths.operational(dir));
  for (const t of ["dream_changes", "returns", "wake_display", "dreams", "dream_asks", "core_events"]) {
    db.run(`DROP TABLE IF EXISTS ${t}`);
  }
  for (const [table, column] of [...V8_COLUMNS].reverse()) db.run(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  db.run("DELETE FROM meta WHERE key LIKE 'physics.v8.%'");
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schemaVersion', '7')");
  db.close();
}
