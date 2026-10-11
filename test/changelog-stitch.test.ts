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

const IMPROVEMENTS = `# Improvements

## Decisions to review — the walk (2026-10-10)

**Status:** open.

### Decided by someone, 2026-10-10, lightly held (existing)

- Existing item. Stays where it is.

### Also noted

- **A loose note.** Stays last.

---

## U1 — An older entry (2026-09-14)

Untouched.
`;

function makeDecisionsRepo(improvements = IMPROVEMENTS): string {
  const repo = makeRepo();
  mkdirSync(join(repo, "docs", "decisions.d"), { recursive: true });
  writeFileSync(join(repo, "docs", "IMPROVEMENTS.md"), improvements);
  writeFileSync(join(repo, "docs", "decisions.d", "README.md"), "# Decisions fragments\n\nNot a subsection.\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "decisions base"], 1_700_050_000);
  return repo;
}

function addDecision(repo: string, name: string, text: string, when?: number): void {
  writeFileSync(join(repo, "docs", "decisions.d", name), text);
  if (when === undefined) return;
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", `add ${name}`], when);
}

const decision = (who: string): string =>
  `### Decided by the ${who} builder, 2026-10-11, lightly held (${who})\n\n- Decided by the ${who} builder: a thing.\n  Why: wrapped.\n`;

describe("stitch, decisions", () => {
  test("appends subsections before ### Also noted, in merge order, and deletes them", () => {
    const repo = makeDecisionsRepo();
    const base = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    // The branches commit a, b; the base merges b, a.
    const at: Record<string, number> = { a: 1_700_100_000, b: 1_700_200_000 };
    for (const x of ["a", "b"]) {
      git(repo, ["checkout", "-q", "-b", `fix/${x}`, base]);
      addDecision(repo, `fix-${x}.md`, `\n${decision(x)}\n\n`, at[x]);
    }
    git(repo, ["checkout", "-q", base]);
    git(repo, ["merge", "-q", "--no-ff", "fix/b", "-m", "merge b"], 1_700_300_000);
    git(repo, ["merge", "-q", "--no-ff", "fix/a", "-m", "merge a"], 1_700_400_000);
    const result = stitch(repo);
    expect(result.problems).toEqual([]);
    expect(result.wrote).toBe(true);
    expect(result.decisions.map((f) => f.name)).toEqual(["fix-b.md", "fix-a.md"]);
    expect(readFileSync(join(repo, "docs", "IMPROVEMENTS.md"), "utf8")).toBe(`# Improvements

## Decisions to review — the walk (2026-10-10)

**Status:** open.

### Decided by someone, 2026-10-10, lightly held (existing)

- Existing item. Stays where it is.

${decision("b")}
${decision("a")}
### Also noted

- **A loose note.** Stays last.

---

## U1 — An older entry (2026-09-14)

Untouched.
`);
    expect(existsSync(join(repo, "docs", "decisions.d", "fix-a.md"))).toBe(false);
    expect(existsSync(join(repo, "docs", "decisions.d", "fix-b.md"))).toBe(false);
    expect(existsSync(join(repo, "docs", "decisions.d", "README.md"))).toBe(true);
    // No changelog fragments: CHANGELOG.md is untouched.
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
  });

  test("with no ### Also noted, goes before the --- that closes the section", () => {
    const repo = makeDecisionsRepo(IMPROVEMENTS.replace("### Also noted\n\n- **A loose note.** Stays last.\n\n", ""));
    addDecision(repo, "one.md", decision("one"), 1_700_100_000);
    stitch(repo);
    const after = readFileSync(join(repo, "docs", "IMPROVEMENTS.md"), "utf8");
    expect(after).toContain(`- Existing item. Stays where it is.\n\n${decision("one")}\n---\n\n## U1`);
  });

  test("stitches the changelog and the decisions in one run", () => {
    const repo = makeDecisionsRepo();
    addFragment(repo, "both.md", "- **Both.** a user notices\n", 1_700_100_000);
    addDecision(repo, "both.md", decision("both"), 1_700_100_000);
    const result = stitch(repo);
    expect(result.wrote).toBe(true);
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toContain("- **Both.** a user notices\n\n## 0.1.0");
    expect(readFileSync(join(repo, "docs", "IMPROVEMENTS.md"), "utf8")).toContain(`${decision("both")}\n### Also noted`);
  });

  test("a malformed decisions fragment fails --check and the stitch, and neither file changes", () => {
    const repo = makeDecisionsRepo();
    addFragment(repo, "good.md", "- **Good.** fine\n", 1_700_100_000);
    addDecision(repo, "bullets.md", "- Decided by someone: no heading.\n", 1_700_200_000);
    addDecision(repo, "split.md", "### Fine heading\n\n## But this splits the section\n", 1_700_300_000);
    const check = spawnSync(process.execPath, [TOOL, "--check", repo], { encoding: "utf8" });
    expect(check.status).toBe(1);
    expect(check.stderr).toContain("docs/decisions.d/bullets.md does not start with a `### ` heading");
    expect(check.stderr).toContain("docs/decisions.d/split.md has a `# ` or `## ` heading");
    const run = spawnSync(process.execPath, [TOOL, repo], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
    expect(readFileSync(join(repo, "docs", "IMPROVEMENTS.md"), "utf8")).toBe(IMPROVEMENTS);
    expect(existsSync(join(repo, "changelog.d", "good.md"))).toBe(true);
  });

  test("no Decisions to review section: a problem, nothing changes", () => {
    const repo = makeDecisionsRepo("# Improvements\n\n## U1 — Only this\n");
    addDecision(repo, "lost.md", decision("lost"), 1_700_100_000);
    const result = stitch(repo);
    expect(result.wrote).toBe(false);
    expect(result.problems[0]).toContain('no "## Decisions to review" section');
    expect(existsSync(join(repo, "docs", "decisions.d", "lost.md"))).toBe(true);
  });

  test("--check lists the decisions it would add and changes nothing", () => {
    const repo = makeDecisionsRepo();
    addDecision(repo, "seen.md", decision("seen"), 1_700_100_000);
    const run = spawnSync(process.execPath, [TOOL, "--check", repo], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("<!-- docs/decisions.d/seen.md -->");
    expect(readFileSync(join(repo, "docs", "IMPROVEMENTS.md"), "utf8")).toBe(IMPROVEMENTS);
  });
});
