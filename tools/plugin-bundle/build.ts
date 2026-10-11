/**
 * BUILD THE PLUGIN BUNDLE — the Claude Code plugin as a folder of its own, for
 * a repository whose root is the plugin (planned: mlapeter/counterparts-plugin)
 * and for Anthropic's plugin directory.
 *
 *   ~/.bun/bin/bun tools/plugin-bundle/build.ts <out-dir>        write the bundle
 *   ~/.bun/bin/bun tools/plugin-bundle/build.ts --list           print the file set, write nothing
 *
 * Why a bundle: the directory reads the plugin folder, and today that folder is
 * this whole repository (tests, docs, dev tools: 800+ files against a limit of
 * 512, and this repository's own package.json and bun.lock). People who install
 * a plugin get only its folder, so the bundle has to hold everything the plugin
 * runs and nothing else.
 *
 * THE FILE SET IS TRACED, NOT LISTED. The roots are what Claude Code reads:
 * `.claude-plugin/plugin.json` (the MCP server's command, the mod's `types`),
 * `hooks/hooks.json` (the five hooks' command, the sidebar mod's `modules`)
 * and `commands/*.md`. Every `${CLAUDE_PLUGIN_ROOT}/<path>` they name is
 * followed: into the launcher (`plugin-run.sh`, whose `$here/<path>` names the
 * three entries — hook.mjs, serve.mjs, counterparts.mjs — and the empty
 * bunfig), and from each module through every import (TypeScript's own
 * pre-processor: static, type-only and string-literal dynamic imports), every
 * `new URL("./x", import.meta.url)` (the scripts a process spawns: runner,
 * nightly, the night run's server) and every `packagePath("…")` (files read
 * from the install). The dashboard's page is followed the way a browser would:
 * from `app.html` through `src`/`href`, module imports and CSS `url()`, plus
 * the licence texts that sit beside a vendored file or font.
 *
 * GENERATED, not copied: `.claude-plugin/plugin.json` (this repository's, with
 * `version` = package.json's and the directory listing fields), a minimal
 * `package.json` and `bun.lock` naming only the embedding table (Claude Code
 * installs that at plugin install: docs/plugin.md), and README.md
 * (tools/plugin-bundle/bundle-readme.md).
 *
 * It refuses, rather than writes, a bundle that breaks a directory rule it can
 * check here: a symlink, a test or module doc, a macOS/Windows system file, a
 * file over 5 MiB, more than 512 files, or versions that disagree.
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, posix, relative, resolve, sep } from "node:path";
import ts from "typescript";

export const REPO = resolve(import.meta.dir, "../..");
const HERE = import.meta.dir;

/** The plugin directory's limits (claude.com/docs/plugins/pre-submission-checklist). */
export const MAX_FILES = 512;
export const MAX_INSPECTED_BYTES = 256 * 1024; // larger, not an image or font: held for a reviewer
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // larger: validation stops

/** The only package the bundle installs: the embedding table, ~30 MB, too big to ship. */
export const MODEL_PACKAGE = "counterparts-model-potion";

/** Directory listing fields and keywords the generated manifest adds
 *  (code.claude.com/docs/en/plugins/manifest-reference#directory-listing-fields).
 *  privacyPolicyUrl is a PLACEHOLDER until counterparts.ai/privacy exists; no
 *  icon until there is an image. */
export const LISTING = {
  documentationUrl: "https://github.com/mlapeter/counterparts#readme",
  supportUrl: "https://github.com/mlapeter/counterparts/issues",
  privacyPolicyUrl: "https://counterparts.ai/privacy",
} as const;
export const EXTRA_KEYWORDS = ["long-term memory", "recall", "context", "local", "sidebar", "sessions", "privacy"] as const;

/** Bare imports a module may make: the runtimes' built-ins, and the engine a
 *  hooks module (the sidebar) runs inside. Anything else would need an
 *  installed package the bundle does not have. */
const BARE_OK = /^(node:|bun:|bun$|claude-code$)/;

/** What never belongs in the bundle, whatever names it. */
const FORBIDDEN: readonly [RegExp, string][] = [
  [/(^|\/)(NOTES|CONTRACT|INTERFACE-GAPS)\.md$/, "a module doc"],
  [/\.test\.[cm]?[jt]sx?$/, "a test"],
  [/(^|\/)tests?\//, "a test folder"],
  [/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|(^|\/)__MACOSX(\/|$)/i, "a macOS or Windows system file"],
  [/(^|\/)(bunfig\.toml|\.npmrc|\.yarnrc(\.yml)?|uv\.toml)$/, "a package-manager configuration file"],
  [/(^|\/)CLAUDE\.md$/, "a CLAUDE.md (not loaded from a plugin; validate warns)"],
  [/^bin\//, "a top-level bin/ (chat and Cowork refuse a plugin with one)"],
];

export interface Plan {
  /** Repository-relative paths copied as they are, sorted. */
  readonly copied: readonly string[];
  /** Bundle-relative path → content, written fresh. */
  readonly generated: Readonly<Record<string, string>>;
  readonly version: string;
}

// ── tracing ────────────────────────────────────────────────────────────────

function isFile(repo: string, rel: string): boolean {
  const abs = join(repo, rel);
  return existsSync(abs) && statSync(abs).isFile();
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/** A relative module specifier from `from`, resolved the way the runtimes do
 *  here: as written, `./x.js` → `./x.ts`/`.tsx` (the NodeNext convention,
 *  adapters/node-hooks.mjs), and the extensionless forms a hooks module uses. */
function resolveModule(repo: string, from: string, spec: string): string | null {
  const base = toPosix(normalize(join(dirname(from), spec)));
  const tries = [base];
  if (/\.js$/.test(base)) tries.push(base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"));
  tries.push(`${base}.ts`, `${base}.tsx`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.d.ts`);
  for (const t of tries) if (isFile(repo, t)) return t;
  return null;
}

/** Every `${CLAUDE_PLUGIN_ROOT}/<path>` a manifest, hooks file or command names. */
function pluginRootPaths(text: string): string[] {
  return [...text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+)/g)].map((m) => m[1]!);
}

/** The bundle's file set, traced from what Claude Code reads. */
export function traceFiles(repo: string = REPO): { files: string[]; problems: string[] } {
  const files = new Set<string>();
  const problems: string[] = [];
  const queue: string[] = [];
  const add = (rel: string, why: string): void => {
    const r = toPosix(normalize(rel));
    if (r.startsWith("..") || r.startsWith("/")) {
      problems.push(`${why} names ${rel}, outside the plugin`);
      return;
    }
    if (!isFile(repo, r)) {
      problems.push(`${why} names ${rel}, which is not a file`);
      return;
    }
    if (!files.has(r)) {
      files.add(r);
      queue.push(r);
    }
  };

  // The roots Claude Code reads.
  const manifest = readFileSync(join(repo, ".claude-plugin/plugin.json"), "utf8");
  for (const p of pluginRootPaths(manifest)) add(p, "plugin.json");
  const types = (JSON.parse(manifest) as { types?: string }).types;
  if (typeof types === "string") add(types, "plugin.json `types`");
  add(".claude-plugin/binaries.json", "plugin-run.sh (the single binary's checksums)");

  add("hooks/hooks.json", "Claude Code (hooks/hooks.json)");
  const hooks = readFileSync(join(repo, "hooks/hooks.json"), "utf8");
  for (const p of pluginRootPaths(hooks)) add(p, "hooks/hooks.json");
  for (const m of (JSON.parse(hooks) as { modules?: string[] }).modules ?? []) add(join("hooks", m), "hooks/hooks.json `modules`");

  for (const name of readdirSync(join(repo, "commands")).sort()) {
    if (!name.endsWith(".md")) continue;
    add(`commands/${name}`, "Claude Code (commands/)");
    for (const p of pluginRootPaths(readFileSync(join(repo, "commands", name), "utf8"))) add(p, `commands/${name}`);
  }

  // The dashboard's server, which `plugin-run.sh cli dashboard` starts in the
  // console's process (the CLI imports it, so this only says so out loud).
  add("src/adapters/dashboard/web/server.ts", "the dashboard (`counterparts dashboard`)");

  // Follow every file.
  while (queue.length > 0) {
    const f = queue.shift()!;
    const text = readFileSync(join(repo, f), "utf8");
    if (f.endsWith(".sh")) {
      // `$here` is the script's own directory (plugin-run.sh); `$here/../..`,
      // the plugin root, is a directory and not a file to carry.
      for (const m of text.matchAll(/\$here\/([A-Za-z0-9_./-]+)/g)) {
        const rel = join(dirname(f), m[1]!);
        if (!(existsSync(join(repo, rel)) && statSync(join(repo, rel)).isDirectory())) add(rel, f);
      }
      continue;
    }
    if (!/\.(m?[jt]sx?)$/.test(f) || f.endsWith(".d.ts")) {
      if (f.endsWith(".d.ts")) followModule(repo, f, text, add, problems);
      continue;
    }
    followModule(repo, f, text, add, problems);
  }

  // The dashboard's page: served from a directory the server names by
  // `packagePath`, so the browser's references are followed from app.html.
  const web = "src/adapters/dashboard/web";
  if (files.has(`${web}/server.ts`)) {
    for (const w of traceWeb(repo, web, problems)) add(w, "the dashboard's page");
  }

  return { files: [...files].sort(), problems };
}

function followModule(
  repo: string,
  f: string,
  text: string,
  add: (rel: string, why: string) => void,
  problems: string[],
): void {
  const src = text.replace(/^#!.*\n/, "\n");
  const specs = ts.preProcessFile(src, true, true).importedFiles.map((i) => i.fileName);
  for (const spec of specs) {
    if (spec.startsWith(".")) {
      const r = resolveModule(repo, f, spec);
      if (r === null) problems.push(`${f} imports ${spec}, which resolves to no file`);
      else add(r, f);
    } else if (!BARE_OK.test(spec)) {
      problems.push(`${f} imports the package ${spec}, which the bundle does not install`);
    }
  }
  // Scripts a process starts or a launcher runs, by URL from the module.
  for (const m of src.matchAll(/new URL\(\s*["'`](\.{1,2}\/[^"'`$]*[^/"'`$])["'`]\s*,\s*import\.meta\.url\s*\)/g)) {
    add(join(dirname(f), m[1]!), f);
  }
  // Files read from the install by their path from the package root. A
  // directory (the dashboard's web root, `src` for log trimming) is not a file
  // list; package.json is generated.
  for (const m of src.matchAll(/packagePath\(\s*["'`]([^"'`$]+)["'`]/g)) {
    const rel = m[1]!;
    if (rel === "package.json" || rel.startsWith("node_modules/")) continue;
    if (existsSync(join(repo, rel)) && statSync(join(repo, rel)).isDirectory()) continue;
    add(rel, f);
  }
}

/** The dashboard page's static files, followed from app.html as a browser
 *  would: `src=`/`href=`, ES module imports, CSS `url()`/`@import`. Absolute
 *  URLs are from the web root; a licence text beside a referenced file rides
 *  with it. */
export function traceWeb(repo: string, web: string, problems: string[] = []): string[] {
  const out = new Set<string>();
  const queue: string[] = [];
  const at = (from: string, url: string): void => {
    if (/^(https?:|data:|#|mailto:)/.test(url)) return;
    const clean = url.replace(/[?#].*$/, "");
    const rel = clean.startsWith("/") ? posix.join(web, clean) : posix.join(posix.dirname(from), clean);
    if (!isFile(repo, rel)) {
      // The favicon is served from memory (server.ts#FAVICON_SVG).
      if (clean !== "/favicon.svg") problems.push(`${from} references ${url}, which is not a file`);
      return;
    }
    if (!out.has(rel)) {
      out.add(rel);
      queue.push(rel);
    }
  };
  at(`${web}/app.html`, "/app.html");
  while (queue.length > 0) {
    const f = queue.shift()!;
    const text = readFileSync(join(repo, f), "utf8");
    if (f.endsWith(".html")) {
      for (const m of text.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)) at(f, m[1]!);
      for (const m of text.matchAll(/<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g)) {
        for (const i of ts.preProcessFile(m[1]!, true, true).importedFiles) at(f, i.fileName);
      }
    } else if (f.endsWith(".js")) {
      for (const i of ts.preProcessFile(text, true, true).importedFiles) at(f, i.fileName);
    } else if (f.endsWith(".css")) {
      for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) at(f, m[1]!);
      for (const m of text.matchAll(/@import\s+["']([^"']+)["']/g)) at(f, m[1]!);
    }
  }
  // Licence texts beside vendored code and fonts (OFL, MIT: they travel with the files).
  for (const dir of new Set([...out].map((f) => posix.dirname(f)))) {
    for (const name of readdirSync(join(repo, dir))) {
      if (/^(OFL|MIT|LICENSE)[^/]*\.txt$/i.test(name)) out.add(`${dir}/${name}`);
    }
  }
  return [...out].sort();
}

// ── generated files ────────────────────────────────────────────────────────

function readJson<T>(repo: string, rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T;
}

/** The exact version and integrity bun.lock pins for one package. */
export function lockedPackage(repo: string, name: string): { version: string; integrity: string } {
  const lock = readFileSync(join(repo, "bun.lock"), "utf8");
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`"${esc}": \\["${esc}@([^"]+)", "[^"]*", \\{[^}]*\\}, "(sha512-[^"]+)"\\]`).exec(lock);
  if (m === null) throw new Error(`bun.lock pins no ${name}`);
  return { version: m[1]!, integrity: m[2]! };
}

export function bundleManifest(repo: string, version: string): string {
  const m = readJson<Record<string, unknown>>(repo, ".claude-plugin/plugin.json");
  const keywords = [...new Set([...((m["keywords"] as string[] | undefined) ?? []), ...EXTRA_KEYWORDS])];
  const out: Record<string, unknown> = {};
  // The repository's fields in their order, with the version set and the
  // listing fields after the links they sit beside.
  for (const [k, v] of Object.entries(m)) {
    if (k === "version") out[k] = version;
    else if (k === "keywords") out[k] = keywords;
    else out[k] = v;
    if (k === "repository") Object.assign(out, LISTING);
  }
  if (!("documentationUrl" in out)) Object.assign(out, LISTING);
  if (!("keywords" in out)) out["keywords"] = keywords;
  return `${JSON.stringify(out, null, 2)}\n`;
}

export function bundlePackageJson(version: string, model: { version: string }): string {
  const pkg = {
    name: "counterparts",
    version,
    private: true,
    description: "The Counterparts Claude Code plugin. Generated from github.com/mlapeter/counterparts by tools/plugin-bundle/build.ts.",
    license: "MIT",
    type: "module",
    dependencies: { [MODEL_PACKAGE]: model.version },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/** A text bun.lock (lockfileVersion 1) with the one package, at the version and
 *  integrity this repository's own bun.lock pins: no network, same bytes every run. */
export function bundleLock(model: { version: string; integrity: string }): string {
  return [
    "{",
    '  "lockfileVersion": 1,',
    '  "configVersion": 1,',
    '  "workspaces": {',
    '    "": {',
    '      "name": "counterparts",',
    '      "dependencies": {',
    `        "${MODEL_PACKAGE}": "${model.version}",`,
    "      },",
    "    },",
    "  },",
    '  "packages": {',
    `    "${MODEL_PACKAGE}": ["${MODEL_PACKAGE}@${model.version}", "", {}, "${model.integrity}"],`,
    "  }",
    "}",
    "",
  ].join("\n");
}

// ── the plan, checked ──────────────────────────────────────────────────────

export function planBundle(repo: string = REPO): Plan {
  const problems: string[] = [];
  const version = readJson<{ version: string }>(repo, "package.json").version;
  const pluginVersion = readJson<{ version?: string }>(repo, ".claude-plugin/plugin.json").version;
  const binVersion = readJson<{ version?: string }>(repo, ".claude-plugin/binaries.json").version;
  if (pluginVersion !== version) problems.push(`.claude-plugin/plugin.json is ${pluginVersion}, package.json ${version}`);
  // plugin-run.sh will not download a binary whose checksums name another version.
  if (binVersion !== version) problems.push(`.claude-plugin/binaries.json is ${binVersion}, package.json ${version} (run tools/single-binary/build.ts --release first)`);

  const traced = traceFiles(repo);
  problems.push(...traced.problems);
  const copied = [...traced.files.filter((f) => f !== ".claude-plugin/plugin.json"), "LICENSE"].sort();

  const model = lockedPackage(repo, MODEL_PACKAGE);
  const generated: Record<string, string> = {
    ".claude-plugin/plugin.json": bundleManifest(repo, version),
    "package.json": bundlePackageJson(version, model),
    "bun.lock": bundleLock(model),
    "README.md": readFileSync(join(HERE, "bundle-readme.md"), "utf8"),
  };

  for (const f of [...copied, ...Object.keys(generated)]) {
    for (const [re, what] of FORBIDDEN) if (re.test(f)) problems.push(`${f} is ${what}`);
  }
  for (const f of copied) {
    const st = lstatSync(join(repo, f));
    if (st.isSymbolicLink()) problems.push(`${f} is a symlink`);
    else if (st.size >= MAX_FILE_BYTES) problems.push(`${f} is ${st.size} bytes, over the 5 MiB limit`);
  }
  const count = new Set([...copied, ...Object.keys(generated)]).size;
  if (count > MAX_FILES) problems.push(`${count} files, over the directory's ${MAX_FILES}`);

  if (problems.length > 0) throw new Error(`plugin bundle refused:\n  ${problems.join("\n  ")}`);
  return { copied, generated, version };
}

/** Every bundle path, copied and generated, sorted. */
export function bundlePaths(plan: Plan): string[] {
  return [...new Set([...plan.copied, ...Object.keys(plan.generated)])].sort();
}

// ── writing ────────────────────────────────────────────────────────────────

/** Write the bundle into `out`. A folder that already holds a bundle (or a
 *  clone of the bundle repository) is emptied first, `.git` kept; any other
 *  non-empty folder is refused. */
export function writeBundle(plan: Plan, out: string, repo: string = REPO): void {
  const target = resolve(out);
  const rel = relative(repo, target);
  if (rel === "" || !rel.startsWith("..") || relative(target, repo) === "" || !relative(target, repo).startsWith("..")) {
    throw new Error(`refusing to write the bundle at ${target}: inside this repository, or one of its parents`);
  }
  if (existsSync(target)) {
    const entries = readdirSync(target).filter((n) => n !== ".git");
    if (entries.length > 0) {
      const mf = join(target, ".claude-plugin/plugin.json");
      const ours = existsSync(mf) && (JSON.parse(readFileSync(mf, "utf8")) as { name?: string }).name === "counterparts";
      if (!ours) throw new Error(`refusing to write the bundle at ${target}: not empty and not a previous bundle`);
      for (const n of entries) rmSync(join(target, n), { recursive: true, force: true });
    }
  }
  for (const f of plan.copied) {
    mkdirSync(dirname(join(target, f)), { recursive: true });
    copyFileSync(join(repo, f), join(target, f));
  }
  for (const [f, text] of Object.entries(plan.generated)) {
    mkdirSync(dirname(join(target, f)), { recursive: true });
    writeFileSync(join(target, f), text);
  }
}

/** Files at or over 256 KiB that are not images or fonts: held for a reviewer. */
export function largeFiles(dir: string, paths: readonly string[]): { path: string; bytes: number }[] {
  return paths
    .filter((p) => !/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf)$/i.test(p))
    .map((p) => ({ path: p, bytes: statSync(join(dir, p)).size }))
    .filter((f) => f.bytes > MAX_INSPECTED_BYTES)
    .sort((a, b) => b.bytes - a.bytes);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const plan = planBundle();
  const paths = bundlePaths(plan);
  if (args[0] === "--list") {
    console.log(paths.join("\n"));
    console.log(`${paths.length} files (limit ${MAX_FILES}), version ${plan.version}`);
  } else if (args.length !== 1 || args[0]!.startsWith("-")) {
    console.error("usage: bun tools/plugin-bundle/build.ts <out-dir> | --list");
    process.exit(2);
  } else {
    writeBundle(plan, args[0]!);
    const big = largeFiles(args[0]!, paths);
    console.log(`wrote ${paths.length} files (limit ${MAX_FILES}) to ${resolve(args[0]!)}, version ${plan.version}`);
    console.log(big.length === 0 ? "no file over 256 KiB" : `over 256 KiB (held for a reviewer):\n${big.map((b) => `  ${b.path}  ${(b.bytes / 1024).toFixed(0)} KiB`).join("\n")}`);
  }
}
