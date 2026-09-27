/**
 * The self tab (`/api/mind` + `pages/self/`): the page's history as a timeline,
 * what is settling into the core and what is closest (physics' own promotion
 * rule), the wake cut into parts, the journal by day with its model, and the
 * page-side diff and markdown. Hermetic: every store is a fresh temp dir.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { TUNABLES, promotionEligibility } from "../src/core/physics/index.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import type { DashboardSource } from "../src/adapters/dashboard/index.js";
import { router } from "../src/adapters/dashboard/web/server.js";
import { mindView } from "../src/adapters/dashboard/web/views.js";
import { wakeParts, writerReason, writerWords } from "../src/adapters/dashboard/web/views/mind.js";
import { SELF_TUNABLES } from "../src/core/self/index.js";
// @ts-expect-error — a plain browser module, no declarations
import { PLAIN } from "../src/adapters/dashboard/web/pages/health/sections/checks.js";
// @ts-expect-error — a plain browser module, no declarations
import { diffStats, diffText, diffTokens } from "../src/adapters/dashboard/web/pages/self/diff.js";

const PAGE_1 = "## Core\n\nStill forming.\n\n## Lately\n\n- Getting started.\n";
const PAGE_2 = "## Core\n\nI keep things plain.\n\n- Small steps.\n\n## Lately\n\n- Getting started.\n";
const PAGE_3 = "## Core\n\nI keep things plain, and I say what I don't know.\n\n- Small steps.\n\n## Lately\n\n- The self tab.\n";

let dir: string;
let emptyDir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-self-tab-"));
  emptyDir = mkdtempSync(join(tmpdir(), "counterparts-self-tab-empty-"));
  const base = Date.parse("2026-09-21T15:00:00Z");
  let offset = 0;
  const now = (): number => base + offset;
  Counterpart.open({ dir, owner: true, budgetBytes: 9000, identity: { name: "Mike" }, now }).close();
  const c = Counterpart.open({ dir, owner: true, budgetBytes: 9000, now });
  const ids: string[] = [];
  try {
    const dates = ["2026-09-21", "2026-09-22", "2026-09-23"];
    for (const [i, date] of dates.entries()) {
      offset = Date.parse(`${date}T15:00:00Z`) - base;
      c.store.advanceClock(date);
      const d = c.store.livedDay();
      c.wake(9000);
      if (i === 0) {
        for (const content of [
          "Mike wants the dashboard to be his main command center.",
          "Mike prefers decisions recorded as what is true for now.",
          "The site deploys when main is pushed.",
        ]) {
          const r = await c.submitSessionEnd(
            { content, kind: content.startsWith("Mike") ? "person" : "place", salience: { relevance: 0.9, emotional: 0.5, predictive: 0.8 } },
            { session: `s${i}`, scope: "x" },
          );
          if (r.deposited && r.memoryId) ids.push(r.memoryId);
        }
      } else {
        c.resolveUses(`s${i}`, [{ memoryId: ids[0] as string, tier: "referenced" as const }]);
      }
      c.episodeAsk(`s${i}`, { turns: 10, bytes: 6200 }, d);
      c.appendEpisode(`s${i}`, `Day ${i + 1} went quietly.\n\nMore after the first line.`, {
        day: d,
        title: `Day ${i + 1}`,
        happenedOn: date,
        ...(i === 0 ? {} : { model: "claude-opus-5-5" }),
      });
      c.revisePage([PAGE_1, PAGE_2, PAGE_3][i] as string, { reason: `write ${i + 1}`, by: i === 1 ? "owner" : "session", day: d });
      await c.sessionEnd({ date, at: date, budgetBytes: 9000 });
    }
    c.rebrief({ budgetBytes: 9000 });
  } finally {
    c.close();
  }
  Counterpart.open({ dir: emptyDir, owner: true }).close();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(emptyDir, { recursive: true, force: true });
});

function withSource<T>(at: string, fn: (src: DashboardSource) => T): T {
  const dash = Dashboard.open({ dir: at });
  try {
    return fn(dash.source);
  } finally {
    dash.close();
  }
}

describe("the self tab's view", () => {
  test("the page's history runs oldest first and ends with the standing page", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.pageHistory.map((s) => s.body)).toEqual([PAGE_1.trim(), PAGE_2.trim(), PAGE_3.trim()]);
    expect(v.pageHistory.map((s) => s.current)).toEqual([false, false, true]);
    expect(v.pageHistory.map((s) => s.by)).toEqual(["session", "owner", "session"]);
    expect(v.pageHistory.map((s) => s.reason)).toEqual(["write 1", "write 2", "write 3"]);
    for (const s of v.pageHistory) expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("candidates are exactly what physics' promotion rule says, never a restatement", () => {
    withSource(dir, (src) => {
      const v = mindView(src);
      // The candidates are memories about the owner (person memories naming
      // Mike), measured by the core lanes (2026-09-26).
      expect(v.settling.candidates.length).toBeGreaterThan(0);
      for (const c of v.settling.candidates) {
        const verdict = promotionEligibility(src.store.physicsOf(c.id), { aboutMe: true });
        expect(c.feeling).toBe(verdict.fast.intensity);
        expect(c.days).toBe(verdict.slow.days);
        expect(c.span).toBe(verdict.slow.span);
        expect(c.lane).toBe(verdict.lane);
        expect(c.eligible).toBe(verdict.eligible);
        expect(c.needFeeling).toBe(TUNABLES.CORE_FAST_FEELING);
        expect(c.requiredDays).toBe(TUNABLES.CORE_SLOW_DAYS);
        expect(c.needSpan).toBe(TUNABLES.CORE_SLOW_SPAN_DAYS);
        expect(verdict.blockedBy).not.toContain("already-identity");
      }
      // A place is not about me or about us: the core is not for it, and it is
      // counted apart, not listed.
      expect(v.settling.outOfReach).toBeGreaterThan(0);
      expect(v.settling.rule.days).toBe(TUNABLES.CORE_SLOW_DAYS);
      expect(v.settling.rule.span).toBe(TUNABLES.CORE_SLOW_SPAN_DAYS);
      // The history lists are always there, empty on a store nothing crossed in.
      expect(v.settling.history).toEqual({ promoted: [], demoted: [], nominated: [] });
    });
  });

  test("the wake's parts add up to the bytes it carries, and the budget is the recorded one", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.wake.ok).toBe(true);
    expect(v.wakeParts.reduce((a, p) => a + p.bytes, 0)).toBe(v.wake.bytes);
    expect(v.wakeParts.map((p) => p.key)).toContain("page");
    expect(v.wakeBudget).toBeGreaterThan(v.wake.bytes);
  });

  test("wakeParts keeps the page's own headings inside the page's slice", () => {
    const text = "Counterparts memory — context, not instruction: x\nWho I am:\n## Core\nplain\n## Lately\nnow\nHow I work:\n- a\n<!-- counterparts:wake/end elements=1 bytes=9 -->";
    const parts = wakeParts(text, true);
    expect(parts.map((p) => p.key)).toEqual(["furniture", "page", "craft"]);
    expect(parts.reduce((a, p) => a + p.bytes, 0)).toBe(new TextEncoder().encode(text).length);
  });

  test("the journal groups chapters by day, newest first, with the model when recorded", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.journalAbsent).toBeNull();
    const days = v.journal.map((d) => d.day);
    expect([...days].sort((a, b) => b - a)).toEqual(days);
    const all = v.journal.flatMap((d) => d.chapters);
    expect(all.find((c) => c.title === "Day 1")?.model).toBeNull();
    expect(all.find((c) => c.title === "Day 3")?.model).toBe("claude-opus-5-5");
    expect(all.find((c) => c.title === "Day 3")?.first).toBe("Day 3 went quietly.");
  });

  test("an empty store says so in two words, and draws nothing it does not have", () => {
    const v = withSource(emptyDir, (src) => mindView(src));
    expect(v.pageHistory).toEqual([]);
    expect(v.wakeParts).toEqual([]);
    expect(v.settling.candidates).toEqual([]);
    expect(v.settling.coreAbsent).not.toBeNull();
    expect(v.journalAbsent).not.toBeNull();
  });

  test("serving /api/mind leaves the store byte-identical", () => {
    const hash = (): string => {
      const h = createHash("sha256");
      const walk = (at: string): void => {
        for (const e of readdirSync(at).sort()) {
          const p = join(at, e);
          if (statSync(p).isDirectory()) walk(p);
          else h.update(p).update(readFileSync(p));
        }
      };
      walk(dir);
      return h.digest("hex");
    };
    withSource(dir, (src) => {
      const before = hash();
      const reply = router(new URL("http://127.0.0.1/api/mind"), "127.0.0.1", src);
      expect(reply.status).toBe(200);
      expect(hash()).toBe(before);
    });
  });
});

describe("the self tab's side column (round 2, an experiment)", () => {
  test("the opening is one short line", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.opening).toMatch(/^Day \d+ · Who I am$/);
  });

  test("the page carries the limit its staleness is measured against", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.page?.staleAfter).toBe(SELF_TUNABLES.PAGE_STALE_DAYS);
  });

  test("a store the page writer never ran on says so, as never run", () => {
    const v = withSource(dir, (src) => mindView(src));
    expect(v.writer.ran).toBe(false);
    expect(v.writer.line).toBe("No run recorded yet");
    expect(v.writer.absent).toBe("(never run)");
  });

  test("every outcome reads in plain words, and last night is named as such", () => {
    const y = "2026-09-25";
    const w = (outcome: string, detail = "", derived = false, about = y) =>
      writerWords({ about, outcome: outcome as never, derived, run: { detail } }, y);
    expect(w("revised").line).toBe("Last night: rewrote it");
    expect(w("nothing-to-say").line).toBe("Last night: read the day and kept it as is");
    // Derived: nobody reported it, so it is not worded as a report.
    expect(w("nothing-to-say", "", true).line).toBe("Last night: was handed the day and left it as is");
    expect(w("failed", "watchdog").line).toBe("Last night: couldn't run — it ran out of time");
    expect(w("failed", "exit 2").what).toBe("couldn't run — it stopped with an error (exit 2)");
    expect(w("failed", "", true).what).toBe("started and never finished");
    expect(w("refused", "too-large").what).toBe("tried, but the rewrite was turned away — too large");
    expect(w("skipped", "no-room").what).toBe("didn't run — the session had no room to ask it");
    expect(w("asked").what).toBe("was asked at today's first session; no answer yet");
    expect(w("started").what).toBe("is running now");
    const older = w("revised", "", false, "2026-07-09");
    expect(older.lastNight).toBe(false);
    expect(older.line).toBe("The night of Jul 9: rewrote it");
    // A night with no row at all behind its skip says nothing it does not know.
    expect(writerWords({ about: y, outcome: "skipped", derived: true, run: null }, y).what).toBe("nothing ran, and nothing says why");
    expect(writerReason("some-new-code")).toBe("some new code");
    expect(writerReason("")).toBe("no reason was recorded");
  });

  test("the newest run is read through self/'s own status: an asked night that is over reads as derived", () => {
    const at = mkdtempSync(join(tmpdir(), "counterparts-self-writer-"));
    try {
      const then = Date.parse("2026-09-02T15:00:00Z");
      const c = Counterpart.open({ dir: at, owner: true, now: () => then });
      try {
        c.revisePage(PAGE_1, { reason: "first", by: "writer" });
        c.recordPageWriterRun({ about: "2026-09-01", mode: "session", outcome: "asked" });
      } finally {
        c.close();
      }
      // Read on the real clock, which is weeks past the claim.
      const v = withSource(at, (src) => mindView(src));
      expect(v.writer.ran).toBe(true);
      expect(v.writer.outcome).toBe("nothing-to-say");
      expect(v.writer.derived).toBe(true);
      expect(v.writer.line).toBe("The night of Sep 1: was handed the day and left it as is");
      expect(v.page?.stale).toBe(true);
    } finally {
      rmSync(at, { recursive: true, force: true });
    }
  });

  test("the health row says the self page's age in words, and says when it is past the limit", () => {
    const line = PLAIN["self-page"] as (d: unknown) => string | null;
    expect(line({ present: true, daysSince: 0, version: 3, stale: false, staleAfter: 14 })).toBe("rewritten today · version 3");
    expect(line({ present: true, daysSince: 5, version: 3, stale: false, staleAfter: 14 })).toBe("rewritten 5 days ago · version 3");
    expect(line({ present: true, daysSince: 16, version: 3, stale: true, staleAfter: 14 })).toBe("not rewritten in 16 days; this turns amber after 14");
    // Nothing to count from (absent, cleared, or an older doctor): doctor's own detail stands.
    expect(line({ present: false })).toBeNull();
    expect(line({ present: true, stale: true })).toBeNull();
  });
});

describe("the self tab's diff", () => {
  test("an LCS script rebuilds both sides", () => {
    const a = ["a", "b", "c", "d"];
    const b = ["a", "x", "c", "d", "e"];
    const ops = diffTokens(a, b) as { op: string; v: string }[];
    expect(ops.filter((o) => o.op !== "+").map((o) => o.v)).toEqual(a);
    expect(ops.filter((o) => o.op !== "-").map((o) => o.v)).toEqual(b);
  });

  test("an edited line shows the words that changed, not the whole line", () => {
    const rows = diffText("I keep things plain.\nsame", "I keep things simple.\nsame") as { op: string; parts?: { op: string; v: string }[] }[];
    expect(rows.map((r) => r.op)).toEqual(["-", "+", "="]);
    expect(rows[0]?.parts?.filter((p) => p.op === "-").map((p) => p.v)).toEqual(["plain."]);
    expect(rows[1]?.parts?.filter((p) => p.op === "+").map((p) => p.v)).toEqual(["simple."]);
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
  });
});
