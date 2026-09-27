/* The mechanism panel, under the hero — the site's Explorer, with this store in
   it. The pills are ONE small line that scrolls sideways (home round 3b,
   2026-09-27 — a try): each carries its stage as a small colour mark (the
   site's four colours; no headings), its light (from `/api/mechanisms`: fired
   lately, waiting, quiet, not built) and, when only some of it is built, a
   "partly built" tag.

   Picking one (here, or on the brain) shows it INLINE, the same three things
   for every mechanism, all about OUR memories:
     1. one big number (the light's `lead`, from the evidence line);
     2. those memories: a short list or a small picture, each opening its card
        (`mechanisms/<id>/panel.js`, fed by `/api/mechanism?id=`);
     3. one short line saying what the mechanism does (the module's `does`).
   Everything else — the site's line, the long explainer, the firing line,
   what is built and still in development, the last few firings and the link
   to the Field Guide — is behind one "how it works" fold, closed by default.

   The pick and the fold survive the page's four-second refresh: they live
   here, in module scope (the fold also in sessionStorage, for this tab's
   session), and a refresh repaints the lights and the picked panel's data
   under them. */
import { FAMILIES, MECHANISMS, PANELS, guideUrl } from "../../../mechanisms/index.js";
import { REGIONS, regionOf } from "../../../mechanisms/regions.js";
import { api, fail } from "../../../shared/api.js";
import { $, esc } from "../../../shared/dom.js";
import "../../../shared/memory-modal.js"; // window.openMemory, for the pictures' rows
import { renderFeed } from "../../../shared/widgets/feed.js";
import { LIGHT_WORD, light } from "../../../shared/widgets/light.js";
import { q, wireTips } from "../../../shared/widgets/tips.js";

const LEGEND =
  "The small colour mark is the stage a mechanism works in: " + FAMILIES.map((f) => f.label.toLowerCase()).join(", ") + ". " +
  "A green light fired in the last 7 lived days. A ring is waiting: its next run is ahead, or it has nothing to act on yet. " +
  "Amber is built but quiet. Grey is not built yet. \"Partly built\" means some of it works and some is still to come. " +
  "The line scrolls sideways.";

export const markup = `
    <section class="home-panel" id="mech-panel" aria-labelledby="mech-title">
      <div class="mech-top">
        <div class="mechs" id="mech-strip" role="group" aria-label="Memory mechanisms"></div>
        <span class="mech-legend">${q("home-lights", LEGEND)}</span>
      </div>
      <div class="mech-body" id="mech-body"></div>
    </section>`;

/** Wire the legend's `?` and the strip's arrow keys once the markup is in the page. */
export function mount() {
  wireTips($("mech-panel"));
  $("mech-strip").addEventListener("scroll", edges, { passive: true });
  addEventListener("resize", edges);
  $("mech-strip").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const pills = [...document.querySelectorAll("#mech-strip .mech-pill")];
    const at = pills.indexOf(document.activeElement);
    if (at < 0) return;
    const to = e.key === "Home" ? 0 : e.key === "End" ? pills.length - 1 : at + (e.key === "ArrowRight" ? 1 : -1);
    if (to < 0 || to >= pills.length) return;
    e.preventDefault();
    pills[to].focus();
  });
}

const ORDER = MECHANISMS.map((m) => m.id);
const byIdStatic = Object.fromEntries(MECHANISMS.map((m) => [m.id, m]));
const familyOf = (m) => FAMILIES.find((f) => f.key === m.family) || FAMILIES[0];
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

let brain = { select() {}, levels() {}, pulse() {} };
let lights = {}; // id → { status, evidence, events, lead }
let lastSeen = null; // id → newest backing seq, as of the previous paint
let selected = null;
let panelData = {}; // id → the /api/mechanism payload last read
let asked = 0;

// THE FOLD: closed by default, and once opened it stays open for this tab's
// session — across the pulse's repaint and across picks.
const HOW_KEY = "counterparts.home.how";
let howOpen = (() => {
  try { return sessionStorage.getItem(HOW_KEY) === "1"; } catch { return false; }
})();
function setHow(open) {
  howOpen = open;
  try { sessionStorage.setItem(HOW_KEY, open ? "1" : "0"); } catch { /* private window: module scope still holds it */ }
}

const lightOf = (id) => lights[id] || { status: "grey", build: "not", evidence: "", events: [], lead: null };
/** A pill's tag: only the partly built say so. Built needs no tag; grey is not built. */
const tagOf = (id) => lightOf(id).build === "partly" ? '<span class="mech-tag">partly built</span>' : "";

/** Hand the explorer the brain it drives (and that drives it). */
export function attachBrain(b) {
  brain = b;
  if (selected) pushSelectionToBrain();
}

/** A region was clicked on the brain: pick its first mechanism, or step to the
 *  next one if one of its mechanisms is already picked. */
export function pickRegion(key) {
  const region = REGIONS.find((r) => r.key === key);
  if (!region || region.mechanisms.length === 0) return;
  const at = region.mechanisms.indexOf(selected);
  select(region.mechanisms[at < 0 ? 0 : (at + 1) % region.mechanisms.length], true);
}

function pushSelectionToBrain() {
  const m = byIdStatic[selected];
  const region = regionOf(selected);
  if (!m || !region) return;
  brain.select(region.key, hexRgb(familyOf(m).color), m.short);
}

function paintStrip() {
  const strip = $("mech-strip");
  const keep = strip.scrollLeft;
  strip.innerHTML = MECHANISMS.map((m) => {
    const f = familyOf(m);
    return '<button type="button" class="mech-pill' + (m.id === selected ? " is-on" : "") +
      (lightOf(m.id).build === "not" ? " is-notbuilt" : "") + '" data-id="' + esc(m.id) + '" style="--pin:' + f.color + '"' +
      ' aria-pressed="' + (m.id === selected ? "true" : "false") + '" title="' + esc(m.name + " · " + f.label) + '">' +
      '<span class="mech-stage" role="img" aria-label="' + esc(f.label) + '"></span>' +
      light(lightOf(m.id).status) + esc(m.short) + tagOf(m.id) + "</button>";
  }).join("");
  strip.scrollLeft = keep;
  for (const el of strip.querySelectorAll(".mech-pill")) {
    el.addEventListener("click", () => select(el.dataset.id, false));
  }
  edges();
}

/** A soft fade on the side that has more pills past it, so the line reads as scrollable. */
function edges() {
  const strip = $("mech-strip");
  if (!strip) return;
  strip.classList.toggle("more-left", strip.scrollLeft > 2);
  strip.classList.toggle("more-right", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
}

/** Bring the picked pill inside the strip's own scroll, without moving the page. */
function revealPill(id) {
  const strip = $("mech-strip");
  const el = strip && strip.querySelector('.mech-pill[data-id="' + id + '"]');
  if (!el) return;
  const left = el.offsetLeft - strip.offsetLeft;
  const right = left + el.offsetWidth;
  if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 24);
  else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 24;
  edges();
}

const bullets = (xs) => xs.length === 0 ? "" : '<ul class="mech-list">' + xs.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>";

/** The big number: one number and a few words, from the light's `lead`. */
function leadHtml(l) {
  if (l.status === "grey" || !l.lead) return '<p class="mech-lead mech-lead-none">Not built yet.</p>';
  return '<p class="mech-lead"><span class="mech-n">' + esc(String(l.lead.n)) + '</span> <span class="mech-words">' + esc(l.lead.words) + "</span></p>";
}

/** The picked mechanism's panel. The words are the client module's; the light,
 *  the number, the picture and the activity are this store's. */
function paintBody() {
  const m = byIdStatic[selected];
  if (!m) return;
  const l = lightOf(m.id);
  const grey = l.status === "grey";
  const panel = PANELS[m.id];
  const data = panelData[m.id];
  $("mech-panel").style.setProperty("--reg", familyOf(m).color);
  let picture;
  if (grey) {
    picture = '<div class="mech-notbuilt">' + esc(l.evidence || "Not built yet.") + "</div>";
  } else if (!panel) {
    picture = "";
  } else if (data === undefined) {
    picture = '<p class="pic-none">reading this store…</p>';
  } else {
    picture = '<div class="mech-picture">' + panel.picture(data.picture) + "</div>";
  }
  $("mech-body").innerHTML =
    '<div class="mech-grid">' +
      '<div class="mech-main">' +
        '<h2 class="mech-name" id="mech-title">' + esc(m.name) + (l.build === "partly" ? ' <span class="mech-dev">partly built</span>' : "") + "</h2>" +
        leadHtml(l) +
        '<p class="mech-does">' + esc(m.does || "") + "</p>" +
      "</div>" +
      '<div class="mech-side">' + picture + "</div>" +
    "</div>" +
    '<details class="mech-how" id="mech-how"' + (howOpen ? " open" : "") + ">" +
      '<summary><span class="mech-how-l">how it works</span> <span class="mech-how-arrow" aria-hidden="true">↓</span></summary>' +
      '<div class="mech-how-body">' +
        '<p class="mech-quote">' + esc(m.tagline) + "</p>" +
        '<p class="mech-explainer">' + esc(m.explainer) + "</p>" +
        '<p class="mech-evidence">' + light(l.status) + " <b>" + esc(LIGHT_WORD[l.status] || "") + "</b> — " + esc(l.evidence) + "</p>" +
        '<div class="mech-foot">' +
          '<div><h3 class="mech-h">What’s built</h3>' + (bullets(m.built) || '<p class="pic-none">Nothing yet.</p>') + "</div>" +
          '<div><h3 class="mech-h">Still in development</h3>' + (bullets(m.inDevelopment) || '<p class="pic-none">Nothing outstanding for this one.</p>') + "</div>" +
        "</div>" +
        (grey ? "" : '<h3 class="mech-h">Lately</h3><div class="card feed mech-feed" id="mech-feed"></div>') +
        '<p class="mech-guide"><a href="' + esc(guideUrl(m.id)) + '" target="_blank" rel="noopener">see how it works on counterparts.ai →</a></p>' +
      "</div>" +
    "</details>";
  $("mech-how").addEventListener("toggle", (e) => setHow(e.currentTarget.open));
  if (!grey) {
    const feed = $("mech-feed");
    if (data === undefined) feed.innerHTML = '<p class="pic-none" style="padding:10px 14px">reading this store…</p>';
    else if (data.activity.length === 0) feed.innerHTML = '<p class="pic-none" style="padding:10px 14px">No firing of this one is on record yet.</p>';
    else renderFeed(feed, data.activity);
  }
  // A picture may carry its own `?` (the returns and used-rate lines); a
  // pinned one is drawn open again by `q`, so a refresh keeps it open.
  wireTips($("mech-body"));
}

async function loadPanel(id) {
  if (lightOf(id).status === "grey") return;
  const ticket = ++asked;
  let d;
  try { d = await api("/api/mechanism?id=" + encodeURIComponent(id)); } catch (e) { return fail("The " + id + " panel", e); }
  panelData[id] = d;
  if (ticket === asked && id === selected) paintBody();
}

/** Pick a mechanism. `fromBrain`: on a phone the panel sits below the brain,
 *  often off screen, so bring it into view or the tap looks like it did nothing. */
export function select(id, fromBrain) {
  if (!byIdStatic[id]) return;
  selected = id;
  for (const el of document.querySelectorAll("#mech-strip .mech-pill")) {
    const on = el.dataset.id === id;
    el.classList.toggle("is-on", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  }
  pushSelectionToBrain();
  revealPill(id);
  paintBody();
  loadPanel(id);
  if (fromBrain && matchMedia("(max-width: 900px)").matches) {
    const panel = $("mech-panel");
    if (panel && panel.getBoundingClientRect().top > innerHeight * 0.45) {
      panel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }
}

/** Lights in: repaint the strip, the brain's steady glow, and — for every
 *  mechanism whose newest backing row moved since the last paint — a flare on
 *  its region. The first paint flares each working region once, staggered. */
function paint(view) {
  lights = Object.fromEntries(view.mechanisms.map((l) => [l.id, l]));
  if (selected === null) {
    selected = ORDER.find((id) => lightOf(id).status === "green") || ORDER[0];
  }
  paintStrip();
  const levels = {};
  for (const r of REGIONS) {
    levels[r.key] = Math.max(0, ...r.mechanisms.map((id) => {
      const s = lightOf(id).status;
      return s === "green" ? 1 : s === "waiting" ? 0.45 : s === "amber" ? 0.25 : 0;
    }));
  }
  brain.levels(levels);
  const newest = Object.fromEntries(view.mechanisms.map((l) => [l.id, l.events[0] ?? null]));
  if (lastSeen === null) {
    let k = 0;
    for (const r of REGIONS) {
      if (levels[r.key] === 1) setTimeout(() => brain.pulse(r.key), 400 + 450 * k++);
    }
  } else {
    for (const id of ORDER) {
      if (newest[id] !== null && newest[id] !== lastSeen[id]) {
        const r = regionOf(id);
        if (r) brain.pulse(r.key);
      }
    }
  }
  lastSeen = newest;
  pushSelectionToBrain();
}

export async function render() {
  let view;
  try { view = await api("/api/mechanisms"); } catch (e) { return fail("The mechanisms", e); }
  paint(view);
  revealPill(selected);
  paintBody();
  await loadPanel(selected);
}

/** The store moved: new lights, and the picked panel's data read again (the
 *  others are dropped, so picking one later reads it fresh). */
export async function refresh() {
  let view;
  try { view = await api("/api/mechanisms"); } catch (e) { return; }
  paint(view);
  const keep = panelData[selected];
  panelData = keep === undefined ? {} : { [selected]: keep };
  await loadPanel(selected);
}
