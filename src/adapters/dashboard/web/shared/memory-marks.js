/* The small marks a memory carries wherever it is shown — its kind (an icon and
   a colour), its feelings (coloured dots) and its special cases (★ core, a lock for
   protected, "journal"). The memories tab's rows and the memory card both draw
   from here, so a kind looks the same in a chip, a row and a card.
   (2026-09-26: an experiment — change freely.) */
import { esc } from "./dom.js";

const svg = (paths) =>
  '<svg class="kic" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + paths + "</svg>";

/** Each kind: the words, a colour, and a 16px line icon drawn in currentColor. */
export const KINDS = {
  self: { label: "about myself", colour: "#b388ff",
    icon: svg('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.8" class="f"/>') },
  person: { label: "people", colour: "#ffb74d",
    icon: svg('<circle cx="8" cy="5.2" r="2.6"/><path d="M3 14c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6"/>') },
  entity: { label: "things", colour: "#4dd9ec",
    icon: svg('<path d="M8 2 13.5 5v6L8 14 2.5 11V5z"/><path d="M2.5 5 8 8l5.5-3M8 8v6"/>') },
  skill: { label: "skills", colour: "#26c6a6",
    icon: svg('<path d="M9.2 1.8 3.8 9h4l-1 5.2L12.2 7h-4z"/>') },
  place: { label: "places", colour: "#9ccc65",
    icon: svg('<path d="M8 14.3s4.6-4.3 4.6-7.8a4.6 4.6 0 1 0-9.2 0c0 3.5 4.6 7.8 4.6 7.8z"/><circle cx="8" cy="6.4" r="1.6"/>') },
  fact: { label: "facts", colour: "#82b1ff",
    icon: svg('<rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/>') },
};

export function kindOf(kind) {
  return KINDS[kind] || { label: String(kind || "?"), colour: "#8a95a3", icon: svg('<circle cx="8" cy="8" r="4"/>') };
}

/** The kind's icon in its colour, optionally with its word. */
export function kindMark(kind, withLabel) {
  const k = kindOf(kind);
  return '<span class="kmark" style="color:' + k.colour + '">' + k.icon + "</span>" +
    (withLabel ? '<span class="klabel">' + esc(k.label) + "</span>" : "");
}

/** The six cores of the feelings wheel (`core/feelings-wheel.ts`), each a colour. */
export const FEELING_COLOURS = {
  happy: "#ffd740", sad: "#64b5f6", fear: "#ffa45c", anger: "#ff6b6b", surprise: "#d59cf0", disgust: "#8bd17c",
};

/** One dot per feeling, its word on hover. Empty string when there are none. */
export function feelingDots(feelings) {
  if (!feelings || feelings.length === 0) return "";
  const words = feelings.map((f) => f.word).join(", ");
  return '<span class="fdots" title="' + esc("felt: " + words) + '" aria-label="' + esc("felt: " + words) + '">' +
    feelings.map((f) => '<i style="background:' + (FEELING_COLOURS[f.core] || "#8a95a3") + '"></i>').join("") + "</span>";
}

/** The special cases only: ★ core, a lock for protected, journal. */
export function badges(r) {
  return (r.core ? '<span class="mbadge core" title="in the core: part of who I am">★ core</span>' : "") +
    (r.protected ? '<span class="mbadge lock" title="protected: nothing can revise it">' + LOCK + "</span>" : "") +
    (r.journal ? '<span class="mbadge journal" title="a journal chapter, kept as written — not scored">journal</span>' : "");
}

const LOCK = '<svg class="kic" viewBox="0 0 16 16" aria-label="protected"><rect x="3.5" y="7" width="9" height="7" rx="1.3"/>' +
  '<path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
