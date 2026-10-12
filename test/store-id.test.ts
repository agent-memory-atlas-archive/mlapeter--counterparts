/**
 * WHICH STORE A DASHBOARD SERVES (2026-10-12, `adapters/store-id.ts`): the id
 * is stable across opens, differs between two stores, never carries the path,
 * and the dashboard and the session-start wake say the same one.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Store } from "../src/core/store/index.js";
import { openAdapter } from "../src/adapters/claude-code/index.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import { router } from "../src/adapters/dashboard/web/server.js";
import { installedVersion } from "../src/adapters/sessions.js";
import { STORE_ID_RE, storeId, storeMarker } from "../src/adapters/store-id.js";

let root: string;
let a: string;
let b: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-store-id-")));
  a = join(root, "trial", "store");
  b = join(root, "real", "store");
  for (const dir of [a, b]) Store.open({ dir }).close();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function whoami(dir: string): { status: number; body: Record<string, unknown>; raw: string } {
  const dash = Dashboard.open({ dir });
  try {
    const reply = router(new URL("http://127.0.0.1:4747/api/whoami"), "127.0.0.1:4747", dash.source);
    return { status: reply.status, body: JSON.parse(reply.body) as Record<string, unknown>, raw: reply.body };
  } finally {
    dash.close();
  }
}

describe("the store id", () => {
  test("has its shape, and is stable across opens of the same store", () => {
    const first = whoami(a);
    expect(first.status).toBe(200);
    expect(String(first.body["store"])).toMatch(STORE_ID_RE);
    expect(whoami(a).body["store"]).toBe(first.body["store"]);
    expect(storeId(a)).toBe(String(first.body["store"]));
    // The same directory by another spelling (a trailing slash, a symlink) is the same store.
    expect(storeId(`${a}/`)).toBe(storeId(a));
    symlinkSync(join(root, "trial"), join(root, "link"));
    expect(storeId(join(root, "link", "store"))).toBe(storeId(a));
  });

  test("differs between two stores on one machine", () => {
    expect(whoami(a).body["store"]).not.toBe(whoami(b).body["store"]);
  });

  test("contains no path, and no part of one", () => {
    for (const dir of [a, b]) {
      const r = whoami(dir);
      expect(Object.keys(r.body).sort()).toEqual(["store", "version"]);
      for (const part of [dir, root, "trial", "real", "store/", "counterparts-store-id"]) expect(r.raw).not.toContain(part);
      expect(storeMarker(dir)).not.toContain(root);
    }
  });

  test("whoami's version is the package's", () => {
    expect(whoami(a).body["version"]).toBe(installedVersion());
  });

  test("a session-start wake names the same store on the line under the onboarding marker", () => {
    mkdirSync(join(root, "proj"), { recursive: true });
    const adapter = openAdapter(
      { dataDir: a, owner: true, injectionBudgetBytes: 9_000 },
      { command: "/bin/true", args: ["runner"], spawner: () => ({ pid: 4242 }), configPath: join(root, "trial", "claude-code.json") },
    );
    let injection = "";
    try {
      injection = adapter.sessionStart({ sessionId: "s-id", scope: join(root, "proj"), at: "2026-10-12" }).injection ?? "";
    } finally {
      adapter.counterpart.close();
    }
    const lines = injection.split("\n");
    const at = lines.findIndex((l) => l.startsWith("<!-- counterparts:onboarding"));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at + 1]).toBe(`<!-- counterparts:store id=${String(whoami(a).body["store"])} -->`);
    expect(injection).not.toContain(storeId(b));
  });
});
