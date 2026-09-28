/**
 * Association build 2 (2026-09-28): links change what comes to mind.
 *
 * One describe per item of the build, in the build's order, so a behaviour and
 * the commit that introduced it read side by side. Hermetic: every test opens a
 * fresh temp data dir and removes it; nothing here can reach a live store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Store } from "../src/core/store/index.js";
import { Associate } from "../src/core/associate/index.js";
import { Recall, freshGateState, gate, withTunables } from "../src/core/recall/index.js";
import type { Candidate } from "../src/core/recall/index.js";
import { recallTurn } from "../src/core/retrieval.js";
import { Counterpart } from "../src/core/counterpart.js";

let dir: string;
const stores: Store[] = [];
const brains: Counterpart[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "counterparts-assoc2-"));
});

afterEach(() => {
  for (const c of brains.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
  for (const s of stores.splice(0)) {
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

function store(opts: Parameters<typeof Store.open>[0] = {}): Store {
  const s = Store.open({ dir, ...opts });
  stores.push(s);
  return s;
}

/** Ordinary background, so rarity can discriminate (recall §9 G4). */
const FILLER = [
  "The garage door opener needs a new battery soon.",
  "Rebasing keeps the history readable for reviewers.",
  "The library closes early on Sundays now.",
  "The kitchen tap drips when the pressure is high.",
  "The bus route changed and adds ten minutes.",
  "Planted three tomato seedlings in the planter.",
  "Fixed the wobbling chair leg with a shim.",
  "Started keeping receipts in one envelope.",
  "The printer jams on heavy paper stock.",
  "Set up a standing desk in the spare bedroom.",
  "Wrote a short letter to an old teacher.",
  "Bought hiking boots that finally fit properly.",
  "The neighbour's cat sits on the fence every evening.",
  "Replaced the smoke alarm batteries in the hall.",
  "Booked the dentist for a routine cleaning.",
  "The sourdough starter needs feeding twice a week.",
];

const CUED = "The sourdough starter died after two weeks of neglect.";
const TURN = "my sourdough starter died";

/** Words no turn in this file uses: a memory made of them is reachable only by a link. */
const FOREIGN = [
  "Vellichor quixotry zygomorphic ephemera.",
  "Petrichor sonder apricity hiraeth.",
  "Saudade vorfreude hygge komorebi.",
  "Tsundoku wabi mamihlapinatapai.",
  "Eunoia defenestration borborygmus.",
];

/** Link two memories as `uses` fully-credited co-activations would. */
function coUse(associate: Associate, a: string, b: string, uses: number): void {
  for (let i = 0; i < uses; i++) {
    associate.coactivate([
      { id: a, tier: "referenced" },
      { id: b, tier: "referenced" },
    ]);
    associate.flush();
  }
}

function seeded(): { s: Store; associate: Associate; cued: string } {
  const s = store();
  for (const body of FILLER) s.put({ type: "memory", kind: "fact", body });
  const cued = s.put({ type: "memory", kind: "fact", body: CUED, physics: { birthDay: 0, lastUsedDay: 0 } });
  return { s, associate: new Associate({ store: s }), cued };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Links may add QUIET POINTERS (pattern completion)
// ═══════════════════════════════════════════════════════════════════════════
describe("1. quiet pointers: a few per turn, footnote tier only, over a threshold, never loud", () => {
  test("bounded per turn: four well-linked memories, LINK_POINTERS_MAX shown, the rest counted", () => {
    const { s, associate, cued } = seeded();
    const behind = FOREIGN.slice(0, 4).map((body) => s.put({ type: "memory", kind: "fact", body }));
    for (const id of behind) coUse(associate, cued, id, 6);
    const r = new Recall({ store: s, owner: true });
    const d = recallTurn(r, { sessionId: "s1", text: TURN }, { associate }).decision;
    const max = r.tunables.LINK_POINTERS_MAX;
    const shown = d.footnotes.filter((id) => behind.includes(id));
    expect(shown.length).toBe(max);
    expect(d.spread?.linkOnly).toBe(4);
    expect(d.spread?.pointerCandidates).toBe(4);
    expect(d.spread?.pointers).toBe(max);
    expect(d.spread?.pointersShown).toBe(max);
    // Only the quiet tier, and each says how it came.
    for (const id of shown) {
      const v = d.verdicts.find((x) => x.id === id);
      expect(v?.verdict).toBe("footnoted");
      expect(v?.via).toBe("link");
    }
    expect(d.surfaced.some((id) => behind.includes(id))).toBe(false);
  });

  test("NEVER LOUD: a pointer with any activation at all is footnoted, never surfaced", () => {
    const { s } = seeded();
    const id = s.put({ type: "memory", kind: "fact", body: FOREIGN[0] as string });
    const row = s.row(id);
    expect(row).toBeDefined();
    const doc = s.readProse(id);
    const pointer: Candidate = {
      id,
      kind: "fact",
      doc,
      physics: { kind: "fact" } as never,
      strength: 1,
      sal: 1,
      mood: 0,
      cue: 0,
      temporal: 0,
      semantic: 0,
      arrival: 0,
      hops: 1_000,
      activation: 1_000,
      cueFraction: 0,
      matched: 0,
      trains: true,
      maxTier: "footnoted",
      confidential: false,
      linkOnly: true,
    };
    const out = gate(
      { candidates: [pointer], state: freshGateState("g"), storeSize: 500, owner: true, affectStated: false, turn: 1 },
      withTunables(),
    );
    expect(out.surfaced).toEqual([]);
    expect(out.footnotes.map((c) => c.id)).toEqual([id]);
    expect(out.verdicts[0]?.verdict).toBe("footnoted");
    expect(out.verdicts[0]?.via).toBe("link");
    // A pointer is no cue: it is outside the background the bar is built from.
    expect(out.background.n).toBe(0);
  });

  test("a pointer never displaces a memory the words found: its own slots, after the cued footnotes", () => {
    const { s, associate, cued } = seeded();
    const behind = s.put({ type: "memory", kind: "fact", body: FOREIGN[0] as string });
    coUse(associate, cued, behind, 6);
    const without = recallTurn(new Recall({ store: s, owner: true }), { sessionId: "a", text: TURN }, {}).decision;
    const withLinks = recallTurn(new Recall({ store: s, owner: true }), { sessionId: "b", text: TURN }, { associate }).decision;
    // Every memory the conversation brought is still there, in the same order,
    // and the pointer comes after them.
    expect(withLinks.surfaced).toEqual(without.surfaced);
    expect(withLinks.footnotes.slice(0, without.footnotes.length)).toEqual(without.footnotes);
    expect(withLinks.footnotes[withLinks.footnotes.length - 1]).toBe(behind);
  });

  test("the boundary gates hold for pointers: withheld when confidential in a non-owner session, deduped within a session", () => {
    const { s, associate, cued } = seeded();
    const secret = s.put({
      type: "memory",
      kind: "fact",
      body: FOREIGN[1] as string,
      meta: { confidential: true },
    });
    coUse(associate, cued, secret, 6);
    const stranger = recallTurn(new Recall({ store: s, owner: false }), { sessionId: "x", text: TURN }, { associate }).decision;
    expect(stranger.verdicts.find((v) => v.id === secret)?.verdict).toBe("confidential-withheld");
    expect(stranger.footnotes).not.toContain(secret);

    const owner = new Recall({ store: s, owner: true });
    const first = recallTurn(owner, { sessionId: "o", text: TURN }, { associate }).decision;
    expect(first.footnotes).toContain(secret);
    const second = recallTurn(owner, { sessionId: "o", text: TURN }, { associate }).decision;
    expect(second.verdicts.find((v) => v.id === secret)?.verdict).toBe("dedup-suppressed");
  });

  test("a pointer the reply expands is COUNTED as used, and the expansion credits it (trains)", () => {
    const c = Counterpart.open({ dir, owner: true });
    brains.push(c);
    for (const body of FILLER) c.store.put({ type: "memory", kind: "fact", body });
    const cued = c.store.put({ type: "memory", kind: "fact", body: CUED, physics: { birthDay: 0, lastUsedDay: 0 } });
    const behind = c.store.put({ type: "memory", kind: "fact", body: FOREIGN[2] as string, physics: { birthDay: 0, lastUsedDay: 0 } });
    coUse(c.associate, cued, behind, 6);
    c.store.advanceClock("2026-09-28");
    const d = c.recallForTurn({ sessionId: "s1", text: TURN }).decision;
    expect(d.footnotes).toContain(behind);
    const summary = c.creditReferences("s1", { assistantTurns: [], expansions: [behind] });
    expect(summary.pointersExpanded).toBe(1);
    expect(summary.credited).toBe(1);
    expect(summary.ids).toContain(behind);
  });
});
