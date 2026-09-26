/* The journal as a strip of days: each day its date, its lived day and a dot
   per chapter, newest first. It opens on the newest day; picking a day lists
   that day's chapters as titles with the model that wrote each (when
   recorded), and picking a title opens its text in place. The whole entry
   still opens as a record. */
import { absenceLine } from "../../../shared/absence.js";
import { $, esc } from "../../../shared/dom.js";
import { renderMarkdown } from "../markdown.js";
import { chapterKey, ui } from "../state.js";
import { q, wireTips } from "../tips.js";

export const markup = `
    <h2 id="self-journal-h">Journal <span id="self-journal-q"></span></h2>
    <div id="self-journal"></div>`;

let last = null;

/** "Fri 10 Jul 2026" → "10 Jul"; anything else as it came. */
export function dayLabel(day) {
  if (!day.date) return "day " + day.day;
  const m = /^\w{3},?\s+(\d{1,2})\s+(\w{3})\w*\s+\d{4}$/.exec(day.date.trim());
  return m ? m[1] + " " + m[2] : day.date;
}

export function paint(d) {
  if (d) last = d;
  d = last;
  $("self-journal-q").innerHTML = q("journal", "A chapter is written at the end of a session; these do not fade.");
  wireTips($("self-journal-q"));
  const box = $("self-journal");
  if (d.journalAbsent) {
    box.innerHTML = absenceLine(d.journalAbsent, "no chapter has been written yet");
    return;
  }
  const days = d.journal;
  // A picked day that is no longer sent falls back to the newest.
  const picked = days.find((x) => x.day === ui.day) || days[0];
  const strip = box.querySelector(".jd-strip");
  const scrollLeft = strip ? strip.scrollLeft : 0;

  const cells = days.map((x) => {
    const on = x === picked;
    const n = x.chapters.length;
    const marks = n <= 5
      ? '<span class="jd-dots" aria-hidden="true">' + '<i></i>'.repeat(n) + "</span>"
      : '<span class="jd-n" aria-hidden="true">' + n + "</span>";
    return '<button type="button" class="jd-day' + (on ? " on" : "") + '" data-day="' + x.day + '" aria-pressed="' + on + '"' +
      ' aria-label="' + esc((x.date || "lived day " + x.day) + ", " + n + (n === 1 ? " chapter" : " chapters")) + '">' +
      '<b>' + esc(dayLabel(x)) + "</b>" +
      (x.date ? '<span class="jd-lived">day ' + x.day + "</span>" : "") + marks + "</button>";
  }).join("");

  const chapters = picked.chapters.map((c) => {
    const key = chapterKey(c);
    const open = ui.chapters.has(key);
    return '<div class="jc' + (open ? " open" : "") + '">' +
      '<button type="button" class="jc-top" data-key="' + esc(key) + '" aria-expanded="' + open + '">' +
        '<span class="jc-title">' + esc(c.title) + "</span>" +
        (c.model ? '<span class="chip model" title="the model that wrote it">' + esc(c.model) + "</span>" : "") +
      "</button>" +
      (open
        ? '<div class="jc-body">' + (c.text === null ? '<p class="foot">This chapter is withheld here, as it is everywhere.</p>' : renderMarkdown(c.text)) +
            '<button type="button" class="act-btn jc-open" onclick="openMemory(\'' + c.id + '\')">open the whole entry</button></div>'
        : "") +
    "</div>";
  }).join("");

  box.innerHTML =
    '<div class="jd-strip" role="group" aria-label="Days">' + cells + "</div>" +
    '<div class="jd-head"><b>' + esc(picked.date || "lived day " + picked.day) + "</b>" +
      (picked.date ? "<span>lived day " + picked.day + "</span>" : "") + "</div>" +
    '<div class="jd-list">' + chapters + "</div>" +
    (d.journalMore > 0 ? '<p class="foot">' + d.journalMore + " older chapters are not shown here.</p>" : "");
  box.querySelector(".jd-strip").scrollLeft = scrollLeft;

  box.querySelectorAll(".jd-day").forEach((b) => b.addEventListener("click", () => {
    ui.day = Number(b.dataset.day);
    paint();
  }));
  box.querySelectorAll(".jc-top").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.key;
    if (ui.chapters.has(key)) ui.chapters.delete(key); else ui.chapters.add(key);
    paint();
  }));
}
