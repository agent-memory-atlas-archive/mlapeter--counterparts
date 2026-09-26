/* What the next session wakes up with — one line and a stacked bar of its
   parts, in the side column; "read it" opens the whole text in place. The
   rebuild door (`counterparts rebrief`, through the actions seam) is shown but
   not offered for now: rebrief is one step of sleep, and it comes back with
   the sleep work. The console's `counterparts rebrief` is unchanged. */
import { absenceLine } from "../../../shared/absence.js";
import { act, resultHtml } from "../../../shared/actions.js";
import { $, esc } from "../../../shared/dom.js";
import { ui } from "../state.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

export const markup = `
      <div class="side-block">
        <h3 class="sb-h" id="self-wake-h">What the next session wakes up with <span id="self-wake-q"></span></h3>
        <div id="self-wake"></div>
        <div class="wk-act">
          <button type="button" class="act-btn" id="rebrief-go" disabled aria-disabled="true"
            title="comes with the sleep work">Rebuild it now</button><span class="soon" title="comes with the sleep work">coming soon</span>
          <div id="rebrief-out"></div>
        </div>
      </div>`;

let onDone = null;

export const kb = (b) => (b / 1000).toFixed(1) + " KB";

/** The parts, in reading order, with a colour each. */
const TONE = { furniture: "p-furn", page: "p-page", identity: "p-page", craft: "p-craft", threads: "p-threads", hints: "p-hints", horizon: "p-horizon" };

const EXPLAIN = "When a session starts, a line with today's date goes on top, and in a folder with a handoff note, a pointer to it. " +
  "It is composed without a model, at the end of each day.";

export function mount(refresh) {
  onDone = refresh;
  // The action stays wired, so turning the button back on is one attribute.
  $("rebrief-go").addEventListener("click", async () => {
    const go = $("rebrief-go");
    if (go.disabled) return;
    go.disabled = true;
    $("rebrief-out").innerHTML = resultHtml({ out: ["rebuilding…"] });
    const r = await act("rebrief", {});
    go.disabled = false;
    $("rebrief-out").innerHTML = resultHtml(r);
    if (r && r.ok && onDone) onDone();
  });
}

let last = null;

export function paint(d) {
  if (d) last = d;
  d = last;
  $("self-wake-q").innerHTML = q("wake", EXPLAIN);
  wireTips($("self-wake-q"));
  const w = d.wake;
  if (!w.ok) {
    $("self-wake").innerHTML = absenceLine(w.absent || "(never run)", "no wake has been composed yet (" + w.reason + ")");
    return;
  }
  const budget = d.wakeBudget;
  const total = budget && budget > w.bytes ? budget : w.bytes;
  const parts = d.wakeParts || [];
  const seg = parts.map((p) =>
    '<span class="wk-seg ' + (TONE[p.key] || "p-furn") + '" style="width:' + (p.bytes / total * 100).toFixed(2) + '%" title="' +
      esc(p.label) + ": " + p.bytes + ' bytes"></span>').join("");
  const legend = parts.map((p) =>
    '<span class="wk-key"><i class="' + (TONE[p.key] || "p-furn") + '"></i>' + esc(p.label) + " <em>" + kb(p.bytes) + "</em></span>").join("") +
    (budget && budget > w.bytes ? '<span class="wk-key"><i class="p-room"></i>room left <em>' + kb(budget - w.bytes) + "</em></span>" : "");
  $("self-wake").innerHTML =
    '<button type="button" class="wk-sum" id="wake-toggle" aria-expanded="' + ui.wake + '">' +
      '<span class="wk-line">Next session gets <b>' + (w.bytes / 1000).toFixed(1) + "</b>" +
        (budget ? " of " + kb(budget) : " KB <small>(its ceiling was not recorded)</small>") + "</span>" +
      '<span class="wk-open">' + (ui.wake ? "hide it" : "read it") + "</span>" +
    "</button>" +
    '<div class="wk-bar" role="img" aria-label="' + esc(parts.map((p) => p.label + " " + p.bytes + " bytes").join(", ")) + '">' + seg + "</div>" +
    '<div class="wk-legend">' + legend + "</div>" +
    '<div class="wk-full" id="wake-full"' + (ui.wake ? "" : " hidden") + ">" + fullText(w) + "</div>";
  $("wake-toggle").addEventListener("click", () => { ui.wake = !ui.wake; paint(); });
}

function fullText(w) {
  return (w.preface ? '<div class="wakehead">Delivery preface: ' + esc(w.preface) + "</div>" : "") +
    w.lanes.map((lane) =>
      '<div class="lane"><h4>' + esc(lane.heading) + "</h4>" +
      lane.items.map((item) => {
        const m = /^(\S+\s·\s|by\s\S+\s·\s)/.exec(item);
        return '<div class="item">' + (m ? '<span class="date">' + esc(m[1]) + "</span>" + esc(item.slice(m[1].length)) : esc(item)) + "</div>";
      }).join("") + "</div>"
    ).join("");
}
