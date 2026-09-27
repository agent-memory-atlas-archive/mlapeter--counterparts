/* Is the wake overflowing? One compact row (round 3b, item 3 — moved here from
   the self tab): the published wake's size against its ceiling, as one stacked
   bar of its parts (headers, self page, nearby memories, arriving, room left),
   and whether the last render had to trim anything to fit. What the wake says
   is on the self tab ("Next time I wake, I start with:"). */
import { $, esc } from "../../../shared/dom.js";

export const markup = `
    <div class="card pad hwk" id="h-wake"></div>`;

export const kb = (b) => (b / 1000).toFixed(1) + " KB";

/** The parts, in reading order, with a colour each. */
const TONE = { furniture: "p-furn", page: "p-page", identity: "p-page", craft: "p-craft", threads: "p-threads", hints: "p-hints", horizon: "p-horizon" };

/** The row's words and its light. Pure. */
export function wakeLine(w) {
  if (!w.ok) return { tone: "grey", line: "No wake composed yet — one is written at the end of each day" };
  const size = w.budget ? kb(w.bytes) + " of " + kb(w.budget) : kb(w.bytes) + " (its ceiling was not recorded)";
  if (w.trimmed > 0) {
    return {
      tone: "amber",
      line: "The wake is full: " + size + ", and the last render left out " + w.trimmed + (w.trimmed === 1 ? " line" : " lines") +
        (w.trimmedFrom.length > 0 ? " (" + w.trimmedFrom.join(", ") + ")" : "") + " to fit",
    };
  }
  if (w.budget && w.bytes > w.budget) return { tone: "amber", line: "The wake runs over its ceiling: " + size };
  return { tone: "green", line: "The wake fits: " + size + (w.budget ? ", " + kb(w.budget - w.bytes) + " room left" : "") };
}

export function paint(d) {
  const w = d.wake;
  const { tone, line } = wakeLine(w);
  if (!w.ok) {
    $("h-wake").innerHTML = '<span class="hc-dot hc-' + tone + '"></span><span class="hwk-line">' + esc(line) + "</span>";
    return;
  }
  const total = w.budget && w.budget > w.bytes ? w.budget : w.bytes;
  const seg = w.parts.map((p) =>
    '<span class="wk-seg ' + (TONE[p.key] || "p-furn") + '" style="width:' + (p.bytes / total * 100).toFixed(2) + '%" title="' +
      esc(p.label) + ": " + kb(p.bytes) + '"></span>').join("");
  const legend = w.parts.map((p) =>
    '<span class="wk-key"><i class="' + (TONE[p.key] || "p-furn") + '"></i>' + esc(p.label) + " <em>" + kb(p.bytes) + "</em></span>").join("") +
    (w.budget && w.budget > w.bytes ? '<span class="wk-key"><i class="p-room"></i>room left <em>' + kb(w.budget - w.bytes) + "</em></span>" : "");
  $("h-wake").innerHTML =
    '<div class="hwk-top"><span class="hc-dot hc-' + tone + '"></span><span class="hwk-line">' + esc(line) + "</span></div>" +
    '<div class="wk-bar" role="img" aria-label="' + esc(w.parts.map((p) => p.label + " " + kb(p.bytes)).join(", ")) + '">' + seg + "</div>" +
    '<div class="wk-legend">' + legend + "</div>";
}
