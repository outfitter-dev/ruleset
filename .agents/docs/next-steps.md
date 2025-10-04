# Ruleset v0.2.0 – Remaining Work (Updated 2025-09-24)

This list reflects the current status after the latest changes. Anything unchecked still needs attention before we can consider the v0.2.0 plan complete.

## ✅ Completed
- Parser now tags documents with `source.isRule` and the compiler skips non-rule Markdown (`packages/core/src/parser/index.ts`, `packages/core/src/index.ts`).
- Default project scaffolding writes `.ruleset/config.yaml` and an updated example rule (`packages/core/src/api.ts`).
- `rules sync` is disabled for v0.2.0 (commented out in `packages/cli/src/index.ts`).
- README rewritten to match the new workflow; new docs (`docs/QUICKSTART.md`, `docs/CONFIGURATION.md`, `.agents/docs/OVERVIEW.md`, `.agents/docs/SCHEMA.md`) are in place.
- Legacy notes moved to `.agents/.archive/docs/notes/`.
- Tests run clean with Vitest (`bun run --filter @rulesets/core test`).

## ⚙️ Still Outstanding

### Decision 3 – Front Matter & Config
- [ ] Update any remaining docs/samples that mention `.ruleset/config.toml` or “destination” terminology (e.g., configuration guide, snippets inside tests).

### Decision 4 – CLI & Presets
- [ ] Document the disabled `sync` command in docs/CLI help so users know it is deferred.

### Decision 5 – Documentation Rewrite
- [ ] Archive or update legacy files under `/docs/` that still reference the old `docs/plugins/...` paths (e.g., archived overview).
- [ ] Add an entry to `MIGRATION.md` covering the destination→provider rename and CLI surface changes.

### Decision 6 & 7 – Follow-up Notes
- [ ] Ensure `DECISIONS.md` follow-up sections only contain actionable items (no placeholder bullets).
- [ ] Provide a short API reference in `/docs/` pointing to the exported helpers from `@rulesets/core`.

### Decision 8 – Provider Packages & Shared Deps
- [ ] Move provider implementations out of `packages/core/src/destinations/` into dedicated packages (`packages/provider-<name>`).
- [ ] Introduce `type-fest` and `pino` to the workspace and adopt them for shared types/logging.
- [ ] Update release/changeset tooling to recognise the renamed packages once they exist.

### Tests & Tooling
- [ ] Run `bun run check` (or the replacement for `lint`) and resolve formatting/complexity diagnostics. Large portions of the repo still use older formatting conventions.

### Documentation Cross-links
- [ ] Link the new `.agents/docs/OVERVIEW.md` and `.agents/docs/SCHEMA.md` from `docs/index.md` once the latter is rebuilt.
- [ ] Verify the new starter partials (`.ruleset/partials/welcome.md`, `footer.md`) are mentioned in Quick Start/Configuration docs.

## Notes
- Provider package refactors and logging/type utility adoption are the biggest remaining tasks—they may be deferred if we explicitly document them in `DECISIONS.md` as post-v0.2.0 work.
- When tackling lint upgrades, expect `biome.jsonc` to need a schema bump (2.2.2 → 2.2.4).

Log progress in `SCRATCHPAD.md` as you go.
