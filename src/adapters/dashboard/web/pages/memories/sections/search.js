/* Find a memory: ONE box (round 4, 2026-09-28). Typing finds memories by their
   words, live (`/api/search`); Enter asks by meaning (the console's own
   `counterparts ask`, through the actions seam). Either way the answers take
   the list's place — never a second list — and the "×" gives the list back.
   How close an answer came is said plainly: strong match, match, weak match.
   Ask is the owner talking to me, so the server turns the question into my
   voice before it searches (`web/ask-voice.ts`); that is not shown. */
import { absenceLine } from "../../../shared/absence.js";
import { act, resultHtml } from "../../../shared/actions.js";
import { api, fail } from "../../../shared/api.js";
import { $, esc } from "../../../shared/dom.js";
import { foldChapters, fromWords } from "../fold.js";
import { memRow } from "../row.js";
import { find, onFilter, setFilter } from "../state.js";

export const markup = `
        <div class="find">
          <label class="find-lab" for="q">Find a memory</label>
          <div class="find-row">
            <input id="q" type="search" autocomplete="off" spellcheck="false"
              placeholder="a word, or ask a question and press Enter">
            <button class="find-x" id="q-x" type="button" aria-label="clear, and show every memory" title="clear" hidden>×</button>
          </div>
          <div class="find-head" id="find-head" hidden></div>
        </div>`;

let qtimer = null;
let seq = 0;

export function mount() {
  const box = $("q");
  box.addEventListener("input", () => {
    clearTimeout(qtimer);
    $("q-x").hidden = box.value.length === 0;
    qtimer = setTimeout(runSearch, 180);
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(qtimer); ask(); }
    else if (e.key === "Escape" && box.value) { e.preventDefault(); clear(); }
  });
  $("q-x").addEventListener("click", () => { clear(); box.focus(); });
  // A filter chosen anywhere else (a chip, the chart, a link from Home) ends
  // the find: the box empties so it never shows words the list isn't answering.
  onFilter(() => {
    if (find.on || !box.value) return;
    seq++;
    box.value = "";
    $("q-x").hidden = true;
    $("find-head").hidden = true;
  });
}

/** Give the list back: the box emptied, the list redrawn as it was. */
function clear() {
  seq++; // an answer still on its way is dropped
  $("q").value = "";
  $("q-x").hidden = true;
  $("find-head").hidden = true;
  setFilter({});
}

/** The list's own parts hide while the answers stand in its place. */
function takeList(head) {
  find.on = true;
  $("mfilters").hidden = true;
  $("msort").hidden = true;
  $("mpager").innerHTML = "";
  $("find-head").hidden = false;
  $("find-head").innerHTML = head;
}

/** How many matched, said honestly: "the closest 25 of 143 matches" when the list
 *  stops short of every match, "3 matches" when it is all of them. */
export function matchCount(shown, total) {
  const all = typeof total === "number" && total > shown ? total : shown;
  if (all > shown) return "the closest " + shown + " of " + all + " matches";
  return shown + (shown === 1 ? " match" : " matches");
}

async function runSearch() {
  const q = $("q").value.trim();
  if (q.length === 0) { if (find.on) clear(); return; }
  const mine = ++seq;
  let d;
  try { d = await api("/api/search?limit=25&q=" + encodeURIComponent(q)); }
  catch (e) { return fail("Search", e); }
  if (mine !== seq || $("q").value.trim() !== q) return;
  takeList(esc(matchCount(d.hits.length, d.total)) + ' <span class="find-hint">· press Enter to ask by meaning instead</span>');
  $("mlist").innerHTML = d.absent
    ? absenceLine(d.absent, "nothing I hold uses those words — press Enter to ask by meaning")
    : d.hits.map((h) => memRow({ ...h, text: h.shown, archived: null })).join("");
}

/** The tiers `ask` sorts answers into, in plain words. */
export const TIER = { vivid: "strong match", quiet: "match", dim: "weak match" };

/** An answer's words as a row shows them: headings dropped, a date written at
 *  the front lifted off (display only — the memory is untouched). */
export function answerWords(body) {
  const flat = String(body || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).join(" ");
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ \t]*[:,—–-][ \t]*|[ \t]+)(?=\S)/.exec(flat);
  let rest = m ? flat.slice(m[0].length) : flat;
  if (m) rest = rest.charAt(0).toUpperCase() + rest.slice(1);
  return { date: m ? m[1] : null, text: rest.length > 320 ? rest.slice(0, 319) + "…" : rest };
}

async function ask() {
  const q = $("q").value.trim();
  if (!q) return;
  const mine = ++seq;
  takeList("thinking…");
  $("mlist").innerHTML = "";
  const r = await act("ask", { question: q, json: true });
  if (mine !== seq) return;
  let result = null;
  if (r && r.ok && Array.isArray(r.out)) {
    try { result = JSON.parse(r.out.join("\n")); } catch (e) { result = null; }
  }
  if (!result) { takeList("I couldn't ask that"); $("mlist").innerHTML = resultHtml(r); return; }
  const raw = Array.isArray(result.memories) ? result.memories : [];
  // A chapter and the memory drawn from it are one answer (`fold.js`). The
  // links are a read; without them the answers show as they came.
  let links = {};
  if (raw.length > 0) {
    try { links = (await api("/api/chapters?ids=" + encodeURIComponent(raw.map((m) => m.id).join(",")))).links || {}; }
    catch (e) { links = {}; }
  }
  if (mine !== seq) return;
  const mems = foldChapters(raw, links);
  if (mems.length === 0) {
    takeList("nothing came to mind");
    $("mlist").innerHTML = '<div class="empty">' +
      (result.considered === 0
        ? "Nothing I hold shared a word with the question."
        : esc(String(result.considered)) + " memories were weighed and none was close enough.") +
      " Try the words the memory itself would use.</div>";
    return;
  }
  takeList(mems.length + (mems.length === 1 ? " memory came to mind" : " memories came to mind") + ", best match first");
  $("mlist").innerHTML = mems.map((m) => {
    const w = answerWords(m.body);
    return memRow({
      id: m.id, title: m.title, text: w.text, confidential: false, kind: m.kind,
      date: w.date, dateFrom: w.date ? "text" : null, journal: false, core: false, feelings: [], archived: null,
    }, {
      tier: TIER[m.tier] || m.tier,
      from: m.from ? { id: m.from.episodeId, words: fromWords(m.from) } : null,
    });
  }).join("");
}
