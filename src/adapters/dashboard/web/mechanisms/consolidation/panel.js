/* Consolidation, pictured: memories about me or about us climbing toward the
   core, and how far along each lane they are — strongly felt and come back once
   (fast), or come back on several separate days over weeks (slow). Above them,
   the week's returns by source (2026-09-27): only coming back in conversation
   counts toward the core; a dream replay is said apart, dimmer. */
import { esc } from "../../shared/dom.js";
import { q } from "../../shared/widgets/tips.js";
import { bar, memLink, nothingYet, two } from "../picture.js";

const RETURNS_TIP =
  "A memory \"comes back\" when it is used again after a gap; each return makes it fade more slowly. " +
  "Only coming back in conversation counts toward the core. A dream replay counts a little toward fading more slowly, and nothing else. " +
  "History carried over at the upgrade is not counted here.";

function returnsLine(r) {
  if (!r) return "";
  const parts = [r.awake + " came back in conversation"];
  if (r.dream > 0) parts.push('<span class="pic-dim">' + r.dream + " replayed in a dream</span>");
  return '<p class="pic-returns">Last ' + r.days + " lived days: " + parts.join(" · ") + " " + q("pic-returns", RETURNS_TIP) + "</p>";
}

function tag(c) {
  if (c.ready) return ' <span class="pic-tag on">ready</span>';
  if (c.oneReturnAway) return ' <span class="pic-tag">one return away</span>';
  return "";
}

export function picture(p) {
  if (!p) return "";
  const rows = p.climbing.length === 0
    ? nothingYet("Nothing is climbing toward the core yet.")
    : '<ul class="pic-climb">' + p.climbing.map((c) =>
        "<li>" + memLink(c, 90) + tag(c) +
        '<div class="pic-two">' +
          '<span class="pic-lab">felt ' + two(c.feeling) + " · fast lane needs " + two(p.needFeeling) + (c.returned ? " and it has come back" : " and one return") + "</span>" + bar(c.feeling / p.needFeeling, "#b388ff") +
          '<span class="pic-lab">came back on ' + c.days + (c.days === 1 ? " day" : " days") + " over " + c.span + " · slow lane needs " + p.requiredDays + " over " + p.needSpan + "</span>" + bar(Math.min(c.days / p.requiredDays, c.span / p.needSpan), "#00e5ff") +
        "</div></li>"
      ).join("") + "</ul>";
  const made = p.promoted.length === 0 ? "" :
    '<div class="pic-head pic-gap">Recently became core</div><ul class="pic-list">' +
      p.promoted.map((m) => "<li>" + memLink(m, 90) + '<span class="pic-meta">day ' + m.day + (m.lane ? " · " + esc(m.lane) + " lane" : "") + "</span></li>").join("") + "</ul>";
  return returnsLine(p.returns) + rows + made +
    '<p class="pic-cap">' + esc(p.core + " core " + (p.core === 1 ? "memory" : "memories") + " now. Only a memory about me or about us becomes core: strongly felt and come back once after a gap, or come back on " + p.requiredDays + " separate days over " + p.needSpan + ". At most a few a night.") + "</p>";
}
