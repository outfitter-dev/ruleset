---
"@rulesets/core": minor
"@rulesets/cli": minor
---

Initial v0.1.0 release of Rulesets - AI rules compiler

## Features

- **Core Library** (`@rulesets/core`)
  - Parser for Markdown with frontmatter
  - Compiler system with destination plugins
  - Support for Cursor, Windsurf, Claude Code, AGENTS.md, and GitHub Copilot
  - Linter for validating rules
  - Plugin architecture for extensibility

- **CLI** (`@rulesets/cli`)

  - `init` - Initialize Rulesets in projects
  - `compile` - Compile rules to AI tool formats
  - `list` - List installed rulesets
  - `install` - Install ruleset packages (placeholder)
  - `sync` - Sync installed rulesets (placeholder)

## What's Next

This is our initial release focused on core functionality. Future releases will include:

- Pack system for bundled rulesets
- npm package distribution
- Advanced templating and variables
- More destination plugins
