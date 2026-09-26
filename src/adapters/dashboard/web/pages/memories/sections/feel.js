/* "How it feels": a radar of the feelings wheel's six cores, in wheel order,
   with two shapes laid over each other — yours (the feelings recorded as the
   owner's) and mine (this counterpart's own). Each axis is how much of that
   feeling runs through the live memories: the recorded strengths summed, both
   shapes scaled by the one largest axis so they compare, on a square-root
   scale so a little of a feeling still shows beside a lot. Hover an axis for the
   feelings under it; click or tap one to pin them and filter the list to that
   core; click a word to filter to that feeling, from that side. Plain SVG. */
import { $, esc } from "../../../shared/dom.js";
import { FEELING_COLOURS } from "../../../shared/memory-marks.js";
import { hideTip, showTip } from "../../../shared/tip.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";
import { filters, onFilter, setFilter } from "../state.js";

const YOURS = "#ffb74d";
const MINE = "#b388ff";
/** Under this many memories with feelings, say how few there are. */
const FEW = 20;

export const markup = `
          <div class="glance-card">
            <h2 id="feel-h">How it feels<span id="feel-q"></span></h2>
            <div class="card pad feel" id="feel"></div>
          </div>`;

let data = null;
/** The axis whose feelings are showing (kept across a live refresh). */
let picked = null;

/**
 * Hover floats an axis's words by the pointer and changes nothing. A click or a
 * tap on an axis pins its words beside the chart AND filters the list to every
 * memory with a feeling under that core (again: clears it). A click on a word
 * in the pinned readout filters to that feeling, from that side. The readout
 * changes only on a click, so a pointer crossing other axes on its way to a
 * word leaves it alone.
 */
export function mount() {
  const el = $("feel");
  el.addEventListener("click", (e) => {
    const w = e.target.closest("button[data-word]");
    if (w) {
      const cur = filters.feeling;
      const same = cur && cur.word === w.dataset.word && cur.whose === w.dataset.whose;
      filterBy({ feeling: same ? null : { word: w.dataset.word, whose: w.dataset.whose }, feelingCore: null }, !same);
      return;
    }
    const a = e.target.closest("[data-core]");
    if (!a) return;
    picked = a.dataset.core;
    hideTip();
    // No scroll here: the words just pinned are what a phone taps next.
    filterBy({ feeling: null, feelingCore: filters.feelingCore === picked ? null : picked }, false);
  });
  el.addEventListener("keydown", (e) => {
    const a = e.target.closest("g[data-core]");
    if (a && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); a.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  // With a pointer, the words also float by it (the shell's hover tip).
  el.addEventListener("mousemove", (e) => {
    const a = e.target.closest("g[data-core]");
    const c = a && data ? data.cores.find((x) => x.core === a.dataset.core) : null;
    if (!c) return hideTip();
    showTip(e.clientX, e.clientY, detailHtml(c, false));
  });
  el.addEventListener("mouseleave", hideTip);
  onFilter(showDetail);
}

/** Set the feeling filter; for a word, bring the list up if its rows would be off screen. */
function filterBy(patch, scroll) {
  setFilter(patch);
  const h = document.getElementById("mlist-h");
  if (scroll && h && h.getBoundingClientRect().top > innerHeight * 0.5) h.scrollIntoView({ block: "start", behavior: "smooth" });
}

export function paint(d) {
  data = d.feelings;
  $("feel-q").innerHTML = q("feel",
    "The six core feelings of the feelings wheel. The amber shape is yours — how you felt about the moments I kept; the purple one is mine. " +
    "Each axis sums the strength of every feeling recorded under it, across the memories I hold now; both shapes share one scale, " +
    "so a bigger shape means more of it was recorded (the scale is a square root, so small amounts still show). Hover a feeling for the words under it; click or tap one to show those memories below, and click a word for just that feeling.");
  wireTips($("feel-q"));
  draw();
}

function draw() {
  const f = data;
  if (!f) return;
  const cores = f.cores;
  const max = Math.max(0, ...cores.map((c) => Math.max(c.yours.sum, c.mine.sum)));
  const W = 300, H = 250, cx = W / 2, cy = H / 2 + 2, R = 86;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / cores.length;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const fmt = (p) => p[0].toFixed(1) + "," + p[1].toFixed(1);
  let svg = '<svg class="feel-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' +
    esc("how it feels: " + cores.map((c) => c.core + " yours " + c.yours.count + ", mine " + c.mine.count).join("; ")) + '">';
  for (const k of [1 / 3, 2 / 3, 1]) {
    svg += '<polygon class="feel-ring" points="' + cores.map((_, i) => fmt(pt(i, R * k))).join(" ") + '"/>';
  }
  cores.forEach((c, i) => {
    const [x, y] = pt(i, R);
    svg += '<line class="feel-spoke" x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
  });
  if (max > 0) {
    for (const [who, col] of [["yours", YOURS], ["mine", MINE]]) {
      if (cores.every((c) => c[who].sum === 0)) continue;
      const pts = cores.map((c, i) => fmt(pt(i, R * Math.sqrt(c[who].sum / max)))).join(" ");
      svg += '<polygon class="feel-shape" points="' + pts + '" style="fill:' + col + ";stroke:" + col + '"/>';
      cores.forEach((c, i) => {
        if (c[who].sum === 0) return;
        const [x, y] = pt(i, R * Math.sqrt(c[who].sum / max));
        svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="' + col + '"/>';
      });
    }
  }
  // Each axis: a wedge to hover or tap, and its word at the rim.
  cores.forEach((c, i) => {
    const a0 = ang(i) - Math.PI / cores.length, a1 = ang(i) + Math.PI / cores.length;
    const w = [[cx, cy], [cx + (R + 34) * Math.cos(a0), cy + (R + 34) * Math.sin(a0)], [cx + (R + 34) * Math.cos(a1), cy + (R + 34) * Math.sin(a1)]];
    const [lx, ly] = pt(i, R + 16);
    const anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
    svg += '<g class="feel-axis' + (picked === c.core ? " on" : "") + '" data-core="' + esc(c.core) + '" tabindex="0" role="button" aria-label="' + esc(c.core) + '">' +
      '<polygon class="feel-hit" points="' + w.map(fmt).join(" ") + '"/>' +
      '<circle cx="' + (lx + (anchor === "start" ? -8 : anchor === "end" ? 8 : 0)).toFixed(1) + '" cy="' + (ly - (anchor === "middle" ? 12 : 4)).toFixed(1) +
        '" r="3" fill="' + (FEELING_COLOURS[c.core] || "#8a95a3") + '"/>' +
      '<text class="feel-label" x="' + lx.toFixed(1) + '" y="' + (ly + (anchor === "middle" && ly > cy ? 8 : 0)).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(c.core) + "</text></g>";
  });
  svg += "</svg>";
  const legend = '<div class="feel-legend"><span><i style="background:' + YOURS + '"></i>yours</span><span><i style="background:' + MINE + '"></i>mine</span></div>';
  const line = f.carrying === 0
    ? '<p class="glance-empty">No feelings recorded yet. When a memory is kept with how it felt — yours or mine — it shows here.</p>'
    : f.carrying < FEW
      ? '<p class="glance-note">' + f.carrying + (f.carrying === 1 ? " memory carries" : " memories carry") + " feelings so far.</p>"
      : "";
  $("feel").innerHTML = '<div class="feel-row">' + svg + '<div class="feel-side">' + (f.carrying ? legend : "") +
    '<div class="feel-detail" id="feel-detail" aria-live="polite"></div></div></div>' + line;
  showDetail();
}

function showDetail() {
  const box = document.getElementById("feel-detail");
  if (!box || !data) return;
  // A core the list is filtered to is the one shown, after a refresh too.
  if (filters.feelingCore) picked = filters.feelingCore;
  document.querySelectorAll("#feel .feel-axis").forEach((g) => {
    g.classList.toggle("on", g.dataset.core === picked);
    g.classList.toggle("filtering", g.dataset.core === filters.feelingCore);
    g.setAttribute("aria-pressed", String(g.dataset.core === filters.feelingCore));
  });
  const c = data.cores.find((x) => x.core === picked);
  if (!c) {
    box.innerHTML = data.carrying ? '<span class="feel-hint">Click or tap a feeling to see what’s under it, and to show those memories below.</span>' : "";
    return;
  }
  box.innerHTML = detailHtml(c, true);
}

/** One core's feelings in words: `proud 3, joyful 1`, yours and mine. In the
 *  pinned readout each word is a chip that filters the list. */
function detailHtml(c, chips) {
  const words = (s, whose) => {
    if (!s.words.length) return '<span class="feel-hint">none</span>';
    if (!chips) return s.words.map((w) => esc(w.word) + " " + w.count).join(", ");
    const f = filters.feeling;
    return s.words.map((w) => {
      const on = !!f && f.word === w.word.toLowerCase() && f.whose === whose;
      return '<button type="button" class="fword' + (on ? " on" : "") + '" data-word="' + esc(w.word.toLowerCase()) + '" data-whose="' + whose +
        '" aria-pressed="' + on + '" title="show the memories carrying ' + esc(w.word) + " (" + (whose === "owner" ? "yours" : "mine") + ')">' +
        esc(w.word) + ' <span class="fn">' + w.count + "</span></button>";
    }).join("");
  };
  return '<b style="color:' + (FEELING_COLOURS[c.core] || "inherit") + '">' + esc(c.core) + "</b>" +
    '<div class="feel-line"><span class="feel-who" style="color:' + YOURS + '">yours</span> ' + words(c.yours, "owner") + "</div>" +
    '<div class="feel-line"><span class="feel-who" style="color:' + MINE + '">mine</span> ' + words(c.mine, "self") + "</div>";
}
