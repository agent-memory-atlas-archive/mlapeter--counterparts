/**
 * Changelog stitch — folds `changelog.d/*.md` into CHANGELOG.md's `## Unreleased`.
 *
 * Each pull request writes its changelog entry as its own file in `changelog.d/`
 * (named after the branch, `/` → `-`), so two PRs never edit the same lines of
 * CHANGELOG.md. At release, this tool appends every fragment's bullets to the end
 * of `## Unreleased`, after the bullets already there, and deletes the fragments
 * it used. Fragments go in the order their files were first added on the current
 * branch (oldest first; a file not yet committed counts as newest), ties by name.
 *
 * A fragment is one or more `- ` bullets, continuation lines indented. Blank lines
 * before a bullet are dropped (Unreleased has none between bullets). A fragment
 * whose first line is not a bullet is malformed: nothing is changed, exit 1.
 *
 * Usage (from the repository root, or pass the root as an argument):
 *   bun tools/changelog/stitch.ts           # stitch, then delete the fragments
 *   bun tools/changelog/stitch.ts --check   # print what it would add; change nothing
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const FRAGMENT_DIR = "changelog.d";
const UNRELEASED = "## Unreleased";

export interface Fragment {
  /** File name inside `changelog.d/`. */
  name: string;
  /** The bullets, ready to append (no trailing newline). */
  body: string;
  /** Commit time (seconds) the file was first added; Infinity when uncommitted. */
  addedAt: number;
}

export interface StitchResult {
  fragments: Fragment[];
  /** One line per malformed fragment; when non-empty nothing was written. */
  problems: string[];
  /** CHANGELOG.md as it is (check, or problems) or as it was written. */
  changelog: string;
  wrote: boolean;
}

/** The bullets of one fragment, or a reason it is malformed. */
export function parseFragment(text: string): { body: string } | { problem: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (lines.length === 0) return { problem: "is empty" };
  if (!lines[0]!.startsWith("- ")) return { problem: "does not start with a `- ` bullet" };
  const kept = lines.filter((line, i) => !(line.trim() === "" && lines[i + 1]?.startsWith("- ")));
  return { body: kept.join("\n") };
}

function firstAdded(repoDir: string, relPath: string): number {
  let out = "";
  try {
    out = execFileSync("git", ["log", "--diff-filter=A", "--format=%ct", "--", relPath], {
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

export function stitch(repoDir: string, opts: { check?: boolean } = {}): StitchResult {
  const dir = join(repoDir, FRAGMENT_DIR);
  const changelogPath = join(repoDir, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  const names = existsSync(dir)
    ? readdirSync(dir).filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md")
    : [];
  const fragments: Fragment[] = [];
  const problems: string[] = [];
  for (const name of names) {
    const parsed = parseFragment(readFileSync(join(dir, name), "utf8"));
    if ("problem" in parsed) problems.push(`${FRAGMENT_DIR}/${name} ${parsed.problem}`);
    else fragments.push({ name, body: parsed.body, addedAt: firstAdded(repoDir, `${FRAGMENT_DIR}/${name}`) });
  }
  fragments.sort((a, b) => a.addedAt - b.addedAt || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (opts.check || problems.length > 0 || fragments.length === 0) {
    return { fragments, problems, changelog, wrote: false };
  }
  const next = appendToUnreleased(changelog, fragments.map((f) => f.body));
  writeFileSync(changelogPath, next);
  for (const f of fragments) unlinkSync(join(dir, f.name));
  return { fragments, problems, changelog: next, wrote: true };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const repoDir = args.find((a) => !a.startsWith("--")) ?? process.cwd();
  const result = stitch(repoDir, { check });
  for (const p of result.problems) console.error(`malformed: ${p}`);
  if (result.fragments.length === 0 && result.problems.length === 0) {
    console.log(`No fragments in ${FRAGMENT_DIR}/.`);
  } else if (result.fragments.length > 0) {
    const verb = result.wrote ? "Added" : "Would add";
    console.log(`${verb} to ${UNRELEASED}, in this order:\n`);
    for (const f of result.fragments) console.log(`<!-- ${FRAGMENT_DIR}/${f.name} -->\n${f.body}\n`);
    if (result.wrote) console.log(`Deleted ${result.fragments.length} fragment(s).`);
  }
  if (result.problems.length > 0) {
    if (!check) console.error("Nothing was changed.");
    process.exit(1);
  }
}
