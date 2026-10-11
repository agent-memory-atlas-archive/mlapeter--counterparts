- **`counterparts self-page --write --short <file>` works.** The spaced form was refused;
  only `--short=<file>` worked, though the help and the page's room note print the spaced
  one. Both forms work now.
- **The Yesterday line keeps other folders' chapters to their folders.** At a session start
  it names a chapter from another folder by title only when that chapter is about you or me
  and that folder's scope is on, the rule "About me, from another directory" and "Today,
  elsewhere" already keep. Other chapters join the line's count ("and 2 more"); when that is
  all there was, the line says how many sessions wrote chapters in other folders. Chapters
  written in this folder are named as before.
- **A search cache from a newer build says so.** When only the search cache was written by a
  newer Counterparts (after going back to an older version, say), the memory tools no longer
  say "Counterparts was updated — run /mcp", which did not help. They say a newer build wrote
  the search cache: if that build is installed, reconnect; if you went back to an older one,
  delete `cache/cache.sqlite*` in the store (no memory is kept there; it is rebuilt) and then
  reconnect. `counterparts doctor` says the same. A store from a newer build keeps its message.
- **Hook claims hold up in three more corners.** A claims file another hook holds is given up
  on after one wait instead of three; a lock dated in the future after the clock steps back
  is treated as a dead process's instead of waited on; and a hook whose own claim landed while
  its write reported a failure delivers the event instead of standing down for itself.
- **A plugin's first run can't be held up from a shared /tmp.** Another user's directory at
  the first-run lock's name made the first run wait 20 seconds and fail; it is passed over
  now, and the install runs.
