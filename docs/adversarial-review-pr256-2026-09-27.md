# Adversarial review — PR #256, reflection + core by meaning (2026-09-27)

Reviewed at `69a6138` (branch `mechanisms/reflection-core`, merge base `6ea4bfd`).
The blocker and the should-fixes are fixed on the branch, one commit each, titled
"review of #256: …". Each fix has a test in `test/reflect-review.test.ts` that fails on
`69a6138` and passes after the fix. The owner's decisions are left as they are; their
behaviour today is pinned by tests in the same file, so a ruling flips a test.

Read against the build brief and its addendum (2026-09-27), and the owner's call that
`CORE_FAST_ACCEPTS_REFLECTED_FEELING` defaults ON. That call is not reverted here; its
safeguards were checked, and one gap in them is fixed (S4).

The store this lands on: the owner's v8 store, migrated the first time a session
opens after install.

## Blocker

**B1. A dreamed gist could reach the core through the reflection.** *(fixed)*
`begin` hands the reflection the dream's gists as memories (`dreamed: true`), and puts
them in its shown set. `finish` accepted a later feeling and an about mark on anything
in the shown set.
- The scenario: after a dream that wrote a `self` gist, the reflection records a 0.9
  feeling on the gist and marks it `me`. Two days later the gist is used once in a
  session (an organic return). The next sleep promotes it: the fast lane has its
  feeling and its return.
- Measured on `69a6138`: the gist became core.
- On master this road did not exist. A gist's salience is capped below the semantic
  floor, and a dream's own feeling-now is capped at the memory's peak, so a gist could
  meet neither lane.
- The same hole held for a reflection's own entry: when the next dream nominated it,
  or it was on my mind, it was handed back as a memory the reflection could feel and
  mark. The PR said a reflection is not shown its own entries; that held only for the
  main pass.
- Fix: `finish` refuses a feeling, and a `me`/`us`/`owner` mark, on a memory whose
  source is `dreamed` or `reflection` (`dreamed-is-a-suggestion`,
  `reflection-does-not-feel-itself`, `reflection-does-not-mark-itself`). A `work` or
  `world` mark stays open, since that takes a memory out of the candidates. A
  reflection's own entry is never taken into the bundle as a memory.

## Should-fix (all fixed)

**S1. A gist's words could go on the page from a reflection without that dream.**
- The page's gist check read only the gists of the reflection's own dream.
- The scenario: a reflection on its own, the morning after a dream, puts the dream's
  pattern on the self page in the gist's words. Those words then read as something
  lived, which addendum 2 rules out.
- The PR's own test asserted this ("nothing to hold it to: written").
- Fix: the check reads the gists of the last 30 dreams that were not undone. The PR's
  test is turned round.

**S2. Confidential memories could leave the owner's session.**
- *The page.* In the owner's session the reflection is shown confidential memories. It
  could cite one as the page's source, or copy its words onto the page, and every
  session reads the page. The nightly writer never shows it one
  (`pageWriterInput`'s `omit`).
- *The entry.* The entry memory took its confidentiality only from the entry's own
  citations. If only the share or the page cited a confidential memory, an entry that
  talks about it came out not confidential.
- *Other sessions.* `pendingShare` and `carryLine` would hand an untold share to a
  session that is not the owner's. So would the "earlier" entries in the next
  reflection's bundle, whatever they rested on.
- Fix:
  - A confidential memory is not a page source (`confidential-is-not-a-page-source`).
  - A six-word run of a confidential memory the reflection was shown is refused on the
    page (`confidential-words-on-the-page`).
  - The entry is as confidential as anything the night cites.
  - Outside the owner's session, a share or an earlier entry that rests on a
    confidential memory is not handed over.

**S3. The v9 upgrade dropped a candidate the old rule had.**
- The old `aboutMe` read any `person` row that names the owner, whatever its type. The
  upgrade marked only `type = 'memory'` rows.
- The effect: a belief about the owner (a `schema` row of kind `person`) stopped being
  a candidate overnight. There was one such row on the seeded demo store (35 → 34).
- The record's candidate count also left out schema rows, so doctor said 32 where the
  old rule read 35.
- Fix: the person pass also covers schema rows. The count covers every row the upgrade
  marked, memory or schema, live and not yet core, except the page. This includes the
  identity core, which the old rule also read as about me.
- After the fix, the demo store's candidates are identical before and after the
  upgrade (35/35). See "Independent upgrade check".

**S4. The visible guard missed half of what the open door lets through.**
- `reflectionOnly` looks only at where the returns came from.
- The scenario: a memory is used once, organically. Its fast-lane feeling came only
  from a reflection ("Mike lets an AI act for itself", intensity 0 at the time, 0.8
  recorded later).
- It crosses through exactly the door `CORE_FAST_ACCEPTS_REFLECTED_FEELING` opens, and
  nothing said so: no record flag, no doctor count, no morning share.
- Fix: the promotion record also carries `feelingRecordedLater`. It is true when the
  memory would not have crossed tonight with that door closed.
  - Doctor counts it on its own clause ("N became core on a feeling a reflection
    recorded later").
  - The next morning share names it, as it names a promotion on reflection alone.
  - `reflectionOnly` keeps the meaning the addendum gave it.

**S5. Carrying a morning share was a read and then a write.** *(the PR's own open
item)*
- The scenario: two prompts in the same instant both read the share as `offered`, and
  both carry it.
- Fix: `updateReflection` takes `ifShareState`, and lands only if the share is still in
  that state inside its transaction. It says whether it landed, and `carryLine` returns
  nothing when it lost.
- Test: a second session holding a stale "offered" read does not carry the share
  again.

## Decisions for the owner

- **D1. `counterparts core --reflected-feeling off` does not close "promoted on
  reflection alone".**
  - Off, a feeling a reflection records later no longer counts. A reflection's
    citation still counts as the fast lane's return, as the addendum says.
  - So a memory with a strong feeling at the time can still reach the core with no
    organic use at all. The reflection marks it `me` and cites it, and the next sleep
    promotes it. Tested, with the switch set through the console.
  - The help text is accurate, but "off" reads like it closes the road.
  - My recommendation: have "off" also require the fast lane's return to be organic,
    so the switch means "nothing becomes core on reflection alone". Otherwise, say it
    in the help line.
- **D2. A reflection can overwrite what the writer said a memory is about.**
  - A `self` memory the writer marked `work` (a work lesson) can be re-marked `me` by
    the reflection, and becomes a candidate. The addendum's "removal is the safer
    direction" covers only the other way.
  - The owner has no door to set or pin a mark (`about_by = 'owner'` exists, but
    nothing writes it).
  - Recommendation: a reflection may move a mark toward `work`/`world`, but not turn
    the writer's `work`/`world` into a core mark. Later, `counterparts core --about <id>
    <mark>` for the owner.
- **D3. `pageWriter.mode: off` does not stop the reflection's page write.**
  - The config's own words for `off` are "nothing runs and nothing is written". The
    MCP server does not read that block.
  - The entry point already passes `snapshotsDir` and `timeZone` from the host config,
    so passing the mode is small.
  - Recommendation: honour it, since a reflection's page write is a page writer. It
    does not bite the owner today (his mode is `session`).
- **D4. The owner's removal redacts the reflection's record, but not its entry's
  memory.**
  - The entry memory ("Reflected: …") holds the same words the record does, and still
    names the removed id in `meta.cites`. So recall can still surface what the
    redaction took out of the record.
  - This is the same shape as #251's Q6 (dream journals). There the ruling redacted the
    journal.
  - Recommendation: redact the entry memory's words the same way, or remove it with
    the chase.
- **D5. Reflection alone can carry the slow lane.**
  - With the weekly spacing, five reflection days span 28+ lived days. Measured: it
    crosses at 28+ lived days from birth, lane `slow`, record `reflectionOnly: true`.
  - The brief's "not in ~10 days" holds. The PR leaves "four weeks of weekly citing"
    open on purpose.
  - Recommendation: watch it. If it shows up, count reflection days toward the fast
    lane's return only, not the slow lane.
- **D6. A dreamed gist at consolidation.**
  - After B1 no road reaches the core from a gist: capped salience, no later feeling,
    no reflection or dream return.
  - The upgrade still marks a `self`-kind gist `me` (carrying the old rule), so a guard
    in `aboutMe` (source `dreamed` is never a candidate) would be defence in depth.
  - This is dream CONTRACT open question 2 ("promoted out of `dreamed` provenance?").
    Left there.

## Owner rulings (2026-09-27, held lightly)

The owner ruled on D1–D6 the same day. Commits titled "owner rulings on #256: …".

- **D1. Off is fully closed.** With `core --reflected-feeling off`, the fast lane needs
  a feeling felt at the time AND a return that is an ordinary use, not a reflection's
  citation (`CoreContext.organicReturnDay`). A reflection may then only move what a
  memory is about toward work or world. On, as before. The help, the console's core
  list and the switch's reply say so. Tests: "D1", and the switch test end to end.
- **D2. Open, a reflection may re-label either way** ("it's me reflecting; it may
  catch labeling bugs"), with a why.
  - Each re-label goes into `core_events` as `<mark> (was <before>): <why> (reflection
    rfl_…)`.
  - Doctor counts re-labels and, apart, the moves into me/us/owner.
  - A move into me/us/owner is said in that morning's share ("I've come to think "X"
    is about who I am").
  - Test: "D2".
- **D3. `pageWriter.mode: off` is honoured.** The MCP entry point passes it the way
  it passes `snapshotsDir`/`timeZone`, and `openAdapter` does too. The reflection still
  keeps its entry and offers its share, and a page it sends is refused
  `page-writer-off`. Test: "D3", through the adapter and through the MCP server.
- **D4. A removal redacts the entry's memory too.** Its words and title, the removed id
  in `meta.cites`, and its versions' words. The row stays. Test: "D4".
- **D5. No change; on the watch list** in the physics and sleep NOTES. Reflection alone
  can carry the slow lane in about four weeks of weekly citing. Pinned by "D5".
- **D6. No change; an open question** in the dream CONTRACT §7.2: should `aboutMe`
  refuse a `dreamed` row outright?

## Notes

- **N1. A reflection and an organic use on one lived day: the second is refused. That
  is right.**
  - They are one lane day either way.
  - The refused one would have weighed 0 for durability: its gap from the first is 0,
    and spacing gives a gap of 0 no weight.
  - The only cost is the label. When the reflection came first, the record reads
    `reflectionOnly: true` although there was a real use. That errs on the side of
    showing the owner more, not less (tested).
- **N2.** The "became core" latch is set when the share is offered, not when it is
  told. A share that is carried and then never told loses the mention. Doctor still
  counts it.
- **N3.** Nothing stops a reflection that was begun days ago (and is still the newest)
  from being finished late. Its feelings then carry the begin date as
  `recorded_later`. Low.
- **N4.** `told` is accepted from any session, not only the reflecting or the carrying
  one. Low.
- **N5.** Because of S3, doctor's candidate number now counts schema rows the old rule
  read (beliefs, and the identity core). On the demo store: 32 → 35.
- **N6.** `core --reflected-feeling` opens the store as a writer, as `--demote` does.
  - On a v8 store it migrates.
  - Outside the usual `<base>/store` layout, with no snapshots dir, it prints the raw
    `MIGRATION_SNAPSHOT_FAILED` JSON after "core failed:". The store is unchanged.
- **N7.** A failure midway through the v9 migration reaches the person as raw SQLite
  text ("SQLiteError: …"), the same as #251 N18.
- **N8.** The morning share is told in the session's own words, unmarked, which is the
  agreed "telling a dream" design. The 09-28 check (recall "seam", "Montaigne", and so
  on) covers whether dream words land as lived fact.
- **N9.** In `store/index.ts`, `carryAboutMark` was inserted between `modelOrNull`'s
  doc comment and `modelOrNull`, so that comment now sits above the wrong function.
  Cosmetic.
- **N10. For the dashboard session** (not edited here):
  - `core-road.ts`, `mind.ts#oneReturnAway` and `tonight.ts` call
    `promotionEligibility` without `acceptsReflectedFeeling`. With the owner's
    `--reflected-feeling off`, the settling view keeps drawing the open-door verdict
    while sleep uses the closed one, so a memory can read "met" and never cross. Pass
    `acceptsReflectedFeeling(store)`.
  - `mechanism-panel.ts` calls `aboutMe(store, { id, kind }, owner)` without the row's
    `about`, which costs a `store.read` per memory. Passing the row avoids it.
  - Promotion records now carry `feelingRecordedLater` beside `reflectionOnly`. The
    Self tab may want to say "on reflection" for either.

### Verified and held

- **One reflection a lived day.** An abandoned `begun` does not use up the day; only
  the newest open reflection can be finished.
- **What it can touch.** It cites, feels and marks only what it was shown, and only
  what still stands.
- **Returns.** Gists and its own entries earn no return. Weekly spacing holds: ten
  nights give two counted returns.
- **The core's rules.** A `skill` is never core. Three a night holds however many
  memories a reflection marks and feels (tested with five).
- **The page.**
  - The page rests on a cited core memory when there is a core.
  - A night that cites nothing rewrites and shares nothing.
  - The page write goes through `Self#revisePage`, which runs the credential gate and
    the observer stand-down.
  - The page write claims the night, so the SessionStart writer stands down.
- **The share.**
  - It is told once.
  - It is carried only after the reflecting session ended. The hook and the MCP server
    read the same session registry (`store.dir`).
- **Undo.** Undoing a dream leaves its reflection.
- **Observer stance.** `launch`, `begin`, `finish` and `told` all stand down through
  the MCP tool. `finish`, `told`, `pendingShare` and `carryLine` refuse in the module.
  Table counts were unchanged (tested).
- **The open fast lane, end to end through real doors (tested).**
  - MCP `reflect finish` with a feeling, a mark and a citation.
  - The sleep that follows promotes the memory with `reflectionOnly: true` and
    `returnSources {awake 0, reflection 1}`.
  - Doctor says "1 memory became core on reflection alone".
  - The next share names it; `told` records it; the following share does not name it
    again.
- **The switch, through the console (tested).** `core --reflected-feeling off` sets
  the meta row, a bad value is refused, and `core` prints which way the door stands.

## Independent upgrade check

Done on pristine archives of master `6ea4bfd` (v8) and the branch, outside the repo.

**Seed.** The v8 `tools/demo/seed.ts` (30 lived days, 175 rows). Then, with the v8
build:
- a dream with a `self`-kind gist and a feeling-now;
- a `person` memory naming the owner only in `meta.name`;
- an archived `self` memory.

**At the upgrade.**
- The snapshot `<snaps>/<ts>-pre-migration-v8-to-v9/counterparts.sqlite` is v8, and
  every table's row count equals the original's.
- Every v8 table is identical on every v8 column. The only other differences are the
  `store.migrated` event, the v9 upgrade meta row, and the new `reflections` table.
- Marks: 33 `self` memories became `me`, 2 `self` schema rows (the identity core and a
  belief) became `me`, and 5 `person` memories became `owner` (including the
  meta-only one). All carry `about_by = 'upgrade'`.
- The dream's feeling was sourced `dream`.
- A second open took no new snapshot and left the store byte-identical (`.dump`
  hash).

**Candidates, old rule against new.** `aboutMe` was compared over every row.
- At `69a6138`: one row differed. `sch_e31125d0515e` is a person-kind belief, "Rosalind
  Achebe agreed a Thursday maintenance window…". It was a candidate by the old rule and
  not after (S3).
- After the fix: identical, 35/35. Journals aside, "only old" and "only new" are both
  empty.
- The next morning, each build runs its own sleep. Both promote nothing (no returns
  yet).

**Failure midway.** A trigger made the v9 feelings step abort after the marks.
- The migration rolled back whole: schema v8, no `about` column.
- The v8 build still read the store.
- After the trigger was dropped, a retry migrated cleanly and reused the same snapshot
  folder.

**Observer floor (the v9 CLI on the v8 store, `--dir`, usual layout).** The `.dump`
hash was unchanged and the store stayed v8.
- `doctor`: amber, "on schema v8; this build reads it once a session has upgraded it"
  and "the next session copies it to …/snapshots and upgrades it to v9".
- `status`, `core`, `dream --list`, `dream --show`: exit 3, "this store is on schema
  v8; the next Claude Code session copies it and upgrades it to v9. Nothing to do:
  start a session, then run this again."

**Doctor after the upgrade.** "Upgrade to v9: what a memory is about is now marked by
meaning; the old rule was carried so nothing changed overnight — 33 self memories
marked about me, 5 about the owner (35 core candidates); 0 marks set by the writer or
a reflection since." Plus a Reflection line: "has not reflected yet; returns this week
— awake 0, reflection 0, dream 0".

## Decisions taken (reviewer defaults, held lightly)

| Item | Default chosen | Where it lives | Test |
|---|---|---|---|
| B1 | A reflection may mark a gist or its own entry `work`/`world`, but not `me`/`us`/`owner`, and may not feel it. | `reflect.ts#notLivedReason`, `finish` | B1 (3 tests) |
| S1 | The gist-word check reads the last 30 dreams that were not undone (`GIST_DREAMS`). | `reflect.ts#quotesAGist` | S1, and the PR's page test turned round |
| S2 | A confidential memory is never a page source; a six-word run of one it was shown is refused on the page; outside the owner's session, an untold share and earlier entries resting on one are withheld. | `reflect.ts#quotesConfidential`, `#touchesConfidential` | S2 (3 tests) |
| S3 | The upgrade's candidate count covers every upgrade-marked memory or schema row, live and not core, except the page (the identity core included). | `operational.ts#markByOldRule` | S3; PR test now expects 3 |
| S4 | New record field `feelingRecordedLater`, next to `reflectionOnly` (unchanged). Doctor counts it separately; the share names either one. | `consolidate.ts`, `doctor.ts#reflectionFindings`, `reflect.ts#promotedThroughReflection` | S4 |
| S5 | `updateReflection({ ifShareState })` returns whether it landed. | `store/index.ts`, `reflect.ts#carryLine` | S5 |

## Suite

After the review commits:
- `bun test` without `*-live.test.ts`: 4118 pass, 0 fail, 8 skip (4099 at `69a6138`);
  after the owner rulings, see the rulings' final report.
- Each live file on its own: dashboard-home-live 1/0, dashboard-memories-live 1/0,
  dashboard-self-live 1/0.
- `tsc --noEmit`: clean.
- `test/reflect-review.test.ts` has 19 tests.
