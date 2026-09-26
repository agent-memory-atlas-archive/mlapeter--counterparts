/**
 * The self tab refreshes live and closes nothing (2026-09-26, an experiment).
 *
 * In a real browser: open a `?`, a version's what-changed view, the wake's
 * text, an older journal day and one of its chapters, and a count's list;
 * scroll; then change the store (a new page version, a new chapter, a fresh
 * wake) and force a refresh through the pulse's own hook (`refreshCounters`).
 * Every panel is redrawn — the new version's dot appears — and every open
 * thing is still open, with the scroll where it was.
 *
 * Hermetic: a fresh temp store, the dashboard on a port the OS picks. Needs
 * playwright's chromium (`bunx playwright install chromium`); on a machine
 * without it the test is skipped and says so, rather than failing the suite.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { startDashboard } from "../src/adapters/dashboard/web/server.js";
import type { RunningDashboard } from "../src/adapters/dashboard/web/server.js";

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
  console.log(`dashboard-self-live: skipped — no chromium for playwright (${why})`);
}

const PAGE_1 = "## Core\n\nStill forming.\n\n## Lately\n\n- Getting started.\n";
const PAGE_2 = "## Core\n\nI keep things plain.\n\n- Small steps.\n\n## Lately\n\n- Getting started.\n";
const PAGE_3 = "## Core\n\nI keep things plain, and I say what I don't know.\n\n- Small steps.\n\n## Lately\n\n- The self tab.\n";
const PAGE_4 = "## Core\n\nI keep things plain, and I say what I don't know.\n\n- Small steps.\n\n## Lately\n\n- The self tab, live.\n";

let dir: string;
let running: RunningDashboard | null = null;
const base = Date.parse("2026-09-21T15:00:00Z");
let offset = 0;
const now = (): number => base + offset;

function openAt(date: string): Counterpart {
  offset = Date.parse(`${date}T15:00:00Z`) - base;
  return Counterpart.open({ dir, owner: true, budgetBytes: 9000, now });
}

async function liveDay(c: Counterpart, i: number, date: string, page: string): Promise<void> {
  c.store.advanceClock(date);
  const d = c.store.livedDay();
  c.wake(9000);
  if (i === 0) {
    await c.submitSessionEnd(
      { content: "Mike prefers decisions recorded as what is true for now.", kind: "person", salience: { relevance: 0.9, emotional: 0.5, predictive: 0.8 } },
      { session: `s${i}`, scope: "x" },
    );
  }
  c.episodeAsk(`s${i}`, { turns: 10, bytes: 6200 }, d);
  c.appendEpisode(`s${i}`, `Day ${i + 1} went quietly.\n\nMore after the first line, on day ${i + 1}.`, {
    day: d,
    title: `Day ${i + 1}`,
    happenedOn: date,
    model: "claude-opus-5-5",
  });
  c.revisePage(page, { reason: `write ${i + 1}`, by: i === 1 ? "owner" : "session", day: d });
  await c.sessionEnd({ date, at: date, budgetBytes: 9000 });
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-self-live-"));
  Counterpart.open({ dir, owner: true, budgetBytes: 9000, identity: { name: "Mike" }, now }).close();
  const c = openAt("2026-09-21");
  try {
    const dates = ["2026-09-21", "2026-09-22", "2026-09-23"];
    for (const [i, date] of dates.entries()) {
      offset = Date.parse(`${date}T15:00:00Z`) - base;
      await liveDay(c, i, date, [PAGE_1, PAGE_2, PAGE_3][i] as string);
    }
    c.rebrief({ budgetBytes: 9000 });
  } finally {
    c.close();
  }
  if (browser !== null) running = await startDashboard({ dir, port: 0 });
});

afterAll(async () => {
  if (running !== null) await running.stop();
  if (browser !== null) await browser.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the self tab, live", () => {
  test.skipIf(browser === null)("a refresh through the pulse redraws the panels and closes nothing", async () => {
    const b = browser as Browser;
    const url = (running as RunningDashboard).url;
    const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } });
    const page = await ctx.newPage();
    // A step that cannot happen fails fast and names itself, rather than
    // spending the whole test's budget waiting.
    page.setDefaultTimeout(5_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    try {
      await page.goto(`${url}/#self`);
      await page.waitForSelector("#self-page .md");
      await page.waitForSelector("#self-journal .jd-day");

      // Nothing is open to begin with: no version, no tip, no chapter.
      expect(await page.isHidden("#self-version")).toBe(true);
      expect(await page.locator(".q-wrap.open").count()).toBe(0);
      expect(await page.locator(".jc.open").count()).toBe(0);
      const dotsBefore = await page.locator(".tl-step").count();
      expect(dotsBefore).toBe(3);

      // ── open things ──
      await page.click('#self-history .q-wrap[data-tip="history"] .q');
      const firstSeq = await page.locator(".tl-step").first().getAttribute("data-seq");
      await page.locator(".tl-step").first().click();
      await page.waitForSelector("#self-version .tl-detail");
      await page.click("#wake-toggle");
      const olderDay = await page.locator(".jd-day").nth(1).getAttribute("data-day");
      await page.locator(".jd-day").nth(1).click();
      await page.locator(".jc-top").first().click();
      await page.waitForSelector(".jc.open .jc-body");
      const count = page.locator(".st-count:not([disabled])").first();
      const countKey = await count.getAttribute("data-count");
      await count.click();
      await page.waitForSelector(".st-list");
      await page.evaluate(() => scrollTo(0, 420));
      const y = await page.evaluate(() => scrollY);
      expect(y).toBeGreaterThan(100);

      // ── the store moves: a new version, a new day's chapter, a fresh wake ──
      const c = openAt("2026-09-24");
      try {
        await liveDay(c, 3, "2026-09-24", PAGE_4);
        c.rebrief({ budgetBytes: 9000 });
      } finally {
        c.close();
      }

      // ── the pulse's own hook ──
      // (The module paths are the PAGE's, handed in as values so tsc does not
      // try to resolve them against this repo.)
      await page.evaluate(async (path) => {
        const m = await import(path);
        await m.refreshCounters();
      }, "/shell/pulse.js");

      // Redrawn: the new version's dot is there, and the newest day in the strip.
      await page.waitForFunction(() => document.querySelectorAll(".tl-step").length === 4);
      expect(await page.locator(".jd-day").count()).toBe(4);

      // ...and nothing closed.
      expect(await page.locator('.q-wrap.open[data-tip="history"]').count()).toBe(1);
      expect(await page.locator(".tl-step.on").getAttribute("data-seq")).toBe(firstSeq);
      expect(await page.isVisible("#self-version .tl-detail")).toBe(true);
      expect(await page.isVisible("#wake-full")).toBe(true);
      expect(await page.locator(".jd-day.on").getAttribute("data-day")).toBe(olderDay);
      expect(await page.locator(".jc.open .jc-body").count()).toBe(1);
      expect(await page.locator(`.st-count.on[data-count="${countKey}"]`).count()).toBe(1);
      expect(await page.isVisible(".st-list")).toBe(true);
      const after = await page.evaluate(() => scrollY);
      expect(Math.abs(after - y)).toBeLessThanOrEqual(2);

      // A full redraw of every panel (the tab's own render) keeps them too, so
      // the panels whose data did not move are covered as well.
      await page.evaluate(async (path) => {
        const m = await import(path);
        await m.default.render();
      }, "/pages/self/index.js");
      expect(await page.locator('.q-wrap.open[data-tip="history"]').count()).toBe(1);
      expect(await page.locator(".tl-step.on").getAttribute("data-seq")).toBe(firstSeq);
      expect(await page.isVisible("#wake-full")).toBe(true);
      expect(await page.locator(".jd-day.on").getAttribute("data-day")).toBe(olderDay);
      expect(await page.locator(".jc.open .jc-body").count()).toBe(1);
      expect(await page.locator(`.st-count.on[data-count="${countKey}"]`).count()).toBe(1);
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }, 30_000);
});
