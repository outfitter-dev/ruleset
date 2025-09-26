# AGENT SCRATCHPAD

Tracking work toward the Rulesets v0.4.0 rewrite.

## Questions

### Open Questions

<!-- Add open questions as list items -->

### Answered Questions

- Release ships when it7s truly excellent; no fixed target date.
- Primary CLI command is `rules` with `rulesets` alias.
- Branch prefix: `gt-v0.4/rewrite/*` (begin from a single shared branch, split with `gt split` later).
- Registry integrations are out of scope for v0.4.
- Persistent cache lives under `.ruleset/cache` (garbage collect as needed).
- Provider execution defaults to Bun-based isolation with strict helper sandboxing.
- Runtime baseline: latest Bun, latest stable Node.
- Config can be edited via files or CLI overrides; persist history in global `.ruleset/history.json`.

## Decisions (quick reference)

- Keep project rules under `.ruleset/` by default; support `.agents/ruleset/` via config.
- Use Bun for package management and build tooling wherever possible.
- Enforce strict TS/format/lint checks in pre-commit and pre-push hooks.
- Watch mode prioritises correctness; efficiency toggles configurable.
- Opt-in diagnostics for telemetry (OpenTelemetry with clear guidance and easy disable).

## Todo Overview

- [x] Establish `gt-v0.4/rewrite` base branch and restack current work onto it.
- [x] Draft initial v0.4 implementation plan in `PLAN.md`.
- [x] Document the rewrite blueprint in `REFACTOR.md`.
- [ ] Update AGENTS.md references to point at new artifacts.
- [x] Prepare pre-commit/pre-push hook updates for stricter checks.
- [x] Align package versions + Changesets config to `0.4.0-next` prerelease.
- [x] Refresh CI scaffolding with Linux/macOS matrix + staged Windows smoke run.
- [x] Lay out initial v0.4 package skeletons (`types`, `parser`, `validator`, `transform`, `renderer`, `providers`, `orchestrator`, `lib`).
- [x] Migrate CLI compile surface to `@rulesets/lib` adapter; legacy APIs re-exported via lib bridge.
- [x] Stabilize cross-package typecheck after switching to Bun bundler (typecheck now builds packages first).

## Notes

### 2025-09-24

- Created fresh scratchpad for the v0.4 rewrite effort and archived the v0.2.0 notes.
- Confirmed `gt-v0.4/rewrite` tracks latest `main`; branch hygiene: daily `gt sync`, short-lived feature branches using prefix `gt-v0.4/rewrite/*`, squash merge via queue.
- Updated workspace versions to `0.4.0-next.0` and entered Changesets `next` pre-release mode (`.changeset/pre.json`).
- Replaced CI workflow with multi-platform matrix (Linux/macOS) and optional Windows smoke job; `setup-bun-and-deps` composite now runs typecheck.
- Lefthook now runs format, Biome lint, lint/typecheck/test/build gating; new package skeletons compiled via project references.
- Workspace typecheck now shells through `bun run build:libs` before invoking `tsc --noEmit`.
- CLI now imports build/runtime helpers from `@rulesets/lib`; lib re-exports bridged legacy APIs.
- Adopted Bun-native bundling only for the CLI; library packages now compile via `tsc` (`build:libs` emits declarations before typecheck).
- Added `build:binary` (CLI) / root `build:binary` scripts to produce a compiled CLI artifact on demand.
- Added ambient typings in `packages/lib/src/types/rulesets-core.d.ts` so the lib bridge re-exports existing core functionality without bundling.

### 2025-09-25

- Phase 1 foundations complete; shifting focus to PLAN §2 Monorepo Structure & Tooling.
- Confirmed PLAN.md checklist updated to reflect completed groundwork; next tasks scoped around package layout + Bun tooling.
- Migrated CLI workspace from `packages/cli` to `apps/cli`; updated workspace config, TypeScript paths, and test harness after verifying builds.
- Ported parser + schema validation into `@rulesets/parser`, rewired orchestrator/core to consume new package, and added comprehensive tests.
- Removed legacy tsup configs in favour of Bun builds; `build:libs` now builds parser before core.
- Refreshed `AGENTS.md` to call out the new `apps/cli` location, layered packages, and updated CI commands; confirmed Lefthook still runs lint/build/type/test gates.
- Ported legacy frontmatter validation into `@rulesets/validator`, added coverage, and wired Orchestrator/Core to consume the new diagnostics pipeline.
- Moved provider utilities into `@rulesets/providers`, updated CLI providers to use the shared SDK hooks, and added provider-level tests.
- Centralized Biome configuration at the repo root, removed the stale `.conductor` snapshot (now gitignored), and confirmed `bun run lint` surfaces real lint issues instead of config churn.
- Added `syncpack` dependency checks to the shared tooling (root config + pre-push hook) so workspace version drift is caught automatically.
- Ran Biome autofixes across the new packages (`apps/cli`, `packages/{parser,providers,renderer,transform,types,validator,lib,orchestrator}`), layered targeted overrides for legacy complexity/naming cases, and left `packages/core` excluded while the old implementation is phased out.
- Replaced the CLI `compile` implementation with an orchestrator-based stub that feeds the new packages (parser → validator → orchestrator) and writes artifacts directly. Watch mode & the full provider set are intentionally deferred; compile smoke tests are skipped until the new pipeline is feature-complete.
- Brought `apps/cli` files into Biome compliance (imports, double quotes, complexity helpers). Legacy packages still trip lint—captured that follow-up is needed once those directories are refactored out of the stack.
- Iterated on the new orchestrator-backed `compile` command: default provider set now comes from `@rulesets/providers`, unknown provider IDs surface warnings, and artifact writers honor provider-derived paths.
- Raised the TypeScript baseline to ES2022 so we can rely on `Object.hasOwn`, then updated parser/core/validator helpers to use it without lint suppressions.
- Normalized provider stubs (`packages/providers`) to satisfy centralized lint rules (regex constants, import ordering) and kept controlled barrel exports with targeted suppressions.
- `bun run lint` and `bun run typecheck` both green post-refactor; pending follow-ups remain to port real providers and re-enable skipped CLI compile smoke tests once the new pipeline is feature-complete.
- Updated PLAN §2 checkboxes to reflect completed package layout + Lefthook enforcement.
- Researching Bun workspaces + catalogs and Syncpack enforcement to centralize dependency metadata at the repo root before tackling PLAN §3 schema work.
- Landed shared config/frontmatter/provider types + Zod schemas in `@rulesets/types`, exporting JSON Schema artifacts for downstream tooling.
- Validator now consumes the shared frontmatter schema, mapping Zod issue paths into CLI-friendly diagnostics and keeping legacy rule metadata warnings intact.
- Parser now hydrates frontmatter metadata via the shared schema and surfaces schema issues as parse diagnostics so downstream packages receive typed documents by default.
- Project config loader (`packages/core`) validates against `RulesetProjectConfig`, applies defaults, and bubbles friendly errors that reference `https://ruleset.md/schema/project-config.json`; CLI compile now loads this typed config and honours multi-source lists/globs while skipping missing directories.
- CLI compile respects config-driven sources using the new loader while keeping explicit `--provider`/source workflows intact; missing source directories fall back gracefully instead of hard failing.
- JSON Schema exports in `@rulesets/types` now carry stable `$id` fields under `https://ruleset.md/schema/*` plus helper metadata for future publication.
- Shipped versioned capability registry + result primitives in `@rulesets/types`, updated provider SDK to consume descriptors, refreshed CLI stubs to advertise markdown/filesystem/diagnostics support, and added focused tests; lint/typecheck scripts run clean post-update.
- Orchestrator enforces compile target capability requirements, returning structured diagnostics when providers lack declarations; added Bun tests to cover success/failure paths.
- Provider SDK now embeds SDK version + sandbox descriptors in handshakes, with compatibility checks feeding orchestrator skip diagnostics for mismatched providers; CLI/watch flows surface the new `incompatible-provider` skip reason.
- Implemented Bun subprocess sandbox execution path: orchestrator serializes compile inputs, spawns provider entry scripts via `bun`, and treats failures as structured diagnostics; added tests covering sandbox success and compatibility skips.
- Added provider/project config flag `failOnMissingCapabilities` so teams can escalate missing capabilities from skip diagnostics to hard failures; orchestrator now throws when the flag is set, and tests cover the new behaviour.
- Fixed CLI regression where running `rulesets compile` without explicit sources ignored the default `./.ruleset/rules` directory when config sources were unset; the command now falls back to the CLI default path while still honoring configured sources.
- Added Bun-based smoke tests for `@rulesets/transform`, `@rulesets/renderer`, and `@rulesets/lib` so the workspace `bun run test` gate passes without "No tests found" failures; ensured lib tests use a provider capability declaration that satisfies the orchestrator negotiation.

### 2025-09-26

- Refactored `@rulesets/orchestrator` to expose an async streaming pipeline (`createOrchestratorStream`) that emits Source→Parse→Validate→Transform→Render→Provider events while compiling; `createOrchestrator` now aggregates those events and accepts an `onEvent` hook for realtime consumers.
- Introduced renderer integration before provider execution and forwarded render artifacts via the provider compile input so providers can reuse rendered output; default providers now honor rendered diagnostics/content.
- Extended provider compile contracts with optional `rendered` artifacts and updated first-party providers/noop provider to respect renderer results.
- Added orchestrator unit coverage asserting event emission order and capability handling; CLI compile continues to call the orchestrator (now streaming under the hood) without API changes.
- Implemented persistent cache support under `.ruleset/cache` with content hashing, target reuse, and a new `target:cached` event; cache writes gracefully degrade on read-only paths, and orchestrator tests cover cache hits.
- Next watch-mode iteration: cache metadata already stores per-source hashes and target artifacts. For incremental watch we'll add dependency tracking (imports/partials) once the transform layer exposes it, but first pass will focus on direct source changes + cache reuse. Plan: orchestrator exposes `watchRulesets` helper emitting compile events per filesystem change; CLI consumes it to drive `--watch` mode with chokidar/fs.watch. Cache entries will be updated per change; invalidation simply drops touched source keys and recomputes downstream targets (full dependency graph to follow).
- Added CLI `--watch` support that reuses the orchestrator cache: file system changes call back into `compileRulesets`, emit streaming events, and only the touched sources recompile. Watchers rely on `fs.watch` across discovered directories plus config parents, debounce events, and honor Ctrl+C cleanup.
- Surfaced streaming events in `@rulesets/lib` via `compileStream`/`createCompiler().stream` helpers and wired the CLI compile command into the async iterable pipeline; CLI now updates spinners/logs per stage and emits structured JSON progress events (tests updated accordingly).
- Extended watch mode dependency coverage: CLI now watches partial/template directories, invalidates the orchestration cache when those assets change, and added utilities/tests for dependency path tracking so partial edits trigger recompilation.
- Resolved partial dependency identifiers to concrete filesystem paths, threaded them through the orchestrator cache + CLI invalidation flow, and added tests proving cache reuse skips/invalidates correctly. Ready to plug in richer transform metadata once available.
- Parser/transform emit partial dependency metadata, orchestrator persists normalized dependency paths, and new `watchRulesets` helper centralizes watch orchestration so the CLI just supplies its loader/executor.
- Landed the first real Handlebars renderer pass: renderer now pre-renders documents, loads partials from `.ruleset/partials` + config overrides, registers project/provider helper modules, and hands rendered artifacts to providers with strict diagnostics. Added focused renderer/orchestrator tests covering partials, helpers, and template context.
- Expanded rendering pipeline with Markdown passthrough + XML emission: renderer can convert compiled Markdown into `<ruleset>` XML with section tags, orchestrator threads provider `format` preferences from project/frontmatter, enforces the `output:sections` capability, and first-party providers advertise support. Added Bun tests proving XML outputs and capability negotiation behave as expected.
- Introduced renderer format registry (`registerRendererFormat`/`unregisterRendererFormat`) with per-render overrides, enabling future JSON/YAML emitters without touching core.
- Updated `RendererOptions` to accept custom format descriptors and added tests for registry usage, inline overrides, and missing format diagnostics; PLAN §6 extension hook now complete.
- Ported Cursor, Claude Code, and Copilot providers onto the new @rulesets/providers SDK with shared filesystem helpers; default provider list now instantiates the real implementations instead of Markdown stubs.
- Added provider-specific tests covering output path resolution and config overrides; lint/typecheck/test suite updated to include the new coverage.
- Ported Windsurf and Codex providers onto the shared filesystem helper, adding XML-aware format negotiation and codex diagnostics for shared agents hints; helper now drives Cursor/Claude/Copilot too for DRY reuse.
- Added first-party provider tests covering Windsurf XML outputs and Codex override/diagnostic behaviour.
