- **Changelog entries are written as fragments.** A pull request puts its entry in
  `changelog.d/<branch>.md` instead of editing `CHANGELOG.md`, so pull requests no longer
  conflict over the Unreleased section; `tools/changelog/stitch.ts` folds them in at
  release. Nothing changes for someone using Counterparts.
