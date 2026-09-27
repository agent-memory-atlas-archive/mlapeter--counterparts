/* The four small tiles under the home page's headline (`/api/overview`'s
   `hero.counts`, 2026-09-26, an experiment): memories, core, chapters,
   replaced. Each number is a link to where it is shown in full (a hash route:
   `shell/tabs.js#parseRoute`); the words that explain it sit behind its `?`. */
import { $, esc } from "../../../shared/dom.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

const GOES_TO = {
  "memories": "memories?state=live",
  "core": "self/settling",
  "chapters": "self/journal",
  "replaced": "memories?state=archived",
};

const TIPS = {
  memories: "Everything I hold right now: memories, and the cards for the people and projects I know. The journal's chapters are counted apart.",
  core: "Core memories don't fade. A memory gets there by being used on separate days with a high enough score. \"Closest\" is the one nearest to making it.",
  chapters: "My journal, written in the first person at the end of a session. Chapters don't fade.",
  replaced: "Older readings replaced by newer ones — nothing forgotten; the old version is kept. \"Let go\" is different: memories that faded until they were set aside.",
};

export const markup = `<div class="home-counts" id="ov-tiles"></div>`;

/** Filled pips for the closest candidate's days: a small picture of "1 of 3". */
function pips(p) {
  if (!p || !p.of) return "";
  let out = '<span class="ht-pips" aria-hidden="true">';
  for (let i = 0; i < p.of; i++) out += '<span class="ht-pip' + (i < p.days ? " on" : "") + '"></span>';
  return out + "</span>";
}

export function paint(d) {
  $("ov-tiles").innerHTML = d.hero.counts.map((t) => {
    const to = GOES_TO[t.key];
    const note = t.note ? '<div class="s">' + pips(t.progress) + esc(t.note) + "</div>" : "";
    return '<div class="tile ht ht-' + esc(t.key) + (t.absent ? " quiet" : "") + '">' +
      '<a class="ht-link" href="#' + esc(to) + '">' +
        '<span class="n">' + esc(t.value) + "</span>" +
        '<span class="l">' + esc(t.label) + "</span>" +
      "</a>" + q("home-tile-" + t.key, TIPS[t.key] || "") + note + "</div>";
  }).join("");
  wireTips($("ov-tiles"));
}

/** A link changes the hash and the nav follows it (`shell/tabs.js`). A second
 *  click on the same tile changes nothing, so it re-announces the hash itself. */
export function mount() {
  $("ov-tiles").addEventListener("click", (e) => {
    const a = e.target.closest("a.ht-link");
    if (!a || location.hash !== a.getAttribute("href")) return;
    e.preventDefault();
    dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

/** One home count's number, READ OFF THE PAGE rather than out of a variable:
 *  the flow diagram's counters were proved live while the tiles beside them
 *  were not, and a harness that asked the payload would have believed a page
 *  that never repainted. (`tools/visual-loop` calls this.) */
window.tileValue = (label) => {
  for (const tile of document.querySelectorAll("#ov-tiles .tile")) {
    const l = tile.querySelector(".l");
    if (l && l.textContent === label) {
      const n = tile.querySelector(".n");
      return n ? n.textContent : "";
    }
  }
  return "";
};
