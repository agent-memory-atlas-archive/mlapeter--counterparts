# Decisions fragments

A pull request that decides something new writes it here, not in
[`IMPROVEMENTS.md`](../IMPROVEMENTS.md): one file per pull request, named after its branch
with `/` turned into `-` (branch `fix/wake-room` writes `docs/decisions.d/fix-wake-room.md`).
Two pull requests then never add lines in the same place under "Decisions to review", and
merging one doesn't put the other in conflict.

The file holds the subsection exactly as it would appear under "Decisions to review": a
`### ` heading, then its bullets. For example:

```md
### Decided by the wake-room builder, 2026-10-11, lightly held (the wake's room line)

- Decided by the wake-room builder, 2026-10-11, lightly held: the room line names at most
  three other sessions. Why: a fourth pushed the first memory below the fold.
```

More than one `### ` subsection in a file is fine. A `# ` or `## ` heading is not (it would
split the section), and neither is a file that doesn't start with `### `.

Only NEW subsections go here. An edit to a decision already in `IMPROVEMENTS.md` (a "Kept.
Mike, …" line under an item, a reviewer's bullet under an existing subsection) goes straight
into `IMPROVEMENTS.md`, as before. A reviewer adding to a decision whose fragment hasn't been
stitched yet edits the fragment. When a pull request decides nothing, it writes no fragment.

At release, `bun tools/changelog/stitch.ts` (the same step that stitches
[`changelog.d/`](../../changelog.d/README.md)) appends every fragment to the end of the first
`## Decisions to review` section, before its `### Also noted` when it has one, in the order
their pull requests merged, and deletes them ([RELEASING.md](../RELEASING.md)).
`bun tools/changelog/stitch.ts --check` prints what it would add and changes nothing; it
fails on a malformed fragment. Until the stitch, a decision lives only in its fragment, so
walking the decisions between releases means reading this folder too (or running the
stitch on master early).
