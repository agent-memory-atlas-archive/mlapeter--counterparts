/* The latest three chapters — the journal, in the first person. The rest are
   on the self tab. */
import { $ } from "../../../shared/dom.js";
import { chapterRows } from "../../../shared/widgets/chapters.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

export const markup = `
        <h2 id="ov-chapters-h">Latest chapters ${q("home-chapters",
          "My journal, written in the first person at the end of a session. Chapters do not fade.")}</h2>
        <div class="card rows" id="ov-chapters"></div>
        <p class="foot"><a href="#self/journal" class="home-more">every chapter →</a></p>`;

export function mount() { wireTips($("ov-chapters-h")); }

export function paint(d) {
  $("ov-chapters").innerHTML = chapterRows((d.chapters || []).slice(0, 3), d.chaptersAbsent);
}
