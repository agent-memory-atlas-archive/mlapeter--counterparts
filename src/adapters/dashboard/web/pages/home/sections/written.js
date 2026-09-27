/* "Written vs came back", under the tiles (2026-09-27, home round 3 — a try,
   not a rule). One small column per lived day: memories written that day
   above the line, older memories that came back that day below it — bright
   when they came back in conversation, dim when a dream replayed them. The
   upgrade's carried-over history is not shown: nobody saw it happen. One line
   under it says today in words; the rest is behind the `?`.

   Data: `/api/overview`'s `written` (`views/written-returned.ts`). */
import { $, esc } from "../../../shared/dom.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

export const markup = `<div class="home-wr" id="home-wr"></div>`;

const H = 30; // px above the line, and below it
const W = 10; // one day's slot in the viewBox

function tip(since) {
  return "Each column is one lived day. Up: memories written that day. Down: older memories that came back that day — " +
    "bright when they came back in conversation, dim when a dream replayed them. Only coming back in conversation counts toward the core." +
    (since === null ? "" : " Returns only began to be recorded at the upgrade on lived day " + since + ", so earlier days show none.");
}

function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

/** A column's words, for its hover title. */
function titleOf(d, since) {
  const parts = [plural(d.written, "memory written", "memories written")];
  if (since !== null && d.day < since) parts.push("returns not recorded yet");
  else {
    parts.push(d.awake + " came back");
    if (d.dream > 0) parts.push(d.dream + " replayed in a dream");
  }
  return "day " + d.day + ": " + parts.join(", ");
}

function chart(v) {
  const days = v.days;
  const peak = Math.max(1, ...days.map((d) => Math.max(d.written, d.awake + d.dream)));
  const h = (n) => (n <= 0 ? 0 : Math.max(1.5, (n / peak) * (H - 2)));
  const cols = days.map((d, i) => {
    const x = i * W + 2;
    const w = W - 4;
    const before = v.since !== null && d.day < v.since;
    const up = h(d.written);
    const aw = h(d.awake);
    const dr = h(d.dream);
    return "<g><title>" + esc(titleOf(d, v.since)) + "</title>" +
      '<rect class="wr-hit" x="' + (i * W) + '" y="0" width="' + W + '" height="' + (2 * H) + '"/>' +
      (up > 0 ? '<rect class="wr-w" x="' + x + '" y="' + (H - up) + '" width="' + w + '" height="' + up + '" rx="1"/>' : "") +
      (before ? '<rect class="wr-none" x="' + x + '" y="' + (H + 1) + '" width="' + w + '" height="1.5"/>' : "") +
      (aw > 0 ? '<rect class="wr-a" x="' + x + '" y="' + (H + 1) + '" width="' + w + '" height="' + aw + '" rx="1"/>' : "") +
      (dr > 0 ? '<rect class="wr-d" x="' + x + '" y="' + (H + 1 + aw) + '" width="' + w + '" height="' + dr + '" rx="1"/>' : "") +
      "</g>";
  }).join("");
  const width = days.length * W;
  return '<svg class="wr-svg" viewBox="0 0 ' + width + " " + (2 * H + 2) + '" preserveAspectRatio="none" role="img" aria-label="Memories written and memories that came back, per lived day">' +
    '<line class="wr-axis" x1="0" x2="' + width + '" y1="' + (H + 0.5) + '" y2="' + (H + 0.5) + '"/>' + cols + "</svg>";
}

export function paint(d) {
  const v = d.written;
  const el = $("home-wr");
  if (!v || !v.today || v.days.length === 0) { el.innerHTML = ""; return; }
  const t = v.today;
  const words = "Today: " + t.written + " written, " + t.awake + " came back" +
    (t.dream > 0 ? ", " + t.dream + " replayed in a dream" : "") + ".";
  const first = v.days[0].day;
  el.innerHTML =
    '<div class="wr-head"><span class="wr-key"><i class="wr-sw wr-sw-w"></i>written</span>' +
      '<span class="wr-key"><i class="wr-sw wr-sw-a"></i>came back</span>' +
      '<span class="wr-key"><i class="wr-sw wr-sw-d"></i>in a dream</span>' + q("home-written", tip(v.since)) + "</div>" +
    chart(v) +
    '<div class="wr-foot"><span>day ' + first + "</span><span>today</span></div>" +
    '<p class="wr-line">' + esc(words) + "</p>";
  wireTips(el);
}
