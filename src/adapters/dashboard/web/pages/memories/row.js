/* One memory as a row — the shape the list and the find box's answers share.
   Title on its own line with the words dimmer beneath (two lines, clipped); the
   date, the kind and the marks on the right. Every row is drawn at the same
   brightness (round 4, 2026-09-28): how well it is remembered shows only when
   it is not the usual — the one word "fading". A plain fact carries no kind
   tag (the quiet default); a journal chapter is titled by its day. */
import { esc } from "../../shared/dom.js";
import { badges, feelingDots, kindMark, kindOf, shortDate } from "../../shared/memory-marks.js";
import { openMemory } from "../../shared/memory-modal.js";

/** Rows under `container` open their memory on a click or Enter (one listener
 *  for every row it will ever hold, so a repaint needs no rewiring). */
export function wireRows(container) {
  const open = (e) => {
    // A link inside a row (a found memory's "from chapter …") opens what it names, not the row.
    const link = e.target.closest("[data-open]");
    if (link && container.contains(link)) { openMemory(link.dataset.open); return; }
    const row = e.target.closest(".mrow[data-id]");
    if (row && container.contains(row)) openMemory(row.dataset.id);
  };
  container.addEventListener("click", open);
  // Enter on a button inside a row is already a click; only the row itself needs this.
  container.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.target.closest("button")) open(e); });
}

const DATE_WORDS = { text: "the date written in the memory", chapter: "the day its journal chapter names", recorded: "the day it was recorded" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A journal chapter's title: "Journal · Sun 27 Sep", or "Journal" with no day. */
export function journalTitle(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!m) return "Journal";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return "Journal · " + WEEKDAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
}

/**
 * `r`: { id, title, text, confidential, kind, date, dateFrom, core, protected,
 * journal, feelings, archived, hold, versions, schemaRole }. `opts.tier` adds a
 * small match word ("strong match"); `opts.from` ({ id, words }) adds a small
 * link under the words to the journal chapter the memory was drawn from.
 */
export function memRow(r, opts = {}) {
  const words = r.confidential ? '<span class="withheld">' + esc(r.text) + "</span>" : esc(r.text || "");
  const title = r.journal && !r.confidential ? journalTitle(r.date) : r.title;
  const main = title
    ? '<div class="mtitle">' + esc(title) + "</div>" + (r.text ? '<div class="mtext">' + words + "</div>" : "")
    : '<div class="mtext solo">' + words + "</div>";
  const k = kindOf(r.kind);
  const kindWords = k.label + (r.schemaRole ? " · " + r.schemaRole : "");
  // A plain fact is the quiet default: no tag. A journal chapter says so in its title.
  const kindTag = (r.kind === "fact" && !r.schemaRole) || r.journal ? ""
    : '<span class="mkind" title="' + esc(kindWords) + '">' + kindMark(r.kind, false) + '<span class="klabel">' + esc(kindWords) + "</span></span>";
  const held = opts.tier ? '<span class="mtier">' + esc(opts.tier) + "</span>"
    : r.hold === "fading" ? '<span class="mfading" title="unless it is used, I will put it away within two weeks">fading</span>' : "";
  const date = r.date && !r.journal
    ? '<span class="mdate" title="' + esc(DATE_WORDS[r.dateFrom] || "") + '">' + esc(shortDate(r.date)) + "</span>" : "";
  const put = r.archived
    ? '<div class="mwhy">put away: ' + esc(r.archived) + (r.versions > 1 ? " · " + r.versions + " versions" : "") + "</div>" : "";
  const id = esc(r.id);
  return '<div class="mrow click' + (r.archived ? " arch" : "") + '" role="button" tabindex="0" data-id="' + id + '">' +
    '<div class="mmain">' + main +
      (opts.from ? '<button type="button" class="mchapter" data-open="' + esc(opts.from.id) + '">' + esc(opts.from.words) + "</button>" : "") +
      put + "</div>" +
    '<div class="mside">' +
      '<span class="mline">' + held + date + "</span>" +
      '<span class="mline">' + badges({ ...r, journal: false }) + feelingDots(r.feelings) + kindTag + "</span>" +
    "</div></div>";
}
