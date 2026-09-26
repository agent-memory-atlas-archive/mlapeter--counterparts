/* "How firmly it's held": one bar in three parts — firm, settling, fading —
   with their counts. Brighter is firmer (the tab's one visual language), and
   fading is amber. Click a part to filter the list to it; click it again for
   everything. Journal chapters aren't scored, so they are a note, not a part. */
import { $, esc } from "../../../shared/dom.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";
import { filters, onFilter, toggle } from "../state.js";

const PARTS = [
  ["firm", "firm"],
  ["settling", "settling"],
  ["fading", "fading"],
];

export const markup = `
          <div class="glance-card">
            <h2 id="hold-h">How firmly it's held<span id="hold-q"></span></h2>
            <div class="card pad hold" id="hold"></div>
          </div>`;

let data = null;

export function mount() {
  $("hold").addEventListener("click", (e) => {
    const b = e.target.closest("[data-hold]");
    if (b && !b.disabled) toggle("hold", b.dataset.hold);
  });
  onFilter(paintParts);
}

export function paint(d) {
  data = d;
  $("hold-q").innerHTML = q("hold",
    "Firm: in the core, protected, or strong enough that — even unused — it is still settled knowledge " + d.firmAheadDays +
    " lived days from now. Fading: if nobody uses it, it will be let go (archived — kept, not deleted) within " + d.nearLetGoDays +
    " lived days. Settling: everything between. Using a memory makes it firmer. Click a part to see those memories below.");
  wireTips($("hold-q"));
  paintParts();
}

function paintParts() {
  if (!data) return;
  const h = data.hold;
  const scored = h.firm + h.settling + h.fading;
  if (scored === 0) {
    $("hold").innerHTML = '<p class="glance-empty">Nothing held yet. It fills in as we talk.</p>' + journalNote(h);
    return;
  }
  const seg = PARTS.filter(([k]) => h[k] > 0).map(([k, label]) => {
    const on = filters.hold === k;
    return '<button type="button" class="hseg ' + k + (on ? " on" : "") + (filters.hold && !on ? " off" : "") +
      '" style="flex:' + h[k] + '" data-hold="' + k + '" aria-pressed="' + on + '" title="' + esc(label + ": " + h[k]) + '">' +
      '<span class="hn">' + (h[k] / scored >= 0.08 ? h[k] : "") + "</span></button>";
  }).join("");
  const keys = PARTS.map(([k, label]) => {
    const on = filters.hold === k;
    return '<button type="button" class="hkey ' + k + (on ? " on" : "") + '" data-hold="' + k + '" aria-pressed="' + on + '"' +
      (h[k] === 0 ? " disabled" : "") + '><i></i>' + esc(label) + ' <span class="fn">' + h[k] + "</span></button>";
  }).join("");
  $("hold").innerHTML = '<div class="hbar" role="group" aria-label="how firmly it is held — click a part to filter the list">' + seg + "</div>" +
    '<div class="hkeys">' + keys + "</div>" + journalNote(h);
}

function journalNote(h) {
  return h.journal ? '<p class="glance-note">' + h.journal + (h.journal === 1 ? " journal chapter isn't" : " journal chapters aren't") +
    " scored, so " + (h.journal === 1 ? "it's" : "they're") + " left out.</p>" : "";
}
