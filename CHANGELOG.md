# Changelog

## 0.3.4 — 2026-09-26

Memories stay strong by coming back, the core is for what is about the two of you, and
Counterparts can dream. **The store's format changes (v7 → v8).** The first Claude Code
session after installing copies the store (as every upgrade since 0.3.1 has) and upgrades
it; until then `counterparts doctor` says (amber) that the next session will upgrade it,
and the dashboard asks you to open a session. Close every session before installing, and
run `/mcp` → Reconnect in any you missed.

Staying strong.

- **A memory that comes back fades more slowly.** Each time a memory is used again on a
  later day, it gets harder to lose — a lot after a week or more, a little the next day,
  and never less than before. This replaces the one-time bonus a memory used to get for
  surviving its first day.
- **Nothing you already have moves down.** Every memory in your store keeps the old
  bonus path exactly, so no memory drops a band or will be let go sooner because of the
  upgrade. The first sleep after the upgrade checks this on every memory, and `doctor`
  prints what it found (an "Upgrade" line).
- **The days a memory was already used count as coming back.** At the upgrade, every
  day a memory was used before counts toward fading more slowly. A memory the old rules
  were about to make core but the new ones do not (a well-used fact, say) stays strong
  that way instead, and `doctor`'s Upgrade line says how many there were.
- **"Nearby, if it helps" takes turns.** The wake's "Nearby" lane no longer shows the
  same strong memory every day. A memory Claude uses because it was showing there still
  counts as a use, but not as coming back; one shown a lot gives way for a while, and
  returns to the lane over a few days.

The core.

- **Only memories about Claude, or about the two of you, become core** — kind `self`, and
  memories about a person that name you. Facts, skills and places never do, however often
  they come back.
- **Two ways in.** Strongly felt (by you or by Claude) and it came back at least once, a
  couple of days later. Or it kept coming back — on five separate days over three weeks.
- **At most three a night**, strongest first; the rest wait for the next sleep.
- **You can send one back.** `counterparts core` lists the core (with how each got
  there), what dreams nominated, and what you sent back; `counterparts core --demote <id>
  --reason "..."` returns a memory to ordinary fading from today and keeps it out.

Dreaming.

- **Once a day, when there is something new, Claude may ask you "I haven't dreamed since
  … — OK if I dream for a few minutes?"** at a natural moment. Say no and it will not
  ask again that day. Say yes and a background agent replays what you lived since the
  last dream beside what it resembles.
- **What a dream can do**: merge near-copies into one memory in better words (the
  originals are kept), link memories that belong together, replay what matters (it
  strengthens them a little), write down a pattern it notices (labelled "Dreamed", and
  it starts weak until it proves true), flag two memories that disagree (Claude raises
  them with you next session), record how an old feeling sits now, and nominate a
  memory for the core. It cannot delete anything, change the self page, make anything
  core, or rewrite a memory in place.
- **A dream journal.** Every dream keeps a journal entry, apart from your memories — a
  dream is never remembered as something that happened. `counterparts dream` lists
  them, `--show <id>` shows the journal and every change, and `--undo <id>` reverses a
  whole dream. The dashboard's self page shows the journal and what each dream changed.

Seeing it.

- `counterparts mechanisms` and the dashboard: Consolidation now lights up on real
  evidence (memories coming back, merges, memories becoming core); **Dreaming** is a new
  light beside it; Gist is partly built (a dream's pattern). The self page shows what
  became core lately and by which way, what you sent back, and what dreams nominated.
- `counterparts fired` has rows for returns, dream replays, dreams, dream changes, the
  daily ask, demotions and the upgrade check.

**The dashboard's Memories tab, round 2.** One idea across the tab: brighter means held
more firmly. The map of everything held plots strength against age, marks the core with a
★ and turns amber what would be let go within two weeks if it isn't used. Kinds are chips
in the list's filter row; each row shows a title, its date, the kind and its feelings, and
sorts newest or oldest first. A memory's card shows its strength curve, why it mattered,
the days it was used, its versions as one timeline, and the raw numbers under "details".

**The dashboard's Home tab, round 2.** One headline count, four small tiles (memories,
core with the closest candidate's progress, chapters, replaced), and the mechanism lights
as built, partly built or not built, with a new "waiting" ring for a mechanism that ran on
schedule with nothing to do. The dashboard and `counterparts mechanisms` now read the same
evidence for each light, so the two agree. Home's feed shows memory events only; the
housekeeping stays in the flow feed.

## 0.3.3 — 2026-09-26

Reminders with dates, and feelings start to matter. The store's format is unchanged (still
v7), so there is no upgrade step; close every Claude Code session before installing, and
run `/mcp` → Reconnect in any you missed.

Reminders work.

- **A memory can carry a date, and it comes back around then.** `note` and each
  `session_end` memory take an optional `eventDate`: a day `2026-10-15`, a month
  `2026-10`, or a range `2026-10-20..2026-10-31` (how to say "late October"). Claude writes
  the date itself; nothing is read out of the text, and a date that cannot be read is
  refused with the shapes that can. A year alone is kept but never comes back on its own.
- **Plain or quiet.** Beside the date, `remind: "plain"` for something that really has to
  happen — a deadline, an important day, or anything you say not to forget. On its day
  you see it in the terminal (`Today: pay your taxes`) and Claude has it in context, once;
  a month or a range is said on its first day and again on its last. Everything else is
  quiet, the default: it can come back as a footnote around the date, at most twice.
  Giving a memory a date is what makes it eligible, however ordinary the memory; one that
  has faded away or been archived still never comes back.
- **A plain line is spent only when you can see it.** If the morning's wake is too full
  for the terminal line, it waits for your first prompt instead of being used up unseen,
  and the update notice never pushes it out.
- **A quiet reminder is not repeated every turn.** A footnote that came back spends one of
  its two mentions, at most one a day. Month and range dates spread their warmth over the
  first week instead of all landing on the 1st, keep their second mention for after the
  dates pass, and never take one of the wake's two "Arriving" lines — those are for
  day-dated things, and a tie goes to the one happening sooner.
- **The gauge shows it.** `counterparts mechanisms` and the dashboard's Prospective light
  count dated memories held and reminders that came back this week, plain and quiet apart
  (the dashboard adds today's). Grey only when nothing is dated.
- **Revising a dated memory keeps its date.** A revision (`updates:`) that leaves the date
  or `remind` out carries them over, and the older memory stops coming back, so one
  reminder is never said twice; `eventDate: null` drops the date. The reminder is found
  where it moved even when a later revision names the older memory, and what was already
  said or used for the same window still counts after the move.
- **A date that has already passed is kept, and the reply says it won't come back**, so a
  wrong year can be caught when it is written.

**Feelings start to matter.** No change to the store's format.

- **A memory's strongest feeling holds it higher and makes it fade more slowly** — yours or
  Claude's, or its emotional score if that is stronger. This changes how existing memories
  fade too: the ones that carry feeling now last longer (a strongly felt note about 1.7
  times as long before it is let go). The first nightly cleanup after upgrading may move a
  few felt memories up a band. Feeling does not count toward becoming core: what it takes
  to reach identity is unchanged.
- **A recorded feeling softens faster than the memory it sits on.** The feeling is kept as
  it was recorded; the softened strength is what recall and the displays read.
- **Mood-matching.** When a feeling was recorded in the last few hours, memories that
  carried the same feeling for the same person come to mind more easily, and the other
  person's matching feelings help a little. It only helps a memory the conversation
  already reached — it never brings up one on its own.
- **An emotional score given on its own is no longer ignored by the memory gate.**
- **More words on the feelings wheel**, from real use: grateful, curious, tender,
  sheepish, relieved, moved, wistful, bittersweet, fond and intrigued (marked as
  additions, not the poster's), and "exposed" reads as vulnerable. Blends count under
  both their feelings (tender: sad and happy). A word that is not on the wheel is kept as
  your own, and the reply suggests a wheel word only for a near misspelling — "tender" is
  no longer offered "despair".
- **Showing it.** The dashboard's memory view and `counterparts ask --full` / `--id` show a
  memory's feelings as `you: … · me: …`. The Emotion light on the dashboard and in
  `counterparts mechanisms` now counts memories carrying feeling and turns where a mood
  brought memories closer.

**The dashboard's Self tab, round 2.** Lighter: one line on top, with the explanations
behind a small `?`. Beside the page, a side column says when it was last rewritten, what
the page writer did on its last night, the version dots and how much of the wake it
takes. A version's changes open on a click, settling is one compact chart, the journal is
a strip of days, and the tab refreshes itself while it is open. The Health row says how
many days since the page was rewritten.

## 0.3.2 — 2026-09-25

Dates and times follow your clock, and the store's format moves to v7.

**Before upgrading, close every Claude Code session.** The first session after the upgrade
saves a copy of the store and then updates its format; a session left open is still
running the old memory server, so in any you missed, run `/mcp` and choose Reconnect.
If your store is not in the default place (a `dataDir` outside `~/.counterparts/store`,
or `COUNTERPARTS_DATA_DIR`), set `snapshots.dir` in the config first: the upgrade will
not run without somewhere to save that copy, and memory stays off until it is set
(`doctor` says so).

- **Your day is your local day.** The day a memory was learned, "today", and the dates
  in `doctor` and `counterparts fired` now use this computer's time zone instead of UTC,
  so a memory saved at 11:50 pm belongs to that evening. Console commands read the zone
  from the config beside the store, as the hooks do. Memories saved before keep the
  dates they have. A `timeZone` setting in the config (for example `"America/Denver"`)
  pins a zone, for a machine set to UTC; install says which zone it found.
- **Sessions know what time it is.** The wake opens with a line like
  `Now: Fri 25 Sep 2026, 1:40 pm MDT`, and every turn carries the current time too.
- **Each memory records when it was written and changed, and which model wrote it.**
  Notes, end-of-session memories, journal chapters and the self page carry the model the
  session was using.
- **Feelings can be recorded on a memory** — several per memory, yours and Claude's side
  by side, each named on a feelings wheel (six core emotions and the finer words under
  them) with a strength and what carried it. `note` and `session_end` take them; a word
  not on the wheel is kept, and the reply suggests the nearest ones. They change nothing
  about how memories are held yet.
- **The store can hold a reminder's date** — a day, a month, or a range like
  `2026-10-20..2026-10-31` — ready for reminders to use in a later release.
- One module now does every date conversion, and a test keeps it that way.

**A new dashboard** (`counterparts dashboard`):

- **A new home page**: the brain beside a few plain counts, and the 11 mechanisms the
  site describes, each lit when it is working. Click one to see what it did lately.
- **Memories**: every memory in a list, newest first, with search, Ask, and filters for
  kind, band and archived.
- **Self**: the self page with its history, what is settling into the core, the
  briefing for the next session, and the journal by day.
- **Health**: "is it working?" as a checklist from `doctor`, the last sleep cycle, and
  where archived memories went.
- **Manage memory from the dashboard**: write a note, remove a memory, back up, export,
  rebrief, check the index, and ask, through the same code as the console. Removing
  asks you to confirm first.
- The site's fonts, served from the package.
- A store waiting for its upgrade shows a short page saying so, instead of an error.

## 0.3.1 — 2026-09-25

A small release of fixes. No change to the store's format, so no migration and no
Reconnect.

- **Cards for people, places and the identity core are no longer archived after about
  90 days of use** (#215). The nightly cleanup was treating them like ordinary memories.
  They now fade only through a gentle phase of their own: months of quiet on both the
  lived and the calendar clock (180 days, 365 for people), never while beliefs still
  hang on them, and never the identity core. Nobody's store is old enough to have been
  hit, which is why this ships now.
- **A faded card comes back when a saved memory names it** (#220), and **a card named
  in a saved memory counts as used** (#218), so the people and things you still talk
  about stay live.
- **Prompts typed while Claude is still working are saved** (#213). They were missed
  before, about one typed prompt in twelve.
- **A checked snapshot is taken before any change to the store's format** (#214). If the
  copy can't be made, the change waits. `doctor` shows a store that needs one: red when
  the copy can't be made, amber when it can.
- **Each journal chapter records the model that wrote it** (#217).
- **`counterparts fired` and `doctor` show fading** as a mechanism of its own.

## 0.3.0 — 2026-09-24

No API keys: nothing leaves the machine except through Claude Code. A quieter end-of-turn
ask, paced by what you type. `counterparts ask` searches by meaning.
