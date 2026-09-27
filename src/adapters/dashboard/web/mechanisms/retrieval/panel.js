/* Retrieval, pictured: of the memories brought to mind lately, how many got
   used (2026-09-27: one line and a tiny per-day trend), then the last turns
   that brought memories to mind — which were said out loud and which were kept
   as footnotes — and whether each has actually been used since (read off the
   memory itself: its last credited use is on or after that day). */
import { esc } from "../../shared/dom.js";
import { q } from "../../shared/widgets/tips.js";
import { memLink, nothingYet } from "../picture.js";

const pctOf = (c) => (c && c.brought > 0 ? Math.round((100 * c.used) / c.brought) : null);
const pctWords = (c) => (pctOf(c) === null ? "none" : pctOf(c) + "%");

const USE_TIP =
  "Each memory brought to mind counts once a day — said out loud if any turn that day said it. " +
  "\"Used\" means it was actually used on or after that day (its last credited use), the same test as \"used since\" below.";

/** One tiny bar per lived day: its height is that day's used share; a day with nothing brought is a dot. */
function trend(perDay) {
  const W = 8;
  const H = 18;
  const bars = perDay.map((d, i) => {
    const p = d.brought > 0 ? d.used / d.brought : null;
    const title = "day " + d.day + ": " + (p === null ? "nothing brought to mind" : d.used + " of " + d.brought + " used");
    return "<g><title>" + esc(title) + "</title>" + (p === null
      ? '<rect class="use-none" x="' + (i * W + 2) + '" y="' + (H - 1) + '" width="' + (W - 4) + '" height="1"/>'
      : '<rect class="use-bar" x="' + (i * W + 2) + '" y="' + (H - Math.max(1, p * H)) + '" width="' + (W - 4) + '" height="' + Math.max(1, p * H) + '"/>') + "</g>";
  }).join("");
  return '<svg class="use-trend" viewBox="0 0 ' + perDay.length * W + " " + H + '" width="' + perDay.length * W + '" height="' + H + '" role="img" aria-label="Used share, per lived day">' + bars + "</svg>";
}

function useLine(u) {
  if (!u) return "";
  if (u.brought === 0) return '<p class="pic-use">Nothing was brought to mind in the last ' + u.days + " lived days.</p>";
  return '<p class="pic-use">' + trend(u.perDay) + "<span>Of memories brought to mind in the last " + u.days + " lived days, <b>" + pctWords(u) +
    "</b> got used (said out loud: " + pctWords(u.said) + ", footnotes: " + pctWords(u.footnote) + ") " + q("pic-use", USE_TIP) + "</span></p>";
}

export function picture(p) {
  if (!p || p.turns.length === 0) return useLine(p && p.use) + nothingYet("No turn has brought a memory to mind yet.");
  return useLine(p.use) + '<div class="pic-turns">' + p.turns.map((t) =>
    '<div class="pic-turn"><div class="pic-head">day ' + t.day + " · turn " + t.turn + "</div><ul>" +
      t.memories.map((m) =>
        '<li><span class="pic-tag' + (m.said ? " on" : "") + '">' + (m.said ? "said" : "footnote") + "</span>" +
        memLink(m, 80) +
        '<span class="pic-used' + (m.usedSince ? " yes" : "") + '">' + (m.usedSince ? "used since" : "not used since") + "</span></li>"
      ).join("") +
    "</ul></div>"
  ).join("") + "</div>" +
  '<p class="pic-cap">' + esc("Said out loud means it came into the conversation; a footnote was near enough to mention. Only the ones actually used get stronger.") + "</p>";
}
