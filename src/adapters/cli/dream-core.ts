/**
 * `dream` and `core` — the owner's two windows onto the dreaming +
 * consolidation mechanism (2026-09-26), rendered as plain lines.
 *
 * The console decides nothing here. What a dream did, how to undo it, what the
 * core holds and how a memory leaves it are the core's (`core/dream/`,
 * `Counterpart.coreList` / `demoteCore`); this file only turns their answers
 * into lines a person reads. Pure over its inputs, like `self-page.ts`, so the
 * tests can check the words without a store.
 */
import type { Counterpart } from "../../core/counterpart.js";

/** How a memory id reads in a list: its first line, or why it is not shown. */
export function memoryWords(counterpart: Counterpart, id: string | null, max = 80): string {
  if (id === null) return "(removed by the owner)";
  const row = counterpart.store.row(id);
  if (row === undefined) return "(no such memory)";
  if (row.confidential === 1) return "[confidential]";
  if (row.body === "") return "(removed by the owner)";
  const line = ((row.title ?? "").trim() || (row.body.split("\n").find((l) => l.trim().length > 0) ?? "")).replace(/\s+/g, " ").trim();
  const said = line.length > max ? `${line.slice(0, max - 1)}…` : line;
  return row.archived === 1 ? `${said} (archived: ${row.archived_reason ?? "archived"})` : said;
}

function countsLine(counts: Readonly<Record<string, number>>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${String(n)} ${k}`);
  return parts.length === 0 ? "no changes" : parts.join(", ");
}

/** `counterparts dream --list`: newest first, one line each. */
export function dreamListLines(counterpart: Counterpart, limit = 20): string[] {
  const dreams = counterpart.dreams.list(limit);
  if (dreams.length === 0) {
    return [
      "No dreams yet.",
      "A session is asked, at most once a day, whether it may dream; the owner says yes or not today.",
    ];
  }
  const out = [`Dreams — newest first (${String(dreams.length)} shown)`, ""];
  for (const { dream, counts } of dreams) {
    const when = dream.date ?? `lived day ${String(dream.day)}`;
    const title = dream.title === null || dream.title.length === 0 ? "(no journal)" : `"${dream.title}"`;
    out.push(`${dream.id}  ${when}  ${dream.state.padEnd(9)} ${title} — ${countsLine(counts)}`);
  }
  out.push("", "Read one: counterparts dream --show <id>    Reverse one: counterparts dream --undo <id>");
  return out;
}

/** `counterparts dream --show <id>`: the journal, then every change, undone ones marked. */
export function dreamShowLines(counterpart: Counterpart, id: string): string[] | null {
  const shown = counterpart.dreams.show(id);
  if (shown === null) return null;
  const { dream, changes } = shown;
  const out = [
    `Dream ${dream.id} — ${dream.date ?? `lived day ${String(dream.day)}`}, ${dream.state}`,
    ...(dream.session === null ? [] : [`  for session ${dream.session}`]),
    "",
    dream.title === null ? "Journal: (not written)" : `Journal: "${dream.title}"`,
  ];
  if (dream.journal !== null && dream.journal.length > 0) {
    for (const line of dream.journal.split("\n")) out.push(`  ${line}`);
  }
  out.push("", changes.length === 0 ? "Changes: none." : `Changes (${String(changes.length)}):`);
  for (const c of changes) {
    const mark = c.undone === 1 ? "  [undone] " : "  ";
    const a = c.ref === null ? null : c.ref;
    const b = c.ref2;
    const words = (x: string | null): string => (x === null ? "(removed by the owner)" : `${x} "${memoryWords(counterpart, x)}"`);
    switch (c.action) {
      case "link":
      case "contradiction":
        out.push(`${mark}${c.action}: ${words(a)}  ↔  ${words(b)}`);
        break;
      case "merge": {
        let from: string[] = [];
        try {
          const d = JSON.parse(c.detail) as { from?: unknown };
          if (Array.isArray(d.from)) from = d.from.filter((x): x is string => typeof x === "string");
        } catch {
          from = [];
        }
        out.push(`${mark}merge into ${words(a)}`);
        for (const f of from) out.push(`${mark}  from ${words(f)}`);
        break;
      }
      default:
        out.push(`${mark}${c.action}: ${words(a)}`);
    }
  }
  if (dream.state !== "undone") out.push("", `Reverse all of it: counterparts dream --undo ${dream.id}`);
  return out;
}

/** `counterparts core --list`: the core with lanes, then nominations and demotions. */
export function coreListLines(counterpart: Counterpart): string[] {
  const { core, nominated, demoted } = counterpart.coreList();
  const out = [
    core.length === 0
      ? "The core is empty: nothing has become part of who I am yet."
      : `The core — ${String(core.length)} ${core.length === 1 ? "memory" : "memories"} that do not fade`,
  ];
  for (const m of core) {
    const how = m.lane === null ? "(before lanes, or by revision)" : `${m.lane} lane${m.day === null ? "" : `, lived day ${String(m.day)}`}`;
    const said = m.confidential ? "[confidential]" : (m.body ?? "(unreadable)");
    out.push(`  ${m.id}  ${m.kind.padEnd(6)} ${how} — ${said}`);
  }
  out.push(
    "",
    "Only a memory about me or about us becomes core: strongly felt and back after a gap (fast lane),",
    "or back on several separate days over weeks (slow lane). At most a few a night.",
  );
  if (nominated.length > 0) {
    out.push("", "Nominated by a dream (a lane still has to promote it):");
    for (const n of nominated.slice(0, 20)) {
      out.push(`  ${n.id}  lived day ${String(n.day)}${n.reason === null ? "" : ` — ${n.reason}`}${n.dream === null ? "" : ` (${n.dream})`}`);
    }
  }
  if (demoted.length > 0) {
    out.push("", "Sent back to ordinary fading by you:");
    for (const d of demoted.slice(0, 20)) out.push(`  ${d.id}  lived day ${String(d.day)}${d.reason === null ? "" : ` — ${d.reason}`}`);
  }
  if (core.length > 0) out.push("", 'Send one back: counterparts core --demote <id> --reason "..."');
  return out;
}
