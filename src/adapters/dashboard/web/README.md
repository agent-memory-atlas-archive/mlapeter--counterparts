# `web/` — where the dashboard's pieces live

A working map, not a rulebook. Split out of one 1,731-line `app.html` on
2026-09-25 with no visible change; move things when a better shape shows up.

The page is plain browser ES modules and stylesheets — no bundler, no build
step, no dependencies. `server.ts` serves them as files (see "Serving" below).

## Server side (TypeScript, runs in bun)

| file | what it is |
|---|---|
| `server.ts` | `node:http` on 127.0.0.1, the Host allowlist, `router()` (GET: `/`, `/brain` (now a redirect to `/#home`), the favicon, `/api/*`, the static files), and the POST hand-off to `actions.ts`. A store waiting for its one-time upgrade (v6 met by v7, `../upgrade.ts`) gets one calm page instead, and is tried again on every request |
| `actions.ts` | managing: `POST /api/action/<name>` — the same-origin + per-launch-token guard, argument validation, and the console's own `run()` (loaded lazily; never handed the observer source). `ACTIONS` lists them: `ask`, `note`, `remove`, `backup`, `export`, `scope`, `rebrief`, `verify`, and `doctor` (a read: the health tab's checklist, `doctor --json`) |
| `static.ts` | `resolveStatic()`: which URL paths are static files and where they live (pure; no fs) |
| `views.ts` | the index of `views/`: re-exports every view, so callers import from here |
| `views/<name>.ts` | one module per `/api` view: `meta`, `overview` (the home tab's), `memories` (`/api/memories` + `/api/memories/list`), `memory`, `search`, `mind` (the self tab's), `activity`, `flow-view` (`/api/flow` + `/api/node`), `health`, `pulse`, `mechanisms`, `mechanism-panel` (`/api/mechanism?id=`) |
| `views/archive-words.ts` | why a memory was archived, in plain words: one table (`ARCHIVE_WORDS`, a group phrase and a single-row phrase per reason) and one fallback for a reason nobody mapped; health's bar, the memories list and home's archived count read it |
| `views/mechanisms.ts` | `/api/mechanisms`: each mechanism's light (grey = not built, green = fired in the last 7 lived days, waiting = built and not due — a scheduled run ahead, or nothing to act on — amber = built and quiet), its `build` (built / partly / not: the pill's "partly built" tag), one evidence line, the newest backing event `seq`s. Which rows count as a firing is `adapters/mechanism-evidence.ts` — ONE judgement shared with `counterparts mechanisms` (`cli/mechanisms.ts`), which keeps its own words and its calendar window; this file owns the lived-day window and the dashboard's words |
| `views/shared.ts` | the census and small counters every view leans on |
| `views/rows.ts` | row shapes and builders more than one view uses (band bars, contested beliefs, chapters, lived days) |
| `flow.ts` | the diagram's static shape: nodes, edges, which event lights which node |
| `narrate.ts` | a durable event → one first-person sentence, with its tone (orange only for a real problem), its feed and its icon |
| `lanes.ts` | which feed an event belongs in — `home` (memory events: remembered, stronger, replaced, let go, a chapter, a handoff, sleep, a reminder) or `flow` (housekeeping) — and the home line's icon; one table, exhaustive by type |
| `reveal.ts` | id → words at render time, withholding confidential rows |
| `fired.ts` | `/api/fired`, the what-fired panel |

## Client side (browser modules)

```
app.html              the shell: header, one empty <section> per tab, #tip, #overlay,
                      the <link>s (their ORDER is the cascade order) and one <script type=module>
app.js                entry: mounts every page, the nav, the modal; boot; resize; starts the pulse
shell/
  pages.js            the page registry (nav order) and the page-module interface
  tabs.js             nav strip + showTab
  pulse.js            the 4-second poll: new events → live feeds + page hooks; store moved → page.refresh()
shared/
  tokens.css          @font-face + colour/type variables (:root) — the site's look (counterparts.ai)
  type.css            which face goes where: Outfit (--sans) for anything read as words; Courier (--mono) only for big numbers, ids, record names; loaded LAST
  vendor/             three.module.min.js (0.169.0, MIT) for the home brain
  fonts/              Outfit (variable, latin) + Courier Prime 400/700 (latin) .woff2, with their OFL licences
  base.css layout.css utilities.css   reset, header/nav, headings, the .cols grids, .foot/.tone-*/#err
  tip.css modal.css   the tooltip and the overlay card
  dom.js              $  esc
  format.js           n2 n3 pct said livedSpan headline
  colors.js           COL BANDCOL ACCENT (canvas needs JS values)
  absence.js          emptyBox absenceLine — the "(none yet)" / "(never run)" block
  api.js              api() (looking: GET only) and fail()
  actions.js          act() (managing: the one POST, with the page's token) and resultHtml()
  canvas.js           FACE (the canvas's face, Outfit) fit hitTest roundRect clip wrapText
  tip.js modal.js     showTip/hideTip; openModal/closeModal/section
  memory-modal.js     openMemory, copyId, removeMemory (window globals: rows use inline onclick)
  memory-marks.js .css  a memory's kind icon/colour, feeling dots, strength meter, badges
  event-modal.js      openEvent (window global)
  state.js            tabs {current, loaded}; live {lastSeq, fingerprint}
  widgets/            card rows table chart tiles bar feed light .css;
                      feed.js (renderFeed, live-feed registry), chapters.js (chapterRows),
                      confirm.js + .css (confirmTyped: type a phrase back to confirm),
                      light.js (the status dot: green / waiting ring / amber / grey),
                      tips.js + .css (the `?`: explaining words behind a tap or hover; one
                      copy for every page, pinned tips kept across a live refresh)
pages/<tab>/          tabs: home (was overview), memories, self (was mind), flow, health;
                      #overview and #mind still land (shell/tabs.js RENAMED)
  index.js            default export { name, mount(section), render(), refresh?, show?,
                      resize?, redraw?, onEvents?, onDeposit? }; composes its sections' markup
  sections/*.js       one panel each: `export const markup` (its <h2> + container) and
                      `paint(d)` (or `render()` when it fetches for itself)
  <tab>.css           styles only this page uses (home, memories, self, flow, health)
mechanisms/
  index.js            MECHANISMS (the site's eleven, in its order) and FAMILIES (its four, with colours)
  <id>/index.js       default export { id, family, name, short, tagline, inDev, explainer };
                      the light comes from /api/mechanisms
  <id>/panel.js       picture(payload): the Explorer panel's picture, where one is drawn
  picture.js          the pictures' shared pieces
  regions.js          brain regions → mechanisms, as the site maps them
```

Moving a section between pages: import its module in the other page's
`index.js`, put `${section.markup}` where it should sit, call its `paint` from
that page's `render` with the right payload (the data comes from that page's
`/api` view — a section may need its view to grow a field). Its CSS may live in
a page stylesheet; move that too.

A hash can carry more than the tab: `#self/settling` (an anchor) or
`#memories?state=archived` (a query). `shell/tabs.js#parseRoute` splits it, and
the page's optional `route({ anchor, params })` is called once the page is
drawn. The home hero's four counts are links of this kind.

The home page (round 2, 2026-09-26, an experiment) is one short headline
("Day 30 · 145 memories · 8 of 11 built · 6 active this week"; the mechanism
score is behind `SHOW_MECHANISM_SCORE` in `views/overview.ts`, the one place to
take it out), four small tiles (`sections/tiles.js`: memories, core with the
closest candidate's days from `views/mind.ts#coreCandidates`, chapters, and
replaced, with what was let go or removed as its own small number via
`archive-words.ts#archiveGroup`), the brain, the mechanism panel, and a live
feed of memory events only (`lanes.ts`; the housekeeping stays on the flow
tab's feed, and the pulse's live rows are filtered by `registerLiveFeed(id,
accept)`). The memory count is `views/shared.ts#memoriesLive` — what the
memories list's "live" chip counts, and what the memories header says; the
console's `Memories:` (doctor, status, the wake preface) counts memory rows
only, so the two differ by the people and project cards. Explaining words sit
behind `?`s; what is pinned survives the pulse's refresh.

The home page is the site's hero plus Explorer. `pages/home/brain.js` is the
three.js brain, imported statically from `shared/vendor/three.module.min.js`
(0.169.0, MIT, `MIT-three.txt` beside it; never a CDN). It sets
`#home-brain[data-ready]` once it is drawing or has fallen back to a sentence.
`mechanisms/regions.js` maps brain regions to mechanisms, as the site does.
`sections/explorer.js` owns the pills and the inline panel. The panel's picture
comes from `mechanisms/<id>/panel.js` (export `picture(payload)`, pure markup),
gathered in `PANELS` in `mechanisms/index.js` beside `guideUrl(id)`. Its data
comes from `/api/mechanism?id=` (`views/mechanism-panel.ts`: last firings
narrated, plus a `picture`, both read-only). `mechanisms/picture.js` holds the
pictures' shared pieces. A mechanism built later gets a `panel.js`, one line in
`PANELS`, and a case in `mechanism-panel.ts`.

`pages/memories/` — the memories tab (round 2, 2026-09-26, an experiment:
brighter = held more firmly, everywhere on the tab). `state.js` holds the
page's filters (live/archived/all, kind, core, journal, hold, feeling, sort, page
offset) and notifies the list when a filter changes; a live refresh redraws
from it and puts the scroll back, and `counterparts:changed` (a window event,
fired after a note and after a removal on the memory card) makes the page
re-read at once. `row.js` is the one row shape the list, search hits and Ask's
answers share. Sections: `search.js` (search by words,
plus Ask via `act("ask", {json:true})`, its tiers drawn as brightness),
`tools.js` (write a note, and the back-up/export folder dialog),
`hold.js` ("How firmly it's held": one bar, firm / settling / fading, from
`holdOf` in `views/memories.ts`; a part clicked filters the list), `feel.js`
("How it feels": an SVG radar of the wheel's six cores, yours and mine; an axis or a feeling word clicked filters the list), `list.js` (every
memory, newest or oldest first, kinds as chips, paged on the server by
`/api/memories/list` in `views/memories.ts`). `views/memory-words.ts` says how
a row's words are shown (a date at their front lifted off, journal chapters,
feelings in words); archive reasons come from `views/archive-words.ts`.
`shared/memory-marks.{js,css}` are the kind icons and colours, feeling dots,
the strength meter and the badges, used by the rows and the memory card
(`shared/memory-modal.js`, whose strength curve comes from `fadeCurve` in
`views/mechanism-panel.ts`, the Forgetting panel's own maths).

`pages/self/`: the self tab (reworked 2026-09-26 as an experiment). The top is
two columns: the self page on the left (rendered by `markdown.js`, which escapes
first), and a side column with when it was rewritten and by whom, the page
writer's newest night in words (`writer` in `views/mind.ts`, read through
`self/`'s `pageWriterStatus`), the history as a line of dots, and the wake.
`sections/page.js` draws the page, the side column's facts and the dots;
clicking a dot opens that version above the page and diffs it against the one
before with `diff.js` (line comparison, then words, no deps); nothing is open
by default. `sections/settling.js` is one line of counts (core, protected,
argued with; each opens its list) over a compact chart of the closest
candidates for the core; the view computes them with
`physics#promotionEligibility`. `sections/wake.js` is the wake as one line and
a stacked bar of its parts (`wakeParts`, cut at the lane headings from `self/`),
with the rebrief button shown disabled ("coming soon", back with the sleep
work). `sections/journal.js` is a strip of days; a day lists its chapters, a
chapter opens in place. The `?` that holds each explaining line is
`shared/widgets/tips.js`; `state.js` holds what is open, so the pulse's `refresh()` (which redraws only
the panels whose data moved) keeps it open. `sections/stories.js` is only
`storyCard`, opened in the overlay. The view is still `views/mind.ts` / `/api/mind`.

The health tab answers "is it working?": `pages/health/sections/checks.js` runs
`counterparts doctor --json` through the actions seam (a read; a dashboard
opened on a bare `--dir` arms the explicit-dir guard for that run, so the
settings line reads "not checked") and draws its findings as a checklist,
folding the non-headline greens the way `cli/report.ts` does; `cycle.js` is the
last sleep cycle as one line with a dot per phase; `archive.js` is one stacked
bar of `archived_reason` (plain phrases in the shared archive-words module,
unknown reasons get their own segment); `verify.js` is "Check the index"
(`verify` through the seam). The developer panels (band symmetry, what fired,
every durable record, the day × event grid, what I cannot see) live under the
flow diagram as "Under the hood"
(`pages/flow/sections/{symmetry,fired,records,heatmap,blind}.js`), still fed by
`/api/health` and `/api/fired`. On a bare `--dir` dashboard every action runs
with the explicit-dir guard, COUNTERPARTS_CONFIG removed, and home pointed at a
nonexistent dir (doctor keeps the real home for its ~/.claude check), so no
action can reach a default config.

Harness hooks `tools/visual-loop` relies on: `window.tileValue`,
`window.flowState`, `window.particleCount`, `document.documentElement.dataset.loaded`,
`#home-brain[data-ready]`, and the element ids it clicks (`#mlist .mrow`, `#flowcv`, `#overlay`, …).

## Serving

`resolveStatic` serves only `/app.js` and files under `/shared/`, `/shell/`,
`/pages/`, `/mechanisms/`, with extension `.js`, `.css` or `.woff2`; every path
segment must be plain (no `..`, dotfiles, `%`-escapes left after one decode,
backslashes, NUL). A new top-level folder or extension means editing
`static.ts` (and its test). Everything is `cache-control: no-store`, so an edit
shows on reload. `test/dashboard-web.test.ts` checks that every file the shell
reaches exists and is served, and that no `.js`/`.css` under `web/` is orphaned.
`test/dashboard.test.ts`'s source scan covers the `.js` files too.
