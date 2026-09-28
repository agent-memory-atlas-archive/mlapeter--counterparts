/* "How it feels" on the home tab (round 4, 2026-09-28): the memories tab's
   feelings radar, the same component (`../../memories/sections/feel.js`'s
   `radarSvg`) drawn from the same numbers. Hover an axis for the feelings
   under it; click or tap one to open the memories tab filtered to it.

   Data: `/api/overview`'s `feelings` (`views/memories.ts#feelingsView`). */
import { $ } from "../../../shared/dom.js";
import { hoverWords, radarLegend, radarSvg } from "../../memories/sections/feel.js";
import { go } from "../go.js";

export const markup = `
        <section class="home-card" aria-labelledby="home-feel-h">
          <h2 id="home-feel-h">How it feels</h2>
          <div class="card pad feel home-feel" id="home-feel"></div>
        </section>`;

let data = null;

export function mount() {
  const el = $("home-feel");
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-core]");
    if (a) go("memories?feeling=" + encodeURIComponent(a.dataset.core));
  });
  el.addEventListener("keydown", (e) => {
    const a = e.target.closest("g[data-core]");
    if (a && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go("memories?feeling=" + encodeURIComponent(a.dataset.core)); }
  });
  hoverWords(el, () => data);
}

export function paint(d) {
  data = d.feelings;
  $("home-feel").innerHTML = data.carrying === 0
    ? '<p class="glance-empty">No feelings recorded yet. When a memory is kept with how it felt — yours or mine — it shows here.</p>'
    : '<div class="feel-row">' + radarSvg(data, null) + '<div class="feel-side">' + radarLegend + "</div></div>";
}
