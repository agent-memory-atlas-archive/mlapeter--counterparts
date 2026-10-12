/**
 * The class-body parts of the 2026-10-11 file split are imported by their own
 * class's file and by nothing else.
 *
 * `Counterpart`, `McpServer` and `Store` each keep a one-line delegate for a
 * method whose body moved into a sibling part, as a free function taking the
 * instance. Those functions are exported so the class can import them — which
 * also makes a PRIVATE method's body (`Counterpart`'s deposit, say) callable
 * by anyone who imports the part, past whatever the class's public doors check
 * first. This pin keeps that a structural fact rather than a convention: a
 * second importer is a decision, not an import. A type-only import is not a
 * reach.
 *
 * Reads source text only; no store is opened.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dir, "..", "src");

/** Each class-body part, and the one file allowed to import it — or, for the
 *  wake's parts (2026-10-12, moves only), the files. */
const PARTS: Record<string, string | readonly string[]> = {
  "core/counterpart-boundary.ts": "core/counterpart.ts",
  "core/counterpart-sweep.ts": "core/counterpart.ts",
  "core/counterpart-deposit.ts": "core/counterpart.ts",
  "adapters/mcp/server-session-end.ts": "adapters/mcp/server.ts",
  "adapters/mcp/server-self-tools.ts": "adapters/mcp/server.ts",
  "core/store/reads-memories.ts": "core/store/index.ts",
  "core/store/reads-marks.ts": "core/store/index.ts",
  "core/store/reads-history.ts": "core/store/index.ts",
  // The wake composer's parts: `briefing.ts` re-exports their public names,
  // so nothing else needs to reach in — the room machinery's exports are
  // `render`'s internals.
  "core/self/briefing-room.ts": "core/self/briefing.ts",
  "core/self/briefing-page.ts": "core/self/briefing.ts",
  "core/self/briefing-delivery.ts": ["core/self/briefing-page.ts", "core/self/briefing.ts"],
};

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** The modules a file imports or re-exports as VALUES (type-only imports skipped), and any dynamic `import()`. */
function valueImports(text: string): string[] {
  const out: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?(?:[\w$]+\s*,\s*)?(?:\*\s+as\s+[\w$]+|\*|\{[^}]*\}|[\w$]+)\s+from\s+["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) if (m[2] === undefined) out.push(m[3] as string);
  for (const m of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) out.push(m[1] as string);
  return out;
}

describe("the class-body parts of the file split", () => {
  test("each is imported by its class's file only", () => {
    const importers = new Map<string, string[]>();
    for (const file of tsFiles(SRC)) {
      const here = relative(SRC, file);
      for (const spec of valueImports(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".")) continue;
        const target = relative(SRC, join(file, "..", spec.replace(/\.js$/, ".ts")));
        if (!(target in PARTS)) continue;
        if (!importers.has(target)) importers.set(target, []);
        importers.get(target)!.push(here);
      }
    }
    for (const [part, owner] of Object.entries(PARTS)) {
      // NOT VACUOUS: the class really does import its part.
      const owners = typeof owner === "string" ? [owner] : [...owner];
      expect({ part, importers: [...new Set(importers.get(part) ?? [])].sort() }).toEqual({ part, importers: owners.sort() });
    }
  });
});
