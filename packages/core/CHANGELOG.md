# @rulesets/core

## 0.2.0

### Minor Changes

- 81fe501: Initial v0.1.0 release of Rulesets - AI rules compiler

  ## Features

  - **Core Library** (`@rulesets/core`)

    - Parser for Markdown with front matter
    - Compiler system with provider plugins
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
  - More provider plugins

- ## Bump Rulesets packages to v0.2.0 (minor release).

## 0.1.0

### Minor Changes

- Initial v0 release of Rulesets - a CommonMark-compliant rules compiler for AI coding assistants.

  ### Features

  - **Parser**: Extracts front matter and body content from Markdown files
  - **Linter**: Validates front matter structure and content
  - **Compiler**: Pass-through compilation (marker processing planned for future versions)
  - **Provider Plugins**: Initial support for Cursor and Windsurf
  - **CLI Orchestration**: Complete pipeline from source to provider files

  ### What's Included

  - Full TypeScript implementation with strict typing
  - Comprehensive test suite (44 tests)
  - Dual ESM/CJS builds
  - Complete API documentation
  - GitHub Actions CI/CD pipeline

  ### Limitations

  This v0 release intentionally does not process Rulesets notation markers (`{{...}}`). These features are planned for v0.x releases:

  - Section parsing and handling (v0.1)
  - Variable substitution (v0.2)
  - Import resolution (v0.3)

  See the [documentation](https://github.com/maybe-good/rulesets) for usage instructions and examples.
