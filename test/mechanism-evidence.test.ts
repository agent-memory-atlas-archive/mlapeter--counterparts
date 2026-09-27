/**
 * `mechanism-evidence.ts` — the one "did it fire" judgement the dashboard's
 * lights and `counterparts mechanisms` both call (2026-09-26, an experiment).
 *
 * What it keeps: the two surfaces agree, mechanism by mechanism, on a seeded
 * store; a scheduled phase that ran on time reads as waiting on both, never as
 * quiet; built / partly / not is one table.
 *
 * Hermetic: every store is a temp dir this file creates and removes.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Counterpart } from "../src/core/counterpart.js";
import { markerKey } from "../src/core/sleep/index.js";
import { Store } from "../src/core/store/index.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import { mechanismsView } from "../src/adapters/dashboard/web/views/mechanisms.js";
import { MEMORY_MECHANISMS, consoleVerdicts, readMechanism } from "../src/adapters/cli/mechanisms.js";
import { firedReport } from "../src/adapters/fired.js";
import { MECHANISM_EVIDENCE, builtCount } from "../src/adapters/mechanism-evidence.js";
import { seedDemo } from "../tools/demo/seed.js";

const temps: string[] = [];
const tempDir = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
};
let richDir: string;

beforeAll(async () => {
  richDir = tempDir("counterparts-evidence-rich-");
  await seedDemo({ dir: richDir });
});

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** The dashboard's status, in the console's three lights. */
const AS_CONSOLE: Record<string, string> = { green: "●", waiting: "◐", amber: "◐", grey: "○" };

/** Both surfaces, one store: id → [dashboard light, console light]. */
function bothLights(dir: string, today: string): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  const dash = Dashboard.open({ dir });
  try {
    for (const m of mechanismsView(dash.source).mechanisms) out.set(m.id, [AS_CONSOLE[m.status] ?? "?", ""]);
  } finally {
    dash.close();
  }
  const s = Store.open({ dir, observer: true });
  try {
    const report = firedReport(s, today);
    const byId = new Map(report.rows.map((r) => [r.id, r]));
    const verdicts = consoleVerdicts(s, today);
    for (const m of MEMORY_MECHANISMS) {
      const pair = out.get(m.id);
      if (pair !== undefined) pair[1] = readMechanism(m, verdicts, (id) => byId.get(id)).light;
    }
  } finally {
    s.close();
  }
  return out;
}

describe("one judgement, two surfaces", () => {
  test("every console line names a mechanism of the shared table, once", () => {
    expect(MEMORY_MECHANISMS.map((m) => m.id).sort()).toEqual(MECHANISM_EVIDENCE.map((m) => m.id).sort());
  });

  test("the dashboard and the console agree on every light, on the demo store", () => {
    // The demo store's calendar ends on its last active date, so the console's
    // calendar week is anchored there; the two windows then cover the same rows.
    const s = Store.open({ dir: richDir, observer: true });
    const today = s.getMeta("lastActiveDate") ?? "";
    s.close();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const lights = bothLights(richDir, today);
    expect(lights.size).toBe(12);
    for (const [id, [dash, cli]] of lights) expect(`${id}: ${cli}`).toBe(`${id}: ${dash}`);
    // And the store has something of each light to agree on.
    const seen = new Set([...lights.values()].map(([d]) => d));
    expect(seen).toEqual(new Set(["●", "◐", "○"]));
  });

  test("consolidation, not due: its phase ran on time, so both say waiting with the next run", () => {
    const dir = tempDir("counterparts-evidence-sched-");
    const TODAY = "2026-01-12";
    const c = Counterpart.open({ dir, owner: true });
    let day = 0;
    try {
      for (let i = 1; i <= 12; i++) c.store.advanceClock(`2026-01-${String(i).padStart(2, "0")}`);
      day = c.store.livedDay();
      // The consolidate phase last completed yesterday; it runs every 3 lived days.
      c.store.setMeta(markerKey("consolidate"), String(day - 1));
    } finally {
      c.close();
    }
    const dash = Dashboard.open({ dir });
    try {
      const m = mechanismsView(dash.source).mechanisms.find((x) => x.id === "consolidation")!;
      expect(m.status).toBe("waiting");
      expect(m.nextInDays).toBe(2);
      expect(m.evidence).toContain(`lived day ${day - 1}`);
      expect(m.evidence).toContain("next run in 2 lived days");
    } finally {
      dash.close();
    }
    const s = Store.open({ dir, observer: true });
    try {
      const report = firedReport(s, TODAY);
      const byId = new Map(report.rows.map((r) => [r.id, r]));
      const cons = MEMORY_MECHANISMS.find((m) => m.id === "consolidation")!;
      const line = readMechanism(cons, consoleVerdicts(s, TODAY), (id) => byId.get(id));
      expect(line.light).toBe("◐");
      expect(line.says).toContain("next run in 2 lived days");
    } finally {
      s.close();
    }
  });

  test("a phase far behind its schedule is quiet (amber), not waiting", () => {
    const dir = tempDir("counterparts-evidence-late-");
    const c = Counterpart.open({ dir, owner: true });
    try {
      for (let i = 1; i <= 12; i++) c.store.advanceClock(`2026-01-${String(i).padStart(2, "0")}`);
      c.store.setMeta(markerKey("consolidate"), String(c.store.livedDay() - 6));
    } finally {
      c.close();
    }
    const dash = Dashboard.open({ dir });
    try {
      expect(mechanismsView(dash.source).mechanisms.find((x) => x.id === "consolidation")?.status).toBe("amber");
    } finally {
      dash.close();
    }
  });
});

describe("built / partly / not", () => {
  test("one table; a mechanism not built claims no proof, a built one names some", () => {
    for (const m of MECHANISM_EVIDENCE) {
      expect(["built", "partly", "not"]).toContain(m.build);
      if (m.build === "not") expect(m.proofs.length).toBe(0);
      else expect(m.proofs.length).toBeGreaterThan(0);
    }
    expect(builtCount()).toBe(MECHANISM_EVIDENCE.filter((m) => m.build !== "not").length);
  });

  test("the client modules carry no tag of their own: the pills read `build` from the view", async () => {
    const path = fileURLToPath(new URL("../src/adapters/dashboard/web/mechanisms/index.js", import.meta.url));
    const index = (await import(path)) as { MECHANISMS: Record<string, unknown>[] };
    for (const m of index.MECHANISMS) expect(`${String(m["id"])}: ${"inDev" in m}`).toBe(`${String(m["id"])}: false`);
  });
});
