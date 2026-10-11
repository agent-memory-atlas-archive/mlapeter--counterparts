- **Doctor's fixes fit how you installed.** When the model table is missing or damaged, or
  the search cache came from a newer build, doctor used to say `bun add -g …` even on a
  Claude Code plugin install, which may have no bun at all. A plugin install now gets
  `/plugin → update counterparts` (or uninstall and install it again); the npm install keeps
  its `bun add -g` command; and where doctor can't tell which it is, it names both.
