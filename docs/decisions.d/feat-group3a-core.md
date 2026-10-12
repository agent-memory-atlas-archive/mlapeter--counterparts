### Decided by the group3a builder, 2026-10-11, lightly held (the core: recurrence lane, identity, being reconsidered)

- Decided by the group3a builder, 2026-10-11, lightly held: a memory's SLOT is the memory plus the live
  memories a standing "A over B" ties it to: a settled `changed` pair (a write's `updates`, a settle, a dream
  merge, and folds once part B writes them through `supersede`) or a slot proposal still waiting. It is walked
  along the chain, at most 12 members. `open` pairs (two different things) and `corrected` pairs (the earlier
  was wrong, not said again) are not slots. Why: Group 2 shipped pairs, not slot ids, and these pairs are the
  ones that say "the same thing, later". Embedding neighbours were the other option, but the slot detector
  already turned cosine into pairs, with a dream confirming them.
- Decided by the group3a builder, 2026-10-11, lightly held: a RE-ENCODING is read off the slot's rows. It is
  the birth day of each member other than the slot's first-written, when a session wrote it (a dream's or a
  reflection's writing is not one), and its session is the member's `origin_session`. No `reencoded` row is
  written to `returns`. Why: the count needs no write path, a withdrawn proposal or an undone settle takes its
  days with it automatically, and the existing history counts on the first night. So `returns.source =
  'reencoded'` stays unused. No store-format change was needed: v13 already has `returns.session`.
- Decided by the group3a builder, 2026-10-11, lightly held: `returns.session` is written from now on: the recall
  session for an awake or engaged use, and the reflection's id for a reflection's citation. A day whose
  evidence names no session (every return before this build, and a direct store credit) counts as ONE session
  of its own. Why: every existing row is NULL. Reading NULL as "no session" would hold the lane shut for weeks;
  reading it as one session per day is the most it can honestly mean.
- Decided by the group3a builder, 2026-10-11, lightly held: "the row itself has ≥1 engaged return" (08 C1)
  reads as "the row has a real use of its own": an awake, reflection or engaged return. An engaged-only day
  counts `ENGAGED_RECURRENCE_WEIGHT` (0.5) of a day, and at least one day must be a full one ("half, never
  alone"). Why: an `engaged`-source anchor alone would shut out every row whose only uses were referenced ones.
- Decided by the group3a builder, 2026-10-11, lightly held: a memory a later member of its slot settled over
  (`changed`) does not cross by the slow lane. The slot's recurrence lifts its CURRENT state. Why: otherwise
  an outdated state ("I preferred X") could become core on the strength of its successor's use. The fast lane
  is unchanged.
- Decided by the group3a builder, 2026-10-11, lightly held: identity means about ∈ {me, us}, kind ∈ {self,
  person, entity}, status not planned/proposed/asked (08 C2), and the recognition door (an unmarked memory
  with a strong recognition feeling) is held to the same kinds and the same "not a plan". `CORE_ABOUT_MARKS`
  keeps `owner`, because it still means PERSONAL (what a merge inherits, what a dream may not self-mark, the
  elsewhere line's gate). The core reads the new `IDENTITY_ABOUT_MARKS`. Why: changing the shared constant
  would have moved four unrelated behaviours.
- Decided by the group3a builder, 2026-10-11, lightly held: BEING RECONSIDERED is a `core_events` row
  (`reconsidering`, reason `not-about-me-or-us` | `not-a-core-kind` | `a-plan` | `no-recurrence`). A decision
  writes `reaffirmed` (keep, with the why, actor owner/self/reflection) or `demoted` (retire). Consolidation
  lifts a flag itself (`reaffirmed`, actor `sleep`, reason `cause-gone`) when the memory is about me or us
  again, or has recurred since the flag. A memory someone chose to keep is not flagged again for what it is,
  only for going quiet after the keep. Quiet is counted from the latest of its last recurrence day, its
  promotion or keep, and its band day. Why: item 14 (no automatic demotion), and a flag that outlived its
  cause would ask for a decision that was already made.
- Decided by the group3a builder, 2026-10-11, lightly held: a flagged member moves from "Who I am" to "Still
  open" in the wake, labelled "Core, being reconsidered — keep or retire it (remember core) [id]". Only one
  shows at a time, at the top of the list (`RECONSIDERING_MAX` 1). The rest are counted with "more still
  open". Why: the owner already has about 40 open threads and the lane shows 5. Five flags at once would have
  pushed every open question out. My doors are
  `remember`'s `core: {id, decision: keep|retire, why}` (any core memory, with a why) and a reflection's
  `core` part (any core memory it was shown, at most 5). Flagged members are handed to the reflection. The
  owner's are `counterparts core --demote` and the new `--reaffirm`. Retiring is allowed on a night with the
  reflected-feeling door closed, because it moves toward less core. Why: the brief's "both of us can retire a
  core memory directly", and the wake's Still open was 08 C4's place for it.
- Noticed by the group3a builder, 2026-10-11: with the recurrence lane, a reflection citing a memory once a week
  carries it into the core in three weeks (four reflection days, each its own session), where it used to take
  four. The D5 "watch" test now pins three weeks.
