/**
 * The memories tab refreshes live and closes nothing (2026-09-26, an experiment).
 *
 * In a real browser: choose the oldest-first order, the "all" filter and the
 * list's second page, pin a `?`, open a memory card, and scroll; then write a
 * memory into the store and force a refresh through the pulse's own hook
 * (`refreshCounters`). The list is redrawn — its count moves by one — and every
 * choice is still made, the card still open, the scroll where it was. A kind
 * chip chosen afterwards survives a refresh too.
 *
 * Hermetic: a fresh temp store seeded through `tools/demo`, the dashboard on a
 * port the OS picks. Needs playwright's chromium (`bunx playwright install
 * chromium`); without it the test is skipped and says so.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { startDashboard } from "../src/adapters/dashboard/web/server.js";
import type { RunningDashboard } from "../src/adapters/dashboard/web/server.js";
import { seedDemo } from "../tools/demo/seed.js";

type Browser = import("playwright").Browser;

let browser: Browser | null = null;
let why = "";
try {
  const pw = await import("playwright");
  browser = await pw.chromium.launch();
} catch (err) {
  why = err instanceof Error ? err.message.split("\n")[0] ?? String(err) : String(err);
}
if (browser === null) {
  console.log(`dashboard-memories-live: skipped — no chromium for playwright (${why})`);
}

let dir: string;
let running: RunningDashboard | null = null;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-memories-live-"));
  await seedDemo({ dir });
  if (browser !== null) running = await startDashboard({ dir, port: 0 });
});

afterAll(async () => {
  if (running !== null) await running.stop();
  if (browser !== null) await browser.close();
  rmSync(dir, { recursive: true, force: true });
});

function write(body: string, kind: "fact" | "person" = "fact"): void {
  const c = Counterpart.open({ dir, owner: true });
  try {
    c.store.put({ type: "memory", kind, body, source: "authored" });
  } finally {
    c.close();
  }
}

describe("the memories tab, live", () => {
  test.skipIf(browser === null)("a refresh through the pulse redraws the list and closes nothing", async () => {
    const b = browser as Browser;
    const url = (running as RunningDashboard).url;
    const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(5_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const sub = async (): Promise<string> => (await page.textContent("#mlist-sub")) ?? "";
    const total = async (): Promise<number> => Number(/of (\d+)/.exec(await sub())?.[1] ?? "-1");
    const refresh = (): Promise<void> => page.evaluate(async (path) => {
      const m = await import(path);
      await m.refreshCounters();
    }, "/shell/pulse.js");
    try {
      await page.goto(`${url}/#memories`);
      await page.waitForSelector("#mlist .mrow");
      expect(await page.locator(".q-wrap.open").count()).toBe(0);
      expect(await page.isHidden("#overlay.show")).toBe(true);

      // ── choose, page, pin, open, scroll ──
      await page.click('#msort button[data-sort="oldest"]');
      await page.waitForSelector('#msort button[data-sort="oldest"].on');
      await page.click('#mfilters button[data-f="state"][data-v="all"]');
      await page.waitForSelector('#mfilters button[data-f="state"][data-v="all"].on');
      await page.click('#mpager button[data-off="50"]');
      await page.waitForFunction(() => /page 2 of/.test(document.getElementById("mpager")?.textContent ?? ""));
      const firstOnPage2 = await page.locator("#mlist .mrow").first().getAttribute("data-id");
      await page.click('#mfilters .q-wrap[data-tip="kinds"] .q');
      expect(await page.locator('.q-wrap.open[data-tip="kinds"]').count()).toBe(1);
      await page.locator("#mlist .mrow").nth(3).click();
      await page.waitForSelector("#overlay.show .mc");
      const cardTitle = await page.textContent("#modal .mc-title");
      await page.waitForTimeout(600); // the pager's smooth scroll settles
      await page.evaluate(() => scrollTo(0, 900));
      const y = await page.evaluate(() => scrollY);
      expect(y).toBeGreaterThan(300);
      const before = await total();
      expect(before).toBeGreaterThan(100);

      // ── the store moves ──
      write("A memory written while the tab was open.");
      await refresh();
      await page.waitForFunction((n) => new RegExp("of " + (n + 1)).test(document.getElementById("mlist-sub")?.textContent ?? ""), before);

      // ...and nothing closed.
      expect(await page.locator('#msort button[data-sort="oldest"].on').count()).toBe(1);
      expect(await page.locator('#mfilters button[data-f="state"][data-v="all"].on').count()).toBe(1);
      expect(await page.textContent("#mpager")).toContain("page 2 of");
      expect(await page.locator("#mlist .mrow").first().getAttribute("data-id")).toBe(firstOnPage2);
      expect(await page.locator('.q-wrap.open[data-tip="kinds"]').count()).toBe(1);
      expect(await page.isVisible("#overlay.show .mc")).toBe(true);
      expect(await page.textContent("#modal .mc-title")).toBe(cardTitle);
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(2);

      // A full redraw (the tab's own render) keeps them too.
      await page.evaluate(async (path) => {
        const m = await import(path);
        await m.default.render();
      }, "/pages/memories/index.js");
      expect(await page.textContent("#mpager")).toContain("page 2 of");
      expect(await page.locator('.q-wrap.open[data-tip="kinds"]').count()).toBe(1);
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(2);

      // A kind chip chosen now survives the next refresh.
      await page.keyboard.press("Escape");
      await page.click('#mfilters button[data-f="kind"][data-v="person"]');
      await page.waitForSelector('#mfilters button[data-f="kind"][data-v="person"].on');
      const persons = await total();
      write("Someone new, met while the tab was open.", "person");
      await refresh();
      await page.waitForFunction((n) => new RegExp("of " + (n + 1)).test(document.getElementById("mlist-sub")?.textContent ?? ""), persons);
      expect(await page.locator('#mfilters button[data-f="kind"][data-v="person"].on').count()).toBe(1);
      expect(await page.locator('#msort button[data-sort="oldest"].on').count()).toBe(1);

      // A part of "How firmly it's held", clicked, filters the list — and survives too.
      await page.click('#hold .hkey.firm');
      await page.waitForSelector('#mfilters button[data-f="hold"][data-v="firm"].on');
      write("One more fact, written while the firm filter was on.");
      await refresh();
      expect(await page.locator("#hold .hkey.firm.on").count()).toBe(1);
      expect(await page.locator('#mfilters button[data-f="hold"][data-v="firm"].on').count()).toBe(1);
      expect(await page.locator('#mfilters button[data-f="kind"][data-v="person"].on').count()).toBe(1);
      // The page asked the server for the firm rows, and shows what it answered.
      const shown = await page.evaluate(async () => {
        const r = await fetch("/api/memories/list?state=all&kind=person&hold=firm&sort=oldest");
        return ((await r.json()) as { total: number }).total;
      });
      expect(await total()).toBe(shown);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }, 60_000);
});
