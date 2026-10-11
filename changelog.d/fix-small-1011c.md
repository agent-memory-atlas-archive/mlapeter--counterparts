- **Updating a removed memory no longer fails the write.** A `remember` whose `updates`
  named a memory you had removed used to fail outright, and the new memory was lost with
  it. Now the new memory is stored on its own, unlinked, the same as when `updates` names a
  memory that doesn't exist, and if a `how` was sent the reply says it was not applied.
