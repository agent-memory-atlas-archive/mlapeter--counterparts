/* Settling into the core, as one compact chart: a line of counts (in the core,
   protected, being argued with — each opens the list behind it), then each
   memory closest to the core as one row: a short name, a bar filling toward
   the threshold (earned, with the tick where the core begins), and the day
   dots. The candidates are measured against physics' own promotion rule (the
   view computes it; this only draws it). The explaining words sit behind `?`. */
import { $, esc } from "../../../shared/dom.js";
import { headline, n2, said } from "../../../shared/format.js";
import { openModal } from "../../../shared/modal.js";
import { ui } from "../state.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";
import { storyCard } from "./stories.js";

export const markup = `
        <h2 id="self-settling-h">Settling into the core <span id="self-settling-q"></span></h2>
        <div class="card pad" id="self-settling"></div>`;

let stories = [];
let last = null;

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

export function paint(d) {
  if (d) last = d;
  d = last;
  const s = d.settling;
  stories = d.stories || [];
  $("self-settling-q").innerHTML = q("settling", "The core is what repetition and weight earned; it no longer fades. " +
    "Protected is permanent, including permanently wrong. Being argued with is a belief under pressure against the bar it has to clear to change.");

  // A list that emptied closes.
  if (ui.count && listOf(s, ui.count).length === 0) ui.count = null;

  const parts = [];
  // ── the one line of counts; each opens its list ──
  const counts = [
    ["core", s.core.length, plural(s.core.length, "in the core", "in the core")],
    ["guarded", s.guarded.length, plural(s.guarded.length, "protected", "protected")],
    ["contested", s.contested.length, plural(s.contested.length, "being argued with", "being argued with")],
  ];
  parts.push('<div class="st-counts">' + counts.map(([key, n, label]) =>
    '<button type="button" class="st-count k-' + key + (ui.count === key ? " on" : "") + '" data-count="' + key + '"' +
      (n === 0 ? " disabled" : "") + ' aria-expanded="' + (ui.count === key) + '">' + esc(label) + "</button>").join('<span class="st-sep" aria-hidden="true">·</span>') +
    "</div>");
  if (ui.count) parts.push('<div class="st-list">' + list(s, ui.count) + "</div>");

  // ── rows it could not read: always shown when it happens (never folded) ──
  if (s.unreadable.length > 0) {
    parts.push('<div class="st-warn"><b>' + plural(s.unreadable.length, "core memory", "core memories") +
      " could not be read just now:</b> " + s.unreadable.map((u) => esc(u.label)).join(" · ") + "</div>");
  }

  // ── on the way ──
  parts.push(candidates(s));

  const box = $("self-settling");
  box.innerHTML = parts.join("");
  box.querySelectorAll(".st-count").forEach((b) => b.addEventListener("click", () => {
    ui.count = ui.count === b.dataset.count ? null : b.dataset.count;
    paint();
  }));
  box.querySelectorAll(".st-story").forEach((b) => b.addEventListener("click", () => {
    const story = stories[Number(b.dataset.i)];
    if (story) openModal("<h3>How I changed my mind — or didn't</h3>" + storyCard(story));
  }));
  wireTips($("self-settling-q"));
  wireTips(box);
}

function listOf(s, key) {
  return key === "core" ? s.core : key === "guarded" ? s.guarded : key === "contested" ? s.contested : [];
}

function list(s, key) {
  if (key === "contested") {
    return s.contested.map((c, i) =>
      '<button type="button" class="st-row st-story" data-i="' + i + '">' +
        '<span class="st-text"><span class="st-about">about ' + esc(c.about) + "</span>" + esc(headline(c.now)) + "</span>" +
        (c.revised
          ? '<span class="st-tag changed">changed its mind</span>'
          : '<span class="st-bar" title="pressure ' + n2(c.pressure) + " of " + n2(c.bar) + '"><span style="width:' +
              Math.round(Math.min(1, c.fraction) * 100) + '%"></span></span>') +
      "</button>").join("");
  }
  const rows = listOf(s, key);
  // When nothing protected stands in the core, the protected list IS the
  // "permanent but not in the core" list: say so once rather than twice.
  const sameRows = s.outside.length > 0 && s.outside.length === s.guarded.length;
  const note = key === "guarded" && sameRows
    ? '<p class="foot st-note">None of these has earned the core.</p>'
    : "";
  const outside = key === "guarded" && s.outside.length > 0 && !sameRows
    ? '<h4 class="st-h">Permanent but not in the core</h4>' + s.outside.map(row).join("")
    : "";
  return rows.map(row).join("") + note + outside;
}

function row(r) {
  return '<button type="button" class="st-row click" onclick="openMemory(\'' + r.id + '\')">' +
    '<span class="st-text">' + said(r.text, r.confidential) + "</span></button>";
}

function candidates(s) {
  const r = s.rule;
  const c = s.candidates;
  const foot = ["A memory joins the core once what it has earned reaches " + n2(r.threshold) +
    " and it has been used on " + r.days + " different days. That is checked every " + r.everyDays + " lived days."];
  if (s.onTheWay > 0) foot.push(plural(s.onTheWay, "memory has", "memories have") + " been used on a later day.");
  if (s.unused > 0) foot.push(s.unused + " more could get there but haven't been used on a later day yet.");
  if (s.outOfReach > 0) {
    foot.push(s.outOfReach + (s.outOfReach === 1 ? " memory was" : " memories were") +
      " scored too low to get there by use alone (use tops out at " + n2(r.repCap + r.bonus) + ").");
  }
  const tip = q("rule", foot.join(" "));
  if (c.length === 0) {
    return '<h4 class="st-h">On the way to the core ' + tip + "</h4>" +
      '<div class="empty"><b>(none yet)</b> nothing is on its way to the core yet.</div>';
  }
  const scale = 1.2; // the bar is drawn from 0 to 1.2 so the threshold sits right of centre
  const rows = c.map((m) => {
    const ready = m.eligible;
    const have = Math.min(m.base, scale) / scale * 100;
    const ghost = m.consolidated ? 0 : Math.min(m.bonus, scale - Math.min(m.base, scale)) / scale * 100;
    const strong = m.base >= m.threshold;
    const dots = Array.from({ length: m.requiredDays }, (_, i) =>
      '<span class="dd' + (i < m.days ? " on" : "") + '"></span>').join("");
    const status = ready
      ? "ready — it crosses at the next check"
      : (strong ? "strong enough" : "needs " + n2(m.threshold - m.base) + " more" + (m.consolidated ? "" : " (settling adds " + n2(m.bonus) + " once)")) +
        " · used on " + Math.min(m.days, m.requiredDays) + " of " + m.requiredDays + " days";
    return '<button type="button" class="cr' + (ready ? " ready" : "") + '" onclick="openMemory(\'' + m.id + '\')" title="' +
        esc((m.confidential ? "" : m.text + " — ") + status) + '">' +
      '<span class="cr-name">' + (ready ? '<span class="cr-ready">ready</span>' : "") + said(headline(m.text), m.confidential) + "</span>" +
      '<span class="cm-track" aria-label="earned ' + n2(m.base) + " of " + n2(m.threshold) + '">' +
        '<span class="cm-fill' + (strong ? " ok" : "") + '" style="width:' + have.toFixed(1) + '%"></span>' +
        (ghost > 0 ? '<span class="cm-ghost" style="left:' + have.toFixed(1) + "%;width:" + ghost.toFixed(1) + '%"></span>' : "") +
        '<span class="cm-mark" style="left:' + (m.threshold / scale * 100).toFixed(1) + '%"></span>' +
      "</span>" +
      '<span class="cm-dots" aria-label="used on ' + m.days + " of " + m.requiredDays + ' days">' + dots + "</span>" +
    "</button>";
  }).join("");
  return '<h4 class="st-h">' + esc(plural(c.length, "memory", "memories")) + " closest to the core " + tip + "</h4>" +
    '<div class="cr-head" aria-hidden="true"><span></span><span>earned</span><span>days</span></div>' +
    '<div class="cr-list">' + rows + "</div>";
}
