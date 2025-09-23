## [Unreleased]

### Added
- Standardised on the `.rule.md` file extension for source rules files (keeping `.ruleset.md` for compatibility) to improve discoverability, search capabilities, and IDE support.

### Changed
- Completed the documentation terminology sweep: Mixdown/music metaphors are now expressed as Rulesets vocabulary (source rules, destinations, sections, mixins).
- Documented the authoritative docs location in `.agents/docs/` and clarified the provider-first terminology.
- Updated directory references to the `.ruleset/` layout (`rules/`, `_mixins/`, `dist/`) across guidance and onboarding materials.

### Deprecated
- `rulesets compile --destination` now emits a warning and is documented as a compatibility alias for `--provider`. Plan to remove in a future v0.3.x release — update scripts to use the new flag.
