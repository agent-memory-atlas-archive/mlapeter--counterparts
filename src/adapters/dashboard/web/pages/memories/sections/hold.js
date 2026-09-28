/* "How well I remember": one bar in four parts — firm, settling, fading, and
   the journal (grey: its chapters are kept as written and not scored) — so the
   parts add up to the count at the top of the page. Fading is amber. Click a
   part to filter the list to it; click it again for everything. */
import { $, esc } from "../../../shared/dom.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";
import { filters, onFilter, toggle } from "../state.js";

/** [key, words, hover hint]. The journal part filters by the journal chip. */
const PARTS = [
  ["firm", "firm", "I'll still know it in a month"],
  ["settling", "settling", "between firm and fading"],
  ["fading", "fading", "put away soon unless it's used"],
  ["journal", "journal", "my journal, kept as written"],
];

/** The `?`: two plain sentences (round 4). */
export const HOLD_TIP = "Firm: I'll still know it a month from now even if it's never used. " +
  "Fading: unless it's used, I'll put it away within two weeks.";

export const markup = `
          <div class="glance-card">
            <h2 id="hold-h">How well I remember<span id="hold-q"></span></h2>
            <div class="card pad hold" id="hold"></div>
          </div>`;

let data = null;

export function mount() {
  $("hold").addEventListener("click", (e) => {
    const b = e.target.closest("[data-hold]");
    if (!b || b.disabled) return;
    if (b.dataset.hold === "journal") toggle("journal");
    else toggle("hold", b.dataset.hold);
  });
  onFilter(paintParts);
}

export function paint(d) {
  data = d;
  $("hold-q").innerHTML = q("hold", HOLD_TIP);
  wireTips($("hold-q"));
  paintParts();
}

const isOn = (k) => (k === "journal" ? filters.journal : filters.hold === k);

function paintParts() {
  if (!data) return;
  const h = data.hold;
  const all = h.firm + h.settling + h.fading + h.journal;
  if (all === 0) {
    $("hold").innerHTML = '<p class="glance-empty">Nothing held yet. It fills in as we talk.</p>';
    return;
  }
  const any = PARTS.some(([k]) => isOn(k));
  const seg = PARTS.filter(([k]) => h[k] > 0).map(([k, label, hint]) => {
    const on = isOn(k);
    return '<button type="button" class="hseg ' + k + (on ? " on" : "") + (any && !on ? " off" : "") +
      '" style="flex:' + h[k] + '" data-hold="' + k + '" aria-pressed="' + on + '" title="' + esc(label + " " + h[k] + " — " + hint) + '">' +
      '<span class="hn">' + (h[k] / all >= 0.08 ? h[k] : "") + "</span></button>";
  }).join("");
  const keys = PARTS.map(([k, label, hint]) => {
    const on = isOn(k);
    return '<button type="button" class="hkey ' + k + (on ? " on" : "") + '" data-hold="' + k + '" aria-pressed="' + on + '"' +
      ' title="' + esc(hint) + '"' + (h[k] === 0 ? " disabled" : "") + '><i></i>' + esc(label) + ' <span class="fn">' + h[k] + "</span></button>";
  }).join("");
  $("hold").innerHTML = '<div class="hbar" role="group" aria-label="how well I remember — click a part to filter the list">' + seg + "</div>" +
    '<div class="hkeys">' + keys + "</div>";
}
