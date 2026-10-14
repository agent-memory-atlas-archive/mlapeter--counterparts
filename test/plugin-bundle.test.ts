/**
 * THE PLUGIN BUNDLE (tools/plugin-bundle/build.ts): the Claude Code plugin as a
 * folder of its own, for a repository whose root is the plugin and for
 * Anthropic's plugin directory. These hold the file set the generator traces,
 * what it must never carry, the directory's 512-file limit, and that the
 * bundle's version is this repository's. `tools/plugin-loop/run.sh --bundle`
 * installs a generated bundle as a real plugin in a throwaway home.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ACCEPTED_LARGE,
  BUNDLE_LOCKFILE,
  DIRECTORY_ENTRIES,
  DIRECTORY_SHEBANG,
  EXTRA_KEYWORDS,
  LISTING,
  MAX_FILES,
  MAX_INSPECTED_BYTES,
  MODEL_PACKAGE,
  REPO,
  bundleManifest,
  bundlePaths,
  driftLines,
  largeFiles,
  mirrorProblems,
  planBundle,
  traceFiles,
  transpiledPath,
  writeBundle,
} from "../tools/plugin-bundle/build.js";
import { embeddedFiles } from "../tools/single-binary/build.js";

const repoJson = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(join(REPO, rel), "utf8")) as Record<string, unknown>;

const plan = planBundle();
const paths = bundlePaths(plan);

describe("the file set", () => {
  test("holds what Claude Code reads and what the launcher, hooks, server, console, sidebar and dashboard run", () => {
    for (const f of [
      ".claude-plugin/plugin.json",
      ".claude-plugin/binaries.json",
      "hooks/hooks.json",
      "commands/doctor.md",
      "src/adapters/plugin-run.sh",
      "src/adapters/empty-bunfig.toml",
      "src/adapters/launch.mjs",
      "src/adapters/node-hooks.mjs",
      "src/adapters/claude-code/bin/hook.mjs",
      "src/adapters/claude-code/bin/hook.ts",
      "src/adapters/claude-code/bin/runner.ts",
      "src/adapters/claude-code/bin/nightly.ts",
      "src/adapters/mcp/bin/serve.mjs",
      "src/adapters/mcp/bin/serve.ts",
      "src/adapters/cli/bin/counterparts.mjs",
      "src/adapters/cli/bin/counterparts.ts",
      "src/core/counterpart.ts",
      "hooks/sidebar/hooks/register.tsx",
      "hooks/sidebar/hooks/body.tsx",
      "hooks/sidebar/types/index.d.ts",
      "src/adapters/dashboard/web/server.ts",
      "src/adapters/dashboard/web/app.html",
      "src/adapters/dashboard/web/app.js",
      "LICENSE",
      "README.md",
      "package.json",
      "package-lock.json",
    ]) {
      expect(paths).toContain(f);
    }
  });

  test("the dashboard's page carries every static file the single binary embeds", () => {
    // Two independent ways of naming the files the code reads from its install:
    // the binary's directory rule and the bundle's trace from app.html.
    const embedded = embeddedFiles().filter((f) => f !== "package.json" && !f.startsWith("node_modules/"));
    expect(embedded.length).toBeGreaterThan(50);
    for (const f of embedded) expect(paths).toContain(f);
  });

  test("the trace finds no import it cannot resolve and no package the bundle does not install", () => {
    expect(traceFiles().problems).toEqual([]);
  });

  test("no tests, no module docs, no dev tooling, no system files, no package-manager config", () => {
    const bad = paths.filter((p) =>
      /(^|\/)(NOTES|CONTRACT|INTERFACE-GAPS|CLAUDE)\.md$|\.test\.[cm]?[jt]sx?$|(^|\/)tests?\/|^(test|tools|docs|changelog\.d|\.github)\/|\.DS_Store$|(^|\/)(bunfig\.toml|\.npmrc|tsconfig\.json)$|^bin\//.test(p),
    );
    expect(bad).toEqual([]);
    // The sidebar's own plugin folder (its checks) stays in the repository.
    expect(paths.filter((p) => p.startsWith("hooks/sidebar/") && !/^hooks\/sidebar\/(hooks|types)\//.test(p))).toEqual([]);
  });

  test(`stays within the directory's ${MAX_FILES} files`, () => {
    expect(paths.length).toBeLessThanOrEqual(MAX_FILES);
    expect(paths.length).toBeGreaterThan(100);
  });
});

describe("the generated files", () => {
  const manifest = JSON.parse(plan.generated[".claude-plugin/plugin.json"]!) as Record<string, unknown>;
  const pkg = JSON.parse(plan.generated["package.json"]!) as { version: string; type: string; dependencies: Record<string, string> };

  test("the version is this repository's: package.json, plugin.json and binaries.json agree", () => {
    const version = repoJson("package.json")["version"];
    expect(plan.version).toBe(version as string);
    expect(manifest["version"]).toBe(version);
    expect(pkg.version).toBe(version as string);
    expect(repoJson(".claude-plugin/binaries.json")["version"]).toBe(version);
  });

  test("the manifest follows whatever version it is given (a release regenerates it)", () => {
    const next = JSON.parse(bundleManifest(REPO, "9.8.7")) as Record<string, unknown>;
    expect(next["version"]).toBe("9.8.7");
  });

  test("the manifest keeps the repository's components and adds the directory listing fields", () => {
    const repo = repoJson(".claude-plugin/plugin.json");
    for (const k of ["name", "displayName", "description", "author", "license", "homepage", "repository", "types", "mcpServers"]) {
      expect(manifest[k]).toEqual(repo[k]);
    }
    for (const [k, v] of Object.entries(LISTING)) {
      expect(manifest[k]).toBe(v);
      if (k !== "icon") expect(v.startsWith("https://")).toBe(true);
    }
    // The icon: an image inside the plugin, by its path from the plugin root.
    expect(manifest["icon"]).toBe("./icon.png");
    expect(paths).toContain("icon.png");
    expect(plan.placed["icon.png"]).toBe(".claude-plugin/icon.png");
    expect(readFileSync(join(REPO, ".claude-plugin/icon.png")).subarray(1, 4).toString()).toBe("PNG");
    const keywords = manifest["keywords"] as string[];
    for (const k of [...(repo["keywords"] as string[]), ...EXTRA_KEYWORDS]) expect(keywords).toContain(k);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  test("package.json names only the embedding table, at an exact version, and one npm lockfile pins the same", () => {
    expect(Object.keys(pkg.dependencies)).toEqual([MODEL_PACKAGE]);
    const pinned = pkg.dependencies[MODEL_PACKAGE]!;
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.type).toBe("module");
    // One lockfile: Claude Code uses the first of bun.lock, npm-shrinkwrap.json,
    // package-lock.json and never falls back, so a second would decide instead.
    expect(BUNDLE_LOCKFILE).toBe("package-lock.json");
    expect(paths.filter((p) => /^(bun\.lockb?|npm-shrinkwrap\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(p))).toEqual([BUNDLE_LOCKFILE]);
    const lock = JSON.parse(plan.generated[BUNDLE_LOCKFILE]!) as {
      lockfileVersion: number;
      version: string;
      packages: Record<string, { version?: string; resolved?: string; integrity?: string; dependencies?: Record<string, string> }>;
    };
    // npm 7+ format (Claude Code reads lockfileVersion 2 or 3), same dependencies as package.json.
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.version).toBe(plan.version);
    expect(lock.packages[""]!.dependencies).toEqual(pkg.dependencies);
    expect(Object.keys(lock.packages).sort()).toEqual(["", `node_modules/${MODEL_PACKAGE}`]);
    const entry = lock.packages[`node_modules/${MODEL_PACKAGE}`]!;
    expect(entry.version).toBe(pinned);
    // A registry package over https, pinned by integrity — the integrity this
    // repository's own bun.lock pins.
    expect(entry.resolved).toBe(`https://registry.npmjs.org/${MODEL_PACKAGE}/-/${MODEL_PACKAGE}-${pinned}.tgz`);
    expect(entry.integrity).toMatch(/^sha512-[A-Za-z0-9+/=]+$/);
    expect(readFileSync(join(REPO, "bun.lock"), "utf8")).toContain(entry.integrity!);
  });

  test("the README is long enough for the directory and discloses what the plugin fetches", () => {
    const readme = plan.generated["README.md"]!;
    const words = readme.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(readme).toContain(MODEL_PACKAGE);
    expect(readme).toContain("COUNTERPARTS_BINARY_DOWNLOAD=off");
  });
});

describe("writing it", () => {
  let work = "";
  beforeEach(() => {
    work = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-plugin-bundle-")));
  });
  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  const walk = (dir: string, base = ""): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const rel = base === "" ? e.name : `${base}/${e.name}`;
      return e.isDirectory() ? walk(join(dir, e.name), rel) : [rel];
    });

  test("writes exactly the planned files, as regular files, and names the large ones", () => {
    const out = join(work, "bundle");
    writeBundle(plan, out);
    const written = walk(out).sort();
    expect(written).toEqual(paths);
    for (const f of written) expect(lstatSync(join(out, f)).isFile()).toBe(true);
    expect(JSON.parse(readFileSync(join(out, ".claude-plugin/plugin.json"), "utf8")).version).toBe(plan.version);
    // Listed for the report; splitting them is another lane's.
    for (const big of largeFiles(out, written)) expect(big.bytes).toBeGreaterThan(256 * 1024);
  });

  test("regenerates over a previous bundle and keeps its .git", () => {
    const out = join(work, "bundle");
    writeBundle(plan, out);
    mkdirSync(join(out, ".git"));
    writeFileSync(join(out, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(out, "stale.txt"), "from an older bundle");
    writeBundle(plan, out);
    expect(existsSync(join(out, "stale.txt"))).toBe(false);
    expect(readFileSync(join(out, ".git", "HEAD"), "utf8")).toContain("main");
    expect(existsSync(join(out, ".claude-plugin/plugin.json"))).toBe(true);
  });

  test("refuses a folder that holds something else, and this repository itself", () => {
    const other = join(work, "other");
    mkdirSync(other);
    writeFileSync(join(other, "keep.txt"), "not a bundle");
    expect(() => writeBundle(plan, other)).toThrow(/not empty and not a previous bundle/);
    expect(readFileSync(join(other, "keep.txt"), "utf8")).toBe("not a bundle");
    expect(() => writeBundle(plan, REPO)).toThrow(/inside this repository/);
    expect(() => writeBundle(plan, join(REPO, "dist", "bundle"))).toThrow(/inside this repository/);
  });
});

/**
 * THE DIRECTORY FLAVOR (`--flavor directory`): the same file set, its
 * TypeScript under `src/` transpiled one for one, the three entries Claude
 * Code runs started by their own shebang, no launcher and no binary. The
 * proof that Claude Code starts them from an installed copy is
 * `tools/plugin-loop/run.sh --bundle=directory`.
 */
describe("the directory flavor", () => {
  const dir = planBundle(REPO, "directory");
  const dirPaths = bundlePaths(dir);
  const full = new Set(paths);

  test("mirrors the full flavor's tree: each src/ .ts as its .js at the same path, everything else as it is", () => {
    const expected = new Set(
      paths
        .filter((p) => !/^src\/adapters\/(plugin-run\.sh|launch\.mjs|node-hooks\.mjs)$|\/bin\/[a-z-]+\.mjs$|^\.claude-plugin\/binaries\.json$/.test(p))
        .map((p) => (p.startsWith("src/") && p.endsWith(".ts") && !p.endsWith(".d.ts") ? transpiledPath(p) : p)),
    );
    expect(dirPaths).toEqual([...expected].sort());
    expect(dirPaths.filter((p) => p.startsWith("src/") && /\.tsx?$/.test(p))).toEqual([]);
    // The dashboard's server-side modules are transpiled; its browser files ride as they are.
    expect(dirPaths).toContain("src/adapters/dashboard/web/server.js");
    expect(dirPaths).toContain("src/adapters/dashboard/web/views/memories.js");
    expect(dir.copied).toContain("src/adapters/dashboard/web/app.js");
    // The sidebar stays TypeScript: Claude Code compiles a hooks module itself.
    expect(dir.copied).toContain("hooks/sidebar/hooks/register.tsx");
    expect(full.has("hooks/sidebar/hooks/register.tsx")).toBe(true);
    // The empty bunfig is still carried: the processes the entries start name it.
    expect(dirPaths).toContain("src/adapters/empty-bunfig.toml");
  });

  test("no launcher, no binary checksums, no Node loader, no .mjs shims", () => {
    for (const gone of ["src/adapters/plugin-run.sh", ".claude-plugin/binaries.json", "src/adapters/node-hooks.mjs", "src/adapters/launch.mjs"]) {
      expect(dirPaths).not.toContain(gone);
    }
    expect(dirPaths.filter((p) => p.endsWith(".mjs"))).toEqual([]);
    // The roots Claude Code reads name no launcher (the code still knows one, for the full flavor).
    for (const [f, text] of Object.entries(dir.generated)) if (!f.startsWith("src/")) expect(text).not.toContain("plugin-run.sh");
  });

  test("the three entries start with the shebang and are written executable; nothing else is", () => {
    expect(dir.executable).toEqual(Object.values(DIRECTORY_ENTRIES).sort());
    expect(DIRECTORY_SHEBANG).toBe("#!/usr/bin/env -S bun --no-env-file --config=/dev/null --no-install");
    for (const entry of Object.values(DIRECTORY_ENTRIES)) {
      expect(dir.generated[entry]!.split("\n")[0]).toBe(DIRECTORY_SHEBANG);
      // Transpiled: the main-script guard kept, no type left.
      expect(dir.generated[entry]).toContain("isEntryPoint(process.argv[1], import.meta.url)");
      expect(dir.generated[entry]).not.toMatch(/import type /);
    }
  });

  test("plugin.json, hooks.json and the commands run the entries by path", () => {
    const manifest = JSON.parse(dir.generated[".claude-plugin/plugin.json"]!) as { mcpServers: Record<string, unknown>; icon: string };
    expect(manifest.mcpServers["counterparts"]).toEqual({ command: "${CLAUDE_PLUGIN_ROOT}/src/adapters/mcp/bin/serve.js", args: [] });
    expect(manifest.icon).toBe("./icon.png");
    const hooks = JSON.parse(dir.generated["hooks/hooks.json"]!) as { hooks: Record<string, { hooks: unknown[] }[]>; modules: string[] };
    expect(Object.keys(hooks.hooks).sort()).toEqual(["PreCompact", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"]);
    for (const groups of Object.values(hooks.hooks)) {
      for (const h of groups.flatMap((g) => g.hooks)) {
        expect(h).toEqual({ type: "command", command: "${CLAUDE_PLUGIN_ROOT}/src/adapters/claude-code/bin/hook.js", args: [] });
      }
    }
    expect(hooks.modules).toEqual(["./sidebar/hooks/register.tsx"]);
    const cli = '"${CLAUDE_PLUGIN_ROOT}/src/adapters/cli/bin/counterparts.js"';
    expect(dir.generated["commands/doctor.md"]).toContain(`Bash(${cli} doctor)`);
    expect(dir.generated["commands/dashboard.md"]).toContain(`${cli} dashboard`);
    expect(dir.generated["commands/uninstall.md"]).toContain(`${cli} uninstall --keep-memories --json`);
    // Step 4 builds the terminal line from the console's path, not `sh` and a launcher.
    expect(dir.generated["commands/uninstall.md"]).toContain('"/full/path/to/src/adapters/cli/bin/counterparts.js" "uninstall" "--config"');
    expect(dir.generated["commands/uninstall.md"]).not.toMatch(/`sh`|launcher/);
    expect(dir.generated["commands/meet.md"]).toBe(readFileSync(join(REPO, "commands/meet.md"), "utf8"));
  });

  test("the README says Bun 1.3+ near the top, and nothing of the launcher or the binary", () => {
    const readme = dir.generated["README.md"]!;
    expect(readme.indexOf("Requires Bun 1.3+")).toBeGreaterThan(0);
    expect(readme.indexOf("Requires Bun 1.3+")).toBeLessThan(readme.indexOf("## Install"));
    expect(readme).toContain("curl -fsSL https://bun.sh/install | bash");
    expect(readme).toContain("Claude Code only (the terminal and the Desktop app's Code tab)");
    expect(readme).toContain(MODEL_PACKAGE);
    expect(readme).not.toMatch(/plugin-run\.sh|binaries\.json|COUNTERPARTS_BINARY_DOWNLOAD|<!--/);
    // The full flavor's README: the binary and the launcher, no Bun requirement, no template notes.
    const fullReadme = plan.generated["README.md"]!;
    expect(fullReadme).toContain("plugin-run.sh");
    expect(fullReadme).toContain("Claude Code only (the terminal and the Desktop app's Code tab)");
    expect(fullReadme).not.toMatch(/Requires Bun 1\.3\+|<!--/);
  });

  test("within the directory's limits: file count, and nothing over 256 KiB but images, fonts and the vendored three.js", () => {
    expect(dirPaths.length).toBeLessThanOrEqual(MAX_FILES);
    expect(dir.warnings).toEqual([]);
    for (const [f, text] of Object.entries(dir.generated)) {
      if (!ACCEPTED_LARGE.includes(f)) expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MAX_INSPECTED_BYTES);
    }
  });

  test("the mirror check names what breaks it", () => {
    expect(mirrorProblems(["src/a.ts"], [], {})).toEqual(["src/a.ts has no src/a.js"]);
    expect(mirrorProblems(["src/a.ts"], ["src/a.js"], { "src/a.js": "" })).toEqual(["src/a.js is both a transpiled source and a file carried as it is"]);
    expect(mirrorProblems([], ["src/b.ts"], {})).toEqual(["src/b.ts is TypeScript left in the transpiled tree"]);
    expect(mirrorProblems([], [], { "src/c.js": "" })).toEqual(["src/c.js is generated under src/ from no source"]);
  });

  describe("written", () => {
    let work = "";
    beforeEach(() => {
      work = realpathSync(mkdtempSync(join(tmpdir(), "counterparts-plugin-directory-")));
    });
    afterEach(() => {
      rmSync(work, { recursive: true, force: true });
    });

    test("the entries are executable, other files are not; the drift check passes, then names a change", () => {
      const out = join(work, "bundle");
      writeBundle(dir, out);
      for (const entry of Object.values(DIRECTORY_ENTRIES)) expect(lstatSync(join(out, entry)).mode & 0o111).toBe(0o111);
      expect(lstatSync(join(out, "src/adapters/claude-code/bin/runner.js")).mode & 0o111).toBe(0);
      expect(lstatSync(join(out, "README.md")).mode & 0o111).toBe(0);
      expect(driftLines(dir, out)).toEqual([]);
      writeFileSync(join(out, "src/core/types.js"), "// changed\n");
      writeFileSync(join(out, "stale.txt"), "x");
      rmSync(join(out, "icon.png"));
      expect(driftLines(dir, out).sort()).toEqual(["differs  src/core/types.js", "extra    stale.txt", "missing  icon.png"]);
    });
  });
});
