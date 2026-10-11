# Changelog fragments

A pull request's changelog entry goes here, not in `CHANGELOG.md`: one file per pull
request, named after its branch with `/` turned into `-` (branch `fix/wake-room` writes
`changelog.d/fix-wake-room.md`). Two pull requests then never edit the same lines, and
merging one doesn't put the other in conflict.

The file holds one or more bullets in the voice of `## Unreleased`: what someone using it
notices, in plain sentences, with no PR numbers. Continuation lines are indented two
spaces. For example:

```md
- **Asking for facts shows faded memories in full, among the rest.** A match that has faded
  (below reach) is ranked with the live ones by how well it matched, its words shown and
  labelled faded.
```

At release, `bun tools/changelog/stitch.ts` appends every fragment to the end of
`## Unreleased`, in the order the files were first committed, and deletes them
([RELEASING.md](../docs/RELEASING.md)). `bun tools/changelog/stitch.ts --check` prints what
it would add and changes nothing; it fails when a fragment doesn't start with a `- `
bullet. A change nobody using it would notice doesn't need a fragment.

A hotfix branched off a released tag can still edit `CHANGELOG.md` directly.
