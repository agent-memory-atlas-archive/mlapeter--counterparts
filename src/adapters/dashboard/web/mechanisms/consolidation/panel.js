/* Consolidation, pictured: memories about me or about us climbing toward the
   core, and how far along each lane they are — strongly felt and come back once
   (fast), or come back on several separate days over weeks (slow). */
import { esc } from "../../shared/dom.js";
import { bar, memLink, nothingYet, two } from "../picture.js";

export function picture(p) {
  if (!p) return "";
  const rows = p.climbing.length === 0
    ? nothingYet("Nothing is climbing toward the core yet.")
    : '<ul class="pic-climb">' + p.climbing.map((c) =>
        "<li>" + memLink(c, 90) +
        '<div class="pic-two">' +
          '<span class="pic-lab">felt ' + two(c.feeling) + " · fast lane needs " + two(p.needFeeling) + (c.returned ? " and it has come back" : " and one return") + "</span>" + bar(c.feeling / p.needFeeling, "#b388ff") +
          '<span class="pic-lab">came back on ' + c.days + (c.days === 1 ? " day" : " days") + " over " + c.span + " · slow lane needs " + p.requiredDays + " over " + p.needSpan + "</span>" + bar(Math.min(c.days / p.requiredDays, c.span / p.needSpan), "#00e5ff") +
        "</div></li>"
      ).join("") + "</ul>";
  const made = p.promoted.length === 0 ? "" :
    '<div class="pic-head pic-gap">Recently became core</div><ul class="pic-list">' +
      p.promoted.map((m) => "<li>" + memLink(m, 90) + '<span class="pic-meta">day ' + m.day + (m.lane ? " · " + esc(m.lane) + " lane" : "") + "</span></li>").join("") + "</ul>";
  return rows + made +
    '<p class="pic-cap">' + esc(p.core + " core " + (p.core === 1 ? "memory" : "memories") + " now. Only a memory about me or about us becomes core: strongly felt and come back once after a gap, or come back on " + p.requiredDays + " separate days over " + p.needSpan + ". At most a few a night.") + "</p>";
}
