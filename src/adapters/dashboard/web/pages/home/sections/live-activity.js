/* Live activity — memory events only, in my own words (2026-09-26, an
   experiment): something remembered, a memory stronger, replaced or let go, a
   chapter, a handoff, the night's sleep, a reminder. Housekeeping lines go to
   the flow tab's feed (`web/lanes.ts` is the split). The one home panel the
   pulse owns: it is registered as a live feed that takes only home rows. */
import { $ } from "../../../shared/dom.js";
import { registerLiveFeed, renderFeed } from "../../../shared/widgets/feed.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

export const markup = `
        <h2 id="ov-feed-h">Live activity ${q("home-feed",
          "What happened to my memories, newest first: what I wrote down, what got stronger, what was replaced or let go, " +
          "chapters, handoffs, each night's sleep and reminders. The plumbing is on the flow tab. Click a line for the record behind it. " +
          "Records hold ids, counts and bytes, never a memory's words or a turn of yours; names are filled in as the page is drawn.")}</h2>
        <div class="card feed" id="ov-feed"></div>`;

export function mount() {
  registerLiveFeed("ov-feed", (e) => e.lane === "home");
  wireTips($("ov-feed-h"));
}

export function paint(d) {
  renderFeed($("ov-feed"), d.feed, d);
}

/** True while the feed still shows its absence line — nothing of the pulse's
 *  to lose by repainting it. */
export function showingAbsence() {
  const feedEl = $("ov-feed");
  return !!(feedEl && feedEl.querySelector(".empty"));
}
