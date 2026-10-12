### Decided by the recall-miss builder, 2026-10-12, lightly held (the meaning floor stays; the docs say the limit)

- Decided by the recall-miss builder, 2026-10-12, lightly held: the 10-11 bundle miss
  ("small boat for paddling" found nothing for "The reviewer keeps a ochre kayak called
  Marrow at the lake house.") is the static model's limit, not a bug, and the potion
  in-line floor stays at 0.15. Why: the stored vector scores 0.148 against the question,
  just under the floor, and unrelated pairs in a 39-pair distractor check scored up to
  0.259 (4 of 39 at 0.15 or more), so 0.148 is inside the noise band. A lower floor buys
  this one hit and several false ones, and on a store with one memory any floor under the
  noise ceiling returns that memory for every question. Mean pooling dilutes the word that
  carries the meaning: "kayak" alone scores 0.348, "ochre kayak called Marrow" 0.176, the
  full sentence 0.148. The single-binary smoke's canary passes because it is short (0.288).
  Reproduced the same way from this checkout (bun and Node), the 0.3.19 binary and the
  plugin bundle with its model; the embedding, the identity and the floor lookup were all
  as intended. Both modes miss; the 10-11 run asked `cli recall` with no `--mode`, which is
  facts.
- Decided by the recall-miss builder, 2026-10-12, lightly held: a hand set of 13 pairs that
  share no word, at the 0.15 floor: 3 miss (cat 0.070, sister/Portland 0.118, the kayak
  sentence 0.148), 3 more barely pass (0.153 to 0.171), 7 pass clearly (0.217 to 0.513).
  The README and the plugin README now say so: close paraphrases yes, a description that
  never names the thing no, exact words strongest. Lexical expansion (or a larger model) is
  the follow-up to measure, not done here.
