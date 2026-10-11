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
  EXTRA_KEYWORDS,
  LISTING,
  MAX_FILES,
  MODEL_PACKAGE,
  REPO,
  bundleManifest,
  bundlePaths,
  largeFiles,
  planBundle,
  traceFiles,
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
      "bun.lock",
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
      expect(v.startsWith("https://")).toBe(true);
    }
    expect(manifest["icon"]).toBeUndefined();
    const keywords = manifest["keywords"] as string[];
    for (const k of [...(repo["keywords"] as string[]), ...EXTRA_KEYWORDS]) expect(keywords).toContain(k);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  test("package.json names only the embedding table, at an exact version, and bun.lock pins the same", () => {
    expect(Object.keys(pkg.dependencies)).toEqual([MODEL_PACKAGE]);
    const pinned = pkg.dependencies[MODEL_PACKAGE]!;
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.type).toBe("module");
    const lock = plan.generated["bun.lock"]!;
    expect(lock).toContain(`"${MODEL_PACKAGE}": "${pinned}"`);
    expect(lock).toContain(`"${MODEL_PACKAGE}@${pinned}"`);
    expect(lock).toMatch(/"sha512-[A-Za-z0-9+/=]+"/);
    expect(lock).not.toMatch(/"(typescript|playwright|@types\/bun)"/);
    // The integrity is the one this repository's own lockfile pins.
    expect(readFileSync(join(REPO, "bun.lock"), "utf8")).toContain(lock.match(/"(sha512-[^"]+)"/)![1]!);
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
