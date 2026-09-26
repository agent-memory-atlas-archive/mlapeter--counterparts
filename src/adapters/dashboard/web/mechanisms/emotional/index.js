/* Emotional modulation. `explainer` is what Counterparts actually does, checked against
   docs/research/mechanism-audit-2026-09-24.md and emotion part A (2026-09-26);
   `built` / `inDevelopment` are in plain words; `tagline` and `inDev` are the
   site's (regions.ts). Its light comes from `/api/mechanisms`. */
export default {
  id: "emotional",
  family: "encoding",
  name: "Emotional modulation",
  short: "Emotion",
  tagline: "The moments that mattered are the ones you keep. Feeling is the encoder’s thumb on the scale.",
  inDev: true,
  explainer: "The strongest feeling on a memory, yours or Claude’s, holds it higher and makes it fade more slowly. Memories that felt the way one of you feels now come to mind a little more easily.",
  built: [
    "A memory’s strongest recorded feeling, or its emotional score, lifts it and slows its fading.",
    "A recorded feeling softens faster than the memory itself.",
    "Memories that carried the feeling someone has now come up more easily — more for the same person, a little for the other.",
  ],
  inDevelopment: ["Nothing reads feeling from the words themselves: the feeling classifier stays off, so only recorded feelings count."],
};
