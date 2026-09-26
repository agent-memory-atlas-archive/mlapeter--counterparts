/* Prospective memory. `explainer` is what Counterparts actually does, checked against
   docs/research/mechanism-audit-2026-09-24.md; `built` / `inDevelopment` are the
   audit plus #215/#218/#220, in plain words; `tagline` and `inDev` are the
   site's (regions.ts). Its light comes from `/api/mechanisms`. */
export default {
  id: "prospective",
  family: "retrieval",
  name: "Prospective memory",
  short: "Prospective",
  tagline: "Remembering to do something later — the memory that fires itself at the right moment.",
  inDev: true,
  explainer: "A memory can carry a date — a day, a month or a range like late October — and it comes back around then. Most come back quietly, as a footnote; one marked plain is said outright on its day.",
  built: [
    "A note or a session's memories can be given a date, and quiet ones come back as footnotes at most twice per date.",
    "A reminder marked plain is said to you on its day, once.",
  ],
  inDevelopment: ["Quiet reminders come back only for memories held strongly enough, and nothing yet notices when you have already dealt with one."],
};
