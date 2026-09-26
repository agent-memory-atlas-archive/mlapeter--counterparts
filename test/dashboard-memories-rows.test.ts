/**
 * The memories tab, round 2 (2026-09-26, an experiment): what the views hand the
 * new rows, the new picture and the new memory card — a date lifted off the
 * front of a memory's words (display only), journal chapters, core, feelings,
 * the sort toggle and the new filters, the card's strength curve, use days,
 * lineage, and "close to being let go".
 *
 * Hermetic: a fresh temp store seeded through `tools/demo`, with the states the
 * demo does not reach (feelings, an event date, a model, a revision in place, a
 * use credit, a memory near its let-go day, a confidential one) written through
 * the store's own API, then removed.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Counterpart } from "../src/core/counterpart.js";
import { TUNABLES } from "../src/core/physics/index.js";
import { Dashboard } from "../src/adapters/dashboard/index.js";
import type { DashboardSource } from "../src/adapters/dashboard/index.js";
import { router } from "../src/adapters/dashboard/web/server.js";
import { mechanismPanel, memoriesView, memoryDetail, searchView } from "../src/adapters/dashboard/web/views.js";
import type { MemoryListView } from "../src/adapters/dashboard/web/views.js";
import { fadeCurve } from "../src/adapters/dashboard/web/views/mechanism-panel.js";
import { chapterDate, isChapterMemory, liftDate, shownOf } from "../src/adapters/dashboard/web/views/memory-words.js";
import { seedDemo } from "../tools/demo/seed.js";

const HOST = "127.0.0.1:4747";
let dir: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-memrows-"));
  await seedDemo({ dir });
  let t = Date.parse("2026-09-26T10:00:00Z");
  const c = Counterpart.open({ dir, owner: true, now: () => t });
  try {
    const s = c.store;
    const day = s.livedDay();
    // Two memories born the same lived day, a minute apart.
    ids.first = s.put({ type: "memory", kind: "fact", body: "The first of two written on the same day.", source: "authored" });
    t += 60_000;
    ids.dated = s.put({
      type: "memory",
      kind: "person",
      title: "An unedited rota",
      body: "2026-07-10: the Friday rota went up with no hand edits.\n\nNkechi asked for the same on the second ward.",
      model: "claude-opus-5-5",
      eventDate: "2026-07-24",
      salience: { relevance: 0.9, emotional: 0.8, predictive: 0.6 },
      source: "authored",
    });
    s.addFeelings(ids.dated, [
      { whose: "owner", core: "happy", emotion: "proud", strength: 0.8, carriedBy: "the rota went up untouched" },
      { whose: "self", core: "surprise", emotion: "amazed", strength: 0.5 },
    ]);
    s.updatePhysics(ids.dated, { uses: 3, reinforcedDays: 2, lastUsedDay: day });
    s.appendEvent({ name: "recall.credit", day: day - 3, payload: { reason: "credited", day: day - 3, ids: [ids.dated] } });
    s.appendEvent({ name: "recall.credit", day, payload: { reason: "credited", day, ids: ["mem_other", ids.dated] } });

    ids.revised = s.put({ type: "memory", kind: "fact", body: "A fact before its correction.", source: "authored" });
    s.revise(ids.revised, { body: "A fact after its correction.", reason: "owner-edit" });

    // Low salience, unused for a long time, episodic: prune would take it within days.
    ids.fading = s.put({
      type: "memory",
      kind: "fact",
      body: "A small thing nobody has needed in months.",
      salience: { relevance: 0.05, emotional: 0, predictive: 0 },
      source: "authored",
    });
    s.updatePhysics(ids.fading, { birthDay: day - 400, lastUsedDay: day - 400 });

    ids.secret = s.put({
      type: "memory",
      kind: "person",
      body: "2026-07-09: a private thing.",
      meta: { confidential: true },
      source: "authored",
    });
    s.addFeelings(ids.secret, [{ whose: "owner", core: "fear", emotion: "anxious", strength: 0.4, carriedBy: "a private reason" }]);
  } finally {
    c.close();
  }
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function withSrc<T>(fn: (src: DashboardSource) => T): T {
  const dash = Dashboard.open({ dir });
  try {
    return fn(dash.source);
  } finally {
    dash.close();
  }
}

function getList(src: DashboardSource, qs: string): MemoryListView {
  const reply = router(new URL(`http://${HOST}/api/memories/list${qs}`), HOST, src);
  expect(reply.status).toBe(200);
  return JSON.parse(reply.body) as MemoryListView;
}

function allRows(src: DashboardSource, qs = ""): MemoryListView["rows"] {
  return getList(src, `?limit=200${qs}`).rows.concat(getList(src, `?limit=200&offset=200${qs}`).rows);
}

describe("a date written at the front of a memory is lifted off what is shown", () => {
  test("only a full YYYY-MM-DD at the very start, then a colon, comma, dash or space", () => {
    expect(liftDate("2026-09-26: Mike said so")).toEqual({ date: "2026-09-26", rest: "Mike said so" });
    expect(liftDate("2026-09-26, the pass got faster")).toEqual({ date: "2026-09-26", rest: "The pass got faster" });
    expect(liftDate("2026-09-26 — a dash")).toEqual({ date: "2026-09-26", rest: "A dash" });
    expect(liftDate("2026-09-26 plain space")).toEqual({ date: "2026-09-26", rest: "Plain space" });
    for (const t of ["2026 was a year", "2026-09 was a month", "On 2026-09-26 it rained", "2026-13-01: no such month", "2026-09-26"]) {
      expect(liftDate(t)).toEqual({ date: null, rest: t });
    }
  });

  test("a chapter's heading date, a written date, else the day it was recorded; a confidential row lifts nothing", () => {
    expect(chapterDate("Fri 10 Jul 2026")).toBe("2026-07-10");
    expect(chapterDate("not a date")).toBeNull();
    const chapter = shownOf("## chapter 1 — Fri 10 Jul 2026 · lived day 30\n\nEnd of six weeks.", {
      chapter: true, learnedOn: "2026-07-11", confidential: false,
    });
    expect(chapter).toEqual({ text: "End of six weeks.", date: "2026-07-10", dateFrom: "chapter" });
    const plain = shownOf("# A heading\nFirst line.\nSecond line.", { chapter: false, learnedOn: "2026-07-11", confidential: false });
    expect(plain).toEqual({ text: "First line. Second line.", date: "2026-07-11", dateFrom: "recorded" });
    const secret = shownOf("2026-07-09: a private thing.", { chapter: false, learnedOn: "2026-07-11", confidential: true, withheld: "[withheld]" });
    expect(secret).toEqual({ text: "[withheld]", date: "2026-07-11", dateFrom: "recorded" });
  });

  test("the list shows the lifted words and date; the stored body is untouched", () => {
    withSrc((src) => {
      const r = allRows(src).find((x) => x.id === ids.dated);
      expect(r?.date).toBe("2026-07-10");
      expect(r?.dateFrom).toBe("text");
      expect(r?.text.startsWith("The Friday rota went up")).toBe(true);
      expect(r?.text).toContain("Nkechi asked");
      expect(r?.title).toBe("An unedited rota");
      expect(src.store.row(ids.dated as string)?.body.startsWith("2026-07-10: ")).toBe(true);
    });
  });
});

describe("the list's new marks, filters and sort", () => {
  test("feelings in words; core, protected and journal flags; no model on a row", () => {
    withSrc((src) => {
      const rows = allRows(src, "&state=all");
      const dated = rows.find((x) => x.id === ids.dated);
      expect(dated?.feelings.map((f) => [f.core, f.word, f.whose])).toEqual([["happy", "proud", "owner"], ["surprise", "amazed", "self"]]);
      expect(Object.keys(dated ?? {})).not.toContain("model");
      expect(rows.some((r) => r.core)).toBe(true);
      expect(rows.some((r) => r.protected)).toBe(true);
      const chapters = rows.filter((r) => r.journal);
      expect(chapters.length).toBeGreaterThan(0);
      for (const r of chapters) {
        expect(isChapterMemory(src.store.row(r.id)!)).toBe(true);
        expect(r.dateFrom).toBe("chapter");
        expect(r.text.startsWith("##")).toBe(false);
      }
    });
  });

  test("a confidential row keeps its feelings' words but lifts nothing from its body", () => {
    withSrc((src) => {
      const r = allRows(src).find((x) => x.id === ids.secret);
      expect(r?.confidential).toBe(true);
      expect(r?.text).not.toContain("private");
      expect(r?.dateFrom).toBe("recorded");
      expect(r?.feelings[0]?.word).toBe("anxious");
      const card = memoryDetail(src, ids.secret as string);
      expect(card.feelings[0]?.carriedBy).toBe("");
    });
  });

  test("core and journal filter, with counts; they narrow within live/archived", () => {
    withSrc((src) => {
      const d = getList(src, "?limit=200");
      const core = getList(src, "?core=1&limit=200");
      expect(core.core).toBe(true);
      expect(core.total).toBe(d.counts.core);
      expect(core.total).toBeGreaterThan(0);
      for (const r of core.rows) expect(r.core).toBe(true);
      const journal = getList(src, "?journal=1&limit=200");
      expect(journal.total).toBe(d.counts.journal);
      expect(journal.total).toBeGreaterThan(0);
      for (const r of journal.rows) expect(r.journal).toBe(true);
    });
  });

  test("oldest first is exactly newest first reversed; same-day rows order by the moment written", () => {
    withSrc((src) => {
      const newest = getList(src, "?state=all&limit=200").rows.concat(getList(src, "?state=all&limit=200&offset=200").rows);
      const oldest = getList(src, "?state=all&sort=oldest&limit=200").rows.concat(getList(src, "?state=all&sort=oldest&limit=200&offset=200").rows);
      expect(getList(src, "?sort=oldest").sort).toBe("oldest");
      expect(getList(src, "?sort=junk").sort).toBe("newest");
      expect(oldest.map((r) => r.id)).toEqual(newest.map((r) => r.id).reverse());
      const i = newest.findIndex((r) => r.id === ids.first);
      const j = newest.findIndex((r) => r.id === ids.dated);
      expect(newest[i]?.bornDay).toBe(newest[j]?.bornDay as number);
      expect(j).toBeLessThan(i); // written a minute later, so newer
    });
  });
});

describe("the picture: close to being let go, and journal chapters", () => {
  test("a memory prune would take within the horizon is marked; journal chapters are flagged", () => {
    withSrc((src) => {
      const v = memoriesView(src);
      expect(v.nearLetGoDays).toBeGreaterThan(0);
      const fading = v.points.find((p) => p.id === ids.fading);
      expect(fading?.letGoDay).not.toBeNull();
      expect(fading?.letGoDay).toBeLessThanOrEqual(v.day + v.nearLetGoDays);
      const strong = v.points.find((p) => p.id === ids.dated);
      expect(strong?.letGoDay).toBeNull();
      for (const p of v.points) if (p.promoted) expect(p.letGoDay).toBeNull();
      expect(v.points.some((p) => p.journal)).toBe(true);
      expect(v.points.find((p) => p.id === ids.dated)?.title).toBe("An unedited rota");
    });
  });
});

describe("the memory card", () => {
  test("a curve from the same maths the Forgetting panel draws", () => {
    withSrc((src) => {
      const panel = mechanismPanel(src, "decay");
      const pic = panel.picture;
      if (pic === null || pic.kind !== "decay") throw new Error("no decay picture");
      const c0 = pic.curves[0];
      if (c0 === undefined) throw new Error("no curve");
      const card = memoryDetail(src, c0.id);
      expect(card.curve?.points).toEqual(c0.points);
      expect(card.curve?.archiveDay).toBe(c0.archiveDay);
      expect(card.curve?.archiveLine).toBe(TUNABLES.PHI_PRUNE);
      expect(fadeCurve(src.store.physicsOf(c0.id), card.day).points).toEqual(c0.points as [number, number][]);
    });
  });

  test("core, journal chapters: no curve, and a plain reason", () => {
    withSrc((src) => {
      const core = allRows(src).find((r) => r.core);
      const card = memoryDetail(src, core?.id ?? "");
      expect(card.curve).toBeNull();
      expect(card.curveNote).toContain("core");
      const ch = allRows(src).find((r) => r.journal);
      const chCard = memoryDetail(src, ch?.id ?? "");
      expect(chCard.chapter).toBe(true);
      expect(chCard.curve).toBeNull();
      expect(chCard.curveNote).toContain("journal");
    });
  });

  test("use days from the log; the road to core when days are all that stand in the way", () => {
    withSrc((src) => {
      const card = memoryDetail(src, ids.dated as string);
      expect(card.useDays).toEqual([card.day - 3, card.day]);
      expect(card.reinforcedDays).toBe(2);
      expect(card.promotion.required).toBe(TUNABLES.N_PROMOTION_DAYS);
      const v = card.promotion;
      if (v.byUse) expect(v.days).toBeLessThan(v.required);
      // A memory with no use credits has no use days.
      expect(memoryDetail(src, ids.first as string).useDays).toEqual([]);
    });
  });

  test("model, the date it is about, feelings with what carried them", () => {
    withSrc((src) => {
      const card = memoryDetail(src, ids.dated as string);
      expect(card.model).toBe("claude-opus-5-5");
      expect(card.eventDate).toBe("2026-07-24");
      expect(card.createdAt).not.toBeNull();
      expect(card.feelings[0]).toMatchObject({ word: "proud", carriedBy: "the rota went up untouched" });
    });
  });

  test("versions: rewritten in place, replaced, became, corrects — never 'revised' next to 'never revised'", () => {
    withSrc((src) => {
      const revised = memoryDetail(src, ids.revised as string);
      expect(revised.timeline.map((s) => s.rel)).toEqual(["revised"]);
      expect(revised.timeline[0]?.reason).toBe("owner-edit");

      // A superseded row and its successor point at each other.
      let oldId: string | null = null;
      for (const id of src.store.list({ archived: true })) {
        if (src.store.row(id)?.superseded_by) { oldId = id; break; }
      }
      if (oldId === null) throw new Error("the demo store should hold a superseded row");
      // Opening the old one forwards to the newest (the card says so), whose
      // lineage names what it replaced, one click away.
      const old = memoryDetail(src, oldId);
      expect(old.askedFor).toBe(oldId);
      const head = old.id;
      const direct = src.store.list({ archived: true }).filter((id) => src.store.row(id)?.superseded_by === head);
      expect(direct.length).toBeGreaterThan(0);
      expect(old.timeline.filter((s) => s.rel === "replaced").map((s) => s.id).sort()).toEqual(direct.sort());
      expect(old.timeline.some((s) => s.rel === "became")).toBe(false);

      // A memory that argues with another: a link, labelled as one.
      let arguing: string | null = null;
      for (const id of src.store.list({})) {
        const row = src.store.row(id);
        if (row?.type === "memory" && row.meta.includes('"updates"')) { arguing = id; break; }
      }
      if (arguing !== null) {
        const card = memoryDetail(src, arguing);
        const step = card.timeline.find((s) => s.rel === "corrects");
        expect(step?.id).toBe(src.store.readProse(arguing).meta["updates"] as string);
        expect(card.timeline.some((s) => s.rel === "revised")).toBe(false);
      }
    });
  });
});

describe("search hits carry the row shape", () => {
  test("title, the lifted words, the date, and the marks", () => {
    withSrc((src) => {
      const v = searchView(src, "Friday rota hand edits");
      const hit = v.hits.find((h) => h.id === ids.dated);
      expect(hit?.title).toBe("An unedited rota");
      expect(hit?.shown.startsWith("The Friday rota")).toBe(true);
      expect(hit?.date).toBe("2026-07-10");
      expect(hit?.feelings.length).toBe(2);
    });
  });
});
