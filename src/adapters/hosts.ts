/**
 * WHICH HOST A SESSION LIVES IN, AND THE FEW SENTENCES THAT DEPEND ON IT.
 *
 * Until 2026-09-30 there was one host, and its UI text sat wherever it was
 * first needed: "Run /mcp and Reconnect" in `sessions.ts`, and inside two MCP
 * refusals that end with it. That sentence is Claude Code's — `/mcp` is its
 * slash command — and a tool result read in Claude Desktop's chat, which has no
 * such command, would tell the model to ask the person for something that does
 * not exist. So the words a result says ABOUT THE HOST are looked up here, by
 * host, and nowhere else.
 *
 * Two things this file keeps:
 *
 *   **A record with no host is Claude Code's.** Every session record written
 *   before this field existed was written by Claude Code's hooks, so
 *   `DEFAULT_HOST` is what an absent `host` reads as (`sessions.ts#hostOf`),
 *   and what a process that was told nothing writes as.
 *
 *   **Claude Code's words do not move.** Its entry is the text those callers
 *   printed before this table existed, byte for byte; the exported constants
 *   that name it (`sessions.ts#RECONNECT_REMEDY`,
 *   `mcp/server.ts#STALE_SERVER_REFUSAL`) are built from it and compare equal.
 *
 * A host name is a short token, checked like a session's entrypoint, so a
 * record written by a newer build naming a host this build has no words for
 * still reads — and speaks with the default host's words. It sits beside
 * `sessions.ts` for the same reason that file does: every adapter needs it, and
 * no adapter may import another.
 */

/** The host every record without one belongs to: the launch host. */
export const DEFAULT_HOST = "claude-code";

/** A host name as a record keeps it: short, one lowercase token. */
export function isHostName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,47}$/.test(value);
}

/** The sentences a tool result or a notice says about the host it is read in. */
export interface HostWording {
  /**
   * How to load a newer build into this host's connection to the MCP server —
   * the whole sentence, ending a line that already said what changed
   * ("Counterparts was updated. <this>").
   */
  readonly reconnect: string;
  /**
   * The same step as the first of two, when doing it may not be enough
   * ("<this>; if that does not help, run `counterparts doctor`.").
   */
  readonly reconnectFirst: string;
}

/**
 * THE TABLE. One entry today; a host added later brings its own entry, and
 * `wordingFor` gives any host without one the default host's words.
 */
export const HOST_WORDING: Readonly<Record<string, HostWording>> = {
  [DEFAULT_HOST]: {
    reconnect: "Run /mcp and Reconnect to load it.",
    reconnectFirst: "Run /mcp and Reconnect",
  },
};

/** The words for `host`, or the default host's when it has none of its own. */
export function wordingFor(host: string = DEFAULT_HOST): HostWording {
  return HOST_WORDING[host] ?? (HOST_WORDING[DEFAULT_HOST] as HostWording);
}
