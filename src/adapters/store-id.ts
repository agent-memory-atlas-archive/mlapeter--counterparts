/**
 * WHICH STORE THIS IS, without saying where it is (2026-10-12, Mike's
 * fresh-user trial). On one machine two stores — a throwaway trial store and
 * the person's real one — can both try dashboard port 4747, and the sidebar
 * mod read the real store's dashboard during a trial: read-only, but the wrong
 * store. So the dashboard says which store it serves (`/api/whoami`, and a
 * `store` field on `/api/onboarding`), and the session-start wake says which
 * store this session's hooks opened (`storeMarker`); the mod compares the two.
 *
 * THE ID: `st_` and the first 16 hex of a sha256 over the store's resolved,
 * symlink-free data dir. Nothing is written to the store for it (no store
 * format change, and a dashboard never writes), so it is the same on every
 * open of the same directory, by any process, and it differs between two
 * directories. It never carries the path: a hash, not an encoding. It names a
 * directory, not a history — a store moved or restored to another path reads
 * as another store, which for the mod's question ("is this my store's
 * dashboard?") is the safe answer.
 */
import { createHash } from "node:crypto";
import { realpathDeep } from "../core/store/index.js";

/** What every id starts with, so a reader can tell one from any other token. */
export const STORE_ID_PREFIX = "st_";

/** The id's shape: the prefix and 16 lowercase hex. */
export const STORE_ID_RE = /^st_[0-9a-f]{16}$/;

/** The store id for the data dir `dir` (the store's own `dir`). Never throws for a path that does not exist yet. */
export function storeId(dir: string): string {
  const real = realpathDeep(dir);
  return STORE_ID_PREFIX + createHash("sha256").update(`counterparts-store\0${real}`, "utf8").digest("hex").slice(0, 16);
}

/**
 * THE WAKE'S STORE MARKER: `<!-- counterparts:store id=st_… -->`, on its own
 * line right under the first meeting's marker (`core/onboarding.ts#
 * onboardingMarker`) on a Claude Code session-start wake, so the mod learns
 * from the hook's own context which store this session opened, before any
 * dashboard is up.
 */
export function storeMarker(dir: string): string {
  return `<!-- counterparts:store id=${storeId(dir)} -->`;
}
