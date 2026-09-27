/* Tonight — a few short lines about the next sleep (2026-09-27, home round 3 —
   a try, not a rule; dreams and sleep are being redesigned, so this stays
   small). Every answer is the engine's (`views/tonight.ts`): which phases are
   due, who is ready for the core or one return away, what is near the let-go
   line, what is new since the last dream, and what a dream suggested.

   Data: `/api/overview`'s `tonight`. */
import { $, esc } from "../../../shared/dom.js";
import "../../../shared/memory-modal.js"; // window.openMemory, for the names
import { q, wireTips } from "../../../shared/widgets/tips.js";

export const markup = `
        <h2 id="home-tonight-h">Tonight ${q("home-tonight",
          "The next sleep, in a few lines. Due: which sleep phases run at the next sleep; the rest say when. " +
          "Core: memories about me or about us that a lane would carry in tonight, and those only one return away (felt strongly enough; coming back once after a gap is all they lack). " +
          "Let go: memories that would fall below the line within a week if nobody used them. Dream: what is new since the last dream.")}</h2>
        <div class="card home-tonight" id="home-tonight"></div>`;

export function mount() { wireTips($("home-tonight-h")); }

function names(xs, more) {
  if (!xs || xs.length === 0) return "";
  more += Math.max(0, xs.length - 2);
  xs = xs.slice(0, 2);
  const links = xs.map((m) =>
    '<span class="pic-mem' + (m.confidential ? " withheld" : "") + '" role="button" tabindex="0" title="' + esc(m.text) +
      '" onclick="openMemory(\'' + esc(m.id) + '\')" onkeydown="if(event.key===\'Enter\')openMemory(\'' + esc(m.id) + '\')">' +
      esc(m.text.length > 36 ? m.text.slice(0, 35).replace(/[\s,.;:—-]+$/, "") + "…" : m.text) + "</span>").join(", ");
  return '<span class="tn-names">' + links + (more > 0 ? " and " + more + " more" : "") + "</span>";
}

function phaseChip(p) {
  const every = p.cadence > 1 ? " · every " + p.cadence + " days" : "";
  const when = p.due ? every : " · in " + p.inDays + (p.inDays === 1 ? " day" : " days");
  return '<span class="tn-ph' + (p.due ? " on" : "") + '" title="' + esc(p.phase + (p.due ? ": due" : ": not due") +
    ", runs every " + p.cadence + (p.cadence === 1 ? " lived day" : " lived days")) + '">' + esc(p.phase) +
    '<span class="tn-when">' + esc(when) + "</span></span>";
}

function row(label, body) {
  return '<div class="tn-row"><span class="tn-l">' + esc(label) + '</span><div class="tn-b">' + body + "</div></div>";
}

export function paint(d) {
  const t = d.tonight;
  const el = $("home-tonight");
  if (!t) { el.innerHTML = ""; return; }
  const c = t.core;
  const core =
    (c.ready === 0 ? "none ready" : '<b class="tn-hi">' + c.ready + " ready</b>: " + names(c.readyNames, c.ready - c.readyNames.length)) +
    "; " + (c.oneReturnAway === 0 ? "none one return away" :
      c.oneReturnAway + " one return away: " + names(c.oneAwayNames, c.oneReturnAway - c.oneAwayNames.length));
  const lg = t.letGo;
  const letGo = lg.near === 0
    ? "none near the line"
    : lg.near + " within " + lg.horizon + " days if unused" + (lg.tonight > 0 ? " (" + lg.tonight + " tonight)" : "");
  const dream = t.dream.last === null
    ? "no dream yet · " + t.dream.newSince + " new this week"
    : t.dream.newSince + " new since the last dream (" + esc(t.dream.last) + ")";
  const nom = t.nominations.count === 0 ? "" :
    row("Suggested", t.nominations.count + " by the last dream: " + names(t.nominations.names, t.nominations.count - t.nominations.names.length) +
      ' <span class="tn-dim">— nothing acts on these yet</span>');
  el.innerHTML =
    row("Due", '<div class="tn-phs">' + t.phases.map(phaseChip).join("") + "</div>") +
    row("Core", core) +
    row("Let go", esc(letGo)) +
    row("Dream", dream) +
    nom;
}
