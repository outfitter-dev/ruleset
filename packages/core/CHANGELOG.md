# @rulesets/core

## 0.1.0

### Minor Changes

- Initial v0 release of Rulesets - a CommonMark-compliant rules compiler for AI coding assistants.

  ### Features

  - **Parser**: Extracts front matter and body content from Markdown files
  - **Linter**: Validates front matter structure and content
  - **Compiler**: Pass-through compilation (marker processing planned for future versions)
  - **Destination Plugins**: Initial support for Cursor and Windsurf
  - **CLI Orchestration**: Complete pipeline from source to destination files

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
