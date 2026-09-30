/**
 * THE WAKE IS BEHIND (2026-09-30) — a mark set by the writes that change what
 * the next session should wake to, and read by whichever process with a budget
 * runs next.
 *
 * The bundle is rendered once per lived day by the sleep cycle, at the day's
 * first worker run. A page written after that, a write-up that lands, or the
 * nightly run's page did not reach a wake until the next lived day: on
 * 2026-09-30 the owner's first session of the morning woke with the page from
 * one version back. So the writes that matter set this mark, and the turn-end
 * worker and the nightly process re-render when they find it
 * (`Counterpart.refreshWake`). Not at SessionStart: the wake ranks nothing and
 * writes nothing (CONTRACT §5 G1).
 *
 * Two meta keys, so a renderer never writes the key a writer sets: `behind` is
 * the mark (`{ at, triggers }`), `caught` is the raw mark value the last render
 * read BEFORE it composed. Behind iff the two differ. A mark set while a render
 * is composing has a new value, so it is not swallowed by that render's catch-up.
 */
import type { Store } from "../store/index.js";

export const WAKE_BEHIND_KEY = "self.wake.behind";
export const WAKE_CAUGHT_KEY = "self.wake.caught";

/** What made the wake behind: the self page written, a write-up landed, the nightly run ended. */
export type WakeTrigger = "page" | "write-up" | "run-end";

export const WAKE_TRIGGERS: readonly WakeTrigger[] = ["page", "write-up", "run-end"];

/** The mark as it stands, with its raw value — the thing a render records as caught. */
export interface WakeBehind {
  readonly raw: string;
  readonly at: number;
  readonly triggers: readonly WakeTrigger[];
}

function parse(raw: string): { n: number; at: number; triggers: WakeTrigger[] } | null {
  try {
    const v = JSON.parse(raw) as { n?: unknown; at?: unknown; triggers?: unknown };
    const triggers = Array.isArray(v.triggers)
      ? WAKE_TRIGGERS.filter((t) => (v.triggers as unknown[]).includes(t))
      : [];
    return { n: typeof v.n === "number" ? v.n : 0, at: typeof v.at === "number" ? v.at : 0, triggers };
  } catch {
    return null;
  }
}

/** The mark, when the wake is behind it; null when the last render caught up. Never throws. */
export function wakeBehind(store: Store): WakeBehind | null {
  try {
    const raw = store.getMeta(WAKE_BEHIND_KEY);
    if (raw === undefined || raw.length === 0) return null;
    if (store.getMeta(WAKE_CAUGHT_KEY) === raw) return null;
    const v = parse(raw);
    return { raw, at: v?.at ?? 0, triggers: v?.triggers ?? [] };
  } catch {
    return null;
  }
}

/**
 * Set the mark. A mark still pending keeps its triggers and gains this one, so
 * the render that catches up says everything that put it behind. Never throws:
 * a mark that cannot be written costs the early refresh, never the write that
 * set it — the next lived day's render still comes.
 */
export function markWakeBehind(store: Store, trigger: WakeTrigger): void {
  try {
    const pending = wakeBehind(store);
    const triggers = pending === null ? [trigger] : WAKE_TRIGGERS.filter((t) => t === trigger || pending.triggers.includes(t));
    // A count as well as the time, so two marks never read alike — not even
    // under a clock that stands still, which is how most tests run.
    const n = (parse(store.getMeta(WAKE_BEHIND_KEY) ?? "")?.n ?? 0) + 1;
    store.setMeta(WAKE_BEHIND_KEY, JSON.stringify({ n, at: store.now(), triggers }));
  } catch {
    /* the write that set it already landed */
  }
}

/** A render that read `raw` before composing has published: the wake has caught up to it. Never throws. */
export function noteWakeCaught(store: Store, raw: string): void {
  try {
    store.setMeta(WAKE_CAUGHT_KEY, raw);
  } catch {
    /* the mark stays, and the next process with a budget renders again */
  }
}
