/* The self page — the heart of the tab — on the left, whole and untrimmed; and
   in the side column, when it was last rewritten and by whom, what the page
   writer did on its last night, and its history as a line of dots. Clicking a
   dot opens that version and what changed from the one before it; nothing is
   open until then. Read-only: there is no write door here (the doors are the
   MCP tool and the console's `self-page`). */
import { absenceLine } from "../../../shared/absence.js";
import { $, esc } from "../../../shared/dom.js";
import { diffStats, diffText } from "../diff.js";
import { renderMarkdown } from "../markdown.js";
import { ui } from "../state.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

/** The left column: an opened version (when one is), then the page. */
export const mainMarkup = `
      <div id="self-version"></div>
      <p class="sp-behind" id="self-behind" hidden></p>
      <section class="sp-card" id="self-page"></section>`;

/** The side column's top: the page's facts, then its history. */
export const sideMarkup = `
      <div class="side-block" id="self-meta"></div>
      <div class="side-block" id="self-history"></div>`;

let steps = [];

const WHO = { owner: "you, by hand", session: "a session", writer: "the page writer" };
export const who = (by) => (by ? WHO[by] || by : "someone unrecorded");

/** "2026-09-24" → "Sep 24" (and the year when it is not this one). */
export function shortDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T12:00:00Z");
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  if (d.getUTCFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** The writer's outcome → a tone for its line. */
const WRITER_TONE = { revised: "ok", "nothing-to-say": "ok", refused: "warn", failed: "warn" };

export function paintPage(d) {
  const p = d.page;
  $("self-page").innerHTML = d.pageAbsent
    ? absenceLine(d.pageAbsent, "no page has been written yet — it is written at the end of a session, from what keeps coming up, and you can amend it by hand")
    : '<div class="sp-body">' + renderMarkdown(p.body) + "</div>";
}

/**
 * A page a few lived days behind says so, once, above it (round 3, S1): when it
 * was written and what has been lived since. Calm — a note, not a warning. The
 * view decides when (`pageBehind`); this only draws its line.
 */
export function paintBehind(d) {
  const el = $("self-behind");
  const b = d.pageBehind;
  if (!b || d.pageAbsent) { el.innerHTML = ""; el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = esc(b.line) + " " +
    q("behind", "The page is rewritten by the page writer, at most once a night, when something about who I am has moved. " +
      "It was last rewritten on lived day " + b.writtenDay + "; today is lived day " + (b.writtenDay + b.livedDays) +
      ". The side column says what the page writer did on its newest night.");
  wireTips(el);
}

export function paintMeta(d) {
  const p = d.page;
  const w = d.writer;
  const rows = [];
  if (p) {
    rows.push('<div class="sb-line"><span class="sb-k">Rewritten</span><span>' +
      esc(shortDate(p.revisedOn) || p.revisedOn || "on an unrecorded date") + " · by " + esc(who(p.by)) +
      " · version " + p.version + "</span></div>");
    if (p.stale) rows.push('<div class="sb-line"><span class="chip warn" title="not rewritten in over ' + p.staleAfter + ' days">not rewritten in a while</span></div>');
    if (p.reason) rows.push('<div class="sb-why" title="' + esc(p.reason) + '">“' + esc(p.reason) + "”</div>");
  }
  if (w) {
    rows.push('<div class="sb-writer' + (WRITER_TONE[w.outcome] ? " " + WRITER_TONE[w.outcome] : "") + '">' +
      (w.absent ? '<span class="sb-absent">' + esc(w.absent) + "</span> " : "") + esc(w.line) +
      q("writer", w.more || "The page writer reads the day just gone, once a night, and rewrites the page when something about who I am moved. This is its newest run.") +
      "</div>");
  }
  $("self-meta").innerHTML = rows.join("");
  wireTips($("self-meta"));
}

export function paintHistory(d) {
  if (d) steps = d.pageHistory || [];
  const el = $("self-history");
  // A version that is no longer in the history (a cleared page) closes.
  if (ui.version !== null && !steps.some((s) => s.seq === ui.version)) ui.version = null;
  if (steps.length === 0) { el.innerHTML = ""; el.hidden = true; paintVersion(); return; }
  el.hidden = false;
  if (steps.length === 1) {
    el.innerHTML = '<h3 class="sb-h">How the page changed</h3>' +
      '<p class="foot sp-once">Written once; there is no earlier version to compare.</p>';
    paintVersion();
    return;
  }
  const keep = el.querySelector(".tl");
  const scrollLeft = keep ? keep.scrollLeft : null;
  const dots = steps.map((s) => {
    const on = s.seq === ui.version;
    return '<button type="button" class="tl-step' + (on ? " on" : "") + (s.current ? " now" : "") +
      '" data-seq="' + s.seq + '" aria-pressed="' + on + '" title="' + esc(s.reason || "") + '">' +
      '<span class="tl-dot"></span>' +
      '<span class="tl-date">' + esc(shortDate(s.date) || (s.day !== null ? "day " + s.day : "undated")) + "</span>" +
      '<span class="tl-who">' + esc(s.current ? "now" : "v" + (s.seq - 1)) + " · " + esc(s.by === "owner" ? "you" : s.by || "?") + "</span>" +
    "</button>";
  }).join("");
  el.innerHTML =
    '<h3 class="sb-h">How the page changed ' +
      q("history", steps.length + " versions, oldest on the left. Click one to see what changed from the version before it; click it again to close.") + "</h3>" +
    '<div class="tl"><div class="tl-track">' + dots + "</div></div>";
  const tl = el.querySelector(".tl");
  // Where the line was scrolled stays; the first time, it shows the newest end.
  tl.scrollLeft = scrollLeft === null ? tl.scrollWidth : scrollLeft;
  el.querySelectorAll(".tl-step").forEach((b) => b.addEventListener("click", () => {
    const seq = Number(b.dataset.seq);
    ui.version = ui.version === seq ? null : seq;
    ui.whole = false;
    paintHistory();
    // Only on a click, never on a refresh: bring the opened view into sight.
    const v = $("self-version");
    if (ui.version !== null && v.scrollIntoView) v.scrollIntoView({ block: "nearest" });
  }));
  wireTips(el);
  paintVersion();
}

function paintVersion() {
  const box = $("self-version");
  const i = ui.version === null ? -1 : steps.findIndex((s) => s.seq === ui.version);
  if (i < 0) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  const s = steps[i];
  const prev = i > 0 ? steps[i - 1] : null;
  const head =
    '<div class="tl-vhead"><b>' + (s.current ? "The page as it stands" : "Version " + (s.seq - 1)) + "</b>" +
    '<span class="tl-meta">' + esc(shortDate(s.date) || "undated") + (s.day !== null ? " · lived day " + s.day : "") +
    " · written by " + esc(who(s.by)) + (s.bytes !== null ? " · " + s.bytes + " bytes" : "") + "</span>" +
    '<button type="button" class="tl-close" id="self-version-close" aria-label="Close this version">close</button></div>' +
    (s.reason ? '<div class="tl-why">“' + esc(s.reason) + "”</div>" : "");
  let toggle = "";
  let body;
  if (s.body === null) {
    body = '<div class="foot">This version\'s words could not be read.</div>';
  } else {
    const canDiff = prev !== null && prev.body !== null;
    toggle = canDiff
      ? '<div class="tl-toggle" role="group">' +
          '<button type="button" class="seg' + (ui.whole ? "" : " on") + '" data-whole="0">What changed</button>' +
          '<button type="button" class="seg' + (ui.whole ? " on" : "") + '" data-whole="1">The whole version</button></div>'
      : "";
    if (!canDiff || ui.whole) {
      body = (prev === null ? '<div class="foot">The first page — nothing came before it.</div>' : "") +
        '<div class="sp-body">' + renderMarkdown(s.body) + "</div>";
    } else {
      const rows = diffText(prev.body, s.body);
      const st = diffStats(rows);
      body = '<div class="foot">Compared with version ' + (prev.seq - 1) + ": " +
        '<span class="d-add">' + st.added + " line" + (st.added === 1 ? "" : "s") + " added or changed</span>, " +
        '<span class="d-del">' + st.removed + " taken out or changed</span>.</div>" +
        renderDiff(rows);
    }
  }
  box.innerHTML = '<div class="card pad tl-detail">' + head + toggle + body + "</div>";
  box.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => {
    ui.whole = b.dataset.whole === "1";
    paintVersion();
  }));
  $("self-version-close").addEventListener("click", () => {
    ui.version = null;
    paintHistory();
  });
}

/** Unchanged runs longer than a few lines fold to one line saying so. */
function renderDiff(rows) {
  const out = [];
  let k = 0;
  while (k < rows.length) {
    if (rows[k].op === "=") {
      let e = k;
      while (e < rows.length && rows[e].op === "=") e++;
      const run = rows.slice(k, e);
      const keepHead = k === 0 ? 0 : 2, keepTail = e === rows.length ? 0 : 2;
      if (run.length > keepHead + keepTail + 1) {
        for (const r of run.slice(0, keepHead)) out.push(eqLine(r));
        out.push('<div class="d-fold">… ' + (run.length - keepHead - keepTail) + " unchanged lines …</div>");
        for (const r of run.slice(run.length - keepTail)) out.push(eqLine(r));
      } else {
        for (const r of run) out.push(eqLine(r));
      }
      k = e;
      continue;
    }
    const r = rows[k++];
    const cls = r.op === "+" ? "d-line add" : "d-line del";
    const sign = r.op === "+" ? "+" : "−";
    out.push('<div class="' + cls + '"><span class="d-sign" aria-hidden="true">' + sign + "</span><span>" +
      r.parts.map((p) => p.op === "=" ? esc(p.v) : p.op === "+" ? "<ins>" + esc(p.v) + "</ins>" : "<del>" + esc(p.v) + "</del>").join("") +
      "</span></div>");
  }
  return '<div class="diff">' + out.join("") + "</div>";
}

function eqLine(r) {
  return '<div class="d-line"><span class="d-sign" aria-hidden="true"> </span><span>' + (esc(r.text) || "&nbsp;") + "</span></div>";
}
