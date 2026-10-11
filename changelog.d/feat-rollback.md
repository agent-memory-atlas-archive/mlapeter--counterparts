- **`counterparts rollback` takes your memory back to before an upgrade.** When an upgrade
  changed the store's format, the older version can't open it. This puts back the copy the
  upgrade made first (the newest one, or `--to` names another), says how many memories would
  be lost, and asks you to type a word. Nothing is deleted: the upgraded store and its cache
  are set aside in a `rollback-aside-…` folder beside it. It refuses while a session, a
  memory server or the dashboard has the store open, and says which. Until you install the
  older version, the newer one leaves the store alone, and its sessions say why. `--undo`
  puts the upgraded store back if nothing has written to the restored one, and
  `--upgrade-again` lets this version upgrade it again from a fresh copy, so rolling back
  twice on one day no longer reuses the first copy. `counterparts doctor` shows a Rollback
  line while a rollback is in place. After a rollback, a later version leaves the store alone
  too, until you run `counterparts rollback --upgrade-again` once on it.
