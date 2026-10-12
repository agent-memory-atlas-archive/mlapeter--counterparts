### Decided by the group3c builder, 2026-10-11, lightly held (the dream queue)

- Decided by the group3c builder, 2026-10-11, lightly held: fragility is `1 − strength` on the next lived day
  (review 09 C3's second form), not the strength lost before the next night (its first). Why: on this curve the
  one-night loss falls with stability, which grows exponentially with salience and feeling, so a felt or
  salient memory ranked ~10x below a routine one and long-held valuable memories never got their turn. `1 −
  strength` keeps value in charge, rises as a valuable memory fades toward the edge of reach (it is rescued
  before it leaves), and still favours the weakly held. Value = salience on the curve (`curveSal`, the
  old-claims era applied) + how strongly felt + 0.4 dated + 0.3 on my mind; the old at-risk bonus and age term
  are gone (the curve is the clock).
- Decided by the group3c builder, 2026-10-11, lightly held: a fragility floor, `FRAGILITY_FLOOR` 0.1. Why:
  without it the most charged and most salient memories rank near zero every night while staying queued for
  months (far from falling below reach), and a queued memory is kept out of the look-back and the neighbours.
  At 0.1 a strongly felt memory ranks beside an ordinary one on its first night; the core (never below reach)
  waits for its turn the same way instead of being dropped from the queue.
- Decided by the group3c builder, 2026-10-11, lightly held: the queue starts where dreaming began, at the first
  standing dream's `FIRST_DREAM_DAYS` (7) look-back (today's, before any dream). Why: a store's life before it
  dreamed is not a backlog, and a store that turns dreaming on after months should not wake to all of it. On the
  owner's copy the first dream's look-back reaches lived day 1, so 10 undreamed memories from days 1–5 that are
  still within reach come back into the queue; the old window had aged them out.
- Decided by the group3c builder, 2026-10-11, lightly held: the per-prompt gate reads only `ASK_QUEUE_DAYS` (7)
  back and stops at `MIN_NEW`, as it did; the line, `begin` and the hand-back read the whole queue. Why: the gate
  runs on every prompt, and the undreamed rows below reach (which the full read must still look at to know they
  left) grow with intake until the prune takes them. Cost: an old leftover alone does not raise the ask.
- Decided by the group3c builder, 2026-10-11, lightly held: a refused fold's parts are carried by an event
  (`dream.carried`, the ids), not by editing the dream's `shown`. Why: the night's later changes, the
  reflection's "what the dream saw" and the owner's forget path (which redacts a journal that showed a memory)
  all read `shown`; the parts were seen, so taking them out of it would hide that. The queue reads the carry,
  oldest dream first: a carried id is queued again until a later dream shows it. Only parts a fold would fade
  are carried, and only two or more: an exempt-only fold is not re-offered night after night (#432's bullet 3).
- Decided by the group3c builder, 2026-10-11, lightly held: carried parts rank first the next night, as a group,
  ahead of the value × fragility ranking; general cluster selection (review 09 C4) is not built. Why: the dream
  already chose that fold, and the group is small (at most the parts of the refused folds); ranking a whole
  queue by clusters is a larger change and value × fragility already keeps a day's work of one salience close.
- Decided by the group3c builder, 2026-10-11, lightly held: `agedOut` keeps its name on the bundle and the
  `dream.begun` row and now counts the never-dreamed memories that fell below reach since the last dream (once:
  within reach at that dream, or born after it). `readCapped`, `agedOutAtLeast` and `windowDays` are gone from
  new rows (the read has no cap); the dashboard still reads them on old rows. `dream_shown_day` (v13,
  pre-provisioned) stays unwritten: the read is O(undreamed rows) without it, and a second source of truth would
  have to follow undo, resume, requeue and carry.
