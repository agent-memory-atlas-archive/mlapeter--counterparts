### Decided by the wake-ceiling builder, 2026-10-12, lightly held (Claude Code's default wake ceiling)

- Decided by the wake-ceiling builder, 2026-10-12, lightly held: every Claude Code install
  (the plugin's first run, `install` with no terminal or with `--yes`, and the terminal's)
  writes `injectionBudgetBytes: 9000` into a configuration it creates when no `--budget` was
  given. `install --host claude-desktop` still writes none. A forced re-install over a file
  without the key still writes none (B1: nothing is invented over a kept file). Why: the
  0.3.20 release check found that the plugin's first run is `install --no-connect` with stdin
  ignored, so it took the scripted arm, which wrote no key. The renderer refuses an undefined
  ceiling (`briefing.no-budget`), so every plugin install since 0.3.13 woke on the bootstrap
  line every day. The scripted arm's silence came from scar §2.18 ("the ceiling is a host
  capability, not a core constant"). The core keeps that rule: it still has no default. 9,000
  is the Claude Code adapter's own measured number, the one the terminal arm has written since
  2026-09-22 and the self page's room is sized against.
- Decided by the wake-ceiling builder, 2026-10-12, lightly held: a configuration without the
  key wakes under 9,000 at load (`config.ts#withBudgetDefault`), applied by the hook, the
  worker and night run (`runnerConfig`), `catch-up`, doctor and `rebrief` (a config found
  without the key). No config file is rewritten. The value is marked
  `injectionBudgetDefaulted`, `capabilities()` still says `reported: false`, the hook's
  `adapter.budget.unreported` tripwire still fires (with `defaulted: 9000`), and doctor's Config line says
  "wake ceiling 9000 bytes, Claude Code's default". Why: installs already made by the plugin (0.3.13–0.3.19)
  or by a scripted `install` (any version before this) have no key, and none of them should need to do anything.
  Claude Desktop's MCP server does not apply the default, because that host has no measured
  ceiling. Side effect: the room a prompt's recall may take on those installs becomes 9,000
  instead of `RECALL_TUNABLES.BUDGET_BYTES` (2,048), the same as a terminal install's.
- Decided by the #466 reviewer, 2026-10-12, lightly held: left as built, with the wording
  corrected. Claude Desktop's server applies no default, but the worker its `wake` starts is
  Claude Code's runner (`runnerConfig`), which does, and `install --host claude-desktop` writes
  the same default `claude-code.json`. So a keyless store a Desktop chat wakes from is rendered
  at 9,000 and delivered as the published bundle. Why: 9,000 bytes fits the tool result's
  24,000 characters, and a composed wake is what that person was missing too.
