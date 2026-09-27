/* Prospective memory, pictured (home round 3b, 2026-09-27): the reminders that
   came back this week, then the dated memories still waiting for their day. */
import { esc } from "../../shared/dom.js";
import { memLink, nothingYet } from "../picture.js";

export function picture(p) {
  if (!p || (p.came.length === 0 && p.waiting.length === 0)) {
    return nothingYet("Nothing dated yet: a note or a memory given a date comes back around that day.");
  }
  return '<ul class="pic-list pic-rows">' +
    p.came.map((m) =>
      "<li>" + memLink(m, 90) + '<span class="pic-meta">' + (m.plain ? "said plainly" : "came back as a quiet footnote") + " · day " + m.day + "</span></li>"
    ).join("") +
    p.waiting.map((m) =>
      "<li>" + memLink(m, 90) + '<span class="pic-meta pic-dim">waiting for ' + esc(m.date) + "</span></li>"
    ).join("") +
    "</ul>";
}
