### Added
- Standardised on the `.rule.md` file extension for source rules files (with `.ruleset.md` retained for compatibility) to improve discoverability, search capabilities, and IDE support.

### Changed
- Updated terminology throughout the documentation:
  - "Mix files" → "Source rules"
  - "Target" → "Destination"
  - "Output" → "Compiled rules"
  - "Stem" → "Section"
  - "Option" → "Property"
  - "Snippet" → "Mixin"
  - `property(value)` → `property-*` and `name-("value")`
- Updated directory structure:
  - `.mixdown/mixes/` → `.ruleset/rules/`
  - `.mixdown/mixes/_snippets/` → `.ruleset/rules/_mixins/`
  - `.mixdown/output/` → `.ruleset/dist/`
