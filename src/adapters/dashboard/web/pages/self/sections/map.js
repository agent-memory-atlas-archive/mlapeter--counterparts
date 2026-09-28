/* THE SELF MAP (round 3b, item 4 — an experiment: Mike "wouldn't know until I
   saw it", so all of it is in this one module and `views/self-map.ts`).

   The memories about me or about us as a small picture, plain SVG, no deps:
   - each is a dot, as bright as it is firmly held (the memories tab's language);
   - the core sits in the middle, ringed; a memory one awake return from the
     fast lane wears a faint ring, and one that is ready to cross an amber one;
   - how far a dot sits from the middle is how close it is to the core (the
     engine's own reading, `closeness` from `views/mind.ts#coreCandidates`);
     around the circle, linked memories pull toward each other;
   - lines are the association links between them.
   Hover a dot for its words; click (or Enter) opens its memory card.

   The layout is a pure function of the data (angles seeded from each id, a
   fixed number of steps, no randomness), so a live refresh of unchanged data
   draws the same picture. To take the map out: this file, `views/self-map.ts`,
   the `map` field in `mindView`, and its lines in `settling.js`. */
import { esc } from "../../../shared/dom.js";
import { headline } from "../../../shared/format.js";
import { hideTip, showTip } from "../../../shared/tip.js";

const TAU = Math.PI * 2;

/** FNV-1a over the id → [0, 1): where on the circle a dot starts. */
export function seedOf(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

/**
 * Where every dot goes, in a `w` × `h` box. Pure. The core sits in a small
 * disc at the middle (a sunflower spiral, so any number of them packs evenly);
 * every other dot sits at the radius its closeness gives it — nearer the
 * middle the closer it is to the core — and only its ANGLE moves: links pull
 * linked dots together, and dots too close push apart.
 */
export function layout(map, w, h) {
  const cx = w / 2, cy = h / 2;
  const R = Math.max(40, Math.min(w, h) / 2 - 16);
  const cores = map.nodes.filter((n) => n.core);
  const others = map.nodes.filter((n) => !n.core);
  const rc = cores.length === 0 ? Math.min(26, R * 0.2) : Math.min(R * 0.36, 18 + 12 * Math.sqrt(cores.length));
  const pos = new Map();
  const golden = Math.PI * (3 - Math.sqrt(5));
  cores.forEach((n, i) => {
    if (cores.length === 1) { pos.set(n.id, { x: cx, y: cy, r: 0, fixed: true }); return; }
    const rr = (rc - 11) * Math.sqrt((i + 0.5) / cores.length);
    const a = i * golden + seedOf(cores[0].id) * TAU;
    pos.set(n.id, { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a), r: rr, fixed: true });
  });
  const inner = rc + 16;
  // Start evenly around the circle, in an order the ids fix (so no side of
  // the picture is crowded by chance); the links then pull the angles.
  const order = others.map((n) => n.id).sort((a, b) => seedOf(a) - seedOf(b));
  const turn = seedOf(order.join("|"));
  for (const n of others) {
    const c = Math.max(0, Math.min(2, Number(n.closeness) || 0));
    const r = inner + (1 - c / 2) * (R - inner);
    const a = (order.indexOf(n.id) / Math.max(1, others.length) + turn) * TAU;
    pos.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), r, fixed: false });
  }
  const maxW = Math.max(1e-9, ...map.links.map((l) => l.weight));
  const links = map.links.filter((l) => pos.has(l.a) && pos.has(l.b));
  const STEPS = 160, GAP = 17;
  for (let s = 0; s < STEPS; s++) {
    const cool = 1 - s / STEPS;
    const push = new Map(others.map((n) => [n.id, { x: 0, y: 0 }]));
    // Links pull their two ends together (the core end stays put).
    for (const l of links) {
      const p = pos.get(l.a), q = pos.get(l.b);
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = 0.04 * (0.35 + 0.65 * l.weight / maxW) * Math.max(0, d - GAP) / d;
      if (!p.fixed) { const f = push.get(l.a); f.x += dx * k; f.y += dy * k; }
      if (!q.fixed) { const f = push.get(l.b); f.x -= dx * k; f.y -= dy * k; }
    }
    // Dots too close push apart.
    for (let i = 0; i < others.length; i++) {
      const p = pos.get(others[i].id);
      for (let j = i + 1; j < others.length; j++) {
        const q = pos.get(others[j].id);
        let dx = q.x - p.x, dy = q.y - p.y;
        let d = Math.hypot(dx, dy);
        if (d >= GAP * 1.6) continue;
        if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const k = 0.5 * (GAP * 1.6 - d) / d;
        const a = push.get(others[i].id), b = push.get(others[j].id);
        a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k;
      }
    }
    // Move, then put each dot back on its own ring: only the angle is free.
    for (const n of others) {
      const p = pos.get(n.id), f = push.get(n.id);
      const x = p.x + f.x * cool, y = p.y + f.y * cool;
      const a = Math.atan2(y - cy, x - cx);
      p.x = cx + p.r * Math.cos(a);
      p.y = cy + p.r * Math.sin(a);
    }
  }
  spread(others.map((n) => pos.get(n.id)), cx, cy);
  return { pos, cx, cy, R, rc, inner };
}

/** How far apart two dots' centres must end up: a ringed dot is 9px across its
 *  ring, so this leaves each its own ring and a sliver of room to aim at. */
export const MIN_APART = 22;

/**
 * THE LAST PASS: no two dots on top of each other. Links can pull dots that
 * share a ring (every "ready" dot sits on the innermost one, closeness 2) to
 * the same spot, stronger than the push apart — six of them ended as one
 * overlapping clump beside the core on the owner's map (2026-09-28). Each pair
 * still too close is eased apart along its own ring, so a dot keeps its
 * distance from the middle (its closeness) and only its angle moves. The
 * passes are bounded: a ring with more dots than it has room for at this
 * spacing ends crowded rather than looping.
 */
function spread(pts, cx, cy) {
  for (let pass = 0; pass < 120; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const p = pts[i], q = pts[j];
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d >= MIN_APART - 0.01 || p.r < 1 || q.r < 1) continue;
        const ap = Math.atan2(p.y - cy, p.x - cx), aq = Math.atan2(q.y - cy, q.x - cx);
        // Which way round each goes: q ahead of p, or (on a tie) the later dot ahead.
        let diff = aq - ap;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const dir = diff > 1e-9 ? 1 : diff < -1e-9 ? -1 : 1;
        const half = (MIN_APART - d) / 2 + 0.05;
        const np = ap - dir * half / p.r, nq = aq + dir * half / q.r;
        p.x = cx + p.r * Math.cos(np); p.y = cy + p.r * Math.sin(np);
        q.x = cx + q.r * Math.cos(nq); q.y = cy + q.r * Math.sin(nq);
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** A dot's brightness from how firmly it is held, 0..1 → an opacity the dimmest can still be seen at. */
export const brightness = (s) => 0.22 + 0.78 * Math.max(0, Math.min(1, Number(s) || 0));

/** What a dot says on hover, in words. Pure. */
export function nodeWords(n) {
  const where = n.core ? "in the core" : n.ready ? "ready: it joins the core at the next check"
    : n.oneReturnAway ? "one return away from the core" : "about me or about us";
  return where + " · held " + Math.round(Math.max(0, Math.min(1, n.strength)) * 100) + "%";
}

let last = null;
let box = null;
let drawnWidth = 0;

/** Draw the map into `el` (the settling panel's slot). */
export function paint(el, map) {
  box = el;
  last = map;
  draw();
}

/** Redraw at a new width; nothing to do when the width did not change. */
export function resize() {
  if (box && box.isConnected && Math.round(box.clientWidth) !== drawnWidth) draw();
}

function draw() {
  const map = last;
  if (!box || !map) return;
  const w = Math.max(260, Math.round(box.clientWidth || 480));
  drawnWidth = Math.round(box.clientWidth);
  // A phone gets a near-square picture, so the rings keep their room.
  const h = Math.round(Math.max(230, Math.min(380, w * (w < 520 ? 0.95 : 0.66))));
  const L = layout(map, w, h);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const maxW = Math.max(1e-9, ...map.links.map((l) => l.weight));
  const nCore = map.nodes.filter((n) => n.core).length;

  const rings =
    '<circle class="sm-ring" cx="' + L.cx + '" cy="' + L.cy + '" r="' + L.R.toFixed(1) + '"/>' +
    '<circle class="sm-ring" cx="' + L.cx + '" cy="' + L.cy + '" r="' + ((L.inner + L.R) / 2).toFixed(1) + '"/>' +
    '<circle class="sm-core' + (nCore === 0 ? " empty" : "") + '" cx="' + L.cx + '" cy="' + L.cy + '" r="' + L.rc.toFixed(1) + '"/>' +
    (nCore === 0
      ? '<text class="sm-core-w" x="' + L.cx + '" y="' + (L.cy + 4) + '">core</text>'
      : '<text class="sm-core-w" x="' + L.cx + '" y="' + (L.cy - L.rc - 5).toFixed(1) + '">core</text>');
  const lines = map.links.map((l) => {
    const p = L.pos.get(l.a), q = L.pos.get(l.b);
    if (!p || !q) return "";
    const o = (0.14 + 0.5 * l.weight / maxW).toFixed(2);
    return '<line class="sm-link" data-a="' + esc(l.a) + '" data-b="' + esc(l.b) + '" x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) +
      '" x2="' + q.x.toFixed(1) + '" y2="' + q.y.toFixed(1) + '" style="stroke-opacity:' + o + '"/>';
  }).join("");
  const dots = map.nodes.map((n) => {
    const p = L.pos.get(n.id);
    const r = n.core ? 6.5 : 5.5;
    const ring = n.core ? '<circle class="sm-ring-core" r="' + (r + 3.5) + '"/>'
      : n.ready ? '<circle class="sm-ring-ready" r="' + (r + 3.5) + '"/>'
      : n.oneReturnAway ? '<circle class="sm-ring-one" r="' + (r + 3.5) + '"/>' : "";
    const label = (n.confidential ? "withheld" : headline(n.text)) + " — " + nodeWords(n);
    return '<g class="sm-node' + (n.core ? " core" : "") + '" data-id="' + esc(n.id) + '" transform="translate(' + p.x.toFixed(1) + " " + p.y.toFixed(1) + ')"' +
      ' tabindex="0" role="button" aria-label="' + esc(label) + '">' +
      '<circle class="sm-hit" r="12"/>' + ring +
      '<circle class="sm-dot" r="' + r + '" style="fill-opacity:' + brightness(n.strength).toFixed(2) + '"/></g>';
  }).join("");

  const empty = map.nodes.length === 0
    ? '<p class="sm-empty"><b>(none yet)</b> nothing about me or about us is remembered yet; when it is, it shows here, around the core.</p>'
    : "";
  const legend =
    '<div class="sm-legend" aria-hidden="true">' +
      '<span><i class="k-bright"></i><i class="k-dim"></i>brighter = held more firmly</span>' +
      '<span><i class="k-core"></i>in the core</span>' +
      '<span><i class="k-one"></i>one return away</span>' +
      (map.nodes.some((n) => n.ready) ? '<span><i class="k-ready"></i>ready</span>' : "") +
      '<span><i class="k-link"></i>linked</span>' +
      "<span>nearer the middle = closer to the core</span>" +
    "</div>";
  const count = map.nodes.length === 0 ? "" :
    '<p class="sm-count">' + map.nodes.length + (map.nodes.length === 1 ? " memory" : " memories") + " about me or about us" +
      (map.more > 0 ? " (the closest " + map.nodes.length + " of " + map.total + ")" : "") +
      " · " + map.links.length + (map.links.length === 1 ? " link" : " links") + " between them</p>";

  box.innerHTML =
    '<svg class="sm-svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="group" aria-label="The self map: memories about me or about us, the core in the middle">' +
      rings + '<g class="sm-links">' + lines + "</g>" + dots +
    "</svg>" + empty + count + legend;

  const svg = box.querySelector("svg");
  const lit = (id) => {
    svg.classList.toggle("focus", id !== null);
    svg.querySelectorAll(".sm-link").forEach((ln) => ln.classList.toggle("on", id !== null && (ln.dataset.a === id || ln.dataset.b === id)));
    svg.querySelectorAll(".sm-node").forEach((g) => g.classList.toggle("on", g.dataset.id === id));
  };
  svg.querySelectorAll(".sm-node").forEach((g) => {
    const n = byId.get(g.dataset.id);
    const words = '<b>' + (n.confidential ? '<span class="withheld">withheld</span>' : esc(headline(n.text))) + "</b>" +
      '<div class="dimline">' + esc(nodeWords(n)) + "</div>";
    g.addEventListener("mouseenter", (e) => { lit(n.id); showTip(e.clientX, e.clientY, words); });
    g.addEventListener("mousemove", (e) => showTip(e.clientX, e.clientY, words));
    g.addEventListener("mouseleave", () => { lit(null); hideTip(); });
    g.addEventListener("focus", () => {
      lit(n.id);
      const r = g.getBoundingClientRect();
      showTip(r.left + r.width / 2, r.top, words);
    });
    g.addEventListener("blur", () => { lit(null); hideTip(); });
    const open = () => { hideTip(); if (typeof window.openMemory === "function") window.openMemory(n.id); };
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}
