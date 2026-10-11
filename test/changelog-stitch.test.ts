// tools/changelog/stitch.ts — folding changelog.d/ fragments into ## Unreleased.
// Hermetic: each test builds a throwaway git repo in a temp dir and removes it.

import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendToUnreleased, parseFragment, stitch } from "../tools/changelog/stitch.js";

const TOOL = join(import.meta.dir, "..", "tools", "changelog", "stitch.ts");

const CHANGELOG = `# Changelog

## Unreleased

- **First existing.** Stays first.
- **Second existing.** Runs over
  two lines.

## 0.1.0 — 2026-01-01

- **Released.** Untouched.
`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function git(repo: string, args: string[], when?: number): void {
  const env: Record<string, string | undefined> = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  if (when !== undefined) {
    env.GIT_AUTHOR_DATE = `@${when} +0000`;
    env.GIT_COMMITTER_DATE = `@${when} +0000`;
  }
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], {
    cwd: repo,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
}

function makeRepo(changelog = CHANGELOG): string {
  const repo = mkdtempSync(join(tmpdir(), "cp-stitch-"));
  dirs.push(repo);
  git(repo, ["init", "-q"]);
  writeFileSync(join(repo, "CHANGELOG.md"), changelog);
  mkdirSync(join(repo, "changelog.d"));
  writeFileSync(join(repo, "changelog.d", "README.md"), "# Fragments\n\nNot a bullet.\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "base"], 1_700_000_000);
  return repo;
}

function addFragment(repo: string, name: string, text: string, when?: number): void {
  writeFileSync(join(repo, "changelog.d", name), text);
  if (when === undefined) return;
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", `add ${name}`], when);
}

describe("stitch", () => {
  test("appends fragments after the existing Unreleased bullets, oldest commit first, and deletes them", () => {
    const repo = makeRepo();
    // Committed in the order b, a; names would sort a, b.
    addFragment(repo, "b-first.md", "- **From b.** Added first.\n", 1_700_100_000);
    addFragment(repo, "a-second.md", "\n- **From a.** Added second,\n  wrapped.\n\n- **Also a.** Two bullets.\n", 1_700_200_000);
    const result = stitch(repo);
    expect(result.problems).toEqual([]);
    expect(result.wrote).toBe(true);
    expect(result.fragments.map((f) => f.name)).toEqual(["b-first.md", "a-second.md"]);
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(`# Changelog

## Unreleased

- **First existing.** Stays first.
- **Second existing.** Runs over
  two lines.
- **From b.** Added first.
- **From a.** Added second,
  wrapped.
- **Also a.** Two bullets.

## 0.1.0 — 2026-01-01

- **Released.** Untouched.
`);
    expect(existsSync(join(repo, "changelog.d", "b-first.md"))).toBe(false);
    expect(existsSync(join(repo, "changelog.d", "a-second.md"))).toBe(false);
    expect(existsSync(join(repo, "changelog.d", "README.md"))).toBe(true);
  });

  test("merged pull requests stitch in merge order, not the order their branches committed", () => {
    const repo = makeRepo();
    const base = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    // The branches commit a, b, c (in that order); the base merges c, a, b.
    const at: Record<string, number> = { a: 1_700_100_000, b: 1_700_200_000, c: 1_700_300_000 };
    for (const x of ["a", "b", "c"]) {
      git(repo, ["checkout", "-q", "-b", `fix/${x}`, base]);
      addFragment(repo, `fix-${x}.md`, `- **${x}.** entry\n`, at[x]);
    }
    git(repo, ["checkout", "-q", base]);
    let when = 1_700_400_000;
    for (const x of ["c", "a", "b"]) git(repo, ["merge", "-q", "--no-ff", `fix/${x}`, "-m", `merge ${x}`], (when += 100_000));
    const result = stitch(repo, { check: true });
    expect(result.fragments.map((f) => f.name)).toEqual(["fix-c.md", "fix-a.md", "fix-b.md"]);
  });

  test("same commit ties by name; an uncommitted fragment comes last", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "changelog.d", "zeta.md"), "- **Zeta.** z\n");
    writeFileSync(join(repo, "changelog.d", "alpha.md"), "- **Alpha.** a\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-q", "-m", "both"], 1_700_100_000);
    addFragment(repo, "aaa-loose.md", "- **Loose.** not committed\n");
    const result = stitch(repo, { check: true });
    expect(result.fragments.map((f) => f.name)).toEqual(["alpha.md", "zeta.md", "aaa-loose.md"]);
  });

  test("--check changes nothing and reports what it would add", () => {
    const repo = makeRepo();
    addFragment(repo, "one.md", "- **One.** x\n", 1_700_100_000);
    const run = spawnSync(process.execPath, [TOOL, "--check", repo], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Would add");
    expect(run.stdout).toContain("- **One.** x");
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
    expect(existsSync(join(repo, "changelog.d", "one.md"))).toBe(true);
  });

  test("a malformed fragment fails --check and the stitch, and nothing is changed", () => {
    const repo = makeRepo();
    addFragment(repo, "good.md", "- **Good.** fine\n", 1_700_100_000);
    addFragment(repo, "bad.md", "Forgot the bullet.\n", 1_700_200_000);
    const check = spawnSync(process.execPath, [TOOL, "--check", repo], { encoding: "utf8" });
    expect(check.status).toBe(1);
    expect(check.stderr).toContain("changelog.d/bad.md");
    const run = spawnSync(process.execPath, [TOOL, repo], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
    expect(existsSync(join(repo, "changelog.d", "good.md"))).toBe(true);
  });

  test("no fragments: nothing changes", () => {
    const repo = makeRepo();
    const result = stitch(repo);
    expect(result.wrote).toBe(false);
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
  });
});

describe("appendToUnreleased", () => {
  test("brings the Unreleased heading back above the newest version when it is gone", () => {
    const after = appendToUnreleased("# Changelog\n\n## 0.1.0 — 2026-01-01\n\n- **Released.** x\n", ["- **New.** y"]);
    expect(after).toBe("# Changelog\n\n## Unreleased\n\n- **New.** y\n\n## 0.1.0 — 2026-01-01\n\n- **Released.** x\n");
  });

  test("fills an empty Unreleased section", () => {
    const after = appendToUnreleased("# Changelog\n\n## Unreleased\n\n## 0.1.0\n\n- x\n", ["- **New.** y"]);
    expect(after).toBe("# Changelog\n\n## Unreleased\n\n- **New.** y\n\n## 0.1.0\n\n- x\n");
  });
});

describe("parseFragment", () => {
  test("empty and bullet-less fragments are malformed", () => {
    expect(parseFragment("\n\n")).toEqual({ problem: "is empty" });
    expect("problem" in parseFragment("Some prose\n- then a bullet\n")).toBe(true);
  });
});
