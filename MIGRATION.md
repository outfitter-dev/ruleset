# MIGRATION.md

We need to make sure everything that was in `../rulesets-old` that was more recent work (since August 1, 2025) is migrated into this project. Check all branches that are both local and remote.

NOTE: This is a **STUB** working document. Keep it updated and accurate as we progress. Once you feel confident in the plan, you can remove this "stub" notice.

## PLAN

All of this work is to be done under a single branch off main called `gt-v0.3/rulesets-release`. Once we have completed the migration, we will split the branch into as many feature branches as needed using `gt split -h` (by hunk). Each feature branch will use the prefix `gt-v0.3/` and each must be able to be green in CI, so consider how changes should be made and which branch to parent from.

- ✅ Default project config now lives at `.ruleset/config.yaml` (JSON/JSONC/TOML still supported when explicitly provided).
- ✅ `rulesets compile` now respects `sources` from project config when the CLI source argument is omitted.
- ✅ Project-level `rule.globs` are honoured by the CLI so only matching files are compiled.
- 🔄 Pending: README/CLI docs still reference legacy workflow; update once documentation rewrite lands.
- 🔄 Pending: Provider packages beyond `provider-cursor` still live inside `@rulesets/core`; migrate them before GA.

## Legacy Repository Audit (2025-09-19)

### Branches inspected

- `origin/stack-v0.1refactor_remove_all_comment_markers_and_greppable_references` – post-August 1 clean-up (Bun migration, Ultracite compliance, removal of GREPABLE markers). Terminology unchanged; still references Mixdown, `.mixdown`, and plugin phrasing.
- `origin/feature/consolidate-all-prs` – aggregates extensive agent-facing documentation and Handlebars demo rules (`.agent/examples/handlebars-phase*.rule.md`). Terminology mirrors Mixdown-era naming; good historical context.
- `origin/feature/parallel-provider-compilation` – introduces the Handlebars compiler (`packages/core/src/compiler/handlebars-compiler.ts`) with template caching and provider consolidation. Comments mention Rulesets/providers, but code/tests still reference Mixdown markers and `.mixdown` paths.
- `origin/main` – baseline Mixdown-centric branch for comparison.

### Top-level structure snapshot (`../rulesets-old`)

| Path | Summary | Terminology status | Migration recommendation |
| --- | --- | --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Project-level tooling guides. | AGENTS now reflects Rulesets terminology; CLAUDE still pending rewrite for deprecation plan. | Keep AGENTS synced; CLAUDE can remain archived until a new destination doc replaces it. |
| `.agents/` | Logs, prompts, plans, Handlebars proposals, daily recaps. | Mixdown-centric but contains valuable historical research. | Cherry-pick only still-relevant process docs (e.g., Handlebars adoption notes). |
| `.cursor/`, `.windsurf/`, `.claude/` | Generated rules from legacy builds. | Mixdown naming/paths. | Treat as artifacts; regenerate via new compiler. |
| `docs/` | Architecture, overview, plugin docs. | Mixdown, "destination plugin", "stem" language pervasive. | Migrate content conceptually but re-author with updated vocabulary and `.ruleset` paths. |
| `my-rules.rule.md` | Example source rules file demonstrating the format. | Uses `.rule.md` extension and Rulesets terminology. | Keep updated alongside CLI examples. |
| `packages/core/` | Core TypeScript implementation; Handlebars compiler added in feature branch. | Core/tests now use Rulesets terminology; Handlebars compiler is available but still needs deeper integration with destination providers. | Port selectively, renaming legacy concepts to Rulesets as part of migration. |
| `package.json`, `bun.lock`, configs | Workspace tooling. | Current branch fully references Rulesets packages. | Use as reference; re-seed configs in new repo. |
| `.changeset/` | Legacy changeset config. | Targets Mixdown packages. | Start fresh alongside new release flow. |

### Terminology spot-check

- `rg "Mixdown" ../rulesets-old` returns >150 hits (e.g., `docs/project/ARCHITECTURE.md`, `docs/project/LANGUAGE.md`, `packages/core/tests/integration/e2e.spec.ts`).
- `.mixdown` path references remain standard in documentation (`AGENTS.md`, `docs/project/ARCHITECTURE.md`); `.ruleset` directories do not exist in inspected history.
- CLI still warns "No plugin found for destination" (`apps/cli/src/commands/compile.ts`); provider naming not yet backported.
- Music metaphors ("stem", "track") were present in legacy docs; the active codebase now uses "section" everywhere.

### Migration implications

1. **Terminology work is outstanding.** Renaming Mixdown → Rulesets, plugin → provider, and replacing music metaphors must happen in this repo; legacy branches offer no ready-made replacements.
2. **Handlebars compiler ported.** Implementation now lives in the new repository; remaining work is hooking providers into it and migrating advanced helpers from the legacy branch.
3. **Historical docs need triage.** Decide which `.agents` materials are worth porting (e.g., Handlebars adoption proposal) versus leaving archived.
4. **Sample files require extension updates.** ✅ `.rule.md` samples now live in the repository; regenerate any remaining `.mix.md` references during migration cleanup.
5. **Legacy docs archived.** Archived historical docs now live under `.agents/notes/.archive/`; active guidance is tracked in `.agents/docs/` and `.agents/docs/notes/`.

### Phase 1

- [ ] Read through all files in the old project, and detail their contents and status in this document, along with a brief explanation of why they should or should not be migrated to the new project.
- [ ] Ensure all mentions of "mixdown" and related (from @SCRATCHPAD.md) have been updated.

### Phase 2

- [ ] Begin the migration work of the old project into the new project following the [migration notes](#migration-notes) below.

## Migration Notes

- Replace legacy `{{section-name}}` blocks with Markdown headings before compiling.
  - Promote the section name to a heading (e.g., `{{instructions}}` → `## Instructions`).
  - Move any properties into frontmatter (`rule.*`) or provider overrides as needed.
  - If reuse is required, extract content into partials under `.ruleset/partials/` and reference them via Handlebars.
- Convert `destinations.include` usage to per-provider flags.
  - For each destination ID in `destinations.include`, add `<provider>.enabled: true` and move overrides under that provider key.
  - Remove the legacy `destinations` block once provider keys are in place.
