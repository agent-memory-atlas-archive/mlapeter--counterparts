- **Counterparts no longer reads a file outside its own directories.** The parallel run's
  switch, which could read an A/B assignment file in your home directory when a `parallel`
  setting was turned on, is gone; a configuration that still has a `parallel` key keeps
  working and the key is ignored.
