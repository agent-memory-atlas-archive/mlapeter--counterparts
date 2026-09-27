# `dream/` — CONTRACT

*Added 2026-09-26 from the owner's decisions of that day (dreaming + consolidation).
Working defaults, held lightly: "try it, see how it goes, adjust".*

## 1. Purpose

Let the counterpart dream: a few minutes, once a day at most and only when the owner
says yes, of replaying what was lived since the last dream beside what it resembles,
and changing the store in the ways sleep changes a brain: merge, link, strengthen,
notice a pattern, flag a contradiction, soften a feeling. Keep a dream journal. Never
let a dream pass for something that happened, and make every dream undoable as a whole.

This module holds the RULES and the BOOKKEEPING: when a dream is due, what a dream is
shown, what it may change and how much, the record of every change, and undo. The
dreamer is the model (a background agent the session launches), outside this process.

## 2. Brain analog

- **Deep-sleep replay** (the hippocampus replaying the day during slow-wave sleep and
  handing it to cortex — Wilson & McNaughton 1994; Diekelmann & Born 2010): file what
  happened, link what belongs together, merge near-copies into one trace, and strengthen
  what matters. Here: `merge`, `link`, `replayed` (a return at half weight).
- **REM mixing** (loose associations across distant memories; insight and pattern after
  sleep — Wagner et al. 2004; Cai et al. 2009): `mixing` and `lookback` in the bundle,
  `gist` as the pattern written down, `contradiction` when two memories cannot both hold.
- **Emotional softening** ("sleep to forget, sleep to remember" — Walker & van der Helm
  2009): the sting fades, the memory stays. Here: `feeling-now`, recorded beside the
  original, never stronger than it was felt.
- **A dream journal.** Dreams are remembered as dreams.

**Named deviations** (constitution line 12):

1. **A dream is ASKED for.** Humans do not consent to sleep; here the owner says yes, once
   a day at most, because a dream spends his model's time and changes his store.
2. **A dream is not lived.** Its words are refused by capture (`DREAM_MARK`), its journal
   is not a memory, a gist it writes starts lower than anything lived (source
   `dreamed`), and its replays count toward no core lane. Human dreams leak into waking
   memory; this one is kept from doing so on purpose.
3. **Nothing is lost to a dream.** A merge archives its originals with a forwarding
   address and keeps their words as a version; the whole dream can be undone.

## 3. Keeps

- **Sleep changes memory offline** [v0: auto-consolidation on a cycle; the field guide's
  consolidation]. `sleep/` stays arithmetic-only; this is the part that needs a model,
  and so it is a separate, asked-for act.
- **Recall's gates** [v2 recall §9.1]: a dream is shown only what could surface in the
  session that launched it — no archived, superseded, protected or schema row; nothing
  confidential outside the owner's own session.
- **Versions, never deletion** [constitution 7; store §16]: merges supersede; undo
  restores.
- **One door per act, every claim mechanized** [mcp §5 G2]: one tool, `dream`, with
  phases.
- **The authorship doctrine's provenance** [owner ruling 2026-08-29]: a dream's gist is
  minted on its own channel, `dreamed`, engine-set.
- **#238's idea**, harvested for returns rather than here: what the display prompts is
  not evidence.

## 4. Drops / simplifies

- **No model call in this module**, and none in `sleep/`: the dreamer is a background
  agent the session launches with its own tools.
- **No automatic dreaming.** The ask is a quiet line; no hook dreams on its own.
- **No settling of contradictions.** A dream flags a pair; the pair is raised awake next
  session, and to the owner when it is about him.
- **No promotion.** A dream nominates; only a core lane at consolidation promotes.

## 5. Contract

### 5.1 The ask

- Due when: not observer; the store has lived more than one day; no dream this lived
  day; the day's ask neither raised nor declined; and at least `MIN_NEW` showable
  memories made since the last dream.
- Raised as ONE quiet line for the model (the hook's `additionalContext`), at most once
  per CALENDAR day across every session (the `dream_asks` latch). It asks the model to
  ask the owner at a natural moment. A "no" is phase `decline`: snoozed for the day.
- Never in the host-mode page writer's headless session.
- A contradiction a dream flagged is raised the same way, once, when both memories are
  showable.

### 5.2 The dream

- `launch` returns a prompt for a background agent (same model, same MCP server, the
  session's id), written by this module (`launchPrompt`).
- `begin` refuses under observer, when a dream already ran this lived day, and when
  nothing is new; otherwise it records the dream and returns the bundle: the self page,
  the wake, journal chapters since the last dream, the owner's names and the memories
  about him, every new memory with its `NEIGHBOURS` nearest older ones (the static
  embedder's vectors, or the token index), `MIXING` loosely related older ones, and the
  `LOOKBACK_COUNT` strongest-feeling memories from about a week back. The ids shown are
  recorded on the dream; nothing else can be changed by it.
- `propose` applies each change on its own, within per-dream `LIMITS`, and records it
  with what undo needs (ids and numbers only):
  `merge` (2–3 near-copies of one kind, not core, into one memory in better words; the
  merged memory stands where the strongest original stood, carries their returns and
  feelings, and inherits their links), `link` (both ways, `LINK_WEIGHT`), `replayed` (a
  return at `DREAM_RETURN_WEIGHT`, never a use), `gist` (source `dreamed`, citing and
  linked to its sources, salience capped at `DREAMED_CLAIM_CEILING`), `contradiction`,
  `feeling-now` (the self's feeling today, capped at the memory's peak), `nominate-core`
  (a memory about me or about us; recorded in `core_events` with the dream's reason).
- `journal` closes the dream with its entry (kept in `dreams.journal`, never a memory)
  and returns the hand-back line, which begins with the mark.
- Every word a dream writes is redacted of credentials first.

### 5.3 Guarantees

1. **[M]** A dream cannot delete, edit the self page, promote, rewrite a memory in place,
   or change a memory it was not shown (`apply`'s action list and `shown`).
2. **[M]** At most one dream per lived day (`begin`).
3. **[M]** A dream's words never become a lived memory: the bundle and the hand-back carry
   `DREAM_MARK`; `remember/spans.ts#enters` refuses any turn carrying it; the Claude Code
   reader tags such a block `dream`. Tested end to end: seed, dream, sweep, zero rows.
4. **[M]** Undo reverses the whole batch and is idempotent: originals restored (their
   versions kept), the merged memory and gists archived `dream-undone`, links back to
   their prior weights, the dream's feelings, replays and nominations removed. A merge
   whose merged memory has moved on since (revised into a successor, merged again,
   archived or removed) is left as it is and counted (`kept`), so an undo never stands
   originals beside a live successor (review of #251).
7. **[M]** What a dream makes keeps the rules of what it was made from: a merge or gist drawn
   from a confidential memory is confidential; a dated reminder and a memory the owner
   demoted from the core are not merged; a dream's merges are not "new" for the next
   ask; a dream left open is closed to changes once a newer one begins (review of #251).
5. **[M]** Under observer stance nothing is written and every phase says so.
6. **[M]** The journal lives in the `dreams` table: no decay, dedup, prune or recall
   touches it.

## 6. Scars honored

**§2.4** (every refusal named; a dream that changed nothing says so) · **§2.6** (every
tool claim mechanized) · **§2.16** (the tool carries an admission test and negative
examples) · **§2.19** (every change enumerable: `counterparts dream --show`) · **G11**
(this system's own words never enter capture).

## 7. Open questions

1. How often will the owner say yes? The ask is once a day at most; if it is a nag, a
   longer snooze or a weekly rhythm is the next knob.
2. Should a gist that proves true awake be promoted out of `dreamed` provenance?
3. Should dream links be stored differently from Hebbian links (a marker, a hop
   weight)? A session designing association with the owner may decide; today they are
   ordinary edges at `LINK_WEIGHT`.
