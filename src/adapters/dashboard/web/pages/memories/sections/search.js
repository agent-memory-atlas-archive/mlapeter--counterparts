/* Find a memory: search by its words (live, as you type) and ask a question
   (the console's own `counterparts ask`, through the actions seam). Both lists
   use the list's row shape and open the memory on click; Ask's answers are
   bright when they came clearly to mind and dim when they are a faint lead. */
import { absenceLine } from "../../../shared/absence.js";
import { act, resultHtml } from "../../../shared/actions.js";
import { api, fail } from "../../../shared/api.js";
import { $, esc } from "../../../shared/dom.js";
import { memRow, wireRows } from "../row.js";

export const markup = `
    <div class="find">
      <div class="find-col">
        <label class="find-lab" for="q">Search by words</label>
        <div class="find-row">
          <input id="q" type="search" autocomplete="off" spellcheck="false"
            placeholder="a word the memory would use…">
          <span id="qn"></span>
        </div>
        <div class="card mlist" id="qout" hidden></div>
      </div>
      <div class="find-col">
        <label class="find-lab" for="ask-q">Ask your memory a question</label>
        <div class="find-row">
          <input id="ask-q" type="text" autocomplete="off" spellcheck="false"
            placeholder="what do I know about…?">
          <button class="mbtn primary" id="ask-go" type="button">Ask</button>
        </div>
        <div id="ask-out"></div>
      </div>
    </div>`;

let qtimer = null;
export function mount() {
  wireRows($("qout"));
  wireRows($("ask-out"));
  $("q").addEventListener("input", () => {
    clearTimeout(qtimer);
    qtimer = setTimeout(runSearch, 180);
  });
  $("ask-go").addEventListener("click", ask);
  $("ask-q").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
}

async function runSearch() {
  const q = $("q").value.trim();
  const out = $("qout");
  if (q.length === 0) { out.hidden = true; $("qn").textContent = ""; return; }
  let d;
  try { d = await api("/api/search?limit=25&q=" + encodeURIComponent(q)); }
  catch (e) { return fail("Search", e); }
  out.hidden = false;
  $("qn").textContent = d.hits.length + (d.hits.length === 1 ? " match" : " matches");
  out.innerHTML = d.absent
    ? absenceLine(d.absent, "nothing I hold matches those words")
    : d.hits.map((h) => memRow({ ...h, text: h.shown, archived: null })).join("");
}

/** The tiers `ask` sorts answers into, in the words a person would use, and
 *  the brightness each is drawn at. */
const TIER = { vivid: "came clearly to mind", quiet: "came quietly", dim: "a faint lead" };
const TIER_LIT = { vivid: 5, quiet: 3, dim: 1 };

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
  const q = $("ask-q").value.trim();
  const out = $("ask-out");
  if (!q) return;
  $("ask-go").disabled = true;
  out.innerHTML = '<div class="act-out">thinking…</div>';
  const r = await act("ask", { question: q, json: true });
  $("ask-go").disabled = false;
  let result = null;
  if (r && r.ok && Array.isArray(r.out)) {
    try { result = JSON.parse(r.out.join("\n")); } catch (e) { result = null; }
  }
  if (!result) { out.innerHTML = resultHtml(r); return; }
  const mems = Array.isArray(result.memories) ? result.memories : [];
  if (mems.length === 0) {
    out.innerHTML = '<div class="empty"><b>Nothing came back.</b> ' +
      (result.considered === 0
        ? "Nothing I hold shared a word with the question."
        : esc(String(result.considered)) + " memories were weighed and none was close enough.") +
      " Try the words the memory itself would use.</div>";
    return;
  }
  out.innerHTML = '<div class="ask-head">What came to mind — ' + mems.length +
    (mems.length === 1 ? " memory" : " memories") + ", best first</div>" +
    '<div class="card mlist ask-list">' + mems.map((m) => {
      const w = answerWords(m.body);
      return memRow({
        id: m.id, title: m.title, text: w.text, confidential: false, kind: m.kind, strength: m.strength,
        date: w.date, dateFrom: w.date ? "text" : null, journal: !!m.journal, feelings: [], archived: null,
      }, { lit: TIER_LIT[m.tier] || 3, tier: TIER[m.tier] || m.tier });
    }).join("") + "</div>";
}
