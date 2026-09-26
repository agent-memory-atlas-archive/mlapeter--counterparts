/* Every memory, with its words — newest first (or oldest), a page at a time.
   The server filters, sorts and pages (`/api/memories/list`), so a store of
   twenty thousand rows sends fifty. The kinds are chips in the filter row, each
   with its icon and count. Click a row to open the memory. */
import { absenceLine } from "../../../shared/absence.js";
import { api, fail } from "../../../shared/api.js";
import { $, esc } from "../../../shared/dom.js";
import { kindMark, kindOf } from "../../../shared/memory-marks.js";
import { memRow, wireRows } from "../row.js";
import { filters, onFilter, setFilter, toggle } from "../state.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

const PAGE = 50;

/** What each kind is, how fast it fades and how easily it is corrected — the
 *  words that used to be the six kind cards, now behind the `?`. */
const KIND_TIP = "Kinds: about me (who I am — fades slowly, hardest to argue out of) · people (fade slowly, hard to correct) · " +
  "things (fade fairly fast) · skills (fade slowest, easy to correct) · places (fade fairly fast, easy to correct) · " +
  "facts (fade fastest, easiest to correct). ★ core is what has become part of who I am; journal is the chapters I wrote, kept as written.";

export const markup = `
        <div class="mlist-head">
          <h2 id="mlist-h">Every memory <small id="mlist-sub"></small></h2>
          <div class="msort seggroup" id="msort" role="group" aria-label="order"></div>
        </div>
        <div class="mfilters" id="mfilters"></div>
        <div class="card mlist" id="mlist"></div>
        <div class="mpager" id="mpager"></div>`;

let seq = 0;

export function mount() {
  wireRows($("mlist"));
  $("mfilters").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    const f = b.dataset.f, v = b.dataset.v || null;
    if (f === "state") setFilter({ state: v });
    else if (f === "clear") setFilter({ kind: null, core: false, journal: false, hold: null, feeling: null, feelingCore: null });
    else if (f === "feeling") setFilter({ feeling: null, feelingCore: null });
    else toggle(f, v);
  });
  $("msort").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-sort]");
    if (b && b.dataset.sort !== filters.sort) setFilter({ sort: b.dataset.sort });
  });
  $("mpager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-off]");
    if (!b || b.disabled) return;
    setFilter({ offset: Number(b.dataset.off) });
    $("mlist-h").scrollIntoView({ block: "start", behavior: "smooth" });
  });
  onFilter(() => { render(); });
}

export async function render() {
  const mine = ++seq;
  const qs = new URLSearchParams({ state: filters.state, sort: filters.sort, offset: String(filters.offset), limit: String(PAGE) });
  if (filters.kind) qs.set("kind", filters.kind);
  if (filters.core) qs.set("core", "1");
  if (filters.journal) qs.set("journal", "1");
  if (filters.hold) qs.set("hold", filters.hold);
  if (filters.feeling) { qs.set("feeling", filters.feeling.word); qs.set("whose", filters.feeling.whose); }
  else if (filters.feelingCore) qs.set("feelingCore", filters.feelingCore);
  let d;
  try { d = await api("/api/memories/list?" + qs.toString()); }
  catch (e) { return fail("The memory list", e); }
  if (mine !== seq) return; // a newer filter already asked
  paintSort(d);
  paintFilters(d);
  paintRows(d);
  paintPager(d);
}

function paintSort(d) {
  $("msort").innerHTML = [["newest", "newest first"], ["oldest", "oldest first"]].map(([v, l]) =>
    '<button type="button" class="fchip' + (d.sort === v ? " on" : "") + '" data-sort="' + v + '" aria-pressed="' +
      (d.sort === v) + '">' + l + "</button>").join("");
}

function chip(f, v, inner, on, extraClass, title) {
  return '<button type="button" class="fchip' + (on ? " on" : "") + (extraClass ? " " + extraClass : "") +
    '" data-f="' + f + '"' + (v ? ' data-v="' + esc(v) + '"' : "") + ' aria-pressed="' + on + '"' +
    (title ? ' title="' + esc(title) + '"' : "") + ">" + inner + "</button>";
}
const count = (n) => ' <span class="fn">' + n + "</span>";

function paintFilters(d) {
  const c = d.counts;
  const state = [["live", c.live], ["archived", c.archived], ["all", c.live + c.archived]]
    .map(([v, n]) => chip("state", v, esc(v) + count(n), d.state === v, "seg")).join("");
  const kinds = Object.keys(c.kinds).map((k) => chip("kind", k, kindMark(k, false) + esc(kindOf(k).label) + count(c.kinds[k]),
    d.kind === k, "kchip" + (c.kinds[k] === 0 ? " zero" : ""))).join("");
  const special =
    chip("core", null, '<span class="star">★</span>core' + count(c.core), d.core, c.core === 0 ? "zero" : "", "in the core: part of who I am") +
    chip("journal", null, "journal" + count(c.journal), d.journal, c.journal === 0 ? "zero" : "", "journal chapters, kept as written");
  const any = d.kind || d.core || d.journal || d.hold || d.feeling || d.feelingCore;
  const feelingChip = d.feeling || d.feelingCore
    ? chip("feeling", null, "feeling: " + esc(d.feeling ? d.feeling.word + " · " + (d.feeling.whose === "owner" ? "yours" : "mine") : d.feelingCore) +
      ' <span class="fx" aria-hidden="true">✕</span>', true, "", "from “How it feels” — click to clear")
    : "";
  const holdChip = d.hold ? chip("hold", d.hold, '<span class="hdot ' + esc(d.hold) + '"></span>' + esc(d.hold) +
    count(c.hold[d.hold]), true, "", "from the bar above — click to show all again") : "";
  $("mfilters").innerHTML =
    '<div class="fgroup seggroup" role="group" aria-label="live or archived">' + state + "</div>" +
    '<div class="fgroup" role="group" aria-label="kind">' + kinds + special + holdChip + feelingChip +
      (any ? chip("clear", null, "show all", false, "clear") : "") + q("kinds", KIND_TIP) + "</div>";
  wireTips($("mfilters"));
}

function paintRows(d) {
  const from = d.total === 0 ? 0 : d.offset + 1;
  const to = Math.min(d.total, d.offset + d.rows.length);
  $("mlist-sub").textContent = d.total === 0 ? "— none match" : "— " + from + "–" + to + " of " + d.total;
  if (d.rows.length === 0) {
    const narrowed = d.kind || d.core || d.journal || d.hold || d.feeling || d.feelingCore;
    $("mlist").innerHTML = absenceLine(d.absent || "(none yet)",
      d.state === "archived" ? "nothing has been archived" + (narrowed ? " that matches these filters" : "")
        : "no memory matches these filters");
    return;
  }
  $("mlist").innerHTML = d.rows.map((r) => memRow(r)).join("");
}

function paintPager(d) {
  if (d.total <= d.limit) { $("mpager").innerHTML = ""; return; }
  const prev = Math.max(0, d.offset - d.limit);
  const next = d.offset + d.limit;
  const page = Math.floor(d.offset / d.limit) + 1;
  const pages = Math.ceil(d.total / d.limit);
  const [back, fwd] = d.sort === "oldest" ? ["← older", "newer →"] : ["← newer", "older →"];
  $("mpager").innerHTML =
    '<button type="button" class="mbtn" data-off="' + prev + '"' + (d.offset === 0 ? " disabled" : "") + ">" + back + "</button>" +
    '<span class="mpage">page ' + page + " of " + pages + "</span>" +
    '<button type="button" class="mbtn" data-off="' + next + '"' + (next >= d.total ? " disabled" : "") + ">" + fwd + "</button>";
}
