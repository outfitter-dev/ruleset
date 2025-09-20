# AGENT SCRATCHPAD

We will use this document to brainstorm and track our work, to try to get to Rulesets v0.3.0 quickly, which will be the initial release of the project.

## Questions

### Open Questions

<!-- Add your open questions here as list items, use sublist items for details -->

### Answered Questions

<!-- The user will answer questions and place the answers here -->

## Decisions
- Canonical runtime is Bun; ship the CLI/binary atop Bun-going-forward.
- Source rules live in `.ruleset/rules/` using the `.rule.md` extension (legacy `.ruleset.md` remains readable).
- Compiled output is written to `.ruleset/dist/`.
- Project configuration defaults to `.ruleset/config.toml`, but JSON, JSONC, and YAML variants must be supported.
- Global installs should default to XDG paths (e.g., `~/.config/ruleset/`), with OS-specific fallbacks.
- Avoid scattering rules outside `.ruleset/rules/`; this keeps agents from auto-loading project rules.

## Todo

Pay close attention to the @MIGRATION.md document.

### Open

- [ ] Remove all instances of "Mixdown", "mixd", etc. from the codebase
  - NOTE: We previously worked on this, and the results are in the `../rulesets-old` directory under the branches `feature/consolidate-all-prs` and `stack-v0.1refactor_remove_all_comment_markers_and_greppable_references`
- [ ] Update all documentation and code to use the new project name "Rulesets"
- [ ] Update all documentation and code to use the term "ruleset" (not to be confused with "Rulesets", the project name)
- [ ] Migrate the handlebars work from the `../rulesets-old` directory to the new project (it may be in a different branch)
- [ ] Consider any work that was done after August 1, 2025 in the `../rulesets-old` directory, and decide if it should be migrated to the new project. If it should be migrated, migrate it. If it should not be migrated, explain why.
- [ ] Update the CHANGELOG.md to remove all previous things and bring it into "keep a changelog" format
  - [ ] We will also need to clean out the Changeset.
- [ ] Ensure all "plugin" mentions are updated to "provider" (it's ok to refer to the provider plugins as "provider plugins")
- [ ] We must remove all music-related terminology, e.g. "track", "stem", etc. from the codebase and documentation. If you're trying to decide on a term, ask the user for guidance.

### Closed

<!-- Move closed items here after completion and append with `[Closed: YYYY-MM-DD hh:mm] -->

- [x] Audit @AGENTS.md to make sure that it's current and accurate. Make any changes necessary. You are using this to guide your work, and is the primary context provided to you and other agents. It's CRITICAL this is accurate. [Closed: 2025-09-19 16:05]

## Notes

### 2025-09-20

#### 2025-09-20 at 09:05

- Reviewed 2025-09-19 handoff log to sync on repository state.
- Confirmed `.ruleset/` layout, section terminology, Handlebars compiler opt-in, and XDG config defaults already landed.
- Pending focus areas: provider integrations to consume section-aware AST + Handlebars helpers, migration of legacy helpers/partials, packaging Bun binary, archive cleanup, and final sweep for `mixdown`/`mixd` references.
- Ready to tackle pending items starting with provider integrations unless redirected.

#### 2025-09-20 at 13:45

- Added compile-time Handlebars options so destinations can force templated rendering, inject helpers, and supply partials per run.
- Extended Handlebars compiler to register global + per-run helpers/partials and expose AST in template context for section-aware helpers.
- Implemented `CursorProvider.prepareCompilation` to surface cursor-specific helpers, inline partials from frontmatter, and optional force flag for Handlebars.
- Added cursor provider tests covering helper/partial usage and Handlebars forcing; updated compiler tests for new options.
- `bun run --filter @rulesets/core test` now passes with new coverage.

#### 2025-09-20 at 15:02

- Extended all destination providers with `prepareCompilation` so each can opt into Handlebars overrides derived from frontmatter or future hooks.
- Added shared utilities for parsing destination config Handlebars opts and loading project/global partials (supports `.ruleset/partials/`, `.config/ruleset/partials/`, and `@`-prefixed rule files with precedence).
- Wired partial discovery into the compile pipeline; provider-supplied partials now layer on top without losing shared ones.
- Added integration test exercising partial discovery plus `RULESETS_HOME` override to prove ordering.
- Tests: `bun run --filter @rulesets/core test`.

#### 2025-09-20 at 15:45

- Removed cursor-specific Handlebars helpers so all destinations share a uniform `prepareCompilation` path.
- Dropped section-consumption helpers/context from Handlebars runtime to encourage partial-driven reuse exclusively.
- Updated provider tests to rely on partials and frontmatter data instead of bespoke helpers.
- Confirmed compilation + partial discovery still green via `bun run --filter @rulesets/core test`.

#### 2025-09-20 at 16:20

- Documented partial discovery order and Handlebars workflow in `README.md` and `packages/core/README.md`.
- Updated `AGENTS.md` and `docs/rules-overview.md` to steer contributors toward partials instead of section-level imports.
- No additional runtime changes; docs-only update.

#### 2025-09-20 at 17:05

- Renamed destination "plugins" to "providers" across core interfaces, implementation classes, and tests to match project terminology.
- Updated provider instantiation/export map, logging metadata, and re-exports; refreshed README examples accordingly.
- Verified provider test suite via `bun run --filter @rulesets/core test`.

#### 2025-09-20 at 18:30

- Addressed PR feedback from Claude on partials support implementation:
  - Optimized file extension checking by converting array to Set for O(1) lookups
  - Added stricter TypeScript typing with HandlebarsConfigShape interface
  - Enhanced security violation logging with detailed context (path attempts, reasons, depth)
  - Created comprehensive security test suite covering symlink traversal, directory escaping, resource limits
  - Fixed all linting issues including import sorting, magic numbers, empty blocks
  - Extracted regex patterns to module constants for better performance
- All tests passing after improvements (`bun run --filter @rulesets/core test`)

#### 2025-09-21 at 10:05

- Hardened Handlebars compiler defaults (strict mode enabled, escaping enforced) with optional overrides and centralized body extraction via `utils/frontmatter.ts`.
- Enhanced error logging to include source + destination context and added tests covering escaping, strict-mode failures, and relaxed configuration; validated with `bun run --filter @rulesets/core test`.

#### 2025-09-21 at 10:40

- Tightened provider preparation utilities: added typed Handlebars option builder, validated partial inputs, and improved Cursor provider error handling.
- Added documentation nudge on Handlebars safety plus new tests for destination utils and `CursorProvider.prepareCompilation`; confirmed with `bun run --filter @rulesets/core test`.

#### 2025-09-21 at 10:55

- Hardened CLI compile workflow: safer filename normalization (fallback to `index.md`) and richer error aggregation with per-file context.
- Ran `bun run --filter @rulesets/cli test` (fails presently because the dist build is missing); core compile logic verified manually through targeted execution paths.

#### 2025-09-21 at 11:10

- Finished documentation sweep for terminology: updated `AGENTS.md`, `docs/architecture/DECISIONS.md`, provider template, and changelog to remove Mixdown references and highlight `.agents/docs/` as the authoritative source.

#### 2025-09-21 at 11:25

- Updated CI workflows to run the full Bun toolchain (lint, typecheck, coverage) without allowing silent failures; documented Bun-first local development steps in the README.

#### 2025-09-21 at 11:35

- Clarified documentation sources in `AGENTS.md` and removed the lingering music-metaphor note from `.agents/docs/language.md` per doc-reorg review feedback.

#### 2025-09-21 at 12:05

- Fixed CLI smoke tests by standardising on the Bun runtime: updated the CLI shebang, removed the redundant tsup banner, and adjusted the test harness to invoke the compiled binary via `process.execPath`; `bun run --filter @rulesets/cli test` now passes.
- End-to-end validation: `bun run lint`, `bun run typecheck`, `bun run test --coverage`, and `bun run build` all succeed on the top of stack; verified `./packages/cli/dist/index.js --help` and `--version` execute successfully.

### 2025-09-19

#### 2025-09-19 at 15:16

- Reviewed AGENTS.md, MIGRATION.md, and LANGUAGE.md to catalog legacy Mixdown/music terminology and plan updates.
- Ran ripgrep to locate legacy terms: Mixdown/mixdown across AGENTS and docs; plugin references in docs/core code; music metaphors (stem/track) prevalent across LANGUAGE spec and overview.
- Earlier plan: adopt `.ruleset` paths, rename Mixdown → Rulesets throughout, shift “plugins” → “providers”, and seek guidance on replacing music terminology.
- Surveyed ../rulesets-old git branches; handlebars implementation lives on origin/feature/parallel-provider-compilation with Handlebars compiler and template caching (e.g., packages/core/src/compiler/handlebars-compiler.ts).
- Branches after 2025-08-01: stack-v0.1refactor_remove_all_comment_markers_and_greppable_references (cleanup + Bun), feature/consolidate-all-prs (agent docs + handlebars demos), feature/parallel-provider-compilation (handles provider consolidation + Handlebars compiler); need prioritization for migration.
- Documented legacy repository audit in MIGRATION.md (branches inspected, directory status, terminology observations).
- Updated AGENTS.md to replace Mixdown terminology with Rulesets vocabulary, rename sections, and swap provider wording.
- Updated terminology docs (now mirrored in `.agents/docs/`) and docs/index.md to adopt Rulesets vocabulary (sections/providers, `.ruleset` paths).
- Assessed code references: mixdown version markers remain in core/compiler tests and CLI comments (mixd-v0); will scope updates with code migration.
- Relocated legacy docs (ex-`docs/project/`) into `.agents/docs/` for active use and archived the remainder under `.agents/notes/.archive/`.
- Migrated key legacy notes (terminology update, markdown lint, AI rules guide, compiler patterns, prompt workflow) into `.agents/docs/notes/` with Rulesets terminology.
- Archived remaining legacy project notes into `.agents/notes/.archive/` and removed `legacy/` stash.
- Remaining action items: replace `mixdown`/`mixd-*` markers in tests and CLI, migrate Handlebars compiler from legacy branch, tidy .agents archives once migration is complete.
- Ran `bun run test` to validate CLI and core updates.
- Adopted `.rule.md` as canonical source extension, defaulting CLI to ./.ruleset/rules and writing config to `.ruleset/config.toml`; updated init/compile flows and global config defaults accordingly.
- Renamed AST terminology (sections/imports/variables) and added a Handlebars compiler with minimal helpers; all tests passing.
- Renamed AST to sections and integrated optional Handlebars compiler pathway (front matter `rulesets.compiler: handlebars`).
- Updated global configuration to use XDG directories and TOML by default (with OS fallbacks).
