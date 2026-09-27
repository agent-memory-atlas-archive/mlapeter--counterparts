/* The hero: one short headline, four small tiles and, under them, "written vs
   came back" (`written.js`) on the left; the brain on the right
   (`../brain.js`). The brain is mounted once; the words are repainted
   whenever the store moves. */
import { $ } from "../../../shared/dom.js";
import * as tiles from "./tiles.js";
import * as written from "./written.js";

export const markup = `
    <section class="home-hero" aria-label="This memory, today">
      <div class="home-copy">
        <p class="home-eyebrow">This memory, today</p>
        <p class="home-headline" id="home-headline"></p>
        ${tiles.markup}
        ${written.markup}
      </div>
      <div class="home-brain" id="home-brain"></div>
    </section>`;

export function mount() { tiles.mount(); }

/** "Day 30 · 145 memories · 8 of 11 built · 6 active this week": each part is
 *  its own span, so a narrow screen breaks between parts, never inside one. */
export function paint(d) {
  const el = $("home-headline");
  const parts = d.hero.headline.split(" · ");
  const nodes = [];
  parts.forEach((part, i) => {
    if (i > 0) nodes.push(document.createTextNode(" "));
    const s = document.createElement("span");
    s.className = "hh-part";
    s.textContent = part + (i < parts.length - 1 ? " ·" : "");
    nodes.push(s);
  });
  el.replaceChildren(...nodes);
  tiles.paint(d);
  written.paint(d);
}
