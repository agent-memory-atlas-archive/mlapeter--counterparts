/**
 * Fragment stitch — folds `changelog.d/*.md` into CHANGELOG.md's `## Unreleased`, and
 * `docs/decisions.d/*.md` into docs/IMPROVEMENTS.md's "Decisions to review".
 *
 * Each pull request writes its changelog entry as its own file in `changelog.d/`, and
 * any new decision subsection as its own file in `docs/decisions.d/` (both named after
 * the branch, `/` → `-`), so two PRs never edit the same lines of CHANGELOG.md or
 * IMPROVEMENTS.md. At release, this tool appends every changelog fragment's bullets to
 * the end of `## Unreleased`, after the bullets already there, and every decisions
 * fragment to the end of the first `## Decisions to review` section (before its
 * `### Also noted`, when it has one); then it deletes the fragments it used. Fragments
 * go in the order their files landed on the current branch: the first-parent commit
 * that added each file (for a pull request, its merge commit), oldest first; a file not
 * yet committed counts as newest; ties by name.
 *
 * A changelog fragment is one or more `- ` bullets, continuation lines indented. Blank
 * lines before a bullet are dropped (Unreleased has none between bullets). A decisions
 * fragment is one or more `### ` subsections, kept as written, with no `# ` or `## `
 * heading in it. A malformed fragment of either kind, or a decisions fragment with no
 * "Decisions to review" section to go into: nothing is changed, exit 1.
 *
 * Usage (from the repository root, or pass the root as an argument):
 *   bun tools/changelog/stitch.ts           # stitch, then delete the fragments
 *   bun tools/changelog/stitch.ts --check   # print what it would add; change nothing
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const FRAGMENT_DIR = "changelog.d";
export const DECISIONS_DIR = "docs/decisions.d";
const UNRELEASED = "## Unreleased";
const DECISIONS = "## Decisions to review";
const ALSO_NOTED = "### Also noted";

export interface Fragment {
  /** File name inside its fragment directory. */
  name: string;
  /** The bullets (or subsections), ready to append (no trailing newline). */
  body: string;
  /** Commit time (seconds) the file landed on the first-parent line; Infinity when uncommitted. */
  addedAt: number;
}

export interface StitchResult {
  fragments: Fragment[];
  /** One line per malformed fragment; when non-empty nothing was written. */
  problems: string[];
  /** CHANGELOG.md as it is (check, or problems) or as it was written. */
  changelog: string;
  /** The `docs/decisions.d/` fragments, in the order they go in. */
  decisions: Fragment[];
  /** docs/IMPROVEMENTS.md as it would be or was written; null when there are no decisions to place (or nowhere to place them). */
  improvements: string | null;
  wrote: boolean;
}

type Parse = (text: string) => { body: string } | { problem: string };

function trimmedLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines;
}

/** The bullets of one fragment, or a reason it is malformed. */
export function parseFragment(text: string): { body: string } | { problem: string } {
  const lines = trimmedLines(text);
  if (lines.length === 0) return { problem: "is empty" };
  if (!lines[0]!.startsWith("- ")) return { problem: "does not start with a `- ` bullet" };
  const kept = lines.filter((line, i) => !(line.trim() === "" && lines[i + 1]?.startsWith("- ")));
  return { body: kept.join("\n") };
}

/** The subsections of one decisions fragment, as written, or a reason it is malformed. */
export function parseDecisionsFragment(text: string): { body: string } | { problem: string } {
  const lines = trimmedLines(text);
  if (lines.length === 0) return { problem: "is empty" };
  if (!lines[0]!.startsWith("### ")) return { problem: "does not start with a `### ` heading" };
  if (lines.some((l) => /^##? /.test(l))) return { problem: "has a `# ` or `## ` heading, which would split the section" };
  return { body: lines.join("\n") };
}

function firstAdded(repoDir: string, relPath: string): number {
  let out = "";
  try {
    // First-parent, merges diffed against their first parent: a fragment from a merged
    // pull request dates from its merge, so fragments stitch in merge order rather than
    // the order the branches happened to commit them.
    out = execFileSync("git", ["log", "--first-parent", "-m", "--no-patch", "--diff-filter=A", "--format=%ct", "--", relPath], {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return Infinity;
  }
  // Newest first; a file added, removed and added again keeps its first time.
  const times = out.split("\n").filter((l) => l.trim() !== "");
  return times.length === 0 ? Infinity : Number(times[times.length - 1]);
}

/** Appends `bodies` to the end of `## Unreleased`, creating the heading if it is gone. */
export function appendToUnreleased(changelog: string, bodies: string[]): string {
  if (bodies.length === 0) return changelog;
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  let start = lines.findIndex((l) => l.trim() === UNRELEASED);
  if (start === -1) {
    // After a release the heading is gone; it goes back above the first version.
    const firstSection = lines.findIndex((l) => l.startsWith("## "));
    const at = firstSection === -1 ? lines.length : firstSection;
    lines.splice(at, 0, UNRELEASED, "", ...(firstSection === -1 ? [] : [""]));
    start = at;
  }
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  let last = end;
  while (last > start + 1 && lines[last - 1]!.trim() === "") last--;
  const added = bodies.join("\n").split("\n");
  const head = lines.slice(0, last);
  // An empty Unreleased keeps its one blank line under the heading.
  if (last === start + 1) head.push("");
  const tail = lines.slice(end);
  return [...head, ...added, ...(tail.length > 0 ? ["", ...tail] : [""])].join("\n");
}

/**
 * Appends `bodies` (a blank line between each) to the end of the first "Decisions to
 * review" section: before its `### Also noted` when it has one (that miscellany stays
 * last, as builders have kept it), else before the blank lines and `---` rule that close
 * the section. Null when there is no such section: unlike Unreleased, its title can't be
 * invented.
 */
export function appendToDecisions(improvements: string, bodies: string[]): string | null {
  const lines = improvements.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.startsWith(DECISIONS));
  if (start === -1) return null;
  if (bodies.length === 0) return improvements;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  const also = lines.findIndex((l, i) => i > start && i < end && l.trim() === ALSO_NOTED);
  let last = also === -1 ? end : also;
  while (last > start + 1 && (lines[last - 1]!.trim() === "" || lines[last - 1]!.trim() === "---")) last--;
  const added = bodies.join("\n\n").split("\n");
  const tail = lines.slice(last);
  while (tail.length > 0 && tail[0]!.trim() === "") tail.shift();
  return [...lines.slice(0, last), "", ...added, ...(tail.length > 0 ? ["", ...tail] : [""])].join("\n");
}

function collect(repoDir: string, dirName: string, parse: Parse, problems: string[]): Fragment[] {
  const dir = join(repoDir, dirName);
  const names = existsSync(dir)
    ? readdirSync(dir).filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md")
    : [];
  const fragments: Fragment[] = [];
  for (const name of names) {
    const parsed = parse(readFileSync(join(dir, name), "utf8"));
    if ("problem" in parsed) problems.push(`${dirName}/${name} ${parsed.problem}`);
    else fragments.push({ name, body: parsed.body, addedAt: firstAdded(repoDir, `${dirName}/${name}`) });
  }
  fragments.sort((a, b) => a.addedAt - b.addedAt || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return fragments;
}

export function stitch(repoDir: string, opts: { check?: boolean } = {}): StitchResult {
  const changelogPath = join(repoDir, "CHANGELOG.md");
  const improvementsPath = join(repoDir, "docs", "IMPROVEMENTS.md");
  const changelog = readFileSync(changelogPath, "utf8");
  const problems: string[] = [];
  const fragments = collect(repoDir, FRAGMENT_DIR, parseFragment, problems);
  const decisions = collect(repoDir, DECISIONS_DIR, parseDecisionsFragment, problems);
  let improvements: string | null = null;
  if (decisions.length > 0) {
    const current = existsSync(improvementsPath) ? readFileSync(improvementsPath, "utf8") : null;
    improvements = current === null ? null : appendToDecisions(current, decisions.map((f) => f.body));
    if (improvements === null) problems.push(`docs/IMPROVEMENTS.md has no "${DECISIONS}" section for ${DECISIONS_DIR}/`);
  }
  // Any problem in either directory: neither file is written, no fragment deleted.
  if (opts.check || problems.length > 0 || (fragments.length === 0 && decisions.length === 0)) {
    return { fragments, problems, changelog, decisions, improvements, wrote: false };
  }
  const next = appendToUnreleased(changelog, fragments.map((f) => f.body));
  if (fragments.length > 0) writeFileSync(changelogPath, next);
  if (improvements !== null) writeFileSync(improvementsPath, improvements);
  for (const f of fragments) unlinkSync(join(repoDir, FRAGMENT_DIR, f.name));
  for (const f of decisions) unlinkSync(join(repoDir, DECISIONS_DIR, f.name));
  return { fragments, problems, changelog: next, decisions, improvements, wrote: true };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const repoDir = args.find((a) => !a.startsWith("--")) ?? process.cwd();
  const result = stitch(repoDir, { check });
  for (const p of result.problems) console.error(`malformed: ${p}`);
  const verb = result.wrote ? "Added" : "Would add";
  const report = (dir: string, to: string, list: Fragment[]): void => {
    if (list.length === 0) {
      console.log(`No fragments in ${dir}/.`);
      return;
    }
    console.log(`${verb} to ${to}, in this order:\n`);
    for (const f of list) console.log(`<!-- ${dir}/${f.name} -->\n${f.body}\n`);
  };
  report(FRAGMENT_DIR, UNRELEASED, result.fragments);
  report(DECISIONS_DIR, `"${DECISIONS}" (docs/IMPROVEMENTS.md)`, result.decisions);
  if (result.wrote) console.log(`Deleted ${result.fragments.length + result.decisions.length} fragment(s).`);
  if (result.problems.length > 0) {
    if (!check) console.error("Nothing was changed.");
    process.exit(1);
  }
}
