/**
 * The sidebar v0.2 through the engine: its hooks, the trees it draws on the
 * terminal and the desktop, and what it asks of the engine beneath (all of it
 * answered by ./world.ts). Each UI test runs its body on both surfaces where
 * both draw it.
 */
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { decodeCells } from '../hooks/cells'
import { hex, stageOf } from '../hooks/mechanisms'
import { cells } from '../hooks/width'
import {
  BAND_PROPS,
  DECISION_T3,
  EVENTS,
  FIRED_TODAY,
  HERE,
  HOME,
  PANE,
  PANE_PROPS,
  PLUGIN,
  PLUGIN_TOOLS,
  PULSE,
  RECALL_BLOCK,
  SCOPES_FILE,
  SESSION,
  T0,
  VIEWPORT,
  ev,
  settle,
  start,
  world,
} from './world'
import type { World, WorldOptions } from './world'

const SURFACES = ['terminal', 'desktop'] as const
const HINT_PROPS = { isDraft: false, isWorking: false, hint: '? for shortcuts' }

async function mount($: Engine, w: World, surface: (typeof SURFACES)[number], props = PANE_PROPS) {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props, viewport: VIEWPORT })
  await settle(w)
  return ui
}
type Ui = Awaited<ReturnType<typeof mount>>

async function texts(ui: Ui): Promise<string> {
  const all = await ui.findAll({})
  return all.map(el => el.text).join('\n')
}

type Drawn = { children?: unknown[]; props?: Record<string, unknown> }
function flat(n: unknown): string {
  if (typeof n === 'string') return n
  if (Array.isArray(n)) return n.map(flat).join('')
  if (n !== null && typeof n === 'object') {
    const d = n as Drawn
    return flat(d.children ?? d.props?.['children'] ?? [])
  }
  return ''
}

/** The body's lines as drawn by its Client, one string a line. */
async function bodyLines(ui: Ui): Promise<string[]> {
  const root = (await ui.drawn({ in: 'body' })) as unknown as Drawn
  const kids = (root.children ?? (root.props?.['children'] as unknown[] | undefined) ?? []) as unknown[]
  return kids.map(flat)
}

/** A plain click on the first line of the body that holds `match`. */
async function click(ui: Ui, match: string): Promise<void> {
  const lines = await bodyLines(ui)
  const y = lines.findIndex(l => l.includes(match))
  if (y < 0) throw new Error(`no line holding ${match} in: ${lines.join(' | ')}`)
  await ui.pointer({ type: 'down', x: 2, y, button: 'left', in: 'body' })
}

/** A plain click on `word` in the first line of the body that holds `match` (its column: these lines are ASCII there). */
async function clickWord(ui: Ui, match: string, word: string): Promise<void> {
  const lines = await bodyLines(ui)
  const y = lines.findIndex(l => l.includes(match))
  if (y < 0) throw new Error(`no line holding ${match} in: ${lines.join(' | ')}`)
  await ui.pointer({ type: 'down', x: (lines[y] ?? '').lastIndexOf(word) + 1, y, button: 'left', in: 'body' })
}

/** The band above the prompt drawing once, on a surface that docks panes or doesn't. */
async function band($: Engine, w: World, docks: boolean): Promise<void> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS, viewport: { ...VIEWPORT, isFullscreen: docks } })
  await settle(w)
  await ui.unmount()
}

/** The hint line under the prompt, drawn: what `tail` the sidebar handed the engine. */
async function tail($: Engine, w: World): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', props: HINT_PROPS as never, viewport: VIEWPORT })
  await settle(w)
  await ui.unmount()
  return w.tails.at(-1)
}

async function block($: Engine, w: World, text = RECALL_BLOCK): Promise<void> {
  await $.session.append({
    door: 'hook-context',
    origin: { kind: 'hook', event: 'UserPromptSubmit' },
    uuid: `row-${String(w.events.length)}`,
    message: {
      type: 'attachment',
      name: 'hook_additional_context',
      content: [{ type: 'text', text: `<system-reminder>\nUserPromptSubmit hook additional context: ${text}\n</system-reminder>` }],
    },
  } as never)
  await settle(w)
}

const cmd = async ($: Engine, args: string): Promise<string> => (await $.command.run({ command: 'counterparts', args } as never)).text ?? ''

// ── opening, and where it opens ─────────────────────────────────────────────

test('at session start nothing is opened or drawn and the dashboard is not read, but this folder’s registry entry is; a docking surface opens it at 34 columns (a dock 35 wide)', async ($, on) => {
  const w = world(on)
  await start($, w)
  expect(w.opens).toHaveLength(0)
  expect(w.fetches).toHaveLength(0)
  expect(w.submits).toHaveLength(0)
  expect(w.mcp).toHaveLength(0) // no tool: the registry file, read-only
  expect(w.fsReads).toContain(SCOPES_FILE)
  expect(w.lastStatus()).toBe('') // no status line in the normal case
  await band($, w, true)
  expect(w.opens).toEqual([{ id: PANE, title: 'Counterparts', columns: 34 }])
  expect(w.fetches).toHaveLength(0) // still nothing read: the pane has not drawn
})

test('on the main screen (no docking) nothing is opened unasked and nothing is said; /counterparts opens it', async ($, on) => {
  const w = world(on)
  await start($, w)
  await band($, w, false)
  expect(w.opens).toHaveLength(0)
  expect(w.statuses.every(s => s === undefined)).toBe(true)
  expect(await cmd($, '')).toBe('Counterparts sidebar opened.')
  expect(w.opens).toHaveLength(1)
  expect(await cmd($, 'nonsense')).toContain('Usage: /counterparts [quiet | brain turning|still|off | resume | fps [n]]')
})

for (const [n, said] of [
  [999, '999 memories'],
  [1000, '1000 memories'],
  [12345, '12k+ memories'],
] as const) {
  test(`the header's count on one row beside the brain, the header six rows: ${said}`, async ($, on) => {
    const was = PULSE.memories
    PULSE.memories = n
    try {
      const w = world(on)
      await start($, w)
      const ui = await mount($, w, 'terminal')
      // the column beside the brain: blank, title, blank, day, count, search (from 1,000 it takes a cell of the gap)
      const texts = (await ui.findAll({ type: 'Text' })).map(x => x.text)
      expect(texts).toContain(said)
      expect(texts.indexOf(said)).toBe(texts.indexOf('day 18') + 1)
      expect(texts).not.toContain(String(n))
      await ui.unmount()
    } finally {
      PULSE.memories = was
    }
  })
}

test('a docking terminal too narrow for an unasked pane: the dim tail under the prompt names /counterparts until the pane draws; no status line', async ($, on) => {
  const w = world(on, { placed: false })
  await start($, w)
  await band($, w, true)
  expect(await tail($, w)).toBe('/counterparts opens the sidebar')
  expect(w.lastStatus()).toBe('')
  const ui = await mount($, w, 'terminal')
  await ui.unmount()
  expect(await tail($, w)).toBeUndefined()
})

test('drawn: the dashboard is read; the header is the small brain, COUNTERPARTS, the day, the count and a search box; no status line', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect(w.fetches.some(u => u.endsWith('/api/pulse'))).toBe(true)
    expect(w.fetches.some(u => u.endsWith('/api/mechanisms'))).toBe(true)
    expect(w.fetches.some(u => u.includes('/api/dreams'))).toBe(true)
    expect((await ui.find({ type: 'Button', key: 'title' }))?.text).toContain('COUNTERPARTS')
    expect(await ui.find({ type: 'Text', text: 'day 18' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '776 memories' })).toBeDefined()
    expect((await ui.find({ type: 'Input', key: 'q' }))?.props['placeholder']).toBe('search')
    if (surface === 'terminal') {
      const r = await ui.find({ type: 'Raster', key: 'brain' })
      expect(r?.props['columns']).toBe(18)
      expect(r?.props['rows']).toBe(6)
    } else {
      // no Raster on the desktop: the header with no brain
      expect(await ui.find({ type: 'Raster' })).toBeUndefined()
      expect((await ui.find({ type: 'Button', key: 'title' }))?.text).toContain('◉ COUNTERPARTS ↗')
    }
    await ui.unmount()
  }
  expect(w.statuses.every(s => s === undefined)).toBe(true)
})

test('the dashboard is read while the pane shows: cheap reads every 15 s, every 30 s once quiet, none when it is not shown', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const pulses = () => w.fetches.filter(u => u.endsWith('/api/pulse')).length
  const since = () => w.fetches.filter(u => u.includes('sinceSeq=')).length
  expect(pulses()).toBe(1)
  await w.clock.advance(15000)
  expect(since()).toBe(1)
  expect(pulses()).toBe(1)
  await w.clock.advance(15000 * 3)
  expect(since()).toBe(4)
  await w.clock.advance(15000)
  expect(since()).toBe(4) // four quiet reads in a row: now every 30 s
  await w.clock.advance(15000)
  expect(since()).toBe(5)
  w.shown = false // the person showed another pane
  const before = w.fetches.length
  await w.clock.advance(120000)
  expect(w.fetches.length).toBe(before)
  await ui.unmount()
})

// ── the sections ────────────────────────────────────────────────────────────

test('Memories and Subconscious: what the recall block put in front of Claude, titles read from the dashboard (a read that counts nothing), the message’s time on the heading', async ($, on) => {
  const w = world(on)
  await start($, w)
  w.events.push(DECISION_T3)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    await block($, w)
    const lines = await bodyLines(ui)
    expect(lines[0]).toMatch(/^Memories ─+ 1:35$/)
    expect(lines[1]).toBe('The sidebar is 35 columns wide') // the title, not the gist Claude read
    expect(lines).toContain('Subconscious ' + '─'.repeat(32 - 'Subconscious '.length))
    expect(lines).toContain('Release notes go out on Fridays')
    expect(lines.join('\n')).not.toMatch(/[·•●]\s*Release/) // no dots or bullets on these
    await ui.unmount()
  }
  expect(w.fetches.some(u => u.includes('/api/memory?id=mem_sur00001'))).toBe(true)
  expect(w.mcp.filter(c => c.tool === 'recall')).toHaveLength(0) // never the recall tool, which counts and credits
  expect(await tail($, w)).toBeUndefined() // the pane is open: no tail
})

test('a turn’s row not written yet when the block arrives: the gist stands, and the title comes a moment later', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await block($, w)
  expect((await bodyLines(ui))[1]).toBe('Mike chose 35 columns on Oct 10:') // an ISO date shown short
  w.events.push(DECISION_T3) // written now
  await w.clock.advance(1600)
  await settle(w)
  expect((await bodyLines(ui))[1]).toBe('The sidebar is 35 columns wide')
  await ui.unmount()
})

test('a message with nothing said in full: no Memories section, and the time moves to Subconscious; the dashboard down leaves the words Claude read', async ($, on) => {
  const w = world(on, { down: true })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await block($, w, ['<!-- counterparts:recall t=4 -->', '', 'Quietly available (ignorable; expand an id with recall before citing one):', '- Release notes go out on Fridays [mem_rel00001]', '<!-- counterparts:recall/end -->'].join('\n'))
  let lines = await bodyLines(ui)
  expect(lines.some(l => l.startsWith('Memories'))).toBe(false)
  expect(lines[0]).toMatch(/^Subconscious ─+ 1:35$/)
  await block($, w)
  lines = await bodyLines(ui)
  expect(lines[1]).toBe('Mike chose 35 columns on Oct 10:') // the gist wraps; no title without the dashboard
  await ui.unmount()
})

test('a footnote Claude opened by its id gets “↗ opened”', async ($, on) => {
  const w = world(on)
  on('tool.call', () => ({ result: 'ok', text: '{"memories":[]}' }))
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await block($, w)
  expect((await bodyLines(ui)).join('\n')).not.toContain('↗ opened')
  await $.tool.call({ tool: 'mcp__counterparts__recall', ids: ['mem_rel00001'] } as never)
  await settle(w)
  // its title whole; the mark on the line after it when the title's last line has no room
  const lines = await bodyLines(ui)
  expect(lines[lines.indexOf('Release notes go out on Fridays') + 1]).toBe('↗ opened')
  await ui.unmount()
})

test('Saved this session: each memory a note or session_end saved, newest first, its stage dot on the first line only, up to three lines in one colour; no chapter; what an update replaces only opened; nothing for a refused one', async ($, on) => {
  const w = world(on)
  on('tool.call', (_$, e) => {
    const args = e as unknown as { text?: string; title?: string }
    if (args.text === 'refuse me') return { result: 'refused', text: '{"stored":false,"reason":"duplicate"}' }
    if (String(e.tool).endsWith('__session_end')) return { result: 'ok', text: '{"deposited":2}' }
    return { result: 'ok', text: `{"stored":true,"id":"${args.title === 'Long one' ? 'mem_long0001' : 'mem_new00001'}"}` }
  })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  // a resumed session: what it saved before, from the dashboard
  expect((await bodyLines(ui)).join('\n')).toContain('● The sidebar draws the brain in\nbraille')
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'The pane is thirty-five columns wide and every column of it is spent on words', text: 'x' } as never)
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Narrower now', text: 'x', updates: 'mem_old00001' } as never)
  await $.tool.call({ tool: 'mcp__counterparts__note', text: 'refuse me' } as never)
  await $.tool.call({ tool: 'mcp__counterparts__session_end', memories: [{ title: 'First of two', text: 'a' }, { title: 'Second of two', text: 'b' }] } as never)
  await $.tool.call({ tool: 'mcp__counterparts__chapter', title: 'Day 18', text: 'a journal entry' } as never)
  await settle(w)
  const lines = await bodyLines(ui)
  const at = lines.findIndex(l => l.startsWith('Saved this session'))
  expect(lines[at]).toMatch(/^Saved this session ─+ 5$/)
  expect(lines.slice(at + 1, at + 10)).toEqual([
    '● Second of two',
    '● First of two',
    '● Narrower now',
    '● The pane is thirty-five',
    'columns wide and every column of', // a wrapped line goes back to the left edge
    'it is spent on words',
    '● The sidebar draws the brain in',
    'braille',
    ' ',
  ])
  expect(lines.join('\n')).not.toMatch(/replaces|Chapter|Day 18/)
  // the dot is the stage's: Salience's cyan for a new memory, Reconsolidation's lilac for an update
  const root = (await ui.drawn({ in: 'body' })) as unknown as Drawn
  const row = (root.children ?? [])[at + 3] as Drawn
  expect(((row.children ?? [])[0] as Drawn).props?.['color']).toBe(hex(stageOf('reconsolidation').col))
  // every line of an item one colour
  const colour = (i: number): unknown => (((root.children ?? [])[i] as Drawn).children ?? []).map(c => (c as Drawn).props?.['color']).at(-1)
  expect(colour(at + 4)).toBe(colour(at + 5))
  expect(colour(at + 5)).toBe(colour(at + 6))
  // opened, an update says what it replaces (the title read from the dashboard)
  await click(ui, '● Narrower now')
  await settle(w)
  expect((await bodyLines(ui)).join(' ')).toContain('replaces The sidebar was 46 col')
  await click(ui, '● Narrower now')
  expect(lines.join('\n')).not.toContain('refuse me')
  expect(w.toasts).toHaveLength(0) // the pane and the tail say it; no toast
  await ui.unmount()
  await cmd($, 'quiet')
  expect(await tail($, w)).toBe('stored 2 memories: First of two · /counterparts opens it')
  // a /clear starts this session's list over
  await $.session.end({ reason: 'clear', sessionId: SESSION, resume: { id: SESSION } } as never)
  await settle(w)
  await cmd($, '')
  const after = await mount($, w, 'terminal')
  expect((await bodyLines(after)).some(l => l.startsWith('Saved this session'))).toBe(false)
  await after.unmount()
})

test('saved under the plugin’s own server name too', async ($, on) => {
  const w = world(on, { tools: PLUGIN_TOOLS })
  on('tool.call', () => ({ result: 'ok', text: '{"stored":true,"id":"mem_new00002"}' }))
  await start($, w)
  await $.tool.call({ tool: 'mcp__plugin_counterparts_counterparts__note', title: 'From the plugin server', text: 'x' } as never)
  await settle(w)
  await cmd($, 'quiet')
  expect(await tail($, w)).toBe('stored: From the plugin server · /counterparts opens it')
})

test('Mechanisms today: times each fired today, from the dashboard; a zero dim with no bar, Schemas not built; a click lists its firings, grouped, and lights its region', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    let lines = await bodyLines(ui)
    const at = lines.findIndex(l => l.startsWith('Mechanisms today'))
    expect(lines[at]).toMatch(/^Mechanisms today ─+ times fired$/)
    expect(lines[at + 1]).toMatch(/^Salience {8}▄+▖?\s+3$/)
    expect(lines[at + 2]).toMatch(/^Emotion {9}\s+0$/) // no bar
    expect(lines[at + 5]).toMatch(/^Retrieval {7}▄{12}\s*12$/) // the longest bar
    expect(lines[at + 12]).toBe('Schemas         ○ not built yet')
    await click(ui, 'Forgetting')
    lines = await bodyLines(ui)
    const f = lines.findIndex(l => l.startsWith('Forgetting'))
    expect(lines[f + 1]).toBe('faded at 3:34:')
    expect(lines[f + 2]).toBe('An old plan that faded')
    expect(w.fetches.some(u => u.endsWith('/api/mechanism?id=decay'))).toBe(true)
    // an event opens in place: it is short
    await click(ui, 'An old plan that faded')
    lines = await bodyLines(ui)
    expect(lines.join('\n')).toContain('It faded at the night.')
    expect(lines.join('\n')).toContain('fact · learned Sep 1')
    await click(ui, 'Forgetting') // again: closed
    expect((await bodyLines(ui)).join('\n')).not.toContain('faded at 3:34:')
    await ui.unmount()
  }
})

test('a mechanism that fired today but names fewer than three in the panel (its lookback, its merged repeats): its own rows are read deeper', async ($, on) => {
  const was = FIRED_TODAY.emotional ?? null
  FIRED_TODAY.emotional = 1
  try {
    const w = world(on, { panelActivity: id => (id === 'emotional' ? [] : EVENTS) })
    w.events.push(ev(460, 'recall.decision', 'On turn 4 a matching mood brought one memory closer.', 30, {
      session: 'sess-older', turn: '4', surfacedCount: '1', footnoteCount: '0', moodMatched: '1',
      surfaced: JSON.stringify([{ id: 'mem_sur00001', sal: 0.6 }]),
    }))
    await start($, w)
    const ui = await mount($, w, 'terminal')
    await click(ui, 'Emotion')
    await settle(w)
    const shown = (await bodyLines(ui)).join('\n')
    expect(w.fetches.some(u => u.includes('/api/activity?name=recall.decision&limit=150'))).toBe(true)
    expect(shown).toContain('brought closer at')
    expect(shown).toContain('The sidebar is 35 columns wide')
    expect(shown).not.toContain('nothing lately')
    // nothing fired today and nothing in the panel: no deeper read
    const before = w.fetches.length
    await click(ui, 'Prospective')
    await settle(w)
    expect(w.fetches.slice(before).some(u => u.includes('/api/activity?name=prospective'))).toBe(false)
    await ui.unmount()
  } finally {
    FIRED_TODAY.emotional = was
  }
})

test('a dashboard older than v0.2 (no firedToday): today’s counts come from the feed’s rows of today, a dream’s rows once', async ($, on) => {
  const w = world(on, { oldDashboard: true })
  w.events.push(ev(402, 'dream.changed', 'In a dream I changed 5 things (1 merge).', 599, { applied: '5', merge: '1' }, 'drm_test0001'))
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const lines = await bodyLines(ui)
  const at = lines.findIndex(l => l.startsWith('Mechanisms today'))
  const count = (name: string): string => (lines.slice(at + 1, at + 13).find(l => l.startsWith(name)) ?? '').trim().split(/\s+/).at(-1) ?? ''
  expect(count('Salience')).toBe('1')
  expect(count('Forgetting')).toBe('1')
  expect(count('Retrieval')).toBe('2')
  expect(count('Consolidation')).toBe('2') // the promotion, and the dream's merge
  expect(count('Dreaming')).toBe('1') // its journal and its changes: one dream
  expect(count('Interference')).toBe('1')
  expect(w.fetches.filter(u => u.includes('/api/activity?name=')).length).toBeGreaterThanOrEqual(18)
  await ui.unmount()
})

test('a dashboard older than v0.2: a row that lands while today is counted is counted once, by the next poll', async ($, on) => {
  const box: { w?: World } = {}
  let landed = false
  const w = world(on, {
    oldDashboard: true,
    // after the pulse said 500: a deposit lands while the cold read reads the deposits
    onFetch: url => {
      if (landed || url.pathname !== '/api/activity' || url.searchParams.get('name') !== 'gate.deposit') return
      landed = true
      box.w?.events.push(ev(600, 'gate.deposit', 'I wrote down one memory.', 0, { accepted: '1', session: SESSION }))
    },
  })
  box.w = w
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const salience = async (): Promise<string> => {
    const lines = await bodyLines(ui)
    const at = lines.findIndex(l => l.startsWith('Mechanisms today'))
    return (lines.slice(at + 1, at + 13).find(l => l.startsWith('Salience')) ?? '').trim().split(/\s+/).at(-1) ?? ''
  }
  expect(landed).toBe(true)
  expect(await salience()).toBe('1') // the cold read stops at 500
  await w.clock.advance(15000)
  await settle(w)
  expect(await salience()).toBe('2') // the poll from 500 adds it, once
  await ui.unmount()
})

test('past midnight with nothing new, today is read again: yesterday’s bars do not stand as today’s', async ($, on) => {
  const w = world(on, { now: new Date(2026, 9, 9, 23, 59, 0).getTime() })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await settle(w)
  const reads = (): number => w.fetches.filter(u => u.endsWith('/api/mechanisms')).length
  const before = reads()
  expect(before).toBeGreaterThanOrEqual(1)
  await w.clock.advance(15000) // a quiet poll, the same day: nothing to read again
  expect(reads()).toBe(before)
  await w.clock.advance(60000) // past midnight, nothing new
  await settle(w)
  expect(reads()).toBeGreaterThan(before)
  await ui.unmount()
})

test('a dashboard whose store keeps another zone: its `today` differs from this clock’s all day, and quiet polls read nothing again', async ($, on) => {
  const w = world(on, { dashToday: '2026-10-10' })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await settle(w)
  const reads = (): number => w.fetches.filter(u => u.endsWith('/api/mechanisms')).length
  const before = reads()
  expect(before).toBeGreaterThanOrEqual(1)
  for (let i = 0; i < 3; i++) await w.clock.advance(15000)
  await settle(w)
  expect(reads()).toBe(before)
  await ui.unmount()
})

test('Last Dream: its first sentence, in its own voice; a click opens the dream itself, no counts', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    let lines = await bodyLines(ui)
    const at = lines.findIndex(l => l.startsWith('Last Dream'))
    expect(lines[at]).toMatch(/^Last Dream ─+ 3:35$/)
    expect(lines.slice(at + 1, at + 3)).toEqual(['I dreamed the plugin and the', 'brain were one thing.'])
    await click(ui, 'I dreamed the plugin')
    lines = await bodyLines(ui)
    expect(lines.join(' ')).toContain('Then the rail became a river, and the river carried the titles.')
    expect(lines.join(' ')).not.toMatch(/what changed|near-copies|pairs of memories|faded|became core/)
    await click(ui, 'I dreamed the plugin')
    expect((await bodyLines(ui)).join(' ')).not.toContain('Then the rail')
    await ui.unmount()
  }
})

test('a click opens a memory in place whatever its length, and never the dashboard by itself: past 20 lines, the last ends with `more`, the one link to it; never through the recall tool', async ($, on) => {
  const w = world(on)
  on('tool.call', (_$, e) => ({ result: 'ok', text: `{"stored":true,"id":"${(e as unknown as { title?: string }).title === 'Long one' ? 'mem_long0001' : 'mem_sur00001'}"}` }))
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Long one', text: 'x' } as never)
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Short one', text: 'x' } as never)
  await settle(w)
  await click(ui, 'Short one')
  let shown = (await bodyLines(ui)).join('\n')
  expect(shown).toContain('The sidebar is 35 columns wide') // its title, in full
  expect(shown).toContain('nothing decorates.')
  expect(shown).toContain('fact · learned Oct 9')
  expect(shown).not.toMatch(/ more$/m)
  await click(ui, '● The sidebar is 35 columns wide') // opened, its own title in full: a click on it closes
  shown = (await bodyLines(ui)).join('\n')
  expect(shown).not.toContain('nothing decorates.')
  await click(ui, 'Long one')
  await settle(w)
  expect(w.runs.some(r => r[0] === 'open')).toBe(false) // in place, not the dashboard
  const lines = await bodyLines(ui)
  expect(lines.join(' ')).toContain('sentence 3 of a long')
  const more = lines.filter(l => / more$/.test(l))
  expect(more).toHaveLength(1)
  expect(more[0]).toMatch(/… more$/)
  // a click on the line's words is the item's (it closes again); only `more` opens the dashboard, on that memory
  await clickWord(ui, '… more', 'more')
  expect(w.runs.at(-1)).toEqual(['open', 'http://localhost:4747/#memories?id=mem_long0001'])
  expect((await bodyLines(ui)).join(' ')).toContain('sentence 3 of a long') // still open
  await w.clock.advance(5 * 60000) // a long read: nothing closes it but a click
  await settle(w)
  expect((await bodyLines(ui)).join(' ')).toContain('sentence 3 of a long')
  await click(ui, '… more')
  expect((await bodyLines(ui)).join(' ')).not.toContain('sentence 3 of a long')
  expect(w.runs.filter(r => r[0] === 'open')).toHaveLength(1)
  expect(w.mcp.filter(c => c.tool === 'recall')).toHaveLength(0)
  await ui.unmount()
})

test('clicks are the same every time: open A, open B (A closes), close B, open A again; nothing closes them but a click', async ($, on) => {
  const w = world(on)
  on('tool.call', (_$, e) => ({ result: 'ok', text: `{"stored":true,"id":"${(e as unknown as { title?: string }).title === 'Long one' ? 'mem_long0001' : 'mem_sur00001'}"}` }))
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Long one', text: 'x' } as never)
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Short one', text: 'x' } as never)
  await settle(w)
  const has = async (t: string) => (await bodyLines(ui)).join(' ').includes(t)
  await click(ui, 'Short one')
  await settle(w)
  expect(await has('nothing decorates.')).toBe(true)
  await click(ui, 'Long one')
  await settle(w)
  expect(await has('nothing decorates.')).toBe(false)
  expect(await has('sentence 3 of a long')).toBe(true)
  await click(ui, 'sentence 3 of a long') // a click on its text closes it
  await settle(w)
  expect(await has('sentence 3 of a long')).toBe(false)
  await click(ui, 'Short one')
  await settle(w)
  expect(await has('nothing decorates.')).toBe(true)
  await w.clock.advance(5 * 60000)
  await settle(w)
  expect(await has('nothing decorates.')).toBe(true)
  expect(w.runs.some(r => r[0] === 'open')).toBe(false)
  await ui.unmount()
})

test('a Subconscious item opens in place by a dashboard read, not the recall tool, and stays open', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await block($, w)
  await settle(w)
  await click(ui, 'Release notes go out on Fridays')
  await settle(w)
  await w.clock.advance(5000)
  await settle(w)
  expect(w.fetches.some(u => u.includes('/api/memory?id=mem_rel00001'))).toBe(true)
  expect(w.runs.some(r => r[0] === 'open')).toBe(false)
  expect(w.mcp.filter(c => c.tool === 'recall')).toHaveLength(0)
  await ui.unmount()
})

test('at a laptop’s height the sections fold to fit, a folded one keeping its heading; a click on it unfolds it', async ($, on) => {
  const w = world(on)
  let n = 0
  on('tool.call', () => ({ result: 'ok', text: `{"stored":true,"id":"mem_n${String((n += 1)).padStart(7, '0')}"}` }))
  await start($, w)
  const small = { ...PANE_PROPS, scroll: { offset: 0, bodyRows: 30 } } as typeof PANE_PROPS
  const ui = await mount($, w, 'terminal', small)
  for (let i = 0; i < 8; i++) await $.tool.call({ tool: 'mcp__counterparts__note', title: `Saved item number ${String(i)} with a title that wraps`, text: 'x' } as never)
  await settle(w)
  let lines = await bodyLines(ui)
  expect(lines.length).toBeLessThanOrEqual(30 - 7 - 4)
  expect(lines.some(l => /^Mechanisms today ─+ times fired$/.test(l))).toBe(true)
  const folded = lines.find(l => l.startsWith('Saved this session'))
  expect(folded).toMatch(/─ 9 ›$/)
  await click(ui, 'Saved this session')
  lines = await bodyLines(ui)
  expect(lines.some(l => l.startsWith('● Saved item number 7'))).toBe(true)
  expect(lines.some(l => /^Mechanisms today ─+ \d+ fired ›$/.test(l))).toBe(true) // folded instead
  await click(ui, 'Saved this session') // again: back as it was
  expect((await bodyLines(ui)).find(l => l.startsWith('Saved this session'))).toMatch(/─ 9 ›$/)
  await ui.unmount()
})

// ── views ──────────────────────────────────────────────────────────────────

test('views: two, the sidebar and quiet; quiet is only the dim tail, ending with how to open it; the band above the prompt draws nothing', async ($, on) => {
  const w = world(on)
  on('tool.call', () => ({ result: 'ok', text: '{"stored":true,"id":"mem_new00001"}' }))
  await start($, w)
  await band($, w, true)
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Button', key: 'view-strip' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'view-sidebar' })).toBeDefined()
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Quiet me (2026-10-09)', text: 'x' } as never)
  await settle(w)
  expect(await tail($, w)).toBeUndefined() // the pane shows: no tail
  await ui.press({ key: 'view-quiet' })
  expect(w.closes).toContain(PANE)
  expect(w.store['view']).toBe('quiet')
  expect(await tail($, w)).toBe('stored: Quiet me · /counterparts opens it') // today's date dropped
  const none = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS, viewport: VIEWPORT })
  await settle(w)
  expect((await none.findAll({})).map(x => x.text).join('')).not.toContain('Quiet me')
  await none.unmount()
  // a long title gives way to the hint, never the other way round
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'A title long enough that a narrow row could not hold it and the hint after it', text: 'x' } as never)
  await settle(w)
  const hint = '? for shortcuts'
  const narrow = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', props: { ...HINT_PROPS, hint } as never, viewport: { ...VIEWPORT, columns: 100 } })
  await settle(w)
  await narrow.unmount()
  const cut = w.tails.at(-1) ?? ''
  expect(cut).toMatch(/^stored: A title long enough.*… · \/counterparts opens it$/)
  // the engine draws more than its `hint` prop holds and keeps cells clear: 32 spare (measured, NOTES)
  expect(hint.length + cut.length).toBeLessThanOrEqual(100 - 32)
  // quiet reads nothing and draws no brain
  const fetches = w.fetches.length
  const blits = w.blits.length
  await w.clock.advance(120000)
  expect(w.fetches.length).toBe(fetches)
  expect(w.blits.length).toBe(blits)
  expect(await cmd($, '')).toBe('Counterparts sidebar opened.')
  expect(w.opens.at(-1)?.columns).toBe(34)
  expect(w.store['view']).toBe('sidebar')
  await ui.unmount()
})

for (const [stored, opens] of [['full', true], ['quiet', false], ['rail', false], ['hidden', false], ['strip', false], [undefined, true]] as const) {
  test(`a stored view from v0.1 or v0.2 carries over: ${String(stored)} ${opens ? 'opens the sidebar' : 'opens no pane'}`, async ($, on) => {
    const w = world(on, { store: stored === undefined ? {} : { view: stored } })
    await start($, w)
    await band($, w, true)
    expect(w.opens.length > 0).toBe(opens)
    if (opens) expect(w.opens[0]?.columns).toBe(34)
    // nothing is rewritten but by opening it (v0.2 writes `sidebar` for the pane)
    expect(w.store['view']).toBe(opens ? 'sidebar' : stored)
    // nothing has happened yet: the tail says only how to open it (a stored `strip`, dropped, reads as quiet)
    if (!opens) expect(await tail($, w)).toBe('Counterparts is quiet · /counterparts opens it')
  })
}

test('the band can draw before session.start has read the stored view: quiet stays quiet, and is not overwritten', async ($, on) => {
  const w = world(on, { store: { view: 'quiet' } })
  await band($, w, true) // before session.start, as measured live in v0.1
  expect(w.opens).toHaveLength(0)
  await start($, w)
  expect(w.store['view']).toBe('quiet')
})

test('a pane drawn before session.start has named the session still finds what this session saved (a resumed session’s first read)', async ($, on) => {
  const w = world(on)
  const ui = await mount($, w, 'terminal') // no session.start yet: the first read asks for the session's id itself
  await settle(w)
  const lines = await bodyLines(ui)
  const s = lines.findIndex(l => l.startsWith('Saved this session'))
  expect(s).toBeGreaterThanOrEqual(0)
  expect(lines.slice(s + 1, s + 3).join(' ')).toContain('The sidebar draws the brain in braille')
  await ui.unmount()
})

test('/counterparts quiet, hide, rail and strip all mean quiet; the commands say what they did', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const verb of ['quiet', 'hide', 'rail']) {
    expect(await cmd($, verb)).toContain('Counterparts quiet')
    expect(w.store['view']).toBe('quiet')
  }
  // the strip is gone: an older put-back that types it gets quiet
  expect(await cmd($, 'strip')).toContain('Counterparts quiet')
  expect(w.store['view']).toBe('quiet')
})

// ── the brain ──────────────────────────────────────────────────────────────

test('turning: the small brain is a Raster repainted by blits; it sways at the calm rate, bursts while an arc flies, rests after a quiet minute; /counterparts fps reports it', async ($, on) => {
  const w = world(on)
  on('tool.call', () => ({ result: 'ok', text: '{"stored":true,"id":"mem_p0000001"}' }))
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const r = await ui.find({ type: 'Raster', key: 'brain' })
  expect(decodeCells(String(r?.props['cells'])).length).toBe(18 * 6 * 3)
  await w.clock.advance(2000)
  expect(await cmd($, 'fps')).toContain('now swaying (6 fps)')
  expect(w.blits.every(b => b.requestId === PANE && b.key === 'brain' && b.columns === 18 && b.rows === 6)).toBe(true)
  await w.clock.advance(90000)
  expect(await cmd($, 'fps')).toContain('now at rest (no timer)')
  let n = w.blits.length
  await w.clock.advance(10000)
  expect(w.blits.length).toBe(n)
  // an opened mechanism wakes it
  await click(ui, 'Forgetting')
  await w.clock.advance(1000)
  expect(w.blits.length - n).toBeGreaterThanOrEqual(1)
  expect(await cmd($, 'fps')).toContain('now swaying')
  await click(ui, 'Forgetting')
  await w.clock.advance(120000)
  expect(await cmd($, 'fps')).toContain('now at rest (no timer)')
  // a pulse (a saved note) wakes it at the burst rate while its arc flies
  n = w.blits.length
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Wake up', text: 'x' } as never)
  await settle(w)
  await w.clock.advance(1000)
  expect(await cmd($, 'fps')).toContain('now in a burst (12 fps)')
  expect(w.blits.length - n).toBeGreaterThanOrEqual(4)
  expect(await cmd($, 'fps')).not.toContain('status line') // the rate is in this reply only
  expect(w.lastStatus()).toBe('')
  const set = await cmd($, 'fps 15')
  expect(set).toContain('Brain target set to 15 fps.')
  await ui.unmount()
})

test('still: a fixed view, no timer; when something fires its region lights for a moment, one frame in and one out', async ($, on) => {
  const w = world(on)
  on('tool.call', () => ({ result: 'ok', text: '{"stored":true,"id":"mem_s0000001"}' }))
  await start($, w)
  expect(await cmd($, 'brain still')).toContain('holds still')
  expect(w.store['brain']).toBe('still')
  const ui = await mount($, w, 'terminal')
  const cellsNow = async () => String((await ui.find({ type: 'Raster', key: 'brain' }))?.props['cells'])
  const rest = await cellsNow()
  await w.clock.advance(5000)
  expect(w.blits).toHaveLength(0)
  expect(await cmd($, 'fps')).toContain('now still (no timer')
  await $.tool.call({ tool: 'mcp__counterparts__note', title: 'Light up', text: 'x' } as never)
  await settle(w)
  expect(await cellsNow()).not.toBe(rest) // Salience's region, lit
  await w.clock.advance(3000)
  await settle(w)
  expect(await cellsNow()).toBe(rest) // and out again
  expect(w.blits).toHaveLength(0)
  await ui.unmount()
})

test('off: no brain, the header is two lines; the footer’s brain row turns it, stored for every session', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'brain-off' })
  expect(w.store['brain']).toBe('off')
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'title' }))?.text).toBe('◉ COUNTERPARTS ↗')
  const blits = w.blits.length
  await w.clock.advance(5000)
  expect(w.blits.length).toBe(blits)
  await ui.press({ key: 'brain-turning' })
  expect(w.store['brain']).toBe('turning')
  expect(await ui.find({ type: 'Raster', key: 'brain' })).toBeDefined()
  await ui.unmount()
})

test('a brain mode set in an earlier session holds in the next', async ($, on) => {
  const w = world(on, { store: { brain: 'off' } })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'brain-off' }))?.text).toBe('● off')
  await ui.unmount()
})

test('the brain stops when its Raster is gone: refused blits stop the timer after a few fresh drawings', async ($, on) => {
  const w = world(on, { blitDeny: true })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  for (let i = 0; i < 6; i++) {
    await w.clock.advance(1000)
    await ui.drawn()
  }
  expect(w.blits).toHaveLength(0)
  expect(w.denied).toBeLessThanOrEqual(4)
  const n = w.denied
  await w.clock.advance(3000)
  await ui.drawn()
  expect(w.denied).toBe(n)
  await ui.unmount()
})

test('a blit refused because the Raster is not mounted yet: a fresh drawing starts the brain again', async ($, on) => {
  const w = world(on, { blitDenyFirst: 1 })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await w.clock.advance(500)
  await ui.drawn()
  await w.clock.advance(4000)
  expect(w.denied).toBe(1)
  expect(w.blits.length).toBeGreaterThanOrEqual(3)
  await ui.unmount()
})

test('closed and opened again, a late refusal of an old blit does not freeze the brain', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await w.clock.advance(500)
  w.slowDeny = 1
  await w.clock.advance(200)
  await cmd($, 'strip')
  await cmd($, '')
  await ui.drawn()
  const before = w.blits.length
  await w.clock.advance(1000)
  await ui.drawn()
  await w.clock.advance(4000)
  expect(w.denied).toBe(1)
  expect(w.blits.length - before).toBeGreaterThanOrEqual(3)
  await ui.unmount()
})

test('/counterparts asks for a fresh drawing: a pane reopened after a hand-close is not left on its settled drawing', async ($, on) => {
  const w = world(on)
  on('ui.invalidate', (_$, e) => {
    w.invalidations.push(e.event)
    return { value: undefined }
  })
  await start($, w)
  expect(await cmd($, '')).toBe('Counterparts sidebar opened.')
  expect(w.invalidations).toContain('ui.render')
})

test('while the pane holds the keyboard (typing a search) the brain holds still; given back, it turns again', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal', { ...PANE_PROPS, isFocused: true } as typeof PANE_PROPS)
  await w.clock.advance(2000)
  expect(w.blits).toHaveLength(0)
  await ui.redraw({ ...PANE_PROPS, isFocused: false } as typeof PANE_PROPS)
  await w.clock.advance(4000)
  expect(w.blits.length).toBeGreaterThanOrEqual(3)
  await ui.unmount()
})

test('one event lights every mechanism it proves: a dream with a merge and a gist lights Dreaming’s region first, its arcs a little apart', async ($, on) => {
  const w = world(on)
  await start($, w)
  await cmd($, 'brain off') // the header's ◉ takes the lit mechanism's stage colour
  const ui = await mount($, w, 'terminal')
  const dot = async () => {
    const t = await ui.find({ type: 'Button', key: 'title' })
    return (t?.children ?? []).map(c => (typeof c === 'object' && c !== null ? (c as { props: Record<string, unknown> }).props['color'] : null))[0]
  }
  const resting = await dot()
  w.events.push(ev(502, 'dream.changed', 'In a dream I changed 47 things (1 merge, 2 gist).', 0, { applied: '49', merge: '1', gist: '2', link: '20' }, 'drm_test0002'))
  await w.clock.advance(15000)
  await settle(w)
  expect(await dot()).toBe(hex(stageOf('dreaming').col, 0.95))
  await w.clock.advance(3000)
  await settle(w)
  expect(await dot()).toBe(resting)
  await ui.unmount()
})

test('a reload keeps the state: a `firing` v0.1 wrote ({ id, at }, no list) draws the pane with nothing lit', async ($, on) => {
  const w = world(on)
  let reads = 0
  on('state.get', { plugin: PLUGIN, key: 'firing' } as never, (() => {
    reads += 1
    return { value: { value: { id: 'retrieval', at: T0 }, version: 1 } }
  }) as never)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(reads).toBeGreaterThan(0)
  expect(await ui.find({ type: 'Raster', key: 'brain' })).toBeDefined()
  await ui.unmount()
})

// ── the dashboard, links, search ───────────────────────────────────────────

test('with the dashboard down the chart says how to start it, inside the pane; the status line says nothing of it', async ($, on) => {
  const w = world(on, { down: true })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect((await bodyLines(ui)).join('\n')).toContain('counterparts dashboard')
    await ui.unmount()
  }
  expect(w.statuses.some(s => (s ?? '').includes('dashboard'))).toBe(false)
})

test('down, a plugin-only install is told the plugin route (no `counterparts` on its PATH)', async ($, on) => {
  const w = world(on, { down: true, tools: PLUGIN_TOOLS })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const text = (await bodyLines(ui)).join('\n')
  expect(text).toContain('/counterparts:dashboard')
  expect(text).not.toContain('counterparts dashboard')
  await ui.unmount()
})

test('down, with no memory server found: the plugin route first, then the npm one', async ($, on) => {
  const w = world(on, { down: true, tools: [] })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  const lines = await bodyLines(ui)
  const plugin = lines.findIndex(l => l.includes('/counterparts:dashboard'))
  const npm = lines.findIndex(l => l.includes('or counterparts dashboard'))
  expect(plugin).toBeGreaterThanOrEqual(0)
  expect(npm).toBeGreaterThan(plugin)
  await ui.unmount()
})

test('the dashboard port comes from COUNTERPARTS_DASHBOARD_PORT, as core reads it: reads and links go there', async ($, on) => {
  const w = world(on, { env: { HOME, COUNTERPARTS_DASHBOARD_PORT: '5151' } })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'title' })
  expect(w.runs.at(-1)).toEqual(['open', 'http://localhost:5151/'])
  expect(w.fetches.length).toBeGreaterThan(0)
  for (const f of w.fetches) expect(f.startsWith('http://localhost:5151/')).toBe(true)
  await ui.unmount()
})

test('a port that is not one falls back to 4747', async ($, on) => {
  const w = world(on, { env: { HOME, COUNTERPARTS_DASHBOARD_PORT: 'nope' } })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'title' })
  expect(w.runs.at(-1)).toEqual(['open', 'http://localhost:4747/'])
  await ui.unmount()
})

test('COUNTERPARTS opens the dashboard on a plain click (how this machine opens a URL, asked once)', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'title' })
  await ui.press({ key: 'title' })
  expect(w.runs[0]).toEqual(['uname', '-s'])
  expect(w.runs.filter(r => r[0] === 'uname')).toHaveLength(1)
  expect(w.runs.at(-1)).toEqual(['open', 'http://localhost:4747/'])
  await ui.unmount()
})

test('on Windows a link opens through rundll32, never cmd', async ($, on) => {
  const w = world(on, { windows: true })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'title' })
  expect(w.runs.at(-1)).toEqual(['rundll32', 'url.dll,FileProtocolHandler', 'http://localhost:4747/'])
  await ui.unmount()
})

test('search: Enter asks recall in facts mode; the results take the sections’ place, each opens in place; a click on the heading clears it', async ($, on) => {
  const w = world(on, { tools: PLUGIN_TOOLS })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    await ui.input({ key: 'q', text: 'publish', kind: 'change' })
    expect(w.mcp.filter(c => c.tool === 'recall')).toHaveLength(surface === 'terminal' ? 0 : 1) // typing asks nothing
    await ui.input({ key: 'q', text: 'publish' })
    expect(w.mcp.filter(c => c.tool === 'recall').at(-1)).toEqual({ server: 'plugin_counterparts_counterparts', tool: 'recall', args: { question: 'publish', mode: 'facts' } })
    let lines = await bodyLines(ui)
    expect(lines[0]).toMatch(/^“publish” ─+ 2 found ✕$/)
    expect(lines.slice(1, 4)).toEqual(['Publishing waits for a test and', 'a review', 'memory · Oct 9 · you said it'])
    expect(lines.some(l => l.startsWith('Mechanisms today'))).toBe(false)
    await click(ui, 'Publishing waits')
    expect((await bodyLines(ui)).join('\n')).toContain('Publishing is mine once it is')
    await click(ui, '“publish”')
    lines = await bodyLines(ui)
    expect(lines.some(l => l.startsWith('Mechanisms today'))).toBe(true)
    await ui.unmount()
  }
})

// ── Claude Code's own memory ───────────────────────────────────────────────

test('the Claude memory switch, opted in (COUNTERPARTS_SIDEBAR_CC_MEMORY=1): on by default; off drops MEMORY.md and the memory section, and the footer draws it off', async ($, on) => {
  const w = world(on, { env: { HOME, COUNTERPARTS_SIDEBAR_CC_MEMORY: '1' } })
  const seen: string[][] = []
  on('prompt.context', (_$, e) => {
    seen.push((e.instructionFiles ?? []).map(f => f.kind))
    return { blocks: e.blocks, ...(e.instructionFiles === undefined ? {} : { instructionFiles: e.instructionFiles }) }
  })
  on('prompt.section', (_$, e) => ({ text: e.text }))
  on('ui.invalidate', (_$, e) => {
    w.invalidations.push(e.event)
    return { value: undefined }
  })
  await start($, w)
  const files = [
    { path: '/work/project/CLAUDE.md', kind: 'project' as const, content: 'project rules' },
    { path: '/home/.claude/projects/x/memory/MEMORY.md', kind: 'memory' as const, content: 'auto memory' },
  ]
  const ask = async () => {
    await $.prompt.context({ blocks: [{ name: 'claudeMd', text: 'project rules\nauto memory' }], instructionFiles: files })
    return (await $.prompt.section({ name: 'memory', text: '# Memory\nYou have a persistent memory.' })).text
  }
  expect(await ask()).toBe('# Memory\nYou have a persistent memory.')
  expect(seen.at(-1)).toEqual(['project', 'memory'])
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('● Claude memory')
    await ui.press({ key: 'toggle-mem' })
    expect(w.invalidations).toEqual(expect.arrayContaining(['prompt.section', 'prompt.context']))
    expect(w.toasts.at(-1)).toContain('off from your next message, in every session')
    expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('○ Claude memory')
    expect(await ask()).toBeNull()
    expect(seen.at(-1)).toEqual(['project'])
    await ui.press({ key: 'toggle-mem' })
    expect(await ask()).toBe('# Memory\nYou have a persistent memory.')
    expect(seen.at(-1)).toEqual(['project', 'memory'])
    await ui.unmount()
  }
  expect(w.lastStatus()).toBe('') // a warning only for a paused folder
})

test('turned off in an earlier session: every session drops it, and the footer draws it off', async ($, on) => {
  const w = world(on, { store: { claudeMemory: false } })
  const seen: string[][] = []
  on('prompt.context', (_$, e) => {
    seen.push((e.instructionFiles ?? []).map(f => f.kind))
    return { blocks: e.blocks }
  })
  await start($, w)
  await $.prompt.context({ blocks: [], instructionFiles: [{ path: '/m/MEMORY.md', kind: 'memory', content: 'x' }] })
  expect(seen.at(-1)).toEqual([])
  const ui = await mount($, w, 'terminal')
  expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('○ Claude memory')
  await ui.unmount()
})

test('headless (-p): nothing opens, ticks or reads', async ($, on) => {
  const w = world(on)
  await start($, w, false)
  await w.clock.advance(120000)
  expect(w.opens).toHaveLength(0)
  expect(w.blits).toHaveLength(0)
  expect(w.fetches).toHaveLength(0)
  expect(w.mcp).toHaveLength(0)
  expect(w.fsReads).toHaveLength(0)
})

// ── the Counterparts switch: every v0.1 safety behaviour, in the footer ─────
// 2026-10-09: a press meant for Claude Code's memory paused ~/random, and the
// sidebar drew the unread state as on while three sessions there ran with no
// wake, no recall and no log lines.

const POSITIONS = ['on', 'paused', 'off'] as const
/** The three-way switch as drawn, its three buttons' text: `● on ○ paused ○ off`. */
async function cpText(ui: Ui): Promise<string> {
  const parts: string[] = []
  for (const p of POSITIONS) parts.push((await ui.find({ type: 'Button', key: `cp-${p}` }))?.text ?? '')
  return parts.join(' ')
}
/** The `on` position's dot is drawn lit (cyan) only for a folder known to be on. */
async function cpLit(ui: Ui): Promise<boolean> {
  const b = await ui.find({ type: 'Button', key: 'cp-on' })
  return (b?.children ?? []).some(c => typeof c === 'object' && c !== null && (c as { props: Record<string, unknown> }).props['color'] === '#00e5ff')
}
/** Calls that would change the folder (a read names no mode). */
const writes = (w: World) => w.mcp.filter(c => c.tool === 'scope' && c.args['mode'] !== undefined)

test('the three-way switch: `Counterparts ● on ○ paused ○ off`, one row of 32 cells; the Claude memory switch hidden by default', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    const row = drawnNode(await ui.drawn(), 'row-cp')
    expect(row?.hover?.['scope']).toBe('counterparts-switch-cp')
    const text = flat(row?.children ?? [])
    expect(text).toBe('Counterparts ● on ○ paused ○ off')
    expect(cells(text)).toBeLessThanOrEqual(32)
    expect(await ui.find({ type: 'Button', key: 'toggle-mem' })).toBeUndefined()
    expect(drawnNode(await ui.drawn(), 'mem-why')).toBeUndefined()
    await ui.unmount()
  }
})

test('the Counterparts switch asks before it pauses a folder set on, and resumes it at once; paused, the brain is grey, a banner says so, and the amber status line', async ($, on) => {
  const w = world(on)
  await start($, w)
  expect(w.mcp).toHaveLength(0)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    const before = w.mcp.length
    await ui.press({ key: 'cp-on' }) // already on: nothing
    await ui.press({ key: 'cp-paused' })
    expect(w.mcp).toHaveLength(before) // the press asked first, and called nothing
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeDefined()
    await ui.press({ key: 'confirm-pause' })
    expect(w.mcp.at(-1)).toEqual({ server: 'counterparts', tool: 'scope', args: { mode: 'pause' } })
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '⏸ Counterparts paused here' })).toBeDefined()
    expect(await cpText(ui)).toBe('○ on ● paused ○ off')
    expect(await cpLit(ui)).toBe(false)
    expect(w.lastStatus()).toBe('⏸ Counterparts memory paused in this folder · /counterparts resume')
    if (surface === 'terminal') {
      const cells = decodeCells(String((await ui.find({ type: 'Raster', key: 'brain' }))?.props['cells']))
      for (let i = 0; i < cells.length; i += 3) {
        const fg = cells[i + 1] ?? 0
        if ((cells[i] ?? 0) === 0x20) continue
        const r = (fg >> 16) & 255, g = (fg >> 8) & 255, b = fg & 255
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40)
      }
    }
    await ui.press({ key: 'cp-paused' }) // already paused: nothing
    expect(w.mcp.at(-1)?.args).toEqual({ mode: 'pause' })
    await ui.press({ key: 'cp-on' }) // resuming asks nothing
    expect(w.mcp.at(-1)).toEqual({ server: 'counterparts', tool: 'scope', args: { mode: 'resume' } })
    expect(w.scope.mode).toBe('on')
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    expect(w.lastStatus()).toBe('')
    await ui.unmount()
  }
  expect(w.mcp.filter(c => c.tool === 'scope' && c.args['mode'] === undefined)).toHaveLength(0)
})

for (const from of ['on', 'paused'] as const) {
  test(`off asks first too, from ${from}; confirmed, the folder is off`, async ($, on) => {
    const w = world(on, { scopeMode: from })
    await start($, w)
    const ui = await mount($, w, 'terminal')
    await ui.press({ key: 'cp-off' })
    expect(writes(w)).toHaveLength(0)
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
    expect((await ui.find({ type: 'Button', key: 'confirm-off' }))?.text).toBe('Turn off')
    const said = (await texts(ui)).replace(/\s+/g, ' ')
    expect(said).toContain(`Turn Counterparts memory off in ${HERE} for every session here?`)
    expect(said).toContain("Nothing is kept or recalled while it's off.")
    await ui.press({ key: 'confirm-off' })
    expect(writes(w).at(-1)?.args).toEqual({ mode: 'off' })
    expect(w.scope.mode).toBe('off')
    expect(await cpText(ui)).toBe('○ on ○ paused ● off')
    expect(await ui.find({ type: 'Text', text: '◌ Counterparts off here' })).toBeDefined()
    expect(w.lastStatus()).toBe('◌ Counterparts memory off in this folder')
    await ui.unmount()
  })
}

test('off: cancelled, or left unanswered, nothing is called', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'cp-off' })
  await ui.press({ key: 'cancel-pause' })
  expect(await ui.find({ type: 'Button', key: 'confirm-off' })).toBeUndefined()
  await ui.press({ key: 'cp-off' })
  await w.clock.advance(31000)
  expect(await ui.find({ type: 'Button', key: 'confirm-off' })).toBeUndefined()
  expect(writes(w)).toHaveLength(0)
  expect(w.scope.mode).toBe('on')
  await ui.unmount()
})

test('a folder set off by its own entry: on turns it back on after one confirm, through the scope tool; Cancel calls nothing; paused and off change nothing', async ($, on) => {
  const w = world(on, { scopeMode: 'off' })
  await start($, w)
  for (const surface of SURFACES) {
    Object.assign(w.scope, { mode: 'off', setBy: HERE })
    await w.clock.advance(61000)
    await settle(w)
    const ui = await mount($, w, surface)
    expect(await ui.find({ type: 'Text', text: '◌ Counterparts off here' })).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'resume-banner' }))?.text).toContain('click to turn it back on')
    expect(await cpText(ui)).toBe('○ on ○ paused ● off')
    expect(w.lastStatus()).toBe('◌ Counterparts memory off in this folder')
    const before = writes(w).length
    await ui.press({ key: 'cp-off' })
    await ui.press({ key: 'cp-paused' })
    expect(writes(w)).toHaveLength(before)
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain('Press on to turn it back on (it asks first).')
    await ui.press({ key: 'cp-on' })
    expect(writes(w)).toHaveLength(before) // asked first
    expect((await ui.find({ type: 'Button', key: 'confirm-on' }))?.text).toBe('Turn on')
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain(`Turn memory back on in ${HERE}? Nothing from while it was off was kept.`)
    await ui.press({ key: 'cancel-pause' })
    expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeUndefined()
    expect(writes(w)).toHaveLength(before)
    await ui.press({ key: 'resume-banner' }) // the banner is the same press as on
    expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeDefined()
    await ui.press({ key: 'confirm-on' })
    expect(writes(w).at(-1)).toEqual({ server: 'counterparts', tool: 'scope', args: { mode: 'on' } })
    expect(w.scope.mode).toBe('on')
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    expect(await ui.find({ type: 'Text', text: '◌ Counterparts off here' })).toBeUndefined()
    expect(w.lastStatus()).toBe('')
    await ui.unmount()
  }
})

test('off because a parent is off: every position explains and names the parent, and nothing is flipped from here', async ($, on) => {
  const w = world(on, { scopeMode: 'off', scopeSetBy: '/work' })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(await cpText(ui)).toBe('○ on ○ paused ● off')
  expect((await ui.find({ type: 'Button', key: 'resume-banner' }))?.text).toContain('off by /work · why')
  for (const key of ['cp-on', 'cp-paused', 'cp-off', 'resume-banner']) {
    await ui.press({ key })
    expect(writes(w)).toHaveLength(0)
    expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeUndefined()
    const said = (await texts(ui)).replace(/\s+/g, ' ')
    expect(said).toContain('This folder is off because /work is set off')
    expect(said).toContain('`counterparts scope /work --on` does.')
  }
  expect(w.scope.mode).toBe('off')
  await ui.unmount()
})

test('a confirm left open while the folder changes elsewhere acts on nothing: an on asked for an off folder, which another session turned on', async ($, on) => {
  const w = world(on, { scopeMode: 'off' })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'cp-on' })
  expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeDefined()
  Object.assign(w.scope, { mode: 'paused' })
  await w.clock.advance(16000)
  await settle(w)
  expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeUndefined() // the row hides: nothing to confirm
  expect(writes(w)).toHaveLength(0)
  await ui.unmount()
})

test('an unset folder is on by default; the switch explains instead of writing a pause or an off that would end as an explicit on', async ($, on) => {
  const w = world(on, { scopeMode: 'unset', scopeSetBy: null })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect(await cpLit(ui)).toBe(true)
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    for (const p of ['paused', 'off'] as const) {
      await ui.press({ key: `cp-${p}` })
      expect(writes(w)).toHaveLength(0)
      expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
      expect(await ui.find({ type: 'Button', key: 'confirm-off' })).toBeUndefined()
      const shown = (await texts(ui)).replace(/\s+/g, ' ')
      expect(shown).toContain('Nothing is set for this folder')
      expect(shown).toContain('--on` gives it one.')
    }
    await ui.unmount()
  }
  expect(w.scope.mode).toBe('unset')
})

test('a folder that follows its parent: the switch explains; paused by a parent, it says where to resume', async ($, on) => {
  const w = world(on, { scopeMode: 'paused', scopeSetBy: '/work' })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(await cpText(ui)).toBe('○ on ● paused ○ off')
  for (const p of POSITIONS) {
    await ui.press({ key: `cp-${p}` })
    expect(writes(w)).toHaveLength(0)
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain('Resume it there: `counterparts scope /work')
  }
  await ui.unmount()
})

test('observer shows as reads-only, not on; a pause of it resumes to observer; on turns it fully on only after the same confirm', async ($, on) => {
  const w = world(on, { scopeMode: 'observer' })
  await start($, w)
  for (const surface of SURFACES) {
    Object.assign(w.scope, { mode: 'observer', setBy: HERE })
    await w.clock.advance(61000)
    await settle(w)
    const ui = await mount($, w, surface)
    expect(await cpText(ui)).toBe('◐ on ○ paused ○ off')
    const wrote = writes(w).length
    await ui.press({ key: 'cp-on' })
    expect(writes(w)).toHaveLength(wrote)
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain(`Turn memory fully on in ${HERE}? New memories will be kept here, for every session.`)
    await ui.press({ key: 'cancel-pause' })
    expect(writes(w)).toHaveLength(wrote)
    await ui.press({ key: 'cp-paused' })
    expect(w.scope.mode).toBe('observer') // asked first
    await ui.press({ key: 'confirm-pause' })
    expect(w.scope.mode).toBe('paused')
    await ui.press({ key: 'cp-on' })
    expect(w.scope.mode).toBe('observer') // resumed to what it was
    await ui.press({ key: 'cp-on' })
    await ui.press({ key: 'confirm-on' })
    expect(writes(w).at(-1)?.args).toEqual({ mode: 'on' })
    expect(w.scope.mode).toBe('on')
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    await ui.unmount()
  }
})

test('a session started in a reads-only folder: its server stands the scope tool down, so a confirmed on (or pause, or off) says the console command instead of the bare refusal', async ($, on) => {
  const w = world(on, { scopeMode: 'observer', scopeWritesStandDown: true })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  for (const [press, confirm, flag] of [['cp-on', 'confirm-on', '--on'], ['cp-paused', 'confirm-pause', '--pause'], ['cp-off', 'confirm-off', '--off']] as const) {
    await ui.press({ key: press })
    await ui.press({ key: confirm })
    expect(writes(w).at(-1)?.tool).toBe('scope')
    expect(w.scope.mode).toBe('observer')
    const said = (await texts(ui)).replace(/\s+/g, ' ')
    expect(said).toContain("so its memory server can't change the setting.")
    expect(said).toContain(`\`counterparts scope ${HERE} ${flag}\` does`)
    expect(said).not.toContain('The memory server said')
    expect(await cpText(ui)).toBe('◐ on ○ paused ○ off')
  }
  await ui.unmount()
})

test('a symlinked folder: its own entry is found under the path it resolves to, so on turns it back on after the confirm', async ($, on) => {
  const w = world(on, { scopeMode: 'off', scopeSetBy: '/real/project', links: { [HERE]: '/real/project' } })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(await cpText(ui)).toBe('○ on ○ paused ● off')
  await ui.press({ key: 'cp-on' })
  expect(writes(w)).toHaveLength(0)
  await ui.press({ key: 'confirm-on' })
  expect(writes(w).at(-1)?.args).toEqual({ mode: 'on' })
  await ui.unmount()
})

for (const [label, parent, links] of [
  ['the parent of the folder it resolves to', '/real', { [HERE]: '/real/project' }],
  ['a symlink to its parent', '/lnk', { [HERE]: '/real/project', '/lnk': '/real' }],
] as const) {
  test(`a symlinked folder off because of ${label}: every position explains, nothing is written`, async ($, on) => {
    const w = world(on, { scopeMode: 'off', scopeSetBy: parent, links })
    await start($, w)
    const ui = await mount($, w, 'terminal')
    expect(await cpText(ui)).toBe('○ on ○ paused ● off')
    for (const key of ['cp-on', 'cp-paused', 'cp-off', 'resume-banner']) {
      await ui.press({ key })
      expect(await ui.find({ type: 'Button', key: 'confirm-on' })).toBeUndefined()
      expect((await texts(ui)).replace(/\s+/g, ' ')).toContain(`This folder is off because ${parent} is set off`)
    }
    expect(writes(w)).toHaveLength(0)
    await ui.unmount()
  })
}

test('where the folder stands is read from the registry file, with no permission check: the tool is called only for a confirmed pause or a resume', async ($, on) => {
  const w = world(on, { permission: 'ask' })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    if (surface === 'terminal') {
      expect(w.mcp).toHaveLength(0)
      expect(await cpLit(ui)).toBe(true) // known: on
      await ui.press({ key: 'cp-paused' })
      expect(w.mcp).toHaveLength(0)
      await ui.press({ key: 'confirm-pause' })
    } else await ui.press({ key: 'cp-on' })
    expect(w.mcp.at(-1)).toEqual({ server: 'counterparts', tool: 'scope', args: { mode: surface === 'terminal' ? 'pause' : 'resume' } })
    await ui.unmount()
  }
  expect(w.mcp).toHaveLength(2)
})

for (const p of POSITIONS) {
  test(`an unknown state is never drawn as on: \`?\` on every position until read; a press on ${p} asks the server, \`…\` meanwhile, and changes nothing`, async ($, on) => {
    const w = world(on, { scopesUnreadable: true, scopeReadMs: 800 })
    await start($, w)
    expect(w.mcp).toHaveLength(0)
    const ui = await mount($, w, 'terminal')
    expect(await cpText(ui)).toBe('? on ? paused ? off')
    expect(await cpLit(ui)).toBe(false)
    expect(w.lastStatus()).toBe('')
    const pressing = ui.press({ key: `cp-${p}` })
    await settle(w)
    expect(await cpText(ui)).toBe('… on … paused … off')
    expect(await cpLit(ui)).toBe(false)
    await w.clock.advance(1000)
    await pressing
    await settle(w)
    expect(await cpText(ui)).toBe('● on ○ paused ○ off')
    expect(writes(w)).toHaveLength(0)
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'confirm-off' })).toBeUndefined()
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain('Counterparts memory is on in this folder. Paused or off asks first.')
    await ui.unmount()
  })
}

type Node = { type?: string; props: Record<string, unknown>; hover?: Record<string, unknown>; children?: unknown[] }

function drawnNode(tree: unknown, key: string): Node | undefined {
  if (tree === null || typeof tree !== 'object') return undefined
  const node = tree as Node
  if (node.props?.['key'] === key) return node
  for (const c of node.children ?? []) {
    const hit = drawnNode(c, key)
    if (hit !== undefined) return hit
  }
  return undefined
}

const CC_OPT_IN = { HOME, COUNTERPARTS_SIDEBAR_CC_MEMORY: '1' }

test('hovered, each memory switch says what a click does, over the rows above the footer: drawn hidden, absolutely placed, so nothing moves', async ($, on) => {
  const w = world(on, { env: CC_OPT_IN })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    const shown = await texts(ui)
    // the card's lines, wrapped to the pane: whole sentences in its two rows, nothing cut
    expect(shown).toContain('Paused or off holds for every')
    expect(shown).toContain('session here; each asks first.')
    expect(shown).toContain("Claude Code's MEMORY.md: a click")
    expect(shown).toContain('turns it off in every session.')
    const tree = await ui.drawn()
    for (const [row, card, scope] of [['row-cp', 'cp-why', 'counterparts-switch-cp'], ['row-mem', 'mem-why', 'counterparts-switch-mem']] as const) {
      expect(drawnNode(tree, row)?.hover?.['scope']).toBe(scope)
      const c = drawnNode(tree, card)
      expect(c?.props['position']).toBe('absolute')
      expect(c?.props['display']).toBe('none')
      expect(c?.hover).toEqual({ display: 'flex', scope })
    }
    await ui.unmount()
  }
})

const HOVER_CASES: [string, WorldOptions, string, string][] = [
  ['on', { env: CC_OPT_IN }, 'Paused or off holds for every session here; each asks first.', "Claude Code's MEMORY.md: a click turns it off in every session."],
  ['observer', { scopeMode: 'observer' }, 'Reads only here. on, paused or off: each asks first.', ''],
  ['paused', { scopeMode: 'paused' }, 'Paused here, for every session. on resumes it; off asks first.', ''],
  ['off', { scopeMode: 'off' }, 'Off here, for every session. on turns it back on (asks first).', ''],
  ['off by a parent', { scopeMode: 'off', scopeSetBy: '/work' }, "This switch can't change this folder. A click says why.", ''],
  ['following a parent', { scopeMode: 'on', scopeSetBy: '/Users/me' }, "This switch can't change this folder. A click says why.", ''],
  ['Claude memory off', { store: { claudeMemory: false } }, '', "Claude Code's own memory is off everywhere. A click turns it on."],
]
for (const [name, opts, cp, mem] of HOVER_CASES) {
  test(`a hover card is whole sentences in its two rows at the pane’s width (${name})`, async ($, on) => {
    const w = world(on, opts)
    await start($, w)
    const ui = await mount($, w, 'terminal')
    const tree = await ui.drawn()
    const card = (key: string): string[] => ((drawnNode(tree, key)?.children ?? []) as unknown[]).map(flat)
    if (cp !== '') expect(card('cp-why').join(' ')).toBe(cp)
    if (mem !== '') expect(card('mem-why').join(' ')).toBe(mem)
    for (const key of ['cp-why', 'mem-why']) expect(card(key).length).toBeLessThanOrEqual(2)
    await ui.unmount()
  })
}

test('while the pause asks, no hover card covers its buttons (the pointer is still on the switch); cancelled, the cards are back', async ($, on) => {
  const w = world(on, { env: CC_OPT_IN })
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    await ui.press({ key: 'cp-paused' })
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeDefined()
    let tree = await ui.drawn()
    expect(drawnNode(tree, 'cp-why')).toBeUndefined()
    expect(drawnNode(tree, 'mem-why')).toBeUndefined()
    await ui.press({ key: 'cancel-pause' })
    tree = await ui.drawn()
    expect(drawnNode(tree, 'cp-why')).toBeDefined()
    expect(drawnNode(tree, 'mem-why')).toBeDefined()
    await ui.unmount()
  }
})

test('pausing asks first: Cancel calls nothing, and an unanswered ask closes by itself', async ($, on) => {
  const w = world(on)
  await start($, w)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    await ui.press({ key: 'cp-paused' })
    expect(writes(w)).toHaveLength(0)
    expect((await texts(ui)).replace(/\s+/g, ' ')).toContain(`Pause Counterparts memory in ${HERE} for every session here?`)
    await ui.press({ key: 'cancel-pause' })
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
    await ui.press({ key: 'cp-paused' })
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeDefined()
    await w.clock.advance(31000)
    expect(await ui.find({ type: 'Button', key: 'confirm-pause' })).toBeUndefined()
    expect(writes(w)).toHaveLength(0)
    expect(w.scope.mode).toBe('on')
    await ui.unmount()
  }
})

test('a paused folder says so in every view: the banner in the pane, the amber status line in the strip and quiet, no tail; /counterparts resume', async ($, on) => {
  const w = world(on, { scopeMode: 'paused' })
  await start($, w)
  const paused = '⏸ Counterparts memory paused in this folder · /counterparts resume'
  expect(w.lastStatus()).toBe(paused) // before any pane is drawn
  const ui = await mount($, w, 'terminal')
  expect((await ui.find({ type: 'Text', text: '⏸ Counterparts paused here' }))?.props['color']).toBe('#ffb347')
  expect((await ui.find({ type: 'Button', key: 'resume-banner' }))?.text).toContain('click to resume')
  await ui.unmount()
  for (const view of ['strip', 'quiet']) {
    await cmd($, view)
    expect(w.lastStatus()).toBe(paused)
    expect(await tail($, w)).toBeUndefined()
  }
  expect(await cmd($, 'resume')).toBe(`Counterparts memory is back on in ${HERE}.`)
  expect(w.mcp.at(-1)?.args).toEqual({ mode: 'resume' })
  expect(w.lastStatus()).toBe('')
})

test('the paused banner resumes with one click', async ($, on) => {
  const w = world(on, { scopeMode: 'paused' })
  await start($, w)
  const ui = await mount($, w, 'terminal')
  await ui.press({ key: 'resume-banner' })
  expect(w.mcp.at(-1)?.args).toEqual({ mode: 'resume' })
  expect(await ui.find({ type: 'Button', key: 'resume-banner' })).toBeUndefined()
  await ui.unmount()
})

test('paused by a parent folder: the banner names it and explains, and resumes nothing here', async ($, on) => {
  const w = world(on, { scopeMode: 'paused', scopeSetBy: '/work' })
  await start($, w)
  expect(w.lastStatus()).toBe('⏸ Counterparts memory paused in this folder · resume it in /work')
  const ui = await mount($, w, 'terminal')
  expect((await ui.find({ type: 'Button', key: 'resume-banner' }))?.text).toContain('paused by /work')
  await ui.press({ key: 'resume-banner' })
  expect(w.mcp.some(c => c.args['mode'] !== undefined)).toBe(false)
  expect((await texts(ui)).replace(/\s+/g, ' ')).toContain('Resume it there: `counterparts scope /work')
  await ui.unmount()
})

test('repro 2026-10-09: another session pauses this folder; a session started there shows paused at once, and never draws on', async ($, on) => {
  const w = world(on, { permission: 'ask' })
  Object.assign(w.scope, { mode: 'paused', setBy: HERE, resumeTo: 'on' })
  await start($, w)
  expect(w.mcp).toHaveLength(0)
  expect(w.lastStatus()).toBe('⏸ Counterparts memory paused in this folder · /counterparts resume')
  await band($, w, true)
  for (const surface of SURFACES) {
    const ui = await mount($, w, surface)
    expect(await ui.find({ type: 'Text', text: '⏸ Counterparts paused here' })).toBeDefined()
    expect(await cpLit(ui)).toBe(false)
    await ui.unmount()
  }
})

test('stale no longer: a pause made in another session shows within one poll while the pane is drawn, and within a minute while closed', async ($, on) => {
  const w = world(on)
  await start($, w)
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Text', text: '⏸ Counterparts paused here' })).toBeUndefined()
  Object.assign(w.scope, { mode: 'paused', setBy: HERE, resumeTo: 'on' })
  await w.clock.advance(16000)
  await settle(w)
  expect(await ui.find({ type: 'Text', text: '⏸ Counterparts paused here' })).toBeDefined()
  expect(w.lastStatus()).toBe('⏸ Counterparts memory paused in this folder · /counterparts resume')
  await cmd($, 'quiet')
  await ui.unmount()
  Object.assign(w.scope, { mode: 'on' })
  await w.clock.advance(61000)
  await settle(w)
  expect(w.lastStatus()).toBe('')
  Object.assign(w.scope, { mode: 'paused' })
  await cmd($, 'fps') // any /counterparts reads it at once
  expect(w.lastStatus()).toContain('⏸ Counterparts memory paused in this folder')
})

test('the registry is the one the wired hooks read: a settings hook’s own --config moves it (and a Bun --config= before the script is Bun’s)', async ($, on) => {
  const hook = '"bun" --no-env-file "--config=/opt/cp/src/adapters/empty-bunfig.toml" run "/opt/cp/src/adapters/claude-code/bin/hook.ts" --config "/cfg/alt/claude-code.json"'
  const settings = JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: hook }] }] } })
  const w = world(on, { scopeMode: 'paused', registryAt: '/cfg/alt/scopes.json', files: { [`${HOME}/.claude/settings.json`]: settings } })
  await start($, w)
  expect(w.fsReads).toContain('/cfg/alt/scopes.json')
  expect(w.fsReads).not.toContain(SCOPES_FILE)
  expect(w.lastStatus()).toBe('⏸ Counterparts memory paused in this folder · /counterparts resume')
})

// ── the Claude memory switch: hidden unless opted in (2026-10-11) ───────────

test('the Claude memory switch is hidden by default and its filter is untouched: MEMORY.md stays, nothing is stored', async ($, on) => {
  const w = world(on, { store: { claudeMemory: true } })
  const seen: string[][] = []
  on('prompt.context', (_$, e) => {
    seen.push((e.instructionFiles ?? []).map(f => f.kind))
    return { blocks: e.blocks }
  })
  await start($, w)
  await $.prompt.context({ blocks: [], instructionFiles: [{ path: '/m/MEMORY.md', kind: 'memory', content: 'x' }] })
  expect(seen.at(-1)).toEqual(['memory'])
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Button', key: 'toggle-mem' })).toBeUndefined()
  expect(w.store['claudeMemorySwitch']).toBeUndefined()
  await ui.unmount()
})

test('whoever had already turned Claude memory off keeps the switch (stored once, so it stays when turned back on)', async ($, on) => {
  const w = world(on, { store: { claudeMemory: false } })
  await start($, w)
  expect(w.store['claudeMemorySwitch']).toBe(true)
  const ui = await mount($, w, 'terminal')
  expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('○ Claude memory')
  await ui.press({ key: 'toggle-mem' }) // back on: the switch stays
  expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('● Claude memory')
  expect(w.store['claudeMemorySwitch']).toBe(true)
  await ui.unmount()
})

test('opted in by the store key alone (`claudeMemorySwitch`), the switch shows', async ($, on) => {
  const w = world(on, { store: { claudeMemorySwitch: true } })
  await start($, w)
  const ui = await mount($, w, 'desktop')
  expect((await ui.find({ type: 'Button', key: 'toggle-mem' }))?.text).toBe('● Claude memory')
  await ui.unmount()
})

// ── the first meeting: speak first, once; "Meet your counterpart" ───────────

const MEET = 'Counterparts is installed. Say hello and introduce yourself.'
const onbFetches = (w: World) => w.fetches.filter(u => u.endsWith('/api/onboarding'))

/** Core's SessionStart wake, as the classic hook injects it: with its onboarding marker on a line of its own, or (null) none, as an older core. */
async function wake($: Engine, w: World, meet: string | null): Promise<void> {
  // As core #419 writes it: the marker on its own line right under the `Now:` clock line, above the wake block.
  const body = [
    'Now: Sunday, October 11, 2026, 1:35 PM',
    ...(meet === null ? [] : [`<!-- counterparts:onboarding meet=${meet} -->`]),
    '<!-- counterparts:wake -->',
    '# Waking up',
    '',
    'Yesterday we worked on the sidebar.',
    '<!-- counterparts:wake/end -->',
  ].join('\n')
  await $.session.append({
    door: 'hook-context',
    origin: { kind: 'hook', event: 'SessionStart' },
    uuid: `wake-${String(w.events.length)}`,
    message: {
      type: 'attachment',
      name: 'hook_additional_context',
      content: [{ type: 'text', text: `<system-reminder>\nSessionStart hook additional context: ${body}\n</system-reminder>` }],
    },
  } as never)
  await settle(w)
}

async function startWith($: Engine, w: World, meet: string | null, interactive = true): Promise<void> {
  await start($, w, interactive)
  await wake($, w, meet)
}

test('speak first: the wake’s marker says not_started, so the first interactive start submits the line once and stores that it did; the dashboard is not asked', async ($, on) => {
  const w = world(on)
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  expect(w.store['meetTriggered']).toEqual({ session: SESSION, at: T0 })
  expect(onbFetches(w)).toHaveLength(0)
  // session.start and the wake again (a reload, a /clear): nothing more.
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  // The triggering session draws no button while Claude introduces itself.
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Button', key: 'meet' })).toBeUndefined()
  await ui.unmount()
})

test('speak first: the wake can land before the plugin’s session.start; the start’s look then decides', async ($, on) => {
  const w = world(on)
  await wake($, w, 'not_started')
  expect(w.submits).toHaveLength(0)
  await start($, w)
  await settle(w)
  expect(w.submits).toEqual([MEET])
})

test('a compaction’s wake carries the marker again (still not_started until core’s meet is called): nothing more is submitted', async ($, on) => {
  const w = world(on)
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  await wake($, w, 'not_started') // SessionStart after /compact
  await w.clock.advance(61000)
  await settle(w)
  expect(w.submits).toEqual([MEET])
})

test('the marker under the wake’s clock line leaves the rest alone: a recall block in the same context still fills Memories', async ($, on) => {
  const w = world(on, { store: { meetTriggered: { settled: 'done', at: T0 } } })
  await start($, w)
  await block($, w, `Now: Sunday, October 11, 2026, 1:35 PM\n<!-- counterparts:onboarding meet=done -->\n${RECALL_BLOCK}`)
  const ui = await mount($, w, 'terminal')
  expect((await bodyLines(ui)).join('\n')).toContain('Release notes go out on Fridays')
  expect(w.submits).toHaveLength(0)
  await ui.unmount()
})

/** A same-day resume's SHORT wake (core #415): one line pointing at the wake above, the since-line, and (core #419) the marker under the clock line. */
async function shortWake($: Engine, w: World, meet: string | null): Promise<void> {
  const body = [
    'Now: Sunday, October 11, 2026, 3:50 PM',
    ...(meet === null ? [] : [`<!-- counterparts:onboarding meet=${meet} -->`]),
    'Counterparts: this session was resumed; the wake it was handed when it started (above) still holds.',
    'Since you started: 2 memories kept in ~/random.',
  ].join('\n')
  await $.session.append({
    door: 'hook-context',
    origin: { kind: 'hook', event: 'SessionStart' },
    uuid: `short-wake-${String(w.events.length)}`,
    message: { type: 'attachment', name: 'hook_additional_context', content: [{ type: 'text', text: `<system-reminder>\nSessionStart hook additional context: ${body}\n</system-reminder>` }] },
  } as never)
  await settle(w)
}

test('a same-day resume’s short wake: the marker is read from it (the button follows), and a resumed session (turns replayed) never speaks first', async ($, on) => {
  const w = world(on, { turns: 3 })
  await start($, w)
  await shortWake($, w, 'not_started')
  expect(w.submits).toHaveLength(0)
  await shortWake($, w, 'later')
  const ui = await mount($, w, 'terminal')
  expect((await ui.find({ type: 'Button', key: 'meet' }))?.text).toBe('Meet your counterpart')
  // Day and count are the dashboard's, not the wake's: the header reads them as before.
  expect(await texts(ui)).toContain('day 18')
  expect(await texts(ui)).toContain('776 memories')
  await ui.unmount()
})

test('a short wake with no marker (a core between #415 and #419): unknown, nothing happens, the pane draws as usual', async ($, on) => {
  const w = world(on, { turns: 3 })
  await start($, w)
  await shortWake($, w, null)
  const ui = await mount($, w, 'terminal')
  expect(await ui.find({ type: 'Button', key: 'meet' })).toBeUndefined()
  expect(await texts(ui)).toContain('776 memories')
  expect(w.submits).toHaveLength(0)
  await ui.unmount()
})

test('speak first: a second session (or a restart) finds the mark and submits nothing', async ($, on) => {
  const w = world(on, { store: { meetTriggered: { session: 'sess-older', at: T0 - 60000 } } })
  await startWith($, w, 'not_started')
  expect(w.submits).toHaveLength(0)
})

test('keyed to the store: once core moved past not_started the mark is settled, and a not_started after it (start-fresh) gets its own first meeting', async ($, on) => {
  const w = world(on, { store: { meetTriggered: { settled: 'done', at: T0 - 86400000 } } })
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  expect(w.store['meetTriggered']).toEqual({ session: SESSION, at: T0 })
})

test('keyed to the store: a binding mark is settled when core says the meeting moved on', async ($, on) => {
  const w = world(on, { store: { meetTriggered: { session: 'sess-older', at: T0 - 60000 } } })
  await startWith($, w, 'done')
  expect(w.store['meetTriggered']).toEqual({ settled: 'done', at: T0 })
  expect(w.submits).toHaveLength(0)
})

const NEVER: [string, WorldOptions, string | null, boolean?][] = [
  ['the folder paused', { scopeMode: 'paused' }, 'not_started'],
  ['the folder off', { scopeMode: 'off' }, 'not_started'],
  ['the folder reads only (observer)', { scopeMode: 'observer' }, 'not_started'],
  ['paused by a parent', { scopeMode: 'paused', scopeSetBy: '/work' }, 'not_started'],
  ['the folder’s state unknown', { scopesUnreadable: true }, 'not_started'],
  ['a prompt already sent (a resumed session)', { turns: 1 }, 'not_started'],
  ['a prompt being typed', { draft: 'how do I' }, 'not_started'],
  ['no marker in the wake (an older core), even with the endpoint saying not_started', { onboarding: { meet: 'not_started' } }, null],
  ['no marker and no endpoint (today’s core)', {}, null],
  ['a marker naming a state it doesn’t know', {}, 'maybe'],
  ['the wake says later', {}, 'later'],
  ['the wake says offered', {}, 'offered'],
  ['the wake says done', {}, 'done'],
  ['the wake says skipped', {}, 'skipped'],
  ['headless (-p)', {}, 'not_started', false],
]
for (const [name, opts, meet, interactive] of NEVER) {
  test(`speak first never fires with ${name}, and leaves no mark of having fired`, async ($, on) => {
    const w = world(on, opts)
    await startWith($, w, meet, interactive ?? true)
    await w.clock.advance(120000)
    await settle(w)
    expect(w.submits).toHaveLength(0)
    const mark = w.store['meetTriggered'] as { session?: unknown } | undefined
    expect(mark?.session).toBeUndefined()
    if (interactive === false) expect(w.fetches).toHaveLength(0)
  })
}

test('the person spoke first: a prompt they sent before the start’s look stands the speak-first down', async ($, on) => {
  const w = world(on)
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual(['hello'])
  expect(w.store['meetTriggered']).toBeUndefined()
})

test('a slash command the person ran first (/model: no turn) counts as having spoken: no speak-first', async ($, on) => {
  const w = world(on)
  on('command.run', { command: 'model' }, () => ({ text: 'Set model to opus' }))
  await $.command.run({ command: 'model', args: 'opus', origin: { kind: 'composer' } } as never)
  await startWith($, w, 'not_started')
  expect(w.submits).toHaveLength(0)
  expect(w.store['meetTriggered']).toBeUndefined()
})

test('a speak-first still queued when the person’s own prompt goes first is dropped', async ($, on) => {
  const w = world(on)
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  const r = await $.prompt.submit({ text: MEET, origin: { kind: 'plugin', name: 'counterparts' }, wait: false })
  expect(r).toEqual({ drop: 'the person spoke first' })
  expect(w.submits).toEqual([MEET, 'hello'])
})

test('a speak-first still queued when the person only ran a slash command (/model: no turn, no reply) goes through', async ($, on) => {
  const w = world(on)
  on('command.run', { command: 'model' }, () => ({ text: 'Set model to opus' }))
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  await $.command.run({ command: 'model', args: 'opus', origin: { kind: 'composer' } } as never)
  const r = await $.prompt.submit({ text: MEET, origin: { kind: 'plugin', name: 'counterparts' }, wait: false })
  expect(r).not.toEqual({ drop: 'the person spoke first' })
  expect(w.submits).toEqual([MEET, MEET])
})

const meetRow = async (ui: Ui) => ui.find({ type: 'Button', key: 'meet' })

for (const meet of ['later', 'offered'] as const) {
  test(`Meet your counterpart: the wake says ${meet}, so a cyan row tops the body; a press submits the same line, once a minute at most`, async ($, on) => {
    const w = world(on)
    await startWith($, w, meet)
    for (const surface of SURFACES) {
      const ui = await mount($, w, surface)
      expect((await meetRow(ui))?.text).toBe('Meet your counterpart')
      expect((await ui.find({ type: 'Text', text: 'Meet your counterpart' }))?.props['color']).toBe('#00e5ff')
      // at the top of the body: after the header, before the sections
      const keys = (((await ui.drawn()) as unknown as Node).children ?? []).map(c => (c as Node).props?.['key'])
      const head = Math.max(keys.indexOf('head'), keys.indexOf('head2'))
      expect(head).toBeGreaterThanOrEqual(0)
      expect(keys.indexOf('meet')).toBeGreaterThan(head)
      expect(keys.indexOf('meet')).toBeLessThan(keys.indexOf('body'))
      await ui.unmount()
    }
    const ui = await mount($, w, 'terminal')
    await ui.press({ key: 'meet' })
    await settle(w)
    expect(w.submits).toEqual([MEET])
    await ui.press({ key: 'meet' })
    await settle(w)
    expect(w.submits).toEqual([MEET])
    await w.clock.advance(61000)
    await ui.press({ key: 'meet' })
    await settle(w)
    expect(w.submits).toEqual([MEET, MEET])
    await ui.unmount()
  })
}

const HIDDEN: [string, WorldOptions, string | null][] = [
  ['done', {}, 'done'],
  ['skipped', {}, 'skipped'],
  ['unknown (no marker: an older core)', {}, null],
  ['not_started, before any speak-first', { turns: 1 }, 'not_started'],
  ['later, in a paused folder', { scopeMode: 'paused' }, 'later'],
  ['later, in a folder set off', { scopeMode: 'off' }, 'later'],
  ['later, the folder unknown', { scopesUnreadable: true }, 'later'],
]
for (const [name, opts, meet] of HIDDEN) {
  test(`Meet your counterpart is hidden: ${name}`, async ($, on) => {
    const w = world(on, opts)
    await startWith($, w, meet)
    const ui = await mount($, w, 'terminal')
    expect(await meetRow(ui)).toBeUndefined()
    expect(await texts(ui)).not.toContain('Meet your counterpart')
    await ui.unmount()
  })
}

test('not_started though the speak-first went out in an earlier session (its turn never reached core): the button offers it again', async ($, on) => {
  const w = world(on, { store: { meetTriggered: { session: 'sess-older', at: T0 - 86400000 } } })
  await startWith($, w, 'not_started')
  const ui = await mount($, w, 'terminal')
  expect((await meetRow(ui))?.text).toBe('Meet your counterpart')
  expect(w.submits).toHaveLength(0)
  await ui.unmount()
})

test('the dashboard down: what the wake said stands', async ($, on) => {
  const w = world(on, { down: true })
  await startWith($, w, 'later')
  const ui = await mount($, w, 'terminal')
  expect(await meetRow(ui)).toBeDefined()
  await ui.unmount()
})

test('the dashboard up refreshes it through the existing poll: done, the button goes, and the polls stop asking', async ($, on) => {
  const w = world(on, { onboarding: { meet: 'later' } })
  await startWith($, w, 'later')
  const ui = await mount($, w, 'terminal')
  expect(await meetRow(ui)).toBeDefined()
  w.onboarding = { meet: 'done' }
  await w.clock.advance(16000)
  await settle(w)
  expect(await meetRow(ui)).toBeUndefined()
  expect(w.store['meetTriggered']).toEqual(expect.objectContaining({ settled: 'done' }))
  const asked = onbFetches(w).length
  await w.clock.advance(60000)
  await settle(w)
  expect(onbFetches(w)).toHaveLength(asked)
  await ui.unmount()
})

test('a queued speak-first is still dropped when the person’s reply called core’s meet meanwhile (the state offered, read from the dashboard)', async ($, on) => {
  const w = world(on, { onboarding: { meet: 'not_started' } })
  on('tool.call', () => ({ result: 'ok', text: '{"script":"..."}' }))
  await startWith($, w, 'not_started')
  expect(w.submits).toEqual([MEET])
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  w.onboarding = { meet: 'offered' }
  await $.tool.call({ tool: 'mcp__counterparts__meet' } as never)
  await settle(w)
  const r = await $.prompt.submit({ text: MEET, origin: { kind: 'plugin', name: 'counterparts' }, wait: false })
  expect(r).toEqual({ drop: 'the person spoke first' })
})

test('a queued speak-first is still dropped when a warm poll read the state offered meanwhile', async ($, on) => {
  const w = world(on, { onboarding: { meet: 'not_started' } })
  await startWith($, w, 'not_started')
  const ui = await mount($, w, 'terminal')
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  w.onboarding = { meet: 'offered' }
  await w.clock.advance(16000)
  await settle(w)
  const r = await $.prompt.submit({ text: MEET, origin: { kind: 'plugin', name: 'counterparts' }, wait: false })
  expect(r).toEqual({ drop: 'the person spoke first' })
  await ui.unmount()
})
