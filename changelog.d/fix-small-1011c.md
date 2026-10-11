- **Updating a removed memory no longer fails the write.** A `remember` whose `updates`
  named a memory you had removed used to fail outright, and the new memory was lost with
  it. Now the new memory is stored on its own, unlinked, and the reply says the memory it
  named was removed. It is never attached to a similar memory in the removed one's place.
- **Facts answers name the memory that holds now.** When a facts-mode `recall` shows an
  earlier version on its own, its "earlier — now …" line names the end of the chain (on
  A, then B, then C, it says C), the same memory recall's other labels and a write's
  neighbours name. An earlier version that a newer settle re-affirmed reads as current.
