/* One memory as a row — the shape the list, the search hits and Ask's answers
   all share. Title on its own line with the words dimmer beneath (two lines,
   clipped); the date, the kind and the marks on the right. How firmly it is
   held is the row's BRIGHTNESS (`lit-1` … `lit-5`, real colours that stay
   readable at the dimmest), with one quiet meter beside it. */
import { esc } from "../../shared/dom.js";
import { badges, feelingDots, kindMark, kindOf, litLevel, shortDate, strengthMeter } from "../../shared/memory-marks.js";
import { openMemory } from "../../shared/memory-modal.js";

/** Rows under `container` open their memory on a click or Enter (one listener
 *  for every row it will ever hold, so a repaint needs no rewiring). */
export function wireRows(container) {
  const open = (e) => {
    const row = e.target.closest(".mrow[data-id]");
    if (row && container.contains(row)) openMemory(row.dataset.id);
  };
  container.addEventListener("click", open);
  container.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
}

const DATE_WORDS = { text: "the date written in the memory", chapter: "the day its journal chapter names", recorded: "the day it was recorded" };

/**
 * `r`: { id, title, text, confidential, kind, strength, date, dateFrom, core,
 * protected, journal, feelings, archived, schemaRole }. `opts.lit` overrides the
 * brightness (Ask's tiers); `opts.tier` adds a small tier word in place of the
 * meter.
 */
export function memRow(r, opts = {}) {
  const lit = r.archived ? 1 : opts.lit ?? (r.journal ? 3 : litLevel(r.strength));
  const words = r.confidential ? '<span class="withheld">' + esc(r.text) + "</span>" : esc(r.text || "");
  const main = r.title
    ? '<div class="mtitle">' + esc(r.title) + "</div>" + (r.text ? '<div class="mtext">' + words + "</div>" : "")
    : '<div class="mtext solo">' + words + "</div>";
  const k = kindOf(r.kind);
  const kindWords = k.label + (r.schemaRole ? " · " + r.schemaRole : "");
  const held = opts.tier ? '<span class="mtier">' + esc(opts.tier) + "</span>"
    : r.journal || r.archived ? "" : strengthMeter(r.strength);
  const id = esc(r.id);
  return '<div class="mrow click lit-' + lit + (r.archived ? " arch" : "") + '" role="button" tabindex="0" data-id="' + id + '">' +
    '<div class="mmain">' + main +
      (r.archived ? '<div class="mwhy">archived: ' + esc(r.archived) + "</div>" : "") + "</div>" +
    '<div class="mside">' +
      '<span class="mline">' + held +
        (r.date ? '<span class="mdate" title="' + esc(DATE_WORDS[r.dateFrom] || "") + '">' + esc(shortDate(r.date)) + "</span>" : "") +
      "</span>" +
      '<span class="mline">' + badges(r) + feelingDots(r.feelings) +
        '<span class="mkind" title="' + esc(kindWords) + '">' + kindMark(r.kind, false) + '<span class="klabel">' + esc(kindWords) + "</span></span>" +
      "</span>" +
    "</div></div>";
}
