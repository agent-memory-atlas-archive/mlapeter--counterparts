/* The memories tab: everything it holds — find it (search + ask), see it (two
   small pictures: how firmly it's held, and how it feels), read and manage it
   (every memory as a paged list, the page's buttons). `/api/memories` feeds the
   pictures; the list fetches its own page (`/api/memories/list`).

   LIVE. The pulse calls `refresh()` when the store moves. Everything is re-read
   and redrawn from `state.js`, so the chosen filters, sort and page (and any
   pinned `?`, kept by the shared tip widget) come back as they were; an open memory card lives in the overlay
   and is left alone; the scroll position is put back. */
import { api, fail } from "../../shared/api.js";
import { $ } from "../../shared/dom.js";
import * as feel from "./sections/feel.js";
import * as hold from "./sections/hold.js";
import * as list from "./sections/list.js";
import * as search from "./sections/search.js";
import * as tools from "./sections/tools.js";
import { setFilter } from "./state.js";

const markup = `
    <div class="mem-top">
      <p class="mem-count" id="mem-lede"></p>${tools.markup}
    </div>${tools.notePanel}${search.markup}
    <div class="glance2">${hold.markup}${feel.markup}
    </div>
    ${list.markup}
  `;

async function render() {
  let d;
  try { d = await api("/api/memories"); } catch (e) { return fail("The memories page", e); }
  const x = scrollX, y = scrollY;
  $("mem-lede").textContent = count(d);
  hold.paint(d);
  feel.paint(d);
  await list.render();
  if (scrollX !== x || scrollY !== y) scrollTo(x, y);
}

/** "145 memories" — the dashboard's one count (2026-09-26): every live row but
 *  the journal's, people and project cards included, the same number the
 *  list's "live" chip and the home page say. */
function count(d) {
  if (d.total === 0) return "Nothing held yet. Write a note, or just talk.";
  return d.total + (d.total === 1 ? " memory" : " memories");
}

export default {
  name: "memories",
  mount(section) {
    section.innerHTML = markup;
    hold.mount();
    feel.mount();
    list.mount();
    search.mount();
    tools.mount();
    // A note or a removal made on purpose: re-read now rather than on the next poll.
    addEventListener("counterparts:changed", () => { render(); });
  },
  render,
  /** The store moved (the pulse): re-read everything this page shows. */
  refresh: render,
  /** `#memories?state=archived` (or live/all): open the list at that filter.
   *  `#memories?feeling=joy` (the home tab's radar): the live memories carrying
   *  a feeling under that core, as a click on this tab's radar would show them. */
  route({ params }) {
    const state = params.get("state");
    const feeling = params.get("feeling");
    if (feeling) {
      setFilter({ state: "live", kind: null, core: false, journal: false, hold: null, feeling: null, feelingCore: feeling });
    } else if (["live", "archived", "all"].includes(state)) {
      setFilter({ state, kind: null, core: false, journal: false, hold: null, feeling: null, feelingCore: null });
    } else return;
    $("mlist-h").scrollIntoView({ block: "start" });
  },
};
