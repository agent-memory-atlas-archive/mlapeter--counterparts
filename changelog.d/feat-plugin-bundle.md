- **Bun no longer fetches the embedding table on its own.** When a plugin install's
  packages didn't install (the package manager its lockfile names wasn't on the PATH,
  Claude Code's 60-second limit, offline), Bun used to download the table from the npm registry the first time it was
  needed, at whatever version was newest, without saying so. Now nothing is fetched: recall
  matches on words, and `/counterparts:doctor` says the table is missing. npm and Bun
  installs of the package are unaffected.
