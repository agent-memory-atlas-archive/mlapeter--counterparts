- **The plugin installs without a GitHub SSH key.** On a computer with no SSH key that
  GitHub accepts, `/plugin install counterparts@counterparts` failed with "Permission denied
  (publickey)", even though adding the marketplace had worked. The marketplace now names the
  repository by its `https://` address, which needs no key. Nothing to reinstall: Claude Code
  reads the marketplace fresh, so the next install attempt works.
