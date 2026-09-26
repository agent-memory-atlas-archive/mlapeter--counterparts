/* The one picture of everything I hold, aimed at "how strong is what I hold,
   and what's fading?": every memory a dot — older to the right, stronger up,
   bigger when it mattered more. Brighter = held more firmly (the page's one
   visual language); amber = close to being let go; ★ = in the core. Hover for
   its title, click to open it. Journal chapters aren't scored, so they aren't
   plotted. */
import { FACE, fit, hitTest } from "../../../shared/canvas.js";
import { $, esc } from "../../../shared/dom.js";
import { headline } from "../../../shared/format.js";
import { kindOf } from "../../../shared/memory-marks.js";
import { openMemory } from "../../../shared/memory-modal.js";
import { hideTip, showTip } from "../../../shared/tip.js";
import { q, wireTips } from "../tips.js";

const DOT = [0, 229, 255];          // the dot's hue; its brightness is its strength
const FADING = [255, 183, 77];      // close to being let go
const STAR = "#f4f8ff";

export const markup = `
        <h2 id="con-h">Everything I hold <small id="con-sub"></small><span id="con-q"></span></h2>
        <div class="card glance">
          <div class="chart"><canvas id="con" height="320"></canvas></div>
          <div class="glance-foot" id="con-foot"></div>
        </div>`;

let data = null;
let conPoints = [];

export function mount() {
  const cv = $("con");
  cv.addEventListener("mousemove", (e) => {
    const hit = hitTest(cv, e, conPoints);
    cv.style.cursor = hit ? "pointer" : "default";
    if (!hit) return hideTip();
    const p = hit.p;
    const name = p.confidential ? '<span class="withheld">' + esc(p.text) + "</span>" : esc(p.title || headline(p.text));
    showTip(e.clientX, e.clientY, name +
      '<div class="dimline">' + esc(kindOf(p.kind).label) + " · " + Math.round(p.strength * 100) + "% held · " +
      (p.ageDays === 0 ? "born today" : p.ageDays + (p.ageDays === 1 ? " lived day old" : " lived days old")) +
      (p.promoted ? " · ★ core" : "") +
      (p.letGoDay !== null && p.letGoDay !== undefined ? " · let go around day " + p.letGoDay + " if unused" : "") + "</div>");
  });
  cv.addEventListener("mouseleave", hideTip);
  cv.addEventListener("click", (e) => {
    const hit = hitTest(cv, e, conPoints);
    if (hit) openMemory(hit.p.id);
  });
}

export function paint(d) {
  data = d;
  const plotted = d.points.filter((p) => !p.journal).length;
  const chapters = d.points.length - plotted;
  $("con-sub").textContent = plotted < d.total - chapters ? "— the " + plotted + " strongest" : "";
  $("con-q").innerHTML = q("picture",
    "Every dot is one memory, or an entity or belief I hold. Up is how firmly it is held today, right is how many lived days old it is, " +
    "and a bigger dot mattered more when it arrived. Brighter means held more firmly. Amber means that if nobody uses it, it will be " +
    "let go (archived — kept, not deleted) within " + d.nearLetGoDays + " lived days. ★ is in the core, which doesn't fade." +
    (chapters ? " Journal chapters aren't scored, so they aren't plotted." : ""));
  wireTips($("con-q"));
  const fading = d.points.filter((p) => !p.journal && p.letGoDay !== null).length;
  const core = d.points.filter((p) => p.promoted).length;
  $("con-foot").innerHTML =
    '<span class="gk"><i class="gk-dot dim"></i><i class="gk-dot"></i>brighter = held more firmly</span>' +
    '<span class="gk"><i class="gk-dot small"></i><i class="gk-dot big"></i>bigger = mattered more</span>' +
    '<span class="gk"><i class="gk-dot amber"></i>close to being let go' + (fading ? " · " + fading : "") + "</span>" +
    (core ? '<span class="gk"><b class="gk-star">★</b>core · ' + core + "</span>" : "");
}

const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";

export function draw() {
  if (!data) return;
  const MEM = data;
  const pts = MEM.points.filter((p) => !p.journal);
  const cv = $("con");
  const { ctx, w, h } = fit(cv);
  const narrow = w < 520;
  const padL = narrow ? 34 : 46, padR = 12, padT = 22, padB = 26;
  const maxAge = Math.max(1, ...pts.map((p) => p.ageDays));
  const X = (a) => padL + (a / maxAge) * (w - padR - padL);
  const Y = (s) => h - padB - Math.max(0, Math.min(1, s)) * (h - padT - padB);

  // grid, and the two axes in plain words
  ctx.strokeStyle = "rgba(0,229,255,.07)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#79848f";
  for (let i = 0; i <= 4; i++) {
    const y = Y(i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
  }
  ctx.fillStyle = "#8a95a3";
  ctx.fillText("stronger ↑", padL, 13);
  ctx.fillStyle = "#79848f";
  ctx.fillText("today", padL, h - 7);
  const older = "older →  " + maxAge + (maxAge === 1 ? " lived day" : " lived days");
  ctx.fillStyle = "#8a95a3";
  ctx.fillText(older, w - padR - ctx.measureText(older).width, h - 7);

  if (pts.length === 0) {
    ctx.fillStyle = "#8a95a3";
    ctx.fillText(String(MEM.pointsAbsent || "(none yet)") + " — nothing to plot yet. Write a note, or just talk.", padL + 8, h / 2);
    conPoints = [];
    return;
  }
  if (pts.every((p) => p.ageDays === 0)) {
    ctx.fillStyle = "#8a95a3";
    ctx.fillText(narrow ? "All born today — they spread out as days pass." :
      "All " + pts.length + " were born today. They spread out to the right as days pass.", padL + 30, Y(0.62));
  }

  conPoints = [];
  const few = pts.length < 20;
  const stacked = new Map();
  // Weakest first, so the bright ones sit on top.
  const order = pts.slice().sort((a, b) => a.strength - b.strength);
  for (const p of order) {
    const sal = Math.max(0, Math.min(1, p.salience));
    const r = (few ? 4 : narrow ? 1.8 : 2.5) + sal * sal * (few ? 9 : narrow ? 5 : 8.5);
    let x = X(p.ageDays), y = Y(p.strength);
    const key = Math.round(x / 3) + "," + Math.round(y / 3);
    const i = stacked.get(key) || 0;
    stacked.set(key, i + 1);
    if (i > 0 && few) {
      const rad = 12 * Math.sqrt(i), th = i * 2.39996;
      x = Math.max(padL + r, Math.min(w - padR - r, x + rad * Math.cos(th)));
      y = Math.max(padT + r, Math.min(h - padB - r, y + rad * Math.sin(th)));
    }
    const s = Math.max(0, Math.min(1, p.strength));
    if (p.promoted) {
      ctx.save();
      ctx.fillStyle = STAR;
      ctx.font = Math.round(10 + r * 1.3) + "px " + FACE;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", x, y);
      ctx.restore();
    } else {
      const fading = p.letGoDay !== null && p.letGoDay !== undefined;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fading ? rgba(FADING, 0.9) : rgba(DOT, 0.25 + 0.75 * s);
      ctx.fill();
      if (p.protected) { ctx.strokeStyle = rgba(DOT, 0.9); ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    conPoints.push({ x, y, r: Math.max(r, 6), p });
  }
}
