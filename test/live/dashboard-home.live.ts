/**
 * The home tab refreshes live and closes nothing (2026-09-26, an experiment).
 *
 * In a real browser: pin two `?`s (a tile's and the lights' legend), pick a
 * mechanism pill, and scroll; then write a memory and two event rows — one a
 * memory event, one housekeeping — and run the pulse's own poll. The memories
 * tile moves by one, the live feed takes the memory event and leaves the
 * housekeeping line to the flow tab, and every choice is still made: the tips
 * pinned, the pill picked, the scroll where it was.
 *
 * A SCENARIO, not a suite file: `test/dashboard-home-live.test.ts` runs it in a
 * child `bun test`, so the suite's process never loads playwright (see
 * `test/live/harness.ts` for why). Run it alone with
 * `bun test ./test/live/dashboard-home.live.ts`.
 *
 * Hermetic: a fresh temp store seeded through `tools/demo`, the dashboard on a
 * port the OS picks.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../../src/core/counterpart.js";
import { startDashboard } from "../../src/adapters/dashboard/web/server.js";
import type { RunningDashboard } from "../../src/adapters/dashboard/web/server.js";
import { seedDemo } from "../../tools/demo/seed.js";

import { chromium } from "playwright";
import type { Browser } from "playwright";

let browser: Browser | null = null;
let dir: string;
let running: RunningDashboard | null = null;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-home-live-"));
  await seedDemo({ dir });
  browser = await chromium.launch();
  running = await startDashboard({ dir, port: 0 });
});

afterAll(async () => {
  if (running !== null) await running.stop();
  if (browser !== null) await browser.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A memory, a memory event and a housekeeping row, written while the page is open. */
function storeMoves(): void {
  const c = Counterpart.open({ dir, owner: true });
  try {
    c.store.put({ type: "memory", kind: "fact", body: "A memory written while the home tab was open." });
    const day = c.store.livedDay();
    c.store.appendEvent({ name: "gate.deposit", day, payload: { accepted: 1 } });
    c.store.appendEvent({ name: "adapter.semantic.lag", day, payload: { reason: "ok", hits: 3 } });
  } finally {
    c.close();
  }
}

describe("the home tab, live", () => {
  test("a poll after the store moves redraws the counts, feeds only memory events, and closes nothing", async () => {
    const b = browser as Browser;
    const url = (running as RunningDashboard).url;
    const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(5_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const tile = (label: string): Promise<string> => page.evaluate((l) => (window as unknown as { tileValue(x: string): string }).tileValue(l), label);
    try {
      await page.goto(`${url}/#home`);
      await page.waitForSelector("#home-brain[data-ready]");
      await page.waitForSelector("#ov-tiles .ht");
      await page.waitForSelector("#ov-feed .ev");
      await page.waitForSelector("#mech-strip .mech-pill");
      expect(await page.locator(".q-wrap.open").count()).toBe(0);

      // The headline and the four tiles.
      const headline = (await page.textContent("#home-headline")) ?? "";
      expect(headline).toMatch(/^Day \d+ · \d+ memories · \d+ of 12 built · \d+ active this week$/);
      expect(await page.locator("#ov-tiles .ht .l").allTextContents()).toEqual(["memories", "core", "chapters", "replaced"]);
      const before = Number(await tile("memories"));
      expect(before).toBeGreaterThan(100);
      expect(headline).toContain(`${before} memories`);

      // The pills: built has no tag, partly built says so, not built is grey.
      expect(await page.locator("#mech-strip .mech-tag").allTextContents()).toContain("partly built");
      expect(await page.locator('#mech-strip .mech-pill[data-id="salience"] .mech-tag').count()).toBe(0);
      expect(await page.locator('#mech-strip .mech-pill[data-id="interference"] .light-grey').count()).toBe(1);
      expect(await page.locator("#mech-strip .mech-tag", { hasText: "in dev" }).count()).toBe(0);

      // The home feed holds memory events only: every line carries an icon.
      const lines = await page.locator("#ov-feed .ev").count();
      expect(await page.locator("#ov-feed .ev.has-i").count()).toBe(lines);

      // ── pin, pick, scroll ──
      await page.click('#ov-tiles .q-wrap[data-tip="home-tile-core"] .q');
      await page.click('#mech-panel .q-wrap[data-tip="home-lights"] .q');
      expect(await page.locator(".q-wrap.open").count()).toBe(2);
      await page.click('#mech-strip .mech-pill[data-id="consolidation"]');
      await page.waitForSelector('#mech-strip .mech-pill[data-id="consolidation"].is-on');
      const title = await page.textContent("#mech-title");
      await page.evaluate(() => scrollTo(0, 600));
      const y = await page.evaluate(() => scrollY);
      expect(y).toBeGreaterThan(300);
      const topSeq = await page.locator("#ov-feed .ev").first().getAttribute("data-seq");

      // ── the store moves; the pulse polls ──
      storeMoves();
      await page.evaluate(async (path) => {
        const m = await import(path);
        await m.poll();
      }, "/shell/pulse.js");
      await page.waitForFunction((n) => (window as unknown as { tileValue(x: string): string }).tileValue("memories") === String(n + 1), before);

      // The memory event landed on top; the housekeeping line did not.
      const first = page.locator("#ov-feed .ev").first();
      expect(await first.getAttribute("data-seq")).not.toBe(topSeq);
      expect(await first.locator(".k").textContent()).toContain("gate.deposit");
      expect(await page.locator("#ov-feed .ev", { hasText: "semantic cue" }).count()).toBe(0);

      // ...and nothing closed.
      expect(await page.locator('.q-wrap.open[data-tip="home-tile-core"]').count()).toBe(1);
      expect(await page.locator('.q-wrap.open[data-tip="home-lights"]').count()).toBe(1);
      expect(await page.locator('#mech-strip .mech-pill[data-id="consolidation"].is-on').count()).toBe(1);
      expect(await page.textContent("#mech-title")).toBe(title);
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(2);
      expect(await page.textContent("#home-headline")).toContain(`${before + 1} memories`);

      // A full redraw (the tab's own render) keeps them too.
      await page.evaluate(async (path) => {
        const m = await import(path);
        await m.default.render();
      }, "/pages/home/index.js");
      expect(await page.locator('.q-wrap.open[data-tip="home-tile-core"]').count()).toBe(1);
      expect(await page.locator('#mech-strip .mech-pill[data-id="consolidation"].is-on').count()).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }, 60_000);
});
